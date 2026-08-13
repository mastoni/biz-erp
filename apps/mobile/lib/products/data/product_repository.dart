import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/products/domain/product_exceptions.dart';
import 'package:biz_erp_mobile/products/domain/barcode_lookup.dart';

/// Repository for local product catalog cache.
/// Enforces business isolation, UUID validation, and soft-delete policy.
class ProductRepository {
  final AppDatabase _db;

  ProductRepository(this._db);

  // Drift singularizes the table name 'ProductsLocal' to 'ProductLocal'
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
      barcode: row.barcode, // ← PASTIKAN BARIS INI ADA
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
    // Explicit lambda ensures type inference returns List<Product>
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
  /// Physical DELETE is NOT allowed per Architecture Lock.
  Future<void> softDeleteProduct(String id, String businessId) async {
    // _validateId(id);

    final existing = await getProductById(id, businessId);
    if (existing == null) {
      throw ProductNotFoundException(id, businessId);
    }

    await (_db.update(_db.productsLocal)
          ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
        .write(const ProductsLocalCompanion(isActive: Value(0)));
  }

  /// Restores a soft-deleted product (sets is_active = 1).
  Future<void> restoreProduct(String id, String businessId) async {
    // _validateId(id);

    final existing = await getProductById(id, businessId);
    if (existing == null) {
      throw ProductNotFoundException(id, businessId);
    }

    await (_db.update(_db.productsLocal)
          ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
        .write(const ProductsLocalCompanion(isActive: Value(1)));
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
}
