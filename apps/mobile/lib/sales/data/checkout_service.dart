import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/cart/domain/cart_exceptions.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_exceptions.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_exceptions.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_fingerprint.dart';

class CheckoutService {
  final AppDatabase _db;
  final SaleCalculationEngine _calcEngine;
  static final _uuidRegex = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  static const _uuid = Uuid();

  CheckoutService(this._db, this._calcEngine);

  Future<CheckoutResult> checkout(CheckoutRequest request) async {
    // 1. Validate Idempotency Key
    if (!_uuidRegex.hasMatch(request.idempotencyKey)) {
      throw InvalidIdempotencyKeyException(request.idempotencyKey);
    }

    return await _db.transaction(() async {
      // 2. Check Idempotency (Business scoped)
      final fingerprint = CheckoutFingerprint.build(request);
      final existingIdem =
          await (_db.select(_db.localIdempotencyKeys)..where(
                (t) =>
                    t.businessId.equals(request.businessId) &
                    t.key.equals(request.idempotencyKey),
              ))
              .getSingleOrNull();

      if (existingIdem != null) {
        // Fingerprint mismatch -> REJECT
        if (existingIdem.requestFingerprint != fingerprint) {
          throw IdempotencyConflictException(request.idempotencyKey);
        }

        // Fingerprint match -> Return existing sale
        final existingSale =
            await (_db.select(_db.salesLocal)..where(
                  (t) => t.clientTransactionId.equals(request.idempotencyKey),
                ))
                .getSingleOrNull();

        if (existingSale == null) {
          throw StateError('Idempotency key exists but sale not found');
        }

        final existingPayment =
            await (_db.select(_db.paymentsLocal)..where(
                  (t) => t.clientTransactionId.equals(request.idempotencyKey),
                ))
                .getSingleOrNull();

        int change = 0;
        if (existingPayment != null && existingPayment.changeMinor != null) {
          change = existingPayment.changeMinor!;
        }

        return CheckoutResult(
          clientTransactionId: existingSale.clientTransactionId,
          receiptNumber: existingSale.receiptNumber ?? '',
          grandTotalMinor: existingSale.totalMinor,
          changeMinor: change,
        );
      }

      // 3. Read Cart & Validate
      final cart =
          await (_db.select(_db.cartLocal)..where(
                (t) =>
                    t.id.equals(request.cartId) &
                    t.businessId.equals(request.businessId),
              ))
              .getSingleOrNull();

      if (cart == null) {
        throw CartNotFoundException(request.cartId, request.businessId);
      }
      if (cart.status != 'ACTIVE') {
        throw CartNotActiveException(request.cartId);
      }

      final cartItems = await (_db.select(
        _db.cartItemsLocal,
      )..where((t) => t.cartId.equals(request.cartId))).get();

      if (cartItems.isEmpty) {
        throw EmptyCartException();
      }

      // Map to CalcCartItem
      final calcItems = cartItems
          .map(
            (item) => CalcCartItem(
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
            ),
          )
          .toList();

      // 4. Calculate
      final calcResult = _calcEngine.calculate(
        items: calcItems,
        discount: request.discount,
        taxRateBps: request.taxRateBps,
      );

      // 5. Validate Payment & Calculate Change
      int changeMinor = 0;
      int paymentAmount = calcResult.grandTotalMinor;

      if (request.paymentMethod == PaymentMethod.cash) {
        if (request.cashReceivedMinor < calcResult.grandTotalMinor) {
          throw InsufficientPaymentException(
            request.cashReceivedMinor,
            calcResult.grandTotalMinor,
          );
        }
        changeMinor = request.cashReceivedMinor - calcResult.grandTotalMinor;
      } else {
        changeMinor = 0;
      }

      // 6. Get Receipt Sequence (Atomic UPSERT + RETURNING)
      final now = DateTime.now().millisecondsSinceEpoch;
      final dateStr = _formatDateForReceipt(now);

      final receiptSeqRow = await _db
          .customSelect(
            '''
        INSERT INTO receipt_sequences_local (id, business_id, branch_id, sequence_date, last_sequence, updated_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(business_id, branch_id, sequence_date)
        DO UPDATE SET last_sequence = last_sequence + 1, updated_at = excluded.updated_at
        RETURNING last_sequence
        ''',
            variables: [
              Variable.withString(_uuid.v4()),
              Variable.withString(request.businessId),
              Variable.withString(request.branchId),
              Variable.withString(dateStr),
              Variable.withInt(now),
            ],
            readsFrom: {_db.receiptSequencesLocal},
          )
          .getSingle();

      final sequence = receiptSeqRow.read<int>('last_sequence');
      final receiptNumber =
          '${request.branchId}-$dateStr-${sequence.toString().padLeft(4, '0')}';

      // 7. Insert Sale
      final saleId = request.idempotencyKey;
      await _db
          .into(_db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: saleId,
              businessId: request.businessId,
              branchId: request.branchId,
              cashierId: request.cashierId,
              status: 'PENDING_SYNC',
              subtotalMinor: calcResult.subtotalMinor,
              discountMinor: Value(calcResult.discountMinor),
              taxMinor: Value(calcResult.taxMinor),
              totalMinor: calcResult.grandTotalMinor,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: request.deviceId,
              createdAt: now,
              updatedAt: now,
              receiptNumber: Value(receiptNumber),
              receiptSequence: Value(sequence),
              receiptDate: Value(dateStr),
            ),
          );

      // 8. Insert Items (from cart snapshot)
      for (final cartItem in cartItems) {
        await _db
            .into(_db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: _uuid.v4(),
                clientTransactionId: saleId,
                productId: cartItem.productId,
                quantity: cartItem.quantity,
                unitPriceMinor: cartItem.unitPriceMinor,
                createdAt: now,
              ),
            );
      }

      // 9. Insert Payment
      await _db
          .into(_db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: _uuid.v4(),
              clientTransactionId: saleId,
              paymentMethod: request.paymentMethod.name.toUpperCase(),
              amountMinor: paymentAmount,
              createdAt: now,
              changeMinor: Value(changeMinor),
            ),
          );

      // 10. Insert Idempotency Key
      await _db
          .into(_db.localIdempotencyKeys)
          .insert(
            LocalIdempotencyKeysCompanion.insert(
              key: saleId,
              businessId: request.businessId,
              entityType: 'SALE',
              createdAt: now,
              requestFingerprint: Value(fingerprint),
            ),
          );

      // 11. Update Cart to CHECKED_OUT
      await (_db.update(
        _db.cartLocal,
      )..where((t) => t.id.equals(request.cartId))).write(
        CartLocalCompanion(
          status: const Value('CHECKED_OUT'),
          updatedAt: Value(now),
        ),
      );

      // 12. Return Result
      return CheckoutResult(
        clientTransactionId: saleId,
        receiptNumber: receiptNumber,
        grandTotalMinor: calcResult.grandTotalMinor,
        changeMinor: changeMinor,
      );
    });
  }

  String _formatDateForReceipt(int epochMs) {
    // Simplified date formatting to YYYYMMDD using UTC to avoid timezone package dependencies.
    // In a full implementation, this would use business_settings_local.timezone.
    final dt = DateTime.fromMillisecondsSinceEpoch(epochMs, isUtc: true);
    return '${dt.year.toString().padLeft(4, '0')}${dt.month.toString().padLeft(2, '0')}${dt.day.toString().padLeft(2, '0')}';
  }
}
