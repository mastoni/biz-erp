import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/cart/domain/cart.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';

class PosController extends ChangeNotifier {
  final ProductRepository _productRepo;
  final CartRepository _cartRepo;
  final SaleCalculationEngine _calcEngine;
  final CheckoutService _checkoutService;

  final PrintingService _printingService;
  PrintingService get printingService => _printingService;

  ReceiptData? _lastReceiptData;
  ReceiptData? get lastReceiptData => _lastReceiptData;

  List<Product> _products = [];
  CartWithItems? _currentCart;
  SaleCalculationResult? _calculation;
  CalcDiscount _currentDiscount = const CalcDiscount.none();

  bool _isLoading = false;
  String? _errorMessage;
  CheckoutResult? _lastReceipt;

  // Idempotency: Generated per checkout operation, reset on success or cart change
  String? _pendingIdempotencyKey;
  static const _uuid = Uuid();

  PosController({
    required this._productRepo,
    required this._cartRepo,
    required this._calcEngine,
    required this._checkoutService,
    required this._printingService,
  });

  // Getters
  List<Product> get products => _products;
  CartWithItems? get currentCart => _currentCart;
  SaleCalculationResult? get calculation => _calculation;
  CalcDiscount get currentDiscount => _currentDiscount;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  CheckoutResult? get lastReceipt => _lastReceipt;
  bool get canCheckout =>
      _currentCart != null && _currentCart!.items.isNotEmpty && !_isLoading;

  Future<void> init() async {
    _products = await _productRepo.listActiveProducts(DemoContext.businessId);
    await _refreshCart();
  }

  Future<void> _refreshCart() async {
    final cart = await _cartRepo.getOrCreateActiveCart(DemoContext.businessId);
    _currentCart = await _cartRepo.getCartWithItems(
      cart.id,
      DemoContext.businessId,
    );
    _recalculate();
    _pendingIdempotencyKey = null; // Reset intent when cart changes
    notifyListeners();
  }

  void _recalculate() {
    if (_currentCart == null || _currentCart!.items.isEmpty) {
      _calculation = null;
      return;
    }
    try {
      _calculation = _calcEngine.calculate(
        items: _currentCart!.items
            .map(
              (i) => CalcCartItem(
                quantity: i.quantity,
                unitPriceMinor: i.unitPriceMinor,
              ),
            )
            .toList(),
        discount: _currentDiscount,
        taxRateBps: DemoContext.taxRateBps,
      );
      _errorMessage = null;
    } catch (e) {
      _calculation = null;
      _errorMessage = e.toString();
    }
  }

  void toggleMemberDiscount() {
    if (_currentDiscount.type == DiscountType.none) {
      _currentDiscount = const CalcDiscount(
        type: DiscountType.percentageBps,
        value: 1000,
      ); // 10%
    } else {
      _currentDiscount = const CalcDiscount.none();
    }
    _recalculate();
    notifyListeners();
  }

  Future<void> addToCart(String productId) async {
    if (_currentCart == null) return;
    try {
      await _cartRepo.addItem(
        _currentCart!.cart.id,
        DemoContext.businessId,
        productId,
        1,
      );
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> updateQty(String itemId, int newQty) async {
    if (newQty < 1) return removeItem(itemId);
    try {
      await _cartRepo.updateItemQuantity(
        itemId,
        DemoContext.businessId,
        newQty,
      );
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> removeItem(String itemId) async {
    try {
      await _cartRepo.removeItem(itemId, DemoContext.businessId);
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<bool> performCheckout(PaymentMethod method, int cashReceived) async {
    if (!canCheckout || _currentCart == null) return false;

    // Generate key if not exists (retry scenario)
    _pendingIdempotencyKey ??= _uuid.v4();

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final req = CheckoutRequest(
        businessId: DemoContext.businessId,
        branchId: DemoContext.branchId,
        cashierId: DemoContext.cashierId,
        deviceId: DemoContext.deviceId,
        idempotencyKey: _pendingIdempotencyKey!,
        cartId: _currentCart!.cart.id,
        discount: _currentDiscount,
        taxRateBps: DemoContext.taxRateBps,
        paymentMethod: method,
        cashReceivedMinor: cashReceived,
      );

      final result = await _checkoutService.checkout(req);

      // SUCCESS
      _lastReceipt = result;
      _lastReceiptData = _buildReceiptData(result);
      _pendingIdempotencyKey = null; // Reset for next sale
      _isLoading = false;
      notifyListeners();

      // Fetch NEW active cart (Cart A becomes CHECKED_OUT, Cart B becomes ACTIVE)
      await _refreshCart();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Snapshot struk dari data transaksi yang sudah COMMIT.
  /// Harga/qty dari cart snapshot (identik sale_items_local),
  /// total dari hasil kalkulasi (identik sales_local).
  ReceiptData? _buildReceiptData(CheckoutResult result) {
    final calc = _calculation;
    final cart = _currentCart;
    if (calc == null || cart == null) return null;

    final items = cart.items
        .map(
          (item) => ReceiptItemData(
            productId: item.productId,
            displayName: _resolveProductName(item.productId),
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
          ),
        )
        .toList();

    return ReceiptData(
      receiptNumber: result.receiptNumber,
      businessName: DemoContext.businessName,
      branchName: DemoContext.branchName,
      cashierId: DemoContext.cashierId,
      createdAtEpochMs: DateTime.now().millisecondsSinceEpoch,
      subtotalMinor: calc.subtotalMinor,
      discountMinor: calc.discountMinor,
      taxMinor: calc.taxMinor,
      totalMinor: result.grandTotalMinor,
      cashReceivedMinor: result.grandTotalMinor + result.changeMinor,
      changeMinor: result.changeMinor,
      items: items,
    );
  }

  /// Nama hanya untuk display; fallback jika produk hilang/berubah.
  String _resolveProductName(String productId) {
    final prod = _products.where((p) => p.id == productId).firstOrNull;
    if (prod != null) return prod.name;
    final short = productId.replaceAll('-', '').substring(0, 6).toUpperCase();
    return 'ITEM-$short';
  }
}
