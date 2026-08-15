import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/products/domain/product_exceptions.dart';
import 'package:biz_erp_mobile/products/domain/barcode_lookup.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

/// Repository for local product catalog cache.
/// Enforces business isolation, UUID validation, and soft-delete policy.
class ProductRepository {
  final AppDatabase _db;

  ProductRepository(this._db);

  Product _mapToDomain(ProductsLocalData data) {
    return Product(
      id: data.id,
      businessId: data.businessId,
      name: data.name,
      description: data.description,
      priceMinor: data.priceMinor,
      category: data.category,
      isActive: data.isActive == 1,
      serverVersion: data.serverVersion,
      lastSyncedAt: data.lastSyncedAt,
      barcode: data.barcode,
      localStatus: data.localStatus,
    );
  }

  Product _mapProduct(ProductsLocalData row) {
    return Product(
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      description: row.description,
      priceMinor: row.priceMinor,
      category: row.category,
      isActive: row.isActive == 1,
      serverVersion: row.serverVersion,
      lastSyncedAt: row.lastSyncedAt,
      barcode: row.barcode,
      localStatus: row.localStatus,
    );
  }

  /// Upserts a product. Validates UUID and price_minor.
  /// If a product with the same ID exists, it is overwritten (UPSERT).
  Future<void> upsertProduct(Product product) async {
    if (product.priceMinor < 0) {
      throw ArgumentError('price_minor must be >= 0');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await _db
        .into(_db.productsLocal)
        .insertOnConflictUpdate(
          ProductsLocalCompanion(
            id: Value(product.id),
            businessId: Value(product.businessId),
            name: Value(product.name),
            description: Value(product.description),
            priceMinor: Value(product.priceMinor),
            category: Value(product.category),
            isActive: Value(product.isActive ? 1 : 0),
            serverVersion: Value(product.serverVersion),
            lastSyncedAt: Value(product.lastSyncedAt ?? now),
            barcode: Value(product.barcode),
          ),
        );
  }

  /// UI-level update for existing products.
  /// Sets localStatus = 'dirty' and enqueues to sync_outbox.
  /// Atomic-ish: DB update first, then enqueue. If enqueue fails,
  /// product remains dirty and error is surfaced to caller.
  Future<void> updateProduct(
    Product updated,
    SyncOutboxRepository outbox,
  ) async {
    // 1. Validation (defensive, aligned with backend)
    if (updated.name.trim().isEmpty) {
      throw ArgumentError('Nama produk wajib diisi');
    }
    if (updated.name.length > 100) {
      throw ArgumentError('Nama produk maksimal 100 karakter');
    }
    if (updated.priceMinor < 0) {
      throw ArgumentError('Harga harus >= 0');
    }

    // 2. Verify exists & tenant isolation
    final existing = await getProductById(updated.id, updated.businessId);
    if (existing == null) {
      throw ProductNotFoundException(updated.id, updated.businessId);
    }

    // 3. Duplicate barcode check (per business)
    if (updated.barcode != null && updated.barcode!.trim().isNotEmpty) {
      final lookup = await findByBarcode(updated.businessId, updated.barcode!.trim());
      if (lookup.status == BarcodeLookupStatus.duplicate) {
        throw ArgumentError('Barcode sudah digunakan produk lain');
      }
      if (lookup.status == BarcodeLookupStatus.found &&
          lookup.product!.id != updated.id) {
        throw ArgumentError('Barcode sudah digunakan produk lain');
      }
    }

    // 4. Update local DB FIRST (preserves dirty state even if enqueue fails)
    await _db.into(_db.productsLocal).insertOnConflictUpdate(
      ProductsLocalCompanion(
        id: Value(updated.id),
        businessId: Value(updated.businessId),
        name: Value(updated.name),
        description: Value(updated.description),
        priceMinor: Value(updated.priceMinor),
        category: Value(updated.category),
        isActive: Value(updated.isActive ? 1 : 0),
        // PRESERVE existing serverVersion — only SyncEngine bumps it on push success
        serverVersion: Value(existing.serverVersion),
        lastSyncedAt: Value(existing.lastSyncedAt),
        barcode: Value(updated.barcode?.trim().isEmpty == true ? null : updated.barcode?.trim()),
        localStatus: const Value('dirty'),
      ),
    );

    // 5. THEN enqueue to outbox. If this throws, product stays dirty (safe).
    final dto = ProductDto(
      id: updated.id,
      name: updated.name,
      description: updated.description,
      barcode: updated.barcode?.trim().isEmpty == true ? null : updated.barcode?.trim(),
      priceMinor: updated.priceMinor,
      category: updated.category,
      isActive: updated.isActive,
      serverVersion: existing.serverVersion,
    );
    await outbox.enqueueProductUpsert(dto);
  }

  /// Gets a product by ID, strictly scoped to business_id.
  Future<Product?> getProductById(String id, String businessId) async {
    final query = _db.select(_db.productsLocal)
      ..where((t) => t.id.equals(id) & t.businessId.equals(businessId));

    final result = await query.getSingleOrNull();
    return result == null ? null : _mapToDomain(result);
  }

  /// Lists only active products for a business.
  Future<List<Product>> listActiveProducts(String businessId) async {
    final query = _db.select(_db.productsLocal)
      ..where((t) => t.businessId.equals(businessId) & t.isActive.equals(1));

    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  /// Lists all products (active and inactive) for a business.
  Future<List<Product>> listAllProducts(String businessId) async {
    final query = _db.select(_db.productsLocal)
      ..where((t) => t.businessId.equals(businessId));

    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  /// Soft-deletes a product (sets is_active = 0).
  /// Atomic: updates local DB and enqueues outbox in a single transaction.
  Future<void> softDeleteProduct(String id, String businessId, SyncOutboxRepository outbox) async {
    final existing = await getProductById(id, businessId);
    if (existing == null) {
      throw ProductNotFoundException(id, businessId);
    }

    await _db.transaction(() async {
      await (_db.update(_db.productsLocal)
            ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
          .write(const ProductsLocalCompanion(
            isActive: Value(0),
            localStatus: Value('dirty'),
          ));

      final dto = ProductDto(
        id: existing.id,
        name: existing.name,
        description: existing.description,
        barcode: existing.barcode,
        priceMinor: existing.priceMinor,
        category: existing.category,
        isActive: false,
        serverVersion: existing.serverVersion,
      );
      await outbox.enqueueProductUpsert(dto);
    });
  }

  /// Restores a soft-deleted product (sets is_active = 1).
  /// Atomic: updates local DB and enqueues outbox in a single transaction.
  Future<void> restoreProduct(String id, String businessId, SyncOutboxRepository outbox) async {
    final existing = await getProductById(id, businessId);
    if (existing == null) {
      throw ProductNotFoundException(id, businessId);
    }

    await _db.transaction(() async {
      await (_db.update(_db.productsLocal)
            ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
          .write(const ProductsLocalCompanion(
            isActive: Value(1),
            localStatus: Value('dirty'),
          ));

      final dto = ProductDto(
        id: existing.id,
        name: existing.name,
        description: existing.description,
        barcode: existing.barcode,
        priceMinor: existing.priceMinor,
        category: existing.category,
        isActive: true,
        serverVersion: existing.serverVersion,
      );
      await outbox.enqueueProductUpsert(dto);
    });
  }

  /// Lookup barcode: membedakan FOUND / NOT_FOUND / INACTIVE / DUPLICATE.
  Future<BarcodeLookup> findByBarcode(String businessId, String barcode) async {
    final rows =
        await (_db.select(_db.productsLocal)..where(
              (t) =>
                  t.businessId.equals(businessId) & t.barcode.equals(barcode),
            ))
            .get();
    if (rows.isEmpty) {
      return BarcodeLookup(BarcodeLookupStatus.notFound, null);
    }
    if (rows.length > 1) {
      return BarcodeLookup(BarcodeLookupStatus.duplicate, null);
    }
    final product = _mapProduct(rows.first);
    if (rows.first.isActive != 1) {
      return BarcodeLookup(BarcodeLookupStatus.inactive, product);
    }
    return BarcodeLookup(BarcodeLookupStatus.found, product);
  }

  Future<void> markDirty(String id) async {
    await (_db.update(_db.productsLocal)..where((t) => t.id.equals(id))).write(
      const ProductsLocalCompanion(localStatus: Value('dirty')),
    );
  }

  Future<int> maxServerVersion(String businessId) async {
    final row = await _db
        .customSelect(
          'SELECT COALESCE(MAX(server_version), 0) AS v FROM products_local WHERE business_id = ?',
          variables: [Variable.withString(businessId)],
        )
        .getSingle();
    return row.read<int>('v');
  }

  /// Apply hasil pull server. Skip jika local masih dirty (policy B).
  Future<bool> applyServerSync(ProductDto dto, String businessId) async {
    final existing = await (_db.select(
      _db.productsLocal,
    )..where((t) => t.id.equals(dto.id))).getSingleOrNull();
    if (existing != null && existing.localStatus != 'synced') {
      return false;
    }
    await _db
        .into(_db.productsLocal)
        .insertOnConflictUpdate(
          ProductsLocalCompanion.insert(
            id: dto.id,
            businessId: businessId,
            name: dto.name,
            description: Value(dto.description),
            barcode: Value(dto.barcode),
            priceMinor: dto.priceMinor,
            category: Value(dto.category),
            isActive: Value(dto.isActive ? 1 : 0),
            serverVersion: Value(dto.serverVersion),
            lastSyncedAt: Value(DateTime.now().millisecondsSinceEpoch),
            localStatus: const Value('synced'),
          ),
        );
    return true;
  }

  /// Setelah push sukses: tandai synced + version server terbaru.
  Future<void> markSyncedAfterPush(String id, int serverVersion) async {
    await (_db.update(_db.productsLocal)..where((t) => t.id.equals(id))).write(
      ProductsLocalCompanion(
        localStatus: const Value('synced'),
        serverVersion: Value(serverVersion),
      ),
    );
  }

  /// EXPLICIT user action: overwrite local product with server version.
  /// Policy B remains intact globally; this is user-initiated bypass.
  Future<void> forceAcceptServerProduct(ProductDto dto, String businessId) async {
    final existing = await getProductById(dto.id, businessId);
    if (existing == null) {
      throw ProductNotFoundException(dto.id, businessId);
    }
    await _db.into(_db.productsLocal).insertOnConflictUpdate(
      ProductsLocalCompanion.insert(
        id: dto.id,
        businessId: businessId,
        name: dto.name,
        description: Value(dto.description),
        barcode: Value(dto.barcode),
        priceMinor: dto.priceMinor,
        category: Value(dto.category),
        isActive: Value(dto.isActive ? 1 : 0),
        serverVersion: Value(dto.serverVersion),
        lastSyncedAt: Value(DateTime.now().millisecondsSinceEpoch),
        localStatus: const Value('synced'),
      ),
    );
  }

  /// Phase 3.5: Create product atomically with outbox
  Future<void> createProduct(Product product, SyncOutboxRepository outbox) async {
    if (product.name.trim().isEmpty) throw ArgumentError('Nama produk wajib diisi');
    if (product.priceMinor < 0) throw ArgumentError('Harga harus >= 0');

    if (product.barcode != null && product.barcode!.trim().isNotEmpty) {
      final lookup = await findByBarcode(product.businessId, product.barcode!.trim());
      if (lookup.status == BarcodeLookupStatus.found || lookup.status == BarcodeLookupStatus.duplicate) {
        throw ArgumentError('Barcode sudah digunakan produk lain');
      }
    }

    await _db.transaction(() async {
      await _db.into(_db.productsLocal).insert(
        ProductsLocalCompanion.insert(
          id: product.id, businessId: product.businessId, name: product.name,
          description: Value(product.description), priceMinor: product.priceMinor,
          category: Value(product.category), isActive: Value(product.isActive ? 1 : 0),
          serverVersion: const Value(0), lastSyncedAt: Value(product.lastSyncedAt),
          barcode: Value(product.barcode), localStatus: const Value('dirty'),
        ),
      );
      final dto = ProductDto(
        id: product.id, name: product.name, description: product.description,
        barcode: product.barcode, priceMinor: product.priceMinor,
        category: product.category, isActive: product.isActive, serverVersion: 0,
      );
      await outbox.enqueueProductCreate(dto);
    });
  }
}
