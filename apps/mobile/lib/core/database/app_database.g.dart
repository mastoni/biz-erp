// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $SalesLocalTable extends SalesLocal
    with TableInfo<$SalesLocalTable, SalesLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SalesLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _clientTransactionIdMeta =
      const VerificationMeta('clientTransactionId');
  @override
  late final GeneratedColumn<String> clientTransactionId =
      GeneratedColumn<String>(
        'client_transaction_id',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _businessIdMeta = const VerificationMeta(
    'businessId',
  );
  @override
  late final GeneratedColumn<String> businessId = GeneratedColumn<String>(
    'business_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cashierIdMeta = const VerificationMeta(
    'cashierId',
  );
  @override
  late final GeneratedColumn<String> cashierId = GeneratedColumn<String>(
    'cashier_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _customerIdMeta = const VerificationMeta(
    'customerId',
  );
  @override
  late final GeneratedColumn<String> customerId = GeneratedColumn<String>(
    'customer_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    check: () => const CustomExpression(
      "status IN ('DRAFT', 'PENDING_SYNC', 'SYNCING', 'RESULT_UNKNOWN', "
      "'SYNCED', 'SYNC_FAILED', 'CONFLICT', 'CANCELLED')",
    ),
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _subtotalMinorMeta = const VerificationMeta(
    'subtotalMinor',
  );
  @override
  late final GeneratedColumn<int> subtotalMinor = GeneratedColumn<int>(
    'subtotal_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('subtotal_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _discountMinorMeta = const VerificationMeta(
    'discountMinor',
  );
  @override
  late final GeneratedColumn<int> discountMinor = GeneratedColumn<int>(
    'discount_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('discount_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _taxMinorMeta = const VerificationMeta(
    'taxMinor',
  );
  @override
  late final GeneratedColumn<int> taxMinor = GeneratedColumn<int>(
    'tax_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('tax_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _totalMinorMeta = const VerificationMeta(
    'totalMinor',
  );
  @override
  late final GeneratedColumn<int> totalMinor = GeneratedColumn<int>(
    'total_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('total_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _currencyCodeMeta = const VerificationMeta(
    'currencyCode',
  );
  @override
  late final GeneratedColumn<String> currencyCode = GeneratedColumn<String>(
    'currency_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _currencyMinorUnitsMeta =
      const VerificationMeta('currencyMinorUnits');
  @override
  late final GeneratedColumn<int> currencyMinorUnits = GeneratedColumn<int>(
    'currency_minor_units',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deviceIdMeta = const VerificationMeta(
    'deviceId',
  );
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
    'device_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _syncedAtMeta = const VerificationMeta(
    'syncedAt',
  );
  @override
  late final GeneratedColumn<int> syncedAt = GeneratedColumn<int>(
    'synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    clientTransactionId,
    businessId,
    branchId,
    cashierId,
    customerId,
    status,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    currencyCode,
    currencyMinorUnits,
    deviceId,
    createdAt,
    updatedAt,
    syncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sales_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<SalesLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('client_transaction_id')) {
      context.handle(
        _clientTransactionIdMeta,
        clientTransactionId.isAcceptableOrUnknown(
          data['client_transaction_id']!,
          _clientTransactionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientTransactionIdMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('cashier_id')) {
      context.handle(
        _cashierIdMeta,
        cashierId.isAcceptableOrUnknown(data['cashier_id']!, _cashierIdMeta),
      );
    } else if (isInserting) {
      context.missing(_cashierIdMeta);
    }
    if (data.containsKey('customer_id')) {
      context.handle(
        _customerIdMeta,
        customerId.isAcceptableOrUnknown(data['customer_id']!, _customerIdMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('subtotal_minor')) {
      context.handle(
        _subtotalMinorMeta,
        subtotalMinor.isAcceptableOrUnknown(
          data['subtotal_minor']!,
          _subtotalMinorMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_subtotalMinorMeta);
    }
    if (data.containsKey('discount_minor')) {
      context.handle(
        _discountMinorMeta,
        discountMinor.isAcceptableOrUnknown(
          data['discount_minor']!,
          _discountMinorMeta,
        ),
      );
    }
    if (data.containsKey('tax_minor')) {
      context.handle(
        _taxMinorMeta,
        taxMinor.isAcceptableOrUnknown(data['tax_minor']!, _taxMinorMeta),
      );
    }
    if (data.containsKey('total_minor')) {
      context.handle(
        _totalMinorMeta,
        totalMinor.isAcceptableOrUnknown(data['total_minor']!, _totalMinorMeta),
      );
    } else if (isInserting) {
      context.missing(_totalMinorMeta);
    }
    if (data.containsKey('currency_code')) {
      context.handle(
        _currencyCodeMeta,
        currencyCode.isAcceptableOrUnknown(
          data['currency_code']!,
          _currencyCodeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_currencyCodeMeta);
    }
    if (data.containsKey('currency_minor_units')) {
      context.handle(
        _currencyMinorUnitsMeta,
        currencyMinorUnits.isAcceptableOrUnknown(
          data['currency_minor_units']!,
          _currencyMinorUnitsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_currencyMinorUnitsMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(
        _deviceIdMeta,
        deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta),
      );
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('synced_at')) {
      context.handle(
        _syncedAtMeta,
        syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {clientTransactionId};
  @override
  SalesLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SalesLocalData(
      clientTransactionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_transaction_id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      cashierId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cashier_id'],
      )!,
      customerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}customer_id'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      subtotalMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}subtotal_minor'],
      )!,
      discountMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}discount_minor'],
      )!,
      taxMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}tax_minor'],
      )!,
      totalMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_minor'],
      )!,
      currencyCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}currency_code'],
      )!,
      currencyMinorUnits: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}currency_minor_units'],
      )!,
      deviceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_id'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
      syncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}synced_at'],
      ),
    );
  }

  @override
  $SalesLocalTable createAlias(String alias) {
    return $SalesLocalTable(attachedDatabase, alias);
  }
}

class SalesLocalData extends DataClass implements Insertable<SalesLocalData> {
  /// UUID v4 — primary key and idempotency anchor
  final String clientTransactionId;
  final String businessId;
  final String branchId;
  final String cashierId;
  final String? customerId;

  /// Sale status — restricted to valid state machine values
  final String status;

  /// Money fields — INTEGER minor units only
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final String currencyCode;
  final int currencyMinorUnits;
  final String deviceId;

  /// Epoch milliseconds
  final int createdAt;
  final int updatedAt;
  final int? syncedAt;
  const SalesLocalData({
    required this.clientTransactionId,
    required this.businessId,
    required this.branchId,
    required this.cashierId,
    this.customerId,
    required this.status,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.currencyCode,
    required this.currencyMinorUnits,
    required this.deviceId,
    required this.createdAt,
    required this.updatedAt,
    this.syncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['client_transaction_id'] = Variable<String>(clientTransactionId);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['cashier_id'] = Variable<String>(cashierId);
    if (!nullToAbsent || customerId != null) {
      map['customer_id'] = Variable<String>(customerId);
    }
    map['status'] = Variable<String>(status);
    map['subtotal_minor'] = Variable<int>(subtotalMinor);
    map['discount_minor'] = Variable<int>(discountMinor);
    map['tax_minor'] = Variable<int>(taxMinor);
    map['total_minor'] = Variable<int>(totalMinor);
    map['currency_code'] = Variable<String>(currencyCode);
    map['currency_minor_units'] = Variable<int>(currencyMinorUnits);
    map['device_id'] = Variable<String>(deviceId);
    map['created_at'] = Variable<int>(createdAt);
    map['updated_at'] = Variable<int>(updatedAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<int>(syncedAt);
    }
    return map;
  }

  SalesLocalCompanion toCompanion(bool nullToAbsent) {
    return SalesLocalCompanion(
      clientTransactionId: Value(clientTransactionId),
      businessId: Value(businessId),
      branchId: Value(branchId),
      cashierId: Value(cashierId),
      customerId: customerId == null && nullToAbsent
          ? const Value.absent()
          : Value(customerId),
      status: Value(status),
      subtotalMinor: Value(subtotalMinor),
      discountMinor: Value(discountMinor),
      taxMinor: Value(taxMinor),
      totalMinor: Value(totalMinor),
      currencyCode: Value(currencyCode),
      currencyMinorUnits: Value(currencyMinorUnits),
      deviceId: Value(deviceId),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
    );
  }

  factory SalesLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SalesLocalData(
      clientTransactionId: serializer.fromJson<String>(
        json['clientTransactionId'],
      ),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      cashierId: serializer.fromJson<String>(json['cashierId']),
      customerId: serializer.fromJson<String?>(json['customerId']),
      status: serializer.fromJson<String>(json['status']),
      subtotalMinor: serializer.fromJson<int>(json['subtotalMinor']),
      discountMinor: serializer.fromJson<int>(json['discountMinor']),
      taxMinor: serializer.fromJson<int>(json['taxMinor']),
      totalMinor: serializer.fromJson<int>(json['totalMinor']),
      currencyCode: serializer.fromJson<String>(json['currencyCode']),
      currencyMinorUnits: serializer.fromJson<int>(json['currencyMinorUnits']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
      syncedAt: serializer.fromJson<int?>(json['syncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'clientTransactionId': serializer.toJson<String>(clientTransactionId),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'cashierId': serializer.toJson<String>(cashierId),
      'customerId': serializer.toJson<String?>(customerId),
      'status': serializer.toJson<String>(status),
      'subtotalMinor': serializer.toJson<int>(subtotalMinor),
      'discountMinor': serializer.toJson<int>(discountMinor),
      'taxMinor': serializer.toJson<int>(taxMinor),
      'totalMinor': serializer.toJson<int>(totalMinor),
      'currencyCode': serializer.toJson<String>(currencyCode),
      'currencyMinorUnits': serializer.toJson<int>(currencyMinorUnits),
      'deviceId': serializer.toJson<String>(deviceId),
      'createdAt': serializer.toJson<int>(createdAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
      'syncedAt': serializer.toJson<int?>(syncedAt),
    };
  }

  SalesLocalData copyWith({
    String? clientTransactionId,
    String? businessId,
    String? branchId,
    String? cashierId,
    Value<String?> customerId = const Value.absent(),
    String? status,
    int? subtotalMinor,
    int? discountMinor,
    int? taxMinor,
    int? totalMinor,
    String? currencyCode,
    int? currencyMinorUnits,
    String? deviceId,
    int? createdAt,
    int? updatedAt,
    Value<int?> syncedAt = const Value.absent(),
  }) => SalesLocalData(
    clientTransactionId: clientTransactionId ?? this.clientTransactionId,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    cashierId: cashierId ?? this.cashierId,
    customerId: customerId.present ? customerId.value : this.customerId,
    status: status ?? this.status,
    subtotalMinor: subtotalMinor ?? this.subtotalMinor,
    discountMinor: discountMinor ?? this.discountMinor,
    taxMinor: taxMinor ?? this.taxMinor,
    totalMinor: totalMinor ?? this.totalMinor,
    currencyCode: currencyCode ?? this.currencyCode,
    currencyMinorUnits: currencyMinorUnits ?? this.currencyMinorUnits,
    deviceId: deviceId ?? this.deviceId,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
  );
  SalesLocalData copyWithCompanion(SalesLocalCompanion data) {
    return SalesLocalData(
      clientTransactionId: data.clientTransactionId.present
          ? data.clientTransactionId.value
          : this.clientTransactionId,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      cashierId: data.cashierId.present ? data.cashierId.value : this.cashierId,
      customerId: data.customerId.present
          ? data.customerId.value
          : this.customerId,
      status: data.status.present ? data.status.value : this.status,
      subtotalMinor: data.subtotalMinor.present
          ? data.subtotalMinor.value
          : this.subtotalMinor,
      discountMinor: data.discountMinor.present
          ? data.discountMinor.value
          : this.discountMinor,
      taxMinor: data.taxMinor.present ? data.taxMinor.value : this.taxMinor,
      totalMinor: data.totalMinor.present
          ? data.totalMinor.value
          : this.totalMinor,
      currencyCode: data.currencyCode.present
          ? data.currencyCode.value
          : this.currencyCode,
      currencyMinorUnits: data.currencyMinorUnits.present
          ? data.currencyMinorUnits.value
          : this.currencyMinorUnits,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SalesLocalData(')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('cashierId: $cashierId, ')
          ..write('customerId: $customerId, ')
          ..write('status: $status, ')
          ..write('subtotalMinor: $subtotalMinor, ')
          ..write('discountMinor: $discountMinor, ')
          ..write('taxMinor: $taxMinor, ')
          ..write('totalMinor: $totalMinor, ')
          ..write('currencyCode: $currencyCode, ')
          ..write('currencyMinorUnits: $currencyMinorUnits, ')
          ..write('deviceId: $deviceId, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('syncedAt: $syncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    clientTransactionId,
    businessId,
    branchId,
    cashierId,
    customerId,
    status,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    currencyCode,
    currencyMinorUnits,
    deviceId,
    createdAt,
    updatedAt,
    syncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SalesLocalData &&
          other.clientTransactionId == this.clientTransactionId &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.cashierId == this.cashierId &&
          other.customerId == this.customerId &&
          other.status == this.status &&
          other.subtotalMinor == this.subtotalMinor &&
          other.discountMinor == this.discountMinor &&
          other.taxMinor == this.taxMinor &&
          other.totalMinor == this.totalMinor &&
          other.currencyCode == this.currencyCode &&
          other.currencyMinorUnits == this.currencyMinorUnits &&
          other.deviceId == this.deviceId &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.syncedAt == this.syncedAt);
}

class SalesLocalCompanion extends UpdateCompanion<SalesLocalData> {
  final Value<String> clientTransactionId;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> cashierId;
  final Value<String?> customerId;
  final Value<String> status;
  final Value<int> subtotalMinor;
  final Value<int> discountMinor;
  final Value<int> taxMinor;
  final Value<int> totalMinor;
  final Value<String> currencyCode;
  final Value<int> currencyMinorUnits;
  final Value<String> deviceId;
  final Value<int> createdAt;
  final Value<int> updatedAt;
  final Value<int?> syncedAt;
  final Value<int> rowid;
  const SalesLocalCompanion({
    this.clientTransactionId = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.cashierId = const Value.absent(),
    this.customerId = const Value.absent(),
    this.status = const Value.absent(),
    this.subtotalMinor = const Value.absent(),
    this.discountMinor = const Value.absent(),
    this.taxMinor = const Value.absent(),
    this.totalMinor = const Value.absent(),
    this.currencyCode = const Value.absent(),
    this.currencyMinorUnits = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SalesLocalCompanion.insert({
    required String clientTransactionId,
    required String businessId,
    required String branchId,
    required String cashierId,
    this.customerId = const Value.absent(),
    required String status,
    required int subtotalMinor,
    this.discountMinor = const Value.absent(),
    this.taxMinor = const Value.absent(),
    required int totalMinor,
    required String currencyCode,
    required int currencyMinorUnits,
    required String deviceId,
    required int createdAt,
    required int updatedAt,
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : clientTransactionId = Value(clientTransactionId),
       businessId = Value(businessId),
       branchId = Value(branchId),
       cashierId = Value(cashierId),
       status = Value(status),
       subtotalMinor = Value(subtotalMinor),
       totalMinor = Value(totalMinor),
       currencyCode = Value(currencyCode),
       currencyMinorUnits = Value(currencyMinorUnits),
       deviceId = Value(deviceId),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<SalesLocalData> custom({
    Expression<String>? clientTransactionId,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? cashierId,
    Expression<String>? customerId,
    Expression<String>? status,
    Expression<int>? subtotalMinor,
    Expression<int>? discountMinor,
    Expression<int>? taxMinor,
    Expression<int>? totalMinor,
    Expression<String>? currencyCode,
    Expression<int>? currencyMinorUnits,
    Expression<String>? deviceId,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<int>? syncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (clientTransactionId != null)
        'client_transaction_id': clientTransactionId,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (cashierId != null) 'cashier_id': cashierId,
      if (customerId != null) 'customer_id': customerId,
      if (status != null) 'status': status,
      if (subtotalMinor != null) 'subtotal_minor': subtotalMinor,
      if (discountMinor != null) 'discount_minor': discountMinor,
      if (taxMinor != null) 'tax_minor': taxMinor,
      if (totalMinor != null) 'total_minor': totalMinor,
      if (currencyCode != null) 'currency_code': currencyCode,
      if (currencyMinorUnits != null)
        'currency_minor_units': currencyMinorUnits,
      if (deviceId != null) 'device_id': deviceId,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SalesLocalCompanion copyWith({
    Value<String>? clientTransactionId,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? cashierId,
    Value<String?>? customerId,
    Value<String>? status,
    Value<int>? subtotalMinor,
    Value<int>? discountMinor,
    Value<int>? taxMinor,
    Value<int>? totalMinor,
    Value<String>? currencyCode,
    Value<int>? currencyMinorUnits,
    Value<String>? deviceId,
    Value<int>? createdAt,
    Value<int>? updatedAt,
    Value<int?>? syncedAt,
    Value<int>? rowid,
  }) {
    return SalesLocalCompanion(
      clientTransactionId: clientTransactionId ?? this.clientTransactionId,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      cashierId: cashierId ?? this.cashierId,
      customerId: customerId ?? this.customerId,
      status: status ?? this.status,
      subtotalMinor: subtotalMinor ?? this.subtotalMinor,
      discountMinor: discountMinor ?? this.discountMinor,
      taxMinor: taxMinor ?? this.taxMinor,
      totalMinor: totalMinor ?? this.totalMinor,
      currencyCode: currencyCode ?? this.currencyCode,
      currencyMinorUnits: currencyMinorUnits ?? this.currencyMinorUnits,
      deviceId: deviceId ?? this.deviceId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      syncedAt: syncedAt ?? this.syncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (clientTransactionId.present) {
      map['client_transaction_id'] = Variable<String>(
        clientTransactionId.value,
      );
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (cashierId.present) {
      map['cashier_id'] = Variable<String>(cashierId.value);
    }
    if (customerId.present) {
      map['customer_id'] = Variable<String>(customerId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (subtotalMinor.present) {
      map['subtotal_minor'] = Variable<int>(subtotalMinor.value);
    }
    if (discountMinor.present) {
      map['discount_minor'] = Variable<int>(discountMinor.value);
    }
    if (taxMinor.present) {
      map['tax_minor'] = Variable<int>(taxMinor.value);
    }
    if (totalMinor.present) {
      map['total_minor'] = Variable<int>(totalMinor.value);
    }
    if (currencyCode.present) {
      map['currency_code'] = Variable<String>(currencyCode.value);
    }
    if (currencyMinorUnits.present) {
      map['currency_minor_units'] = Variable<int>(currencyMinorUnits.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<int>(syncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SalesLocalCompanion(')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('cashierId: $cashierId, ')
          ..write('customerId: $customerId, ')
          ..write('status: $status, ')
          ..write('subtotalMinor: $subtotalMinor, ')
          ..write('discountMinor: $discountMinor, ')
          ..write('taxMinor: $taxMinor, ')
          ..write('totalMinor: $totalMinor, ')
          ..write('currencyCode: $currencyCode, ')
          ..write('currencyMinorUnits: $currencyMinorUnits, ')
          ..write('deviceId: $deviceId, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SaleItemsLocalTable extends SaleItemsLocal
    with TableInfo<$SaleItemsLocalTable, SaleItemsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SaleItemsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _clientTransactionIdMeta =
      const VerificationMeta('clientTransactionId');
  @override
  late final GeneratedColumn<String> clientTransactionId =
      GeneratedColumn<String>(
        'client_transaction_id',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
        defaultConstraints: GeneratedColumn.constraintIsAlways(
          'REFERENCES sales_local (client_transaction_id)',
        ),
      );
  static const VerificationMeta _productIdMeta = const VerificationMeta(
    'productId',
  );
  @override
  late final GeneratedColumn<String> productId = GeneratedColumn<String>(
    'product_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _quantityMeta = const VerificationMeta(
    'quantity',
  );
  @override
  late final GeneratedColumn<int> quantity = GeneratedColumn<int>(
    'quantity',
    aliasedName,
    false,
    check: () => const CustomExpression('quantity >= 1'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitPriceMinorMeta = const VerificationMeta(
    'unitPriceMinor',
  );
  @override
  late final GeneratedColumn<int> unitPriceMinor = GeneratedColumn<int>(
    'unit_price_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('unit_price_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _discountMinorMeta = const VerificationMeta(
    'discountMinor',
  );
  @override
  late final GeneratedColumn<int> discountMinor = GeneratedColumn<int>(
    'discount_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('discount_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    clientTransactionId,
    productId,
    quantity,
    unitPriceMinor,
    discountMinor,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sale_items_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<SaleItemsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('client_transaction_id')) {
      context.handle(
        _clientTransactionIdMeta,
        clientTransactionId.isAcceptableOrUnknown(
          data['client_transaction_id']!,
          _clientTransactionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientTransactionIdMeta);
    }
    if (data.containsKey('product_id')) {
      context.handle(
        _productIdMeta,
        productId.isAcceptableOrUnknown(data['product_id']!, _productIdMeta),
      );
    } else if (isInserting) {
      context.missing(_productIdMeta);
    }
    if (data.containsKey('quantity')) {
      context.handle(
        _quantityMeta,
        quantity.isAcceptableOrUnknown(data['quantity']!, _quantityMeta),
      );
    } else if (isInserting) {
      context.missing(_quantityMeta);
    }
    if (data.containsKey('unit_price_minor')) {
      context.handle(
        _unitPriceMinorMeta,
        unitPriceMinor.isAcceptableOrUnknown(
          data['unit_price_minor']!,
          _unitPriceMinorMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_unitPriceMinorMeta);
    }
    if (data.containsKey('discount_minor')) {
      context.handle(
        _discountMinorMeta,
        discountMinor.isAcceptableOrUnknown(
          data['discount_minor']!,
          _discountMinorMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SaleItemsLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SaleItemsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      clientTransactionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_transaction_id'],
      )!,
      productId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_id'],
      )!,
      quantity: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}quantity'],
      )!,
      unitPriceMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_price_minor'],
      )!,
      discountMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}discount_minor'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SaleItemsLocalTable createAlias(String alias) {
    return $SaleItemsLocalTable(attachedDatabase, alias);
  }
}

class SaleItemsLocalData extends DataClass
    implements Insertable<SaleItemsLocalData> {
  /// UUID — primary key
  final String id;

  /// FK → sales_local.client_transaction_id
  final String clientTransactionId;
  final String productId;

  /// Quantity — INTEGER >= 1, never fractional
  final int quantity;

  /// Unit price — INTEGER minor units
  final int unitPriceMinor;

  /// Line discount — INTEGER minor units
  final int discountMinor;

  /// Epoch milliseconds
  final int createdAt;
  const SaleItemsLocalData({
    required this.id,
    required this.clientTransactionId,
    required this.productId,
    required this.quantity,
    required this.unitPriceMinor,
    required this.discountMinor,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['client_transaction_id'] = Variable<String>(clientTransactionId);
    map['product_id'] = Variable<String>(productId);
    map['quantity'] = Variable<int>(quantity);
    map['unit_price_minor'] = Variable<int>(unitPriceMinor);
    map['discount_minor'] = Variable<int>(discountMinor);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  SaleItemsLocalCompanion toCompanion(bool nullToAbsent) {
    return SaleItemsLocalCompanion(
      id: Value(id),
      clientTransactionId: Value(clientTransactionId),
      productId: Value(productId),
      quantity: Value(quantity),
      unitPriceMinor: Value(unitPriceMinor),
      discountMinor: Value(discountMinor),
      createdAt: Value(createdAt),
    );
  }

  factory SaleItemsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SaleItemsLocalData(
      id: serializer.fromJson<String>(json['id']),
      clientTransactionId: serializer.fromJson<String>(
        json['clientTransactionId'],
      ),
      productId: serializer.fromJson<String>(json['productId']),
      quantity: serializer.fromJson<int>(json['quantity']),
      unitPriceMinor: serializer.fromJson<int>(json['unitPriceMinor']),
      discountMinor: serializer.fromJson<int>(json['discountMinor']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'clientTransactionId': serializer.toJson<String>(clientTransactionId),
      'productId': serializer.toJson<String>(productId),
      'quantity': serializer.toJson<int>(quantity),
      'unitPriceMinor': serializer.toJson<int>(unitPriceMinor),
      'discountMinor': serializer.toJson<int>(discountMinor),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  SaleItemsLocalData copyWith({
    String? id,
    String? clientTransactionId,
    String? productId,
    int? quantity,
    int? unitPriceMinor,
    int? discountMinor,
    int? createdAt,
  }) => SaleItemsLocalData(
    id: id ?? this.id,
    clientTransactionId: clientTransactionId ?? this.clientTransactionId,
    productId: productId ?? this.productId,
    quantity: quantity ?? this.quantity,
    unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
    discountMinor: discountMinor ?? this.discountMinor,
    createdAt: createdAt ?? this.createdAt,
  );
  SaleItemsLocalData copyWithCompanion(SaleItemsLocalCompanion data) {
    return SaleItemsLocalData(
      id: data.id.present ? data.id.value : this.id,
      clientTransactionId: data.clientTransactionId.present
          ? data.clientTransactionId.value
          : this.clientTransactionId,
      productId: data.productId.present ? data.productId.value : this.productId,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      unitPriceMinor: data.unitPriceMinor.present
          ? data.unitPriceMinor.value
          : this.unitPriceMinor,
      discountMinor: data.discountMinor.present
          ? data.discountMinor.value
          : this.discountMinor,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SaleItemsLocalData(')
          ..write('id: $id, ')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('unitPriceMinor: $unitPriceMinor, ')
          ..write('discountMinor: $discountMinor, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    clientTransactionId,
    productId,
    quantity,
    unitPriceMinor,
    discountMinor,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SaleItemsLocalData &&
          other.id == this.id &&
          other.clientTransactionId == this.clientTransactionId &&
          other.productId == this.productId &&
          other.quantity == this.quantity &&
          other.unitPriceMinor == this.unitPriceMinor &&
          other.discountMinor == this.discountMinor &&
          other.createdAt == this.createdAt);
}

class SaleItemsLocalCompanion extends UpdateCompanion<SaleItemsLocalData> {
  final Value<String> id;
  final Value<String> clientTransactionId;
  final Value<String> productId;
  final Value<int> quantity;
  final Value<int> unitPriceMinor;
  final Value<int> discountMinor;
  final Value<int> createdAt;
  final Value<int> rowid;
  const SaleItemsLocalCompanion({
    this.id = const Value.absent(),
    this.clientTransactionId = const Value.absent(),
    this.productId = const Value.absent(),
    this.quantity = const Value.absent(),
    this.unitPriceMinor = const Value.absent(),
    this.discountMinor = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SaleItemsLocalCompanion.insert({
    required String id,
    required String clientTransactionId,
    required String productId,
    required int quantity,
    required int unitPriceMinor,
    this.discountMinor = const Value.absent(),
    required int createdAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       clientTransactionId = Value(clientTransactionId),
       productId = Value(productId),
       quantity = Value(quantity),
       unitPriceMinor = Value(unitPriceMinor),
       createdAt = Value(createdAt);
  static Insertable<SaleItemsLocalData> custom({
    Expression<String>? id,
    Expression<String>? clientTransactionId,
    Expression<String>? productId,
    Expression<int>? quantity,
    Expression<int>? unitPriceMinor,
    Expression<int>? discountMinor,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (clientTransactionId != null)
        'client_transaction_id': clientTransactionId,
      if (productId != null) 'product_id': productId,
      if (quantity != null) 'quantity': quantity,
      if (unitPriceMinor != null) 'unit_price_minor': unitPriceMinor,
      if (discountMinor != null) 'discount_minor': discountMinor,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SaleItemsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? clientTransactionId,
    Value<String>? productId,
    Value<int>? quantity,
    Value<int>? unitPriceMinor,
    Value<int>? discountMinor,
    Value<int>? createdAt,
    Value<int>? rowid,
  }) {
    return SaleItemsLocalCompanion(
      id: id ?? this.id,
      clientTransactionId: clientTransactionId ?? this.clientTransactionId,
      productId: productId ?? this.productId,
      quantity: quantity ?? this.quantity,
      unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
      discountMinor: discountMinor ?? this.discountMinor,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (clientTransactionId.present) {
      map['client_transaction_id'] = Variable<String>(
        clientTransactionId.value,
      );
    }
    if (productId.present) {
      map['product_id'] = Variable<String>(productId.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<int>(quantity.value);
    }
    if (unitPriceMinor.present) {
      map['unit_price_minor'] = Variable<int>(unitPriceMinor.value);
    }
    if (discountMinor.present) {
      map['discount_minor'] = Variable<int>(discountMinor.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SaleItemsLocalCompanion(')
          ..write('id: $id, ')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('unitPriceMinor: $unitPriceMinor, ')
          ..write('discountMinor: $discountMinor, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PaymentsLocalTable extends PaymentsLocal
    with TableInfo<$PaymentsLocalTable, PaymentsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PaymentsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _clientPaymentIdMeta = const VerificationMeta(
    'clientPaymentId',
  );
  @override
  late final GeneratedColumn<String> clientPaymentId = GeneratedColumn<String>(
    'client_payment_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _clientTransactionIdMeta =
      const VerificationMeta('clientTransactionId');
  @override
  late final GeneratedColumn<String> clientTransactionId =
      GeneratedColumn<String>(
        'client_transaction_id',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
        defaultConstraints: GeneratedColumn.constraintIsAlways(
          'REFERENCES sales_local (client_transaction_id)',
        ),
      );
  static const VerificationMeta _paymentMethodMeta = const VerificationMeta(
    'paymentMethod',
  );
  @override
  late final GeneratedColumn<String> paymentMethod = GeneratedColumn<String>(
    'payment_method',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _amountMinorMeta = const VerificationMeta(
    'amountMinor',
  );
  @override
  late final GeneratedColumn<int> amountMinor = GeneratedColumn<int>(
    'amount_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('amount_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _recordStatusMeta = const VerificationMeta(
    'recordStatus',
  );
  @override
  late final GeneratedColumn<String> recordStatus = GeneratedColumn<String>(
    'record_status',
    aliasedName,
    false,
    check: () =>
        const CustomExpression("record_status IN ('RECORDED', 'SYNCED')"),
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('RECORDED'),
  );
  static const VerificationMeta _verificationStatusMeta =
      const VerificationMeta('verificationStatus');
  @override
  late final GeneratedColumn<String>
  verificationStatus = GeneratedColumn<String>(
    'verification_status',
    aliasedName,
    false,
    check: () => const CustomExpression(
      "verification_status IN ('UNVERIFIED', 'VERIFIED', 'FAILED_VERIFICATION')",
    ),
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('UNVERIFIED'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _syncedAtMeta = const VerificationMeta(
    'syncedAt',
  );
  @override
  late final GeneratedColumn<int> syncedAt = GeneratedColumn<int>(
    'synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    clientPaymentId,
    clientTransactionId,
    paymentMethod,
    amountMinor,
    recordStatus,
    verificationStatus,
    createdAt,
    syncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'payments_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<PaymentsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('client_payment_id')) {
      context.handle(
        _clientPaymentIdMeta,
        clientPaymentId.isAcceptableOrUnknown(
          data['client_payment_id']!,
          _clientPaymentIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientPaymentIdMeta);
    }
    if (data.containsKey('client_transaction_id')) {
      context.handle(
        _clientTransactionIdMeta,
        clientTransactionId.isAcceptableOrUnknown(
          data['client_transaction_id']!,
          _clientTransactionIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_clientTransactionIdMeta);
    }
    if (data.containsKey('payment_method')) {
      context.handle(
        _paymentMethodMeta,
        paymentMethod.isAcceptableOrUnknown(
          data['payment_method']!,
          _paymentMethodMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_paymentMethodMeta);
    }
    if (data.containsKey('amount_minor')) {
      context.handle(
        _amountMinorMeta,
        amountMinor.isAcceptableOrUnknown(
          data['amount_minor']!,
          _amountMinorMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_amountMinorMeta);
    }
    if (data.containsKey('record_status')) {
      context.handle(
        _recordStatusMeta,
        recordStatus.isAcceptableOrUnknown(
          data['record_status']!,
          _recordStatusMeta,
        ),
      );
    }
    if (data.containsKey('verification_status')) {
      context.handle(
        _verificationStatusMeta,
        verificationStatus.isAcceptableOrUnknown(
          data['verification_status']!,
          _verificationStatusMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('synced_at')) {
      context.handle(
        _syncedAtMeta,
        syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {clientPaymentId};
  @override
  PaymentsLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PaymentsLocalData(
      clientPaymentId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_payment_id'],
      )!,
      clientTransactionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}client_transaction_id'],
      )!,
      paymentMethod: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payment_method'],
      )!,
      amountMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}amount_minor'],
      )!,
      recordStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}record_status'],
      )!,
      verificationStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}verification_status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      syncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}synced_at'],
      ),
    );
  }

  @override
  $PaymentsLocalTable createAlias(String alias) {
    return $PaymentsLocalTable(attachedDatabase, alias);
  }
}

class PaymentsLocalData extends DataClass
    implements Insertable<PaymentsLocalData> {
  /// UUID — primary key
  final String clientPaymentId;

  /// FK → sales_local.client_transaction_id
  final String clientTransactionId;
  final String paymentMethod;

  /// Amount — INTEGER minor units
  final int amountMinor;

  /// Sync lifecycle status
  final String recordStatus;

  /// Financial verification status
  final String verificationStatus;

  /// Epoch milliseconds
  final int createdAt;
  final int? syncedAt;
  const PaymentsLocalData({
    required this.clientPaymentId,
    required this.clientTransactionId,
    required this.paymentMethod,
    required this.amountMinor,
    required this.recordStatus,
    required this.verificationStatus,
    required this.createdAt,
    this.syncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['client_payment_id'] = Variable<String>(clientPaymentId);
    map['client_transaction_id'] = Variable<String>(clientTransactionId);
    map['payment_method'] = Variable<String>(paymentMethod);
    map['amount_minor'] = Variable<int>(amountMinor);
    map['record_status'] = Variable<String>(recordStatus);
    map['verification_status'] = Variable<String>(verificationStatus);
    map['created_at'] = Variable<int>(createdAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<int>(syncedAt);
    }
    return map;
  }

  PaymentsLocalCompanion toCompanion(bool nullToAbsent) {
    return PaymentsLocalCompanion(
      clientPaymentId: Value(clientPaymentId),
      clientTransactionId: Value(clientTransactionId),
      paymentMethod: Value(paymentMethod),
      amountMinor: Value(amountMinor),
      recordStatus: Value(recordStatus),
      verificationStatus: Value(verificationStatus),
      createdAt: Value(createdAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
    );
  }

  factory PaymentsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PaymentsLocalData(
      clientPaymentId: serializer.fromJson<String>(json['clientPaymentId']),
      clientTransactionId: serializer.fromJson<String>(
        json['clientTransactionId'],
      ),
      paymentMethod: serializer.fromJson<String>(json['paymentMethod']),
      amountMinor: serializer.fromJson<int>(json['amountMinor']),
      recordStatus: serializer.fromJson<String>(json['recordStatus']),
      verificationStatus: serializer.fromJson<String>(
        json['verificationStatus'],
      ),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      syncedAt: serializer.fromJson<int?>(json['syncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'clientPaymentId': serializer.toJson<String>(clientPaymentId),
      'clientTransactionId': serializer.toJson<String>(clientTransactionId),
      'paymentMethod': serializer.toJson<String>(paymentMethod),
      'amountMinor': serializer.toJson<int>(amountMinor),
      'recordStatus': serializer.toJson<String>(recordStatus),
      'verificationStatus': serializer.toJson<String>(verificationStatus),
      'createdAt': serializer.toJson<int>(createdAt),
      'syncedAt': serializer.toJson<int?>(syncedAt),
    };
  }

  PaymentsLocalData copyWith({
    String? clientPaymentId,
    String? clientTransactionId,
    String? paymentMethod,
    int? amountMinor,
    String? recordStatus,
    String? verificationStatus,
    int? createdAt,
    Value<int?> syncedAt = const Value.absent(),
  }) => PaymentsLocalData(
    clientPaymentId: clientPaymentId ?? this.clientPaymentId,
    clientTransactionId: clientTransactionId ?? this.clientTransactionId,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    amountMinor: amountMinor ?? this.amountMinor,
    recordStatus: recordStatus ?? this.recordStatus,
    verificationStatus: verificationStatus ?? this.verificationStatus,
    createdAt: createdAt ?? this.createdAt,
    syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
  );
  PaymentsLocalData copyWithCompanion(PaymentsLocalCompanion data) {
    return PaymentsLocalData(
      clientPaymentId: data.clientPaymentId.present
          ? data.clientPaymentId.value
          : this.clientPaymentId,
      clientTransactionId: data.clientTransactionId.present
          ? data.clientTransactionId.value
          : this.clientTransactionId,
      paymentMethod: data.paymentMethod.present
          ? data.paymentMethod.value
          : this.paymentMethod,
      amountMinor: data.amountMinor.present
          ? data.amountMinor.value
          : this.amountMinor,
      recordStatus: data.recordStatus.present
          ? data.recordStatus.value
          : this.recordStatus,
      verificationStatus: data.verificationStatus.present
          ? data.verificationStatus.value
          : this.verificationStatus,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PaymentsLocalData(')
          ..write('clientPaymentId: $clientPaymentId, ')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('paymentMethod: $paymentMethod, ')
          ..write('amountMinor: $amountMinor, ')
          ..write('recordStatus: $recordStatus, ')
          ..write('verificationStatus: $verificationStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    clientPaymentId,
    clientTransactionId,
    paymentMethod,
    amountMinor,
    recordStatus,
    verificationStatus,
    createdAt,
    syncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PaymentsLocalData &&
          other.clientPaymentId == this.clientPaymentId &&
          other.clientTransactionId == this.clientTransactionId &&
          other.paymentMethod == this.paymentMethod &&
          other.amountMinor == this.amountMinor &&
          other.recordStatus == this.recordStatus &&
          other.verificationStatus == this.verificationStatus &&
          other.createdAt == this.createdAt &&
          other.syncedAt == this.syncedAt);
}

class PaymentsLocalCompanion extends UpdateCompanion<PaymentsLocalData> {
  final Value<String> clientPaymentId;
  final Value<String> clientTransactionId;
  final Value<String> paymentMethod;
  final Value<int> amountMinor;
  final Value<String> recordStatus;
  final Value<String> verificationStatus;
  final Value<int> createdAt;
  final Value<int?> syncedAt;
  final Value<int> rowid;
  const PaymentsLocalCompanion({
    this.clientPaymentId = const Value.absent(),
    this.clientTransactionId = const Value.absent(),
    this.paymentMethod = const Value.absent(),
    this.amountMinor = const Value.absent(),
    this.recordStatus = const Value.absent(),
    this.verificationStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PaymentsLocalCompanion.insert({
    required String clientPaymentId,
    required String clientTransactionId,
    required String paymentMethod,
    required int amountMinor,
    this.recordStatus = const Value.absent(),
    this.verificationStatus = const Value.absent(),
    required int createdAt,
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : clientPaymentId = Value(clientPaymentId),
       clientTransactionId = Value(clientTransactionId),
       paymentMethod = Value(paymentMethod),
       amountMinor = Value(amountMinor),
       createdAt = Value(createdAt);
  static Insertable<PaymentsLocalData> custom({
    Expression<String>? clientPaymentId,
    Expression<String>? clientTransactionId,
    Expression<String>? paymentMethod,
    Expression<int>? amountMinor,
    Expression<String>? recordStatus,
    Expression<String>? verificationStatus,
    Expression<int>? createdAt,
    Expression<int>? syncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (clientPaymentId != null) 'client_payment_id': clientPaymentId,
      if (clientTransactionId != null)
        'client_transaction_id': clientTransactionId,
      if (paymentMethod != null) 'payment_method': paymentMethod,
      if (amountMinor != null) 'amount_minor': amountMinor,
      if (recordStatus != null) 'record_status': recordStatus,
      if (verificationStatus != null) 'verification_status': verificationStatus,
      if (createdAt != null) 'created_at': createdAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PaymentsLocalCompanion copyWith({
    Value<String>? clientPaymentId,
    Value<String>? clientTransactionId,
    Value<String>? paymentMethod,
    Value<int>? amountMinor,
    Value<String>? recordStatus,
    Value<String>? verificationStatus,
    Value<int>? createdAt,
    Value<int?>? syncedAt,
    Value<int>? rowid,
  }) {
    return PaymentsLocalCompanion(
      clientPaymentId: clientPaymentId ?? this.clientPaymentId,
      clientTransactionId: clientTransactionId ?? this.clientTransactionId,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      amountMinor: amountMinor ?? this.amountMinor,
      recordStatus: recordStatus ?? this.recordStatus,
      verificationStatus: verificationStatus ?? this.verificationStatus,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (clientPaymentId.present) {
      map['client_payment_id'] = Variable<String>(clientPaymentId.value);
    }
    if (clientTransactionId.present) {
      map['client_transaction_id'] = Variable<String>(
        clientTransactionId.value,
      );
    }
    if (paymentMethod.present) {
      map['payment_method'] = Variable<String>(paymentMethod.value);
    }
    if (amountMinor.present) {
      map['amount_minor'] = Variable<int>(amountMinor.value);
    }
    if (recordStatus.present) {
      map['record_status'] = Variable<String>(recordStatus.value);
    }
    if (verificationStatus.present) {
      map['verification_status'] = Variable<String>(verificationStatus.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<int>(syncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PaymentsLocalCompanion(')
          ..write('clientPaymentId: $clientPaymentId, ')
          ..write('clientTransactionId: $clientTransactionId, ')
          ..write('paymentMethod: $paymentMethod, ')
          ..write('amountMinor: $amountMinor, ')
          ..write('recordStatus: $recordStatus, ')
          ..write('verificationStatus: $verificationStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalIdempotencyKeysTable extends LocalIdempotencyKeys
    with TableInfo<$LocalIdempotencyKeysTable, LocalIdempotencyKey> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalIdempotencyKeysTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _businessIdMeta = const VerificationMeta(
    'businessId',
  );
  @override
  late final GeneratedColumn<String> businessId = GeneratedColumn<String>(
    'business_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityTypeMeta = const VerificationMeta(
    'entityType',
  );
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
    'entity_type',
    aliasedName,
    false,
    check: () => const CustomExpression("entity_type IN ('SALE', 'PAYMENT')"),
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    key,
    businessId,
    entityType,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_idempotency_keys';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalIdempotencyKey> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  LocalIdempotencyKey map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalIdempotencyKey(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $LocalIdempotencyKeysTable createAlias(String alias) {
    return $LocalIdempotencyKeysTable(attachedDatabase, alias);
  }
}

class LocalIdempotencyKey extends DataClass
    implements Insertable<LocalIdempotencyKey> {
  /// The idempotency key (client_transaction_id or client_payment_id)
  final String key;
  final String businessId;

  /// Entity type — restricted to SALE or PAYMENT
  final String entityType;

  /// Epoch milliseconds
  final int createdAt;
  const LocalIdempotencyKey({
    required this.key,
    required this.businessId,
    required this.entityType,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['business_id'] = Variable<String>(businessId);
    map['entity_type'] = Variable<String>(entityType);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  LocalIdempotencyKeysCompanion toCompanion(bool nullToAbsent) {
    return LocalIdempotencyKeysCompanion(
      key: Value(key),
      businessId: Value(businessId),
      entityType: Value(entityType),
      createdAt: Value(createdAt),
    );
  }

  factory LocalIdempotencyKey.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalIdempotencyKey(
      key: serializer.fromJson<String>(json['key']),
      businessId: serializer.fromJson<String>(json['businessId']),
      entityType: serializer.fromJson<String>(json['entityType']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'businessId': serializer.toJson<String>(businessId),
      'entityType': serializer.toJson<String>(entityType),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  LocalIdempotencyKey copyWith({
    String? key,
    String? businessId,
    String? entityType,
    int? createdAt,
  }) => LocalIdempotencyKey(
    key: key ?? this.key,
    businessId: businessId ?? this.businessId,
    entityType: entityType ?? this.entityType,
    createdAt: createdAt ?? this.createdAt,
  );
  LocalIdempotencyKey copyWithCompanion(LocalIdempotencyKeysCompanion data) {
    return LocalIdempotencyKey(
      key: data.key.present ? data.key.value : this.key,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalIdempotencyKey(')
          ..write('key: $key, ')
          ..write('businessId: $businessId, ')
          ..write('entityType: $entityType, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, businessId, entityType, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalIdempotencyKey &&
          other.key == this.key &&
          other.businessId == this.businessId &&
          other.entityType == this.entityType &&
          other.createdAt == this.createdAt);
}

class LocalIdempotencyKeysCompanion
    extends UpdateCompanion<LocalIdempotencyKey> {
  final Value<String> key;
  final Value<String> businessId;
  final Value<String> entityType;
  final Value<int> createdAt;
  final Value<int> rowid;
  const LocalIdempotencyKeysCompanion({
    this.key = const Value.absent(),
    this.businessId = const Value.absent(),
    this.entityType = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalIdempotencyKeysCompanion.insert({
    required String key,
    required String businessId,
    required String entityType,
    required int createdAt,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       businessId = Value(businessId),
       entityType = Value(entityType),
       createdAt = Value(createdAt);
  static Insertable<LocalIdempotencyKey> custom({
    Expression<String>? key,
    Expression<String>? businessId,
    Expression<String>? entityType,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (businessId != null) 'business_id': businessId,
      if (entityType != null) 'entity_type': entityType,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalIdempotencyKeysCompanion copyWith({
    Value<String>? key,
    Value<String>? businessId,
    Value<String>? entityType,
    Value<int>? createdAt,
    Value<int>? rowid,
  }) {
    return LocalIdempotencyKeysCompanion(
      key: key ?? this.key,
      businessId: businessId ?? this.businessId,
      entityType: entityType ?? this.entityType,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalIdempotencyKeysCompanion(')
          ..write('key: $key, ')
          ..write('businessId: $businessId, ')
          ..write('entityType: $entityType, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $SalesLocalTable salesLocal = $SalesLocalTable(this);
  late final $SaleItemsLocalTable saleItemsLocal = $SaleItemsLocalTable(this);
  late final $PaymentsLocalTable paymentsLocal = $PaymentsLocalTable(this);
  late final $LocalIdempotencyKeysTable localIdempotencyKeys =
      $LocalIdempotencyKeysTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    salesLocal,
    saleItemsLocal,
    paymentsLocal,
    localIdempotencyKeys,
  ];
}

typedef $$SalesLocalTableCreateCompanionBuilder =
    SalesLocalCompanion Function({
      required String clientTransactionId,
      required String businessId,
      required String branchId,
      required String cashierId,
      Value<String?> customerId,
      required String status,
      required int subtotalMinor,
      Value<int> discountMinor,
      Value<int> taxMinor,
      required int totalMinor,
      required String currencyCode,
      required int currencyMinorUnits,
      required String deviceId,
      required int createdAt,
      required int updatedAt,
      Value<int?> syncedAt,
      Value<int> rowid,
    });
typedef $$SalesLocalTableUpdateCompanionBuilder =
    SalesLocalCompanion Function({
      Value<String> clientTransactionId,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> cashierId,
      Value<String?> customerId,
      Value<String> status,
      Value<int> subtotalMinor,
      Value<int> discountMinor,
      Value<int> taxMinor,
      Value<int> totalMinor,
      Value<String> currencyCode,
      Value<int> currencyMinorUnits,
      Value<String> deviceId,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int?> syncedAt,
      Value<int> rowid,
    });

final class $$SalesLocalTableReferences
    extends BaseReferences<_$AppDatabase, $SalesLocalTable, SalesLocalData> {
  $$SalesLocalTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$SaleItemsLocalTable, List<SaleItemsLocalData>>
  _saleItemsLocalRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.saleItemsLocal,
    aliasName:
        'sales_local__client_transaction_id__sale_items_local__client_transaction_id',
  );

  $$SaleItemsLocalTableProcessedTableManager get saleItemsLocalRefs {
    final manager = $$SaleItemsLocalTableTableManager($_db, $_db.saleItemsLocal)
        .filter(
          (f) => f.clientTransactionId.clientTransactionId.sqlEquals(
            $_itemColumn<String>('client_transaction_id')!,
          ),
        );

    final cache = $_typedResult.readTableOrNull(_saleItemsLocalRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$PaymentsLocalTable, List<PaymentsLocalData>>
  _paymentsLocalRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.paymentsLocal,
    aliasName:
        'sales_local__client_transaction_id__payments_local__client_transaction_id',
  );

  $$PaymentsLocalTableProcessedTableManager get paymentsLocalRefs {
    final manager = $$PaymentsLocalTableTableManager($_db, $_db.paymentsLocal)
        .filter(
          (f) => f.clientTransactionId.clientTransactionId.sqlEquals(
            $_itemColumn<String>('client_transaction_id')!,
          ),
        );

    final cache = $_typedResult.readTableOrNull(_paymentsLocalRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$SalesLocalTableFilterComposer
    extends Composer<_$AppDatabase, $SalesLocalTable> {
  $$SalesLocalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get clientTransactionId => $composableBuilder(
    column: $table.clientTransactionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cashierId => $composableBuilder(
    column: $table.cashierId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get taxMinor => $composableBuilder(
    column: $table.taxMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get currencyCode => $composableBuilder(
    column: $table.currencyCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get currencyMinorUnits => $composableBuilder(
    column: $table.currencyMinorUnits,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> saleItemsLocalRefs(
    Expression<bool> Function($$SaleItemsLocalTableFilterComposer f) f,
  ) {
    final $$SaleItemsLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.saleItemsLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SaleItemsLocalTableFilterComposer(
            $db: $db,
            $table: $db.saleItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> paymentsLocalRefs(
    Expression<bool> Function($$PaymentsLocalTableFilterComposer f) f,
  ) {
    final $$PaymentsLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.paymentsLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$PaymentsLocalTableFilterComposer(
            $db: $db,
            $table: $db.paymentsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$SalesLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $SalesLocalTable> {
  $$SalesLocalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get clientTransactionId => $composableBuilder(
    column: $table.clientTransactionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cashierId => $composableBuilder(
    column: $table.cashierId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get taxMinor => $composableBuilder(
    column: $table.taxMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get currencyCode => $composableBuilder(
    column: $table.currencyCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get currencyMinorUnits => $composableBuilder(
    column: $table.currencyMinorUnits,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SalesLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $SalesLocalTable> {
  $$SalesLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get clientTransactionId => $composableBuilder(
    column: $table.clientTransactionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get cashierId =>
      $composableBuilder(column: $table.cashierId, builder: (column) => column);

  GeneratedColumn<String> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get taxMinor =>
      $composableBuilder(column: $table.taxMinor, builder: (column) => column);

  GeneratedColumn<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => column,
  );

  GeneratedColumn<String> get currencyCode => $composableBuilder(
    column: $table.currencyCode,
    builder: (column) => column,
  );

  GeneratedColumn<int> get currencyMinorUnits => $composableBuilder(
    column: $table.currencyMinorUnits,
    builder: (column) => column,
  );

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  Expression<T> saleItemsLocalRefs<T extends Object>(
    Expression<T> Function($$SaleItemsLocalTableAnnotationComposer a) f,
  ) {
    final $$SaleItemsLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.saleItemsLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SaleItemsLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.saleItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> paymentsLocalRefs<T extends Object>(
    Expression<T> Function($$PaymentsLocalTableAnnotationComposer a) f,
  ) {
    final $$PaymentsLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.paymentsLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$PaymentsLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.paymentsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$SalesLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SalesLocalTable,
          SalesLocalData,
          $$SalesLocalTableFilterComposer,
          $$SalesLocalTableOrderingComposer,
          $$SalesLocalTableAnnotationComposer,
          $$SalesLocalTableCreateCompanionBuilder,
          $$SalesLocalTableUpdateCompanionBuilder,
          (SalesLocalData, $$SalesLocalTableReferences),
          SalesLocalData,
          PrefetchHooks Function({
            bool saleItemsLocalRefs,
            bool paymentsLocalRefs,
          })
        > {
  $$SalesLocalTableTableManager(_$AppDatabase db, $SalesLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SalesLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SalesLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SalesLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> clientTransactionId = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> cashierId = const Value.absent(),
                Value<String?> customerId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> subtotalMinor = const Value.absent(),
                Value<int> discountMinor = const Value.absent(),
                Value<int> taxMinor = const Value.absent(),
                Value<int> totalMinor = const Value.absent(),
                Value<String> currencyCode = const Value.absent(),
                Value<int> currencyMinorUnits = const Value.absent(),
                Value<String> deviceId = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int?> syncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SalesLocalCompanion(
                clientTransactionId: clientTransactionId,
                businessId: businessId,
                branchId: branchId,
                cashierId: cashierId,
                customerId: customerId,
                status: status,
                subtotalMinor: subtotalMinor,
                discountMinor: discountMinor,
                taxMinor: taxMinor,
                totalMinor: totalMinor,
                currencyCode: currencyCode,
                currencyMinorUnits: currencyMinorUnits,
                deviceId: deviceId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                syncedAt: syncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String clientTransactionId,
                required String businessId,
                required String branchId,
                required String cashierId,
                Value<String?> customerId = const Value.absent(),
                required String status,
                required int subtotalMinor,
                Value<int> discountMinor = const Value.absent(),
                Value<int> taxMinor = const Value.absent(),
                required int totalMinor,
                required String currencyCode,
                required int currencyMinorUnits,
                required String deviceId,
                required int createdAt,
                required int updatedAt,
                Value<int?> syncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SalesLocalCompanion.insert(
                clientTransactionId: clientTransactionId,
                businessId: businessId,
                branchId: branchId,
                cashierId: cashierId,
                customerId: customerId,
                status: status,
                subtotalMinor: subtotalMinor,
                discountMinor: discountMinor,
                taxMinor: taxMinor,
                totalMinor: totalMinor,
                currencyCode: currencyCode,
                currencyMinorUnits: currencyMinorUnits,
                deviceId: deviceId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                syncedAt: syncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$SalesLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({saleItemsLocalRefs = false, paymentsLocalRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (saleItemsLocalRefs) db.saleItemsLocal,
                    if (paymentsLocalRefs) db.paymentsLocal,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (saleItemsLocalRefs)
                        await $_getPrefetchedData<
                          SalesLocalData,
                          $SalesLocalTable,
                          SaleItemsLocalData
                        >(
                          currentTable: table,
                          referencedTable: $$SalesLocalTableReferences
                              ._saleItemsLocalRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SalesLocalTableReferences(
                                db,
                                table,
                                p0,
                              ).saleItemsLocalRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) =>
                                    e.clientTransactionId ==
                                    item.clientTransactionId,
                              ),
                          typedResults: items,
                        ),
                      if (paymentsLocalRefs)
                        await $_getPrefetchedData<
                          SalesLocalData,
                          $SalesLocalTable,
                          PaymentsLocalData
                        >(
                          currentTable: table,
                          referencedTable: $$SalesLocalTableReferences
                              ._paymentsLocalRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$SalesLocalTableReferences(
                                db,
                                table,
                                p0,
                              ).paymentsLocalRefs,
                          referencedItemsForCurrentItem:
                              (item, referencedItems) => referencedItems.where(
                                (e) =>
                                    e.clientTransactionId ==
                                    item.clientTransactionId,
                              ),
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$SalesLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SalesLocalTable,
      SalesLocalData,
      $$SalesLocalTableFilterComposer,
      $$SalesLocalTableOrderingComposer,
      $$SalesLocalTableAnnotationComposer,
      $$SalesLocalTableCreateCompanionBuilder,
      $$SalesLocalTableUpdateCompanionBuilder,
      (SalesLocalData, $$SalesLocalTableReferences),
      SalesLocalData,
      PrefetchHooks Function({bool saleItemsLocalRefs, bool paymentsLocalRefs})
    >;
typedef $$SaleItemsLocalTableCreateCompanionBuilder =
    SaleItemsLocalCompanion Function({
      required String id,
      required String clientTransactionId,
      required String productId,
      required int quantity,
      required int unitPriceMinor,
      Value<int> discountMinor,
      required int createdAt,
      Value<int> rowid,
    });
typedef $$SaleItemsLocalTableUpdateCompanionBuilder =
    SaleItemsLocalCompanion Function({
      Value<String> id,
      Value<String> clientTransactionId,
      Value<String> productId,
      Value<int> quantity,
      Value<int> unitPriceMinor,
      Value<int> discountMinor,
      Value<int> createdAt,
      Value<int> rowid,
    });

final class $$SaleItemsLocalTableReferences
    extends
        BaseReferences<
          _$AppDatabase,
          $SaleItemsLocalTable,
          SaleItemsLocalData
        > {
  $$SaleItemsLocalTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SalesLocalTable _clientTransactionIdTable(
    _$AppDatabase db,
  ) => db.salesLocal.createAlias(
    'sale_items_local__client_transaction_id__sales_local__client_transaction_id',
  );

  $$SalesLocalTableProcessedTableManager get clientTransactionId {
    final $_column = $_itemColumn<String>('client_transaction_id')!;

    final manager = $$SalesLocalTableTableManager(
      $_db,
      $_db.salesLocal,
    ).filter((f) => f.clientTransactionId.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_clientTransactionIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$SaleItemsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $SaleItemsLocalTable> {
  $$SaleItemsLocalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  $$SalesLocalTableFilterComposer get clientTransactionId {
    final $$SalesLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableFilterComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleItemsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $SaleItemsLocalTable> {
  $$SaleItemsLocalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  $$SalesLocalTableOrderingComposer get clientTransactionId {
    final $$SalesLocalTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableOrderingComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleItemsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $SaleItemsLocalTable> {
  $$SaleItemsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get productId =>
      $composableBuilder(column: $table.productId, builder: (column) => column);

  GeneratedColumn<int> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get discountMinor => $composableBuilder(
    column: $table.discountMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  $$SalesLocalTableAnnotationComposer get clientTransactionId {
    final $$SalesLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleItemsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SaleItemsLocalTable,
          SaleItemsLocalData,
          $$SaleItemsLocalTableFilterComposer,
          $$SaleItemsLocalTableOrderingComposer,
          $$SaleItemsLocalTableAnnotationComposer,
          $$SaleItemsLocalTableCreateCompanionBuilder,
          $$SaleItemsLocalTableUpdateCompanionBuilder,
          (SaleItemsLocalData, $$SaleItemsLocalTableReferences),
          SaleItemsLocalData,
          PrefetchHooks Function({bool clientTransactionId})
        > {
  $$SaleItemsLocalTableTableManager(
    _$AppDatabase db,
    $SaleItemsLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SaleItemsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SaleItemsLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SaleItemsLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> clientTransactionId = const Value.absent(),
                Value<String> productId = const Value.absent(),
                Value<int> quantity = const Value.absent(),
                Value<int> unitPriceMinor = const Value.absent(),
                Value<int> discountMinor = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SaleItemsLocalCompanion(
                id: id,
                clientTransactionId: clientTransactionId,
                productId: productId,
                quantity: quantity,
                unitPriceMinor: unitPriceMinor,
                discountMinor: discountMinor,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String clientTransactionId,
                required String productId,
                required int quantity,
                required int unitPriceMinor,
                Value<int> discountMinor = const Value.absent(),
                required int createdAt,
                Value<int> rowid = const Value.absent(),
              }) => SaleItemsLocalCompanion.insert(
                id: id,
                clientTransactionId: clientTransactionId,
                productId: productId,
                quantity: quantity,
                unitPriceMinor: unitPriceMinor,
                discountMinor: discountMinor,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$SaleItemsLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({clientTransactionId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (clientTransactionId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.clientTransactionId,
                                referencedTable: $$SaleItemsLocalTableReferences
                                    ._clientTransactionIdTable(db),
                                referencedColumn:
                                    $$SaleItemsLocalTableReferences
                                        ._clientTransactionIdTable(db)
                                        .clientTransactionId,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$SaleItemsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SaleItemsLocalTable,
      SaleItemsLocalData,
      $$SaleItemsLocalTableFilterComposer,
      $$SaleItemsLocalTableOrderingComposer,
      $$SaleItemsLocalTableAnnotationComposer,
      $$SaleItemsLocalTableCreateCompanionBuilder,
      $$SaleItemsLocalTableUpdateCompanionBuilder,
      (SaleItemsLocalData, $$SaleItemsLocalTableReferences),
      SaleItemsLocalData,
      PrefetchHooks Function({bool clientTransactionId})
    >;
typedef $$PaymentsLocalTableCreateCompanionBuilder =
    PaymentsLocalCompanion Function({
      required String clientPaymentId,
      required String clientTransactionId,
      required String paymentMethod,
      required int amountMinor,
      Value<String> recordStatus,
      Value<String> verificationStatus,
      required int createdAt,
      Value<int?> syncedAt,
      Value<int> rowid,
    });
typedef $$PaymentsLocalTableUpdateCompanionBuilder =
    PaymentsLocalCompanion Function({
      Value<String> clientPaymentId,
      Value<String> clientTransactionId,
      Value<String> paymentMethod,
      Value<int> amountMinor,
      Value<String> recordStatus,
      Value<String> verificationStatus,
      Value<int> createdAt,
      Value<int?> syncedAt,
      Value<int> rowid,
    });

final class $$PaymentsLocalTableReferences
    extends
        BaseReferences<_$AppDatabase, $PaymentsLocalTable, PaymentsLocalData> {
  $$PaymentsLocalTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $SalesLocalTable _clientTransactionIdTable(
    _$AppDatabase db,
  ) => db.salesLocal.createAlias(
    'payments_local__client_transaction_id__sales_local__client_transaction_id',
  );

  $$SalesLocalTableProcessedTableManager get clientTransactionId {
    final $_column = $_itemColumn<String>('client_transaction_id')!;

    final manager = $$SalesLocalTableTableManager(
      $_db,
      $_db.salesLocal,
    ).filter((f) => f.clientTransactionId.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_clientTransactionIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$PaymentsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $PaymentsLocalTable> {
  $$PaymentsLocalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get clientPaymentId => $composableBuilder(
    column: $table.clientPaymentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get paymentMethod => $composableBuilder(
    column: $table.paymentMethod,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get amountMinor => $composableBuilder(
    column: $table.amountMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recordStatus => $composableBuilder(
    column: $table.recordStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get verificationStatus => $composableBuilder(
    column: $table.verificationStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnFilters(column),
  );

  $$SalesLocalTableFilterComposer get clientTransactionId {
    final $$SalesLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableFilterComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PaymentsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $PaymentsLocalTable> {
  $$PaymentsLocalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get clientPaymentId => $composableBuilder(
    column: $table.clientPaymentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get paymentMethod => $composableBuilder(
    column: $table.paymentMethod,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get amountMinor => $composableBuilder(
    column: $table.amountMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recordStatus => $composableBuilder(
    column: $table.recordStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get verificationStatus => $composableBuilder(
    column: $table.verificationStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnOrderings(column),
  );

  $$SalesLocalTableOrderingComposer get clientTransactionId {
    final $$SalesLocalTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableOrderingComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PaymentsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $PaymentsLocalTable> {
  $$PaymentsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get clientPaymentId => $composableBuilder(
    column: $table.clientPaymentId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get paymentMethod => $composableBuilder(
    column: $table.paymentMethod,
    builder: (column) => column,
  );

  GeneratedColumn<int> get amountMinor => $composableBuilder(
    column: $table.amountMinor,
    builder: (column) => column,
  );

  GeneratedColumn<String> get recordStatus => $composableBuilder(
    column: $table.recordStatus,
    builder: (column) => column,
  );

  GeneratedColumn<String> get verificationStatus => $composableBuilder(
    column: $table.verificationStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  $$SalesLocalTableAnnotationComposer get clientTransactionId {
    final $$SalesLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.clientTransactionId,
      referencedTable: $db.salesLocal,
      getReferencedColumn: (t) => t.clientTransactionId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SalesLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.salesLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PaymentsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PaymentsLocalTable,
          PaymentsLocalData,
          $$PaymentsLocalTableFilterComposer,
          $$PaymentsLocalTableOrderingComposer,
          $$PaymentsLocalTableAnnotationComposer,
          $$PaymentsLocalTableCreateCompanionBuilder,
          $$PaymentsLocalTableUpdateCompanionBuilder,
          (PaymentsLocalData, $$PaymentsLocalTableReferences),
          PaymentsLocalData,
          PrefetchHooks Function({bool clientTransactionId})
        > {
  $$PaymentsLocalTableTableManager(_$AppDatabase db, $PaymentsLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PaymentsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PaymentsLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PaymentsLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> clientPaymentId = const Value.absent(),
                Value<String> clientTransactionId = const Value.absent(),
                Value<String> paymentMethod = const Value.absent(),
                Value<int> amountMinor = const Value.absent(),
                Value<String> recordStatus = const Value.absent(),
                Value<String> verificationStatus = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int?> syncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PaymentsLocalCompanion(
                clientPaymentId: clientPaymentId,
                clientTransactionId: clientTransactionId,
                paymentMethod: paymentMethod,
                amountMinor: amountMinor,
                recordStatus: recordStatus,
                verificationStatus: verificationStatus,
                createdAt: createdAt,
                syncedAt: syncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String clientPaymentId,
                required String clientTransactionId,
                required String paymentMethod,
                required int amountMinor,
                Value<String> recordStatus = const Value.absent(),
                Value<String> verificationStatus = const Value.absent(),
                required int createdAt,
                Value<int?> syncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PaymentsLocalCompanion.insert(
                clientPaymentId: clientPaymentId,
                clientTransactionId: clientTransactionId,
                paymentMethod: paymentMethod,
                amountMinor: amountMinor,
                recordStatus: recordStatus,
                verificationStatus: verificationStatus,
                createdAt: createdAt,
                syncedAt: syncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$PaymentsLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({clientTransactionId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (clientTransactionId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.clientTransactionId,
                                referencedTable: $$PaymentsLocalTableReferences
                                    ._clientTransactionIdTable(db),
                                referencedColumn: $$PaymentsLocalTableReferences
                                    ._clientTransactionIdTable(db)
                                    .clientTransactionId,
                              )
                              as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$PaymentsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PaymentsLocalTable,
      PaymentsLocalData,
      $$PaymentsLocalTableFilterComposer,
      $$PaymentsLocalTableOrderingComposer,
      $$PaymentsLocalTableAnnotationComposer,
      $$PaymentsLocalTableCreateCompanionBuilder,
      $$PaymentsLocalTableUpdateCompanionBuilder,
      (PaymentsLocalData, $$PaymentsLocalTableReferences),
      PaymentsLocalData,
      PrefetchHooks Function({bool clientTransactionId})
    >;
typedef $$LocalIdempotencyKeysTableCreateCompanionBuilder =
    LocalIdempotencyKeysCompanion Function({
      required String key,
      required String businessId,
      required String entityType,
      required int createdAt,
      Value<int> rowid,
    });
typedef $$LocalIdempotencyKeysTableUpdateCompanionBuilder =
    LocalIdempotencyKeysCompanion Function({
      Value<String> key,
      Value<String> businessId,
      Value<String> entityType,
      Value<int> createdAt,
      Value<int> rowid,
    });

class $$LocalIdempotencyKeysTableFilterComposer
    extends Composer<_$AppDatabase, $LocalIdempotencyKeysTable> {
  $$LocalIdempotencyKeysTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalIdempotencyKeysTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalIdempotencyKeysTable> {
  $$LocalIdempotencyKeysTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalIdempotencyKeysTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalIdempotencyKeysTable> {
  $$LocalIdempotencyKeysTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$LocalIdempotencyKeysTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalIdempotencyKeysTable,
          LocalIdempotencyKey,
          $$LocalIdempotencyKeysTableFilterComposer,
          $$LocalIdempotencyKeysTableOrderingComposer,
          $$LocalIdempotencyKeysTableAnnotationComposer,
          $$LocalIdempotencyKeysTableCreateCompanionBuilder,
          $$LocalIdempotencyKeysTableUpdateCompanionBuilder,
          (
            LocalIdempotencyKey,
            BaseReferences<
              _$AppDatabase,
              $LocalIdempotencyKeysTable,
              LocalIdempotencyKey
            >,
          ),
          LocalIdempotencyKey,
          PrefetchHooks Function()
        > {
  $$LocalIdempotencyKeysTableTableManager(
    _$AppDatabase db,
    $LocalIdempotencyKeysTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalIdempotencyKeysTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalIdempotencyKeysTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$LocalIdempotencyKeysTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> entityType = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalIdempotencyKeysCompanion(
                key: key,
                businessId: businessId,
                entityType: entityType,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String key,
                required String businessId,
                required String entityType,
                required int createdAt,
                Value<int> rowid = const Value.absent(),
              }) => LocalIdempotencyKeysCompanion.insert(
                key: key,
                businessId: businessId,
                entityType: entityType,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalIdempotencyKeysTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalIdempotencyKeysTable,
      LocalIdempotencyKey,
      $$LocalIdempotencyKeysTableFilterComposer,
      $$LocalIdempotencyKeysTableOrderingComposer,
      $$LocalIdempotencyKeysTableAnnotationComposer,
      $$LocalIdempotencyKeysTableCreateCompanionBuilder,
      $$LocalIdempotencyKeysTableUpdateCompanionBuilder,
      (
        LocalIdempotencyKey,
        BaseReferences<
          _$AppDatabase,
          $LocalIdempotencyKeysTable,
          LocalIdempotencyKey
        >,
      ),
      LocalIdempotencyKey,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$SalesLocalTableTableManager get salesLocal =>
      $$SalesLocalTableTableManager(_db, _db.salesLocal);
  $$SaleItemsLocalTableTableManager get saleItemsLocal =>
      $$SaleItemsLocalTableTableManager(_db, _db.saleItemsLocal);
  $$PaymentsLocalTableTableManager get paymentsLocal =>
      $$PaymentsLocalTableTableManager(_db, _db.paymentsLocal);
  $$LocalIdempotencyKeysTableTableManager get localIdempotencyKeys =>
      $$LocalIdempotencyKeysTableTableManager(_db, _db.localIdempotencyKeys);
}
