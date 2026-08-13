import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';

void main() {
  const biz = '11111111-1111-1111-1111-111111111111';

  late AppDatabase db;
  late ProductRepository repo;
  late CartRepository cartRepo;
  late ScannerService service;
  late String cartId;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    repo = ProductRepository(db);
    cartRepo = CartRepository(db);

    await repo.upsertProduct(
      Product(
        id: 'a1111111-1111-4111-a111-111111111111',
        businessId: biz,
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 1,
        barcode: '8991002123456',
      ),
    );
    await repo.upsertProduct(
      Product(
        id: 'b2222222-2222-4222-a222-222222222222',
        businessId: biz,
        name: 'Roti Lama',
        priceMinor: 9000,
        isActive: false,
        serverVersion: 1,
        barcode: '8991002123457',
      ),
    );
    await repo.upsertProduct(
      Product(
        id: 'c3333333-3333-4333-a333-333333333333',
        businessId: biz,
        name: 'Dup A',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 1,
        barcode: '777',
      ),
    );
    await repo.upsertProduct(
      Product(
        id: 'd4444444-4444-4444-a444-444444444444',
        businessId: biz,
        name: 'Dup B',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 1,
        barcode: '777',
      ),
    );

    final cart = await cartRepo.getOrCreateActiveCart(biz);
    cartId = cart.id;

    service = ScannerService(
      productRepo: repo,
      businessId: biz,
      addToCart: (pid) => cartRepo.addItem(cartId, biz, pid, 1),
    );
  });

  tearDown(() async => await db.close());

  Future<int> qtyOf(String pid) async {
    final cart = await cartRepo.getCartWithItems(cartId, biz);
    if (cart == null) return 0;
    final item = cart.items.where((i) => i.productId == pid).toList();
    return item.isEmpty ? 0 : item.first.quantity;
  }

  test('SCAN-006 barcode dikenal menambah cart', () async {
    await service.processBarcode('8991002123456');
    expect(await qtyOf('a1111111-1111-4111-a111-111111111111'), 1);
    expect(service.lastEvent!.kind, ScanEventKind.added);
  });

  test('SCAN-007 barcode tak dikenal tidak mengubah cart', () async {
    await service.processBarcode('0000000000000');
    expect(await qtyOf('a1111111-1111-4111-a111-111111111111'), 0);
    expect(service.lastEvent!.kind, ScanEventKind.notFound);
  });

  test('SCAN-008 produk non-aktif ditolak dengan event khusus', () async {
    await service.processBarcode('8991002123457');
    expect(await qtyOf('b2222222-2222-4222-a222-222222222222'), 0);
    expect(service.lastEvent!.kind, ScanEventKind.inactive);
  });

  test('MIG-V4 barcode nullable + index ada', () async {
    await repo.upsertProduct(
      Product(
        id: 'e5555555-5555-4555-a555-555555555555',
        businessId: biz,
        name: 'Tanpa Barcode',
        priceMinor: 500,
        isActive: true,
        serverVersion: 1,
      ),
    );
    final rows = await db
        .customSelect(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_products_business_barcode'",
        )
        .get();
    expect(rows, isNotEmpty);
  });
}
