import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';

enum PaymentMethod { cash, transfer }

class CheckoutRequest {
  final String businessId;
  final String branchId;
  final String cashierId;
  final String deviceId;
  final String idempotencyKey;
  final String cartId;
  final CalcDiscount discount;
  final int taxRateBps;
  final PaymentMethod paymentMethod;
  final int cashReceivedMinor;
  final String? customerId;

  const CheckoutRequest({
    required this.businessId,
    required this.branchId,
    required this.cashierId,
    required this.deviceId,
    required this.idempotencyKey,
    required this.cartId,
    required this.discount,
    required this.taxRateBps,
    required this.paymentMethod,
    required this.cashReceivedMinor,
    this.customerId,
  });
}

class CheckoutResult {
  final String clientTransactionId;
  final String receiptNumber;
  final int grandTotalMinor;
  final int changeMinor;

  const CheckoutResult({
    required this.clientTransactionId,
    required this.receiptNumber,
    required this.grandTotalMinor,
    required this.changeMinor,
  });
}
