import 'package:drift/drift.dart';
import 'package:sqlite3/sqlite3.dart' show SqliteException;
import 'package:uuid/uuid.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/cart/domain/cart.dart';
import 'package:biz_erp_mobile/cart/domain/cart_exceptions.dart';

/// Repository for persistent shopping cart.
/// Enforces business isolation, price snapshots, and active-cart uniqueness.
class CartRepository {
  final AppDatabase _db;
  static const _uuid = Uuid();

  CartRepository(this._db);

  Cart _mapCart(CartLocalData data) => Cart(
    id: data.id,
    businessId: data.businessId,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  );

  CartItem _mapCartItem(CartItemsLocalData data) => CartItem(
    id: data.id,
    cartId: data.cartId,
    productId: data.productId,
    quantity: data.quantity,
    unitPriceMinor: data.unitPriceMinor,
    addedAt: data.addedAt,
    updatedAt: data.updatedAt,
  );

  /// Gets the existing ACTIVE cart for a business, or creates a new one.
  /// Relies on the DB partial unique index to prevent race conditions.
  Future<Cart> getOrCreateActiveCart(String businessId) async {
    try {
      return await _db.transaction(() async {
        final existing =
            await (_db.select(_db.cartLocal)..where(
                  (t) =>
                      t.businessId.equals(businessId) &
                      t.status.equals('ACTIVE'),
                ))
                .getSingleOrNull();

        if (existing != null) return _mapCart(existing);

        final id = _uuid.v4();
        final now = DateTime.now().millisecondsSinceEpoch;
        await _db
            .into(_db.cartLocal)
            .insert(
              CartLocalCompanion.insert(
                id: id,
                businessId: businessId,
                status: 'ACTIVE',
                createdAt: now,
                updatedAt: now,
              ),
            );
        return _mapCart(
          await (_db.select(
            _db.cartLocal,
          )..where((t) => t.id.equals(id))).getSingle(),
        );
      });
    } on SqliteException catch (e) {
      // Fallback if concurrent transaction created the cart just before ours
      if (e.message.contains('idx_one_active_cart_per_business') ||
          e.message.contains('UNIQUE constraint failed')) {
        final existing =
            await (_db.select(_db.cartLocal)..where(
                  (t) =>
                      t.businessId.equals(businessId) &
                      t.status.equals('ACTIVE'),
                ))
                .getSingleOrNull();
        if (existing != null) return _mapCart(existing);
      }
      rethrow;
    }
  }

  /// Adds a product to the cart. Captures price snapshot.
  /// If product already in cart, deterministically adds to existing quantity.
  Future<CartItem> addItem(
    String cartId,
    String businessId,
    String productId,
    int quantity,
  ) async {
    if (quantity < 1) throw InvalidQuantityException(quantity);

    return await _db.transaction(() async {
      // 1. Validate cart
      final cart =
          await (_db.select(_db.cartLocal)..where(
                (t) =>
                    t.id.equals(cartId) &
                    t.businessId.equals(businessId) &
                    t.status.equals('ACTIVE'),
              ))
              .getSingleOrNull();
      if (cart == null) throw CartNotFoundException(cartId, businessId);

      // 2. Validate product (must exist, belong to business, and be active)
      final product =
          await (_db.select(_db.productsLocal)..where(
                (t) => t.id.equals(productId) & t.businessId.equals(businessId),
              ))
              .getSingleOrNull();
      if (product == null)
        throw CartProductNotFoundException(productId, businessId);
      if (product.isActive != 1) throw ProductNotActiveException(productId);

      // 3. Check if product already in cart
      final existingItem =
          await (_db.select(_db.cartItemsLocal)..where(
                (t) => t.cartId.equals(cartId) & t.productId.equals(productId),
              ))
              .getSingleOrNull();

      final now = DateTime.now().millisecondsSinceEpoch;

      if (existingItem != null) {
        // Deterministic behavior: accumulate quantity
        final newQty = existingItem.quantity + quantity;
        await (_db.update(
          _db.cartItemsLocal,
        )..where((t) => t.id.equals(existingItem.id))).write(
          CartItemsLocalCompanion(
            quantity: Value(newQty),
            updatedAt: Value(now),
          ),
        );
        return _mapCartItem(
          existingItem.copyWith(quantity: newQty, updatedAt: now),
        );
      } else {
        // New item: capture price snapshot
        final itemId = _uuid.v4();
        final companion = CartItemsLocalCompanion.insert(
          id: itemId,
          cartId: cartId,
          productId: productId,
          quantity: quantity,
          unitPriceMinor: product.priceMinor,
          addedAt: now,
          updatedAt: now,
        );
        await _db.into(_db.cartItemsLocal).insert(companion);
        return _mapCartItem(
          await (_db.select(
            _db.cartItemsLocal,
          )..where((t) => t.id.equals(itemId))).getSingle(),
        );
      }
    });
  }

  Future<void> updateItemQuantity(
    String cartItemId,
    String businessId,
    int quantity,
  ) async {
    if (quantity < 1) throw InvalidQuantityException(quantity);

    await _db.transaction(() async {
      final item = await (_db.select(
        _db.cartItemsLocal,
      )..where((t) => t.id.equals(cartItemId))).getSingleOrNull();
      if (item == null) throw CartItemNotFoundException(cartItemId);

      final cart =
          await (_db.select(_db.cartLocal)..where(
                (t) =>
                    t.id.equals(item.cartId) & t.businessId.equals(businessId),
              ))
              .getSingleOrNull();
      if (cart == null || cart.status != 'ACTIVE')
        throw CartNotFoundException(item.cartId, businessId);

      final now = DateTime.now().millisecondsSinceEpoch;
      await (_db.update(
        _db.cartItemsLocal,
      )..where((t) => t.id.equals(cartItemId))).write(
        CartItemsLocalCompanion(
          quantity: Value(quantity),
          updatedAt: Value(now),
        ),
      );
    });
  }

  Future<void> removeItem(String cartItemId, String businessId) async {
    await _db.transaction(() async {
      final item = await (_db.select(
        _db.cartItemsLocal,
      )..where((t) => t.id.equals(cartItemId))).getSingleOrNull();
      if (item == null) throw CartItemNotFoundException(cartItemId);

      final cart =
          await (_db.select(_db.cartLocal)..where(
                (t) =>
                    t.id.equals(item.cartId) & t.businessId.equals(businessId),
              ))
              .getSingleOrNull();
      if (cart == null) throw CartNotFoundException(item.cartId, businessId);

      await (_db.delete(
        _db.cartItemsLocal,
      )..where((t) => t.id.equals(cartItemId))).go();
    });
  }

  Future<void> abandonCart(String cartId, String businessId) async {
    final cart =
        await (_db.select(_db.cartLocal)..where(
              (t) => t.id.equals(cartId) & t.businessId.equals(businessId),
            ))
            .getSingleOrNull();
    if (cart == null) throw CartNotFoundException(cartId, businessId);

    final now = DateTime.now().millisecondsSinceEpoch;
    await (_db.update(_db.cartLocal)..where((t) => t.id.equals(cartId))).write(
      CartLocalCompanion(
        status: const Value('ABANDONED'),
        updatedAt: Value(now),
      ),
    );
  }

  Future<CartWithItems?> getCartWithItems(
    String cartId,
    String businessId,
  ) async {
    final cart =
        await (_db.select(_db.cartLocal)..where(
              (t) => t.id.equals(cartId) & t.businessId.equals(businessId),
            ))
            .getSingleOrNull();
    if (cart == null) return null;

    final items = await (_db.select(
      _db.cartItemsLocal,
    )..where((t) => t.cartId.equals(cartId))).get();

    return CartWithItems(
      cart: _mapCart(cart),
      items: items.map(_mapCartItem).toList(),
    );
  }
}
