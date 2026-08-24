import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
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
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';

import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';

class PosController extends ChangeNotifier {
  final ProductRepository _productRepo;
  final CartRepository _cartRepo;
  final SaleCalculationEngine _calcEngine;
  final CheckoutService _checkoutService;
  final CustomerRepository _customerRepo;
  final BranchRepository _branchRepo;

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
  String? _selectedCustomerId;
  String? _selectedCustomerName;
  List<Customer> _customers = [];

  // Idempotency: Generated per checkout operation, reset on success or cart change
  String? _pendingIdempotencyKey;
  static const _uuid = Uuid();

  final String _businessId;
  String _branchId;

  // Constants
  final String _cashierId = 'CASHIER-001';
  final String _deviceId = 'DEVICE-001';
  final int _taxRateBps = 1100; // 11% Tax
  final String _businessName = 'WARUNG DEMO BIZERP';
  String _branchName = 'CABANG UTAMA';

  PosController({
    required this._businessId,
    required String branchId,
    required this._branchRepo,
    required this._productRepo,
    required this._cartRepo,
    required this._calcEngine,
    required this._checkoutService,
    required this._printingService,
    required this._customerRepo,
  }) : _branchId = branchId;

  // Getters
  List<Product> get products => _products;
  List<Customer> get customers => _customers;
  CartWithItems? get currentCart => _currentCart;
  SaleCalculationResult? get calculation => _calculation;
  CalcDiscount get currentDiscount => _currentDiscount;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  CheckoutResult? get lastReceipt => _lastReceipt;
  String? get selectedCustomerId => _selectedCustomerId;
  String? get selectedCustomerName => _selectedCustomerName;
  String get branchId => _branchId;
  String get branchName => _branchName;
  String get businessId => _businessId;
  String get cashierId => _cashierId;
  String get deviceId => _deviceId;
  int get taxRateBps => _taxRateBps;
  bool get canCheckout =>
      _currentCart != null && _currentCart!.items.isNotEmpty && !_isLoading;

  Future<void> init() async {
    _products = await _productRepo.listActiveProducts(_businessId);
    _customers = await _customerRepo.listActiveCustomers(_businessId);
    await _loadBranchName();
    await _refreshCart();
  }

  Future<void> _loadBranchName() async {
    final branches = await _branchRepo.getCachedBranches(_businessId);
    final branch = branches.where((b) => b.id == _branchId).firstOrNull;
    if (branch != null) {
      _branchName = branch.name;
    }
    notifyListeners();
  }

  Future<void> changeBranch(String newBranchId) async {
    if (newBranchId == _branchId) return;
    
    _branchId = newBranchId;
    await _branchRepo.setActiveBranch(_businessId, newBranchId);
    await _loadBranchName();
    await _refreshCart(); // Refresh cart (receipt sequence is branch-scoped)
    notifyListeners();
  }

  Future<List<BranchDto>> getAvailableBranches() async {
    return _branchRepo.getCachedBranches(_businessId);
  }

  Future<void> _refreshCart() async {
    final cart = await _cartRepo.getOrCreateActiveCart(_businessId);
    _currentCart = await _cartRepo.getCartWithItems(
      cart.id,
      _businessId,
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
        taxRateBps: _taxRateBps,
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

  void selectCustomer(String? customerId, String? customerName) {
    _selectedCustomerId = customerId;
    _selectedCustomerName = customerName;
    notifyListeners();
  }

  Future<void> addToCart(String productId) async {
    if (_currentCart == null) return;
    try {
      await _cartRepo.addItem(
        _currentCart!.cart.id,
        _businessId,
        productId,
        1,
      );
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> updateQty(String productId, int newQty) async {
    if (_currentCart == null) return;
    if (newQty <= 0) {
      await removeFromCart(productId);
      return;
    }
    try {
      // Find the cart item ID for this product
      final cartItem = _currentCart!.items.where((i) => i.productId == productId).firstOrNull;
      if (cartItem == null) return;
      
      await _cartRepo.updateItemQuantity(
        cartItem.id,
        _businessId,
        newQty,
      );
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> removeFromCart(String productId) async {
    if (_currentCart == null) return;
    try {
      final cartItem = _currentCart!.items.where((i) => i.productId == productId).firstOrNull;
      if (cartItem == null) return;
      
      await _cartRepo.removeItem(cartItem.id, _businessId);
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> clearCart() async {
    if (_currentCart == null) return;
    try {
      // Remove all items one by one
      for (final item in _currentCart!.items) {
        await _cartRepo.removeItem(item.id, _businessId);
      }
      await _refreshCart();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  // Alias for backward compatibility with tests
  Future<CheckoutResult?> performCheckout({
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String? customerId,
  }) async {
    return checkout(
      paymentMethod: paymentMethod,
      cashReceivedMinor: cashReceivedMinor,
      customerId: customerId,
    );
  }

  Future<CheckoutResult?> checkout({
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String? customerId,
  }) async {
    if (_currentCart == null || _currentCart!.items.isEmpty) {
      _errorMessage = 'Cart is empty';
      notifyListeners();
      return null;
    }

    if (_branchId.isEmpty) {
      _errorMessage = 'No branch selected';
      notifyListeners();
      return null;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final request = CheckoutRequest(
        cartId: _currentCart!.cart.id,
        businessId: _businessId,
        branchId: _branchId,
        paymentMethod: paymentMethod,
        cashierId: _cashierId,
        customerId: customerId,
        discount: _currentDiscount,
        taxRateBps: _taxRateBps,
        idempotencyKey: _pendingIdempotencyKey ?? _uuid.v4(),
        deviceId: _deviceId,
        cashReceivedMinor: cashReceivedMinor,
      );

      final result = await _checkoutService.checkout(request);

      _lastReceipt = result;
      _pendingIdempotencyKey = null;

      // Build product name map for receipt
      final productNames = <String, String>{};
      for (final item in _currentCart!.items) {
        final product = await _productRepo.getProductById(item.productId, _businessId);
        if (product != null) {
          productNames[item.productId] = product.name;
        }
      }

      // Create receipt data for printing
      _lastReceiptData = ReceiptData(
        receiptNumber: result.receiptNumber,
        businessName: _businessName,
        branchName: _branchName,
        cashierId: _cashierId,
        createdAtEpochMs: DateTime.now().millisecondsSinceEpoch,
        subtotalMinor: _calculation?.subtotalMinor ?? 0,
        discountMinor: _calculation?.discountMinor ?? 0,
        taxMinor: _calculation?.taxMinor ?? 0,
        totalMinor: result.grandTotalMinor,
        cashReceivedMinor: cashReceivedMinor,
        changeMinor: result.changeMinor,
        items: _currentCart!.items
            .map((ci) => ReceiptItemData(
                  productId: ci.productId,
                  displayName: productNames[ci.productId] ?? ci.productId,
                  quantity: ci.quantity,
                  unitPriceMinor: ci.unitPriceMinor,
                ))
            .toList(),
      );

      // Reset cart after successful checkout
      await _refreshCart();
      _recalculate();

      _isLoading = false;
      notifyListeners();

      return result;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return null;
    }
  }
}