import 'package:biz_erp_mobile/core/sync/sync_models.dart';

/// Status siklus hidup Income di backend canonical.
enum IncomeStatus {
  draft,
  posted,
  reversed,
}

/// Metode pembayaran untuk Income.
enum IncomePaymentMethod {
  cash,
  bankTransfer,
  debit,
  credit,
}

/// Domain Model untuk Pendapatan Operasional / Lainnya (MOB-INCOME-1).
class Income {
  final String id;
  final String businessId;
  final String? branchId;
  final String date;
  final int amountMinor;
  final String method;
  final String? category;
  final String? reference;
  final String description;
  final String status;
  final int serverVersion;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;

  const Income({
    required this.id,
    required this.businessId,
    this.branchId,
    required this.date,
    required this.amountMinor,
    required this.method,
    this.category,
    this.reference,
    required this.description,
    required this.status,
    required this.serverVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  factory Income.fromDto(IncomeDto dto) {
    return Income(
      id: dto.id,
      businessId: dto.businessId,
      branchId: dto.branchId,
      date: dto.date,
      amountMinor: dto.amountMinor,
      method: dto.method,
      category: dto.category,
      reference: dto.reference,
      description: dto.description,
      status: dto.status,
      serverVersion: dto.serverVersion,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      deletedAt: dto.deletedAt,
    );
  }

  IncomeDto toDto() {
    return IncomeDto(
      id: id,
      businessId: businessId,
      branchId: branchId,
      date: date,
      amountMinor: amountMinor,
      method: method,
      category: category,
      reference: reference,
      description: description,
      status: status,
      serverVersion: serverVersion,
      createdAt: createdAt,
      updatedAt: updatedAt,
      deletedAt: deletedAt,
    );
  }

  bool get isDraft => status.toLowerCase() == 'draft';
  bool get isPosted => status.toLowerCase() == 'posted';
  bool get isReversed => status.toLowerCase() == 'reversed';

  String get formattedMethod {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Tunai';
      case 'bank_transfer':
        return 'Transfer Bank';
      case 'debit':
        return 'Kartu Debit';
      case 'credit':
        return 'Kartu Kredit';
      default:
        return method;
    }
  }

  String get formattedStatus {
    switch (status.toLowerCase()) {
      case 'posted':
        return 'Posted';
      case 'reversed':
        return 'Dibatalkan';
      case 'draft':
      default:
        return 'Draft';
    }
  }
}
