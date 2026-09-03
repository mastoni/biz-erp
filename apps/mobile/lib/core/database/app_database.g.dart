// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $ProductsLocalTable extends ProductsLocal
    with TableInfo<$ProductsLocalTable, ProductsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ProductsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _barcodeMeta = const VerificationMeta(
    'barcode',
  );
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
    'barcode',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _localStatusMeta = const VerificationMeta(
    'localStatus',
  );
  @override
  late final GeneratedColumn<String> localStatus = GeneratedColumn<String>(
    'local_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('synced'),
  );
  static const VerificationMeta _priceMinorMeta = const VerificationMeta(
    'priceMinor',
  );
  @override
  late final GeneratedColumn<int> priceMinor = GeneratedColumn<int>(
    'price_minor',
    aliasedName,
    false,
    check: () => const CustomExpression('price_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _costMinorMeta = const VerificationMeta(
    'costMinor',
  );
  @override
  late final GeneratedColumn<int> costMinor = GeneratedColumn<int>(
    'cost_minor',
    aliasedName,
    true,
    check: () => const CustomExpression('cost_minor >= 0'),
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<int> isActive = GeneratedColumn<int>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastSyncedAtMeta = const VerificationMeta(
    'lastSyncedAt',
  );
  @override
  late final GeneratedColumn<int> lastSyncedAt = GeneratedColumn<int>(
    'last_synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    name,
    description,
    barcode,
    localStatus,
    priceMinor,
    costMinor,
    category,
    isActive,
    serverVersion,
    lastSyncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'products_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<ProductsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    }
    if (data.containsKey('barcode')) {
      context.handle(
        _barcodeMeta,
        barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta),
      );
    }
    if (data.containsKey('local_status')) {
      context.handle(
        _localStatusMeta,
        localStatus.isAcceptableOrUnknown(
          data['local_status']!,
          _localStatusMeta,
        ),
      );
    }
    if (data.containsKey('price_minor')) {
      context.handle(
        _priceMinorMeta,
        priceMinor.isAcceptableOrUnknown(data['price_minor']!, _priceMinorMeta),
      );
    } else if (isInserting) {
      context.missing(_priceMinorMeta);
    }
    if (data.containsKey('cost_minor')) {
      context.handle(
        _costMinorMeta,
        costMinor.isAcceptableOrUnknown(data['cost_minor']!, _costMinorMeta),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('last_synced_at')) {
      context.handle(
        _lastSyncedAtMeta,
        lastSyncedAt.isAcceptableOrUnknown(
          data['last_synced_at']!,
          _lastSyncedAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ProductsLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ProductsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      ),
      barcode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}barcode'],
      ),
      localStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_status'],
      )!,
      priceMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}price_minor'],
      )!,
      costMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}cost_minor'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}is_active'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      lastSyncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_synced_at'],
      ),
    );
  }

  @override
  $ProductsLocalTable createAlias(String alias) {
    return $ProductsLocalTable(attachedDatabase, alias);
  }
}

class ProductsLocalData extends DataClass
    implements Insertable<ProductsLocalData> {
  /// Server-generated globally unique UUID (ASSUMPTION-PROD-001)
  final String id;
  final String businessId;
  final String name;
  final String? description;
  final String? barcode;
  final String localStatus;

  /// Price in minor units (INTEGER, no floating point)
  final int priceMinor;

  /// Cost in minor units (HPP) - nullable, separate from sale price
  final int? costMinor;
  final String? category;

  /// Soft delete flag. 1 = active, 0 = inactive.
  /// Inactive products remain in DB for historical reference.
  final int isActive;

  /// Sync version tracking for Phase 3 Sync Engine
  final int serverVersion;

  /// Last sync timestamp (epoch ms)
  final int? lastSyncedAt;
  const ProductsLocalData({
    required this.id,
    required this.businessId,
    required this.name,
    this.description,
    this.barcode,
    required this.localStatus,
    required this.priceMinor,
    this.costMinor,
    this.category,
    required this.isActive,
    required this.serverVersion,
    this.lastSyncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || description != null) {
      map['description'] = Variable<String>(description);
    }
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    map['local_status'] = Variable<String>(localStatus);
    map['price_minor'] = Variable<int>(priceMinor);
    if (!nullToAbsent || costMinor != null) {
      map['cost_minor'] = Variable<int>(costMinor);
    }
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    map['is_active'] = Variable<int>(isActive);
    map['server_version'] = Variable<int>(serverVersion);
    if (!nullToAbsent || lastSyncedAt != null) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt);
    }
    return map;
  }

  ProductsLocalCompanion toCompanion(bool nullToAbsent) {
    return ProductsLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      name: Value(name),
      description: description == null && nullToAbsent
          ? const Value.absent()
          : Value(description),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
      localStatus: Value(localStatus),
      priceMinor: Value(priceMinor),
      costMinor: costMinor == null && nullToAbsent
          ? const Value.absent()
          : Value(costMinor),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      isActive: Value(isActive),
      serverVersion: Value(serverVersion),
      lastSyncedAt: lastSyncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncedAt),
    );
  }

  factory ProductsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ProductsLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      name: serializer.fromJson<String>(json['name']),
      description: serializer.fromJson<String?>(json['description']),
      barcode: serializer.fromJson<String?>(json['barcode']),
      localStatus: serializer.fromJson<String>(json['localStatus']),
      priceMinor: serializer.fromJson<int>(json['priceMinor']),
      costMinor: serializer.fromJson<int?>(json['costMinor']),
      category: serializer.fromJson<String?>(json['category']),
      isActive: serializer.fromJson<int>(json['isActive']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      lastSyncedAt: serializer.fromJson<int?>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'name': serializer.toJson<String>(name),
      'description': serializer.toJson<String?>(description),
      'barcode': serializer.toJson<String?>(barcode),
      'localStatus': serializer.toJson<String>(localStatus),
      'priceMinor': serializer.toJson<int>(priceMinor),
      'costMinor': serializer.toJson<int?>(costMinor),
      'category': serializer.toJson<String?>(category),
      'isActive': serializer.toJson<int>(isActive),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'lastSyncedAt': serializer.toJson<int?>(lastSyncedAt),
    };
  }

  ProductsLocalData copyWith({
    String? id,
    String? businessId,
    String? name,
    Value<String?> description = const Value.absent(),
    Value<String?> barcode = const Value.absent(),
    String? localStatus,
    int? priceMinor,
    Value<int?> costMinor = const Value.absent(),
    Value<String?> category = const Value.absent(),
    int? isActive,
    int? serverVersion,
    Value<int?> lastSyncedAt = const Value.absent(),
  }) => ProductsLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    name: name ?? this.name,
    description: description.present ? description.value : this.description,
    barcode: barcode.present ? barcode.value : this.barcode,
    localStatus: localStatus ?? this.localStatus,
    priceMinor: priceMinor ?? this.priceMinor,
    costMinor: costMinor.present ? costMinor.value : this.costMinor,
    category: category.present ? category.value : this.category,
    isActive: isActive ?? this.isActive,
    serverVersion: serverVersion ?? this.serverVersion,
    lastSyncedAt: lastSyncedAt.present ? lastSyncedAt.value : this.lastSyncedAt,
  );
  ProductsLocalData copyWithCompanion(ProductsLocalCompanion data) {
    return ProductsLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      name: data.name.present ? data.name.value : this.name,
      description: data.description.present
          ? data.description.value
          : this.description,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      localStatus: data.localStatus.present
          ? data.localStatus.value
          : this.localStatus,
      priceMinor: data.priceMinor.present
          ? data.priceMinor.value
          : this.priceMinor,
      costMinor: data.costMinor.present ? data.costMinor.value : this.costMinor,
      category: data.category.present ? data.category.value : this.category,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ProductsLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('description: $description, ')
          ..write('barcode: $barcode, ')
          ..write('localStatus: $localStatus, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('costMinor: $costMinor, ')
          ..write('category: $category, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    name,
    description,
    barcode,
    localStatus,
    priceMinor,
    costMinor,
    category,
    isActive,
    serverVersion,
    lastSyncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ProductsLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.name == this.name &&
          other.description == this.description &&
          other.barcode == this.barcode &&
          other.localStatus == this.localStatus &&
          other.priceMinor == this.priceMinor &&
          other.costMinor == this.costMinor &&
          other.category == this.category &&
          other.isActive == this.isActive &&
          other.serverVersion == this.serverVersion &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class ProductsLocalCompanion extends UpdateCompanion<ProductsLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> name;
  final Value<String?> description;
  final Value<String?> barcode;
  final Value<String> localStatus;
  final Value<int> priceMinor;
  final Value<int?> costMinor;
  final Value<String?> category;
  final Value<int> isActive;
  final Value<int> serverVersion;
  final Value<int?> lastSyncedAt;
  final Value<int> rowid;
  const ProductsLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.name = const Value.absent(),
    this.description = const Value.absent(),
    this.barcode = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.priceMinor = const Value.absent(),
    this.costMinor = const Value.absent(),
    this.category = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ProductsLocalCompanion.insert({
    required String id,
    required String businessId,
    required String name,
    this.description = const Value.absent(),
    this.barcode = const Value.absent(),
    this.localStatus = const Value.absent(),
    required int priceMinor,
    this.costMinor = const Value.absent(),
    this.category = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       name = Value(name),
       priceMinor = Value(priceMinor);
  static Insertable<ProductsLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? name,
    Expression<String>? description,
    Expression<String>? barcode,
    Expression<String>? localStatus,
    Expression<int>? priceMinor,
    Expression<int>? costMinor,
    Expression<String>? category,
    Expression<int>? isActive,
    Expression<int>? serverVersion,
    Expression<int>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (barcode != null) 'barcode': barcode,
      if (localStatus != null) 'local_status': localStatus,
      if (priceMinor != null) 'price_minor': priceMinor,
      if (costMinor != null) 'cost_minor': costMinor,
      if (category != null) 'category': category,
      if (isActive != null) 'is_active': isActive,
      if (serverVersion != null) 'server_version': serverVersion,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ProductsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? name,
    Value<String?>? description,
    Value<String?>? barcode,
    Value<String>? localStatus,
    Value<int>? priceMinor,
    Value<int?>? costMinor,
    Value<String?>? category,
    Value<int>? isActive,
    Value<int>? serverVersion,
    Value<int?>? lastSyncedAt,
    Value<int>? rowid,
  }) {
    return ProductsLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      name: name ?? this.name,
      description: description ?? this.description,
      barcode: barcode ?? this.barcode,
      localStatus: localStatus ?? this.localStatus,
      priceMinor: priceMinor ?? this.priceMinor,
      costMinor: costMinor ?? this.costMinor,
      category: category ?? this.category,
      isActive: isActive ?? this.isActive,
      serverVersion: serverVersion ?? this.serverVersion,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (localStatus.present) {
      map['local_status'] = Variable<String>(localStatus.value);
    }
    if (priceMinor.present) {
      map['price_minor'] = Variable<int>(priceMinor.value);
    }
    if (costMinor.present) {
      map['cost_minor'] = Variable<int>(costMinor.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<int>(isActive.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ProductsLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('description: $description, ')
          ..write('barcode: $barcode, ')
          ..write('localStatus: $localStatus, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('costMinor: $costMinor, ')
          ..write('category: $category, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BusinessSettingsLocalTable extends BusinessSettingsLocal
    with TableInfo<$BusinessSettingsLocalTable, BusinessSettingsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BusinessSettingsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
    requiredDuringInsert: false,
    defaultValue: const Constant('__BUSINESS__'),
  );
  static const VerificationMeta _taxRateBpsMeta = const VerificationMeta(
    'taxRateBps',
  );
  @override
  late final GeneratedColumn<int> taxRateBps = GeneratedColumn<int>(
    'tax_rate_bps',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
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
    requiredDuringInsert: false,
    defaultValue: const Constant('IDR'),
  );
  static const VerificationMeta _currencyMinorUnitsMeta =
      const VerificationMeta('currencyMinorUnits');
  @override
  late final GeneratedColumn<int> currencyMinorUnits = GeneratedColumn<int>(
    'currency_minor_units',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _timezoneMeta = const VerificationMeta(
    'timezone',
  );
  @override
  late final GeneratedColumn<String> timezone = GeneratedColumn<String>(
    'timezone',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('Asia/Jakarta'),
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
  static const VerificationMeta _settingsJsonMeta = const VerificationMeta(
    'settingsJson',
  );
  @override
  late final GeneratedColumn<String> settingsJson = GeneratedColumn<String>(
    'settings_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('{}'),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    branchId,
    taxRateBps,
    currencyCode,
    currencyMinorUnits,
    timezone,
    updatedAt,
    settingsJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'business_settings_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<BusinessSettingsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
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
    }
    if (data.containsKey('tax_rate_bps')) {
      context.handle(
        _taxRateBpsMeta,
        taxRateBps.isAcceptableOrUnknown(
          data['tax_rate_bps']!,
          _taxRateBpsMeta,
        ),
      );
    }
    if (data.containsKey('currency_code')) {
      context.handle(
        _currencyCodeMeta,
        currencyCode.isAcceptableOrUnknown(
          data['currency_code']!,
          _currencyCodeMeta,
        ),
      );
    }
    if (data.containsKey('currency_minor_units')) {
      context.handle(
        _currencyMinorUnitsMeta,
        currencyMinorUnits.isAcceptableOrUnknown(
          data['currency_minor_units']!,
          _currencyMinorUnitsMeta,
        ),
      );
    }
    if (data.containsKey('timezone')) {
      context.handle(
        _timezoneMeta,
        timezone.isAcceptableOrUnknown(data['timezone']!, _timezoneMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('settings_json')) {
      context.handle(
        _settingsJsonMeta,
        settingsJson.isAcceptableOrUnknown(
          data['settings_json']!,
          _settingsJsonMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  BusinessSettingsLocalData map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BusinessSettingsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      taxRateBps: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}tax_rate_bps'],
      )!,
      currencyCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}currency_code'],
      )!,
      currencyMinorUnits: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}currency_minor_units'],
      )!,
      timezone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}timezone'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
      settingsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}settings_json'],
      )!,
    );
  }

  @override
  $BusinessSettingsLocalTable createAlias(String alias) {
    return $BusinessSettingsLocalTable(attachedDatabase, alias);
  }
}

class BusinessSettingsLocalData extends DataClass
    implements Insertable<BusinessSettingsLocalData> {
  final String id;
  final String businessId;

  /// Branch UUID or '__BUSINESS__' sentinel for business-level settings.
  /// Real branch_id MUST NOT equal '__BUSINESS__' (ASSUMPTION-BRANCH-001).
  final String branchId;

  /// Tax rate in basis points. 11% = 1100 bps. INTEGER only.
  final int taxRateBps;
  final String currencyCode;
  final int currencyMinorUnits;

  /// IANA timezone identifier. Authoritative for receipt_date (TZ rule).
  final String timezone;
  final int updatedAt;

  /// Canonical resolved store settings serialized as JSON.
  /// Single source of truth for all store configuration; populated
  /// from GET /v1/settings/store. Existing scalar columns
  /// (taxRateBps, currencyCode, etc.) are derived from this JSON
  /// for backward compatibility.
  final String settingsJson;
  const BusinessSettingsLocalData({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.taxRateBps,
    required this.currencyCode,
    required this.currencyMinorUnits,
    required this.timezone,
    required this.updatedAt,
    required this.settingsJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['tax_rate_bps'] = Variable<int>(taxRateBps);
    map['currency_code'] = Variable<String>(currencyCode);
    map['currency_minor_units'] = Variable<int>(currencyMinorUnits);
    map['timezone'] = Variable<String>(timezone);
    map['updated_at'] = Variable<int>(updatedAt);
    map['settings_json'] = Variable<String>(settingsJson);
    return map;
  }

  BusinessSettingsLocalCompanion toCompanion(bool nullToAbsent) {
    return BusinessSettingsLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      branchId: Value(branchId),
      taxRateBps: Value(taxRateBps),
      currencyCode: Value(currencyCode),
      currencyMinorUnits: Value(currencyMinorUnits),
      timezone: Value(timezone),
      updatedAt: Value(updatedAt),
      settingsJson: Value(settingsJson),
    );
  }

  factory BusinessSettingsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BusinessSettingsLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      taxRateBps: serializer.fromJson<int>(json['taxRateBps']),
      currencyCode: serializer.fromJson<String>(json['currencyCode']),
      currencyMinorUnits: serializer.fromJson<int>(json['currencyMinorUnits']),
      timezone: serializer.fromJson<String>(json['timezone']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
      settingsJson: serializer.fromJson<String>(json['settingsJson']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'taxRateBps': serializer.toJson<int>(taxRateBps),
      'currencyCode': serializer.toJson<String>(currencyCode),
      'currencyMinorUnits': serializer.toJson<int>(currencyMinorUnits),
      'timezone': serializer.toJson<String>(timezone),
      'updatedAt': serializer.toJson<int>(updatedAt),
      'settingsJson': serializer.toJson<String>(settingsJson),
    };
  }

  BusinessSettingsLocalData copyWith({
    String? id,
    String? businessId,
    String? branchId,
    int? taxRateBps,
    String? currencyCode,
    int? currencyMinorUnits,
    String? timezone,
    int? updatedAt,
    String? settingsJson,
  }) => BusinessSettingsLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    taxRateBps: taxRateBps ?? this.taxRateBps,
    currencyCode: currencyCode ?? this.currencyCode,
    currencyMinorUnits: currencyMinorUnits ?? this.currencyMinorUnits,
    timezone: timezone ?? this.timezone,
    updatedAt: updatedAt ?? this.updatedAt,
    settingsJson: settingsJson ?? this.settingsJson,
  );
  BusinessSettingsLocalData copyWithCompanion(
    BusinessSettingsLocalCompanion data,
  ) {
    return BusinessSettingsLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      taxRateBps: data.taxRateBps.present
          ? data.taxRateBps.value
          : this.taxRateBps,
      currencyCode: data.currencyCode.present
          ? data.currencyCode.value
          : this.currencyCode,
      currencyMinorUnits: data.currencyMinorUnits.present
          ? data.currencyMinorUnits.value
          : this.currencyMinorUnits,
      timezone: data.timezone.present ? data.timezone.value : this.timezone,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      settingsJson: data.settingsJson.present
          ? data.settingsJson.value
          : this.settingsJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BusinessSettingsLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('taxRateBps: $taxRateBps, ')
          ..write('currencyCode: $currencyCode, ')
          ..write('currencyMinorUnits: $currencyMinorUnits, ')
          ..write('timezone: $timezone, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('settingsJson: $settingsJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    branchId,
    taxRateBps,
    currencyCode,
    currencyMinorUnits,
    timezone,
    updatedAt,
    settingsJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BusinessSettingsLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.taxRateBps == this.taxRateBps &&
          other.currencyCode == this.currencyCode &&
          other.currencyMinorUnits == this.currencyMinorUnits &&
          other.timezone == this.timezone &&
          other.updatedAt == this.updatedAt &&
          other.settingsJson == this.settingsJson);
}

class BusinessSettingsLocalCompanion
    extends UpdateCompanion<BusinessSettingsLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<int> taxRateBps;
  final Value<String> currencyCode;
  final Value<int> currencyMinorUnits;
  final Value<String> timezone;
  final Value<int> updatedAt;
  final Value<String> settingsJson;
  final Value<int> rowid;
  const BusinessSettingsLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.taxRateBps = const Value.absent(),
    this.currencyCode = const Value.absent(),
    this.currencyMinorUnits = const Value.absent(),
    this.timezone = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.settingsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BusinessSettingsLocalCompanion.insert({
    required String id,
    required String businessId,
    this.branchId = const Value.absent(),
    this.taxRateBps = const Value.absent(),
    this.currencyCode = const Value.absent(),
    this.currencyMinorUnits = const Value.absent(),
    this.timezone = const Value.absent(),
    required int updatedAt,
    this.settingsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       updatedAt = Value(updatedAt);
  static Insertable<BusinessSettingsLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<int>? taxRateBps,
    Expression<String>? currencyCode,
    Expression<int>? currencyMinorUnits,
    Expression<String>? timezone,
    Expression<int>? updatedAt,
    Expression<String>? settingsJson,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (taxRateBps != null) 'tax_rate_bps': taxRateBps,
      if (currencyCode != null) 'currency_code': currencyCode,
      if (currencyMinorUnits != null)
        'currency_minor_units': currencyMinorUnits,
      if (timezone != null) 'timezone': timezone,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (settingsJson != null) 'settings_json': settingsJson,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BusinessSettingsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<int>? taxRateBps,
    Value<String>? currencyCode,
    Value<int>? currencyMinorUnits,
    Value<String>? timezone,
    Value<int>? updatedAt,
    Value<String>? settingsJson,
    Value<int>? rowid,
  }) {
    return BusinessSettingsLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      taxRateBps: taxRateBps ?? this.taxRateBps,
      currencyCode: currencyCode ?? this.currencyCode,
      currencyMinorUnits: currencyMinorUnits ?? this.currencyMinorUnits,
      timezone: timezone ?? this.timezone,
      updatedAt: updatedAt ?? this.updatedAt,
      settingsJson: settingsJson ?? this.settingsJson,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (taxRateBps.present) {
      map['tax_rate_bps'] = Variable<int>(taxRateBps.value);
    }
    if (currencyCode.present) {
      map['currency_code'] = Variable<String>(currencyCode.value);
    }
    if (currencyMinorUnits.present) {
      map['currency_minor_units'] = Variable<int>(currencyMinorUnits.value);
    }
    if (timezone.present) {
      map['timezone'] = Variable<String>(timezone.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (settingsJson.present) {
      map['settings_json'] = Variable<String>(settingsJson.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BusinessSettingsLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('taxRateBps: $taxRateBps, ')
          ..write('currencyCode: $currencyCode, ')
          ..write('currencyMinorUnits: $currencyMinorUnits, ')
          ..write('timezone: $timezone, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('settingsJson: $settingsJson, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BranchesLocalTable extends BranchesLocal
    with TableInfo<$BranchesLocalTable, BranchesLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BranchesLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<bool> status = GeneratedColumn<bool>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("status" IN (0, 1))',
    ),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<int> cachedAt = GeneratedColumn<int>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    name,
    status,
    createdAt,
    updatedAt,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'branches_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<BranchesLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
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
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id, businessId};
  @override
  BranchesLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BranchesLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}cached_at'],
      )!,
    );
  }

  @override
  $BranchesLocalTable createAlias(String alias) {
    return $BranchesLocalTable(attachedDatabase, alias);
  }
}

class BranchesLocalData extends DataClass
    implements Insertable<BranchesLocalData> {
  /// UUID from server branches.id
  final String id;
  final String businessId;
  final String name;
  final bool status;

  /// Server-side timestamps for sync tracking
  final String createdAt;
  final String updatedAt;

  /// Local metadata
  final int cachedAt;
  const BranchesLocalData({
    required this.id,
    required this.businessId,
    required this.name,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['name'] = Variable<String>(name);
    map['status'] = Variable<bool>(status);
    map['created_at'] = Variable<String>(createdAt);
    map['updated_at'] = Variable<String>(updatedAt);
    map['cached_at'] = Variable<int>(cachedAt);
    return map;
  }

  BranchesLocalCompanion toCompanion(bool nullToAbsent) {
    return BranchesLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      name: Value(name),
      status: Value(status),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      cachedAt: Value(cachedAt),
    );
  }

  factory BranchesLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BranchesLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      name: serializer.fromJson<String>(json['name']),
      status: serializer.fromJson<bool>(json['status']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
      cachedAt: serializer.fromJson<int>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'name': serializer.toJson<String>(name),
      'status': serializer.toJson<bool>(status),
      'createdAt': serializer.toJson<String>(createdAt),
      'updatedAt': serializer.toJson<String>(updatedAt),
      'cachedAt': serializer.toJson<int>(cachedAt),
    };
  }

  BranchesLocalData copyWith({
    String? id,
    String? businessId,
    String? name,
    bool? status,
    String? createdAt,
    String? updatedAt,
    int? cachedAt,
  }) => BranchesLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    name: name ?? this.name,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    cachedAt: cachedAt ?? this.cachedAt,
  );
  BranchesLocalData copyWithCompanion(BranchesLocalCompanion data) {
    return BranchesLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      name: data.name.present ? data.name.value : this.name,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BranchesLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, businessId, name, status, createdAt, updatedAt, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BranchesLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.name == this.name &&
          other.status == this.status &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.cachedAt == this.cachedAt);
}

class BranchesLocalCompanion extends UpdateCompanion<BranchesLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> name;
  final Value<bool> status;
  final Value<String> createdAt;
  final Value<String> updatedAt;
  final Value<int> cachedAt;
  final Value<int> rowid;
  const BranchesLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.name = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BranchesLocalCompanion.insert({
    required String id,
    required String businessId,
    required String name,
    required bool status,
    required String createdAt,
    required String updatedAt,
    required int cachedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       name = Value(name),
       status = Value(status),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       cachedAt = Value(cachedAt);
  static Insertable<BranchesLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? name,
    Expression<bool>? status,
    Expression<String>? createdAt,
    Expression<String>? updatedAt,
    Expression<int>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (name != null) 'name': name,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BranchesLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? name,
    Value<bool>? status,
    Value<String>? createdAt,
    Value<String>? updatedAt,
    Value<int>? cachedAt,
    Value<int>? rowid,
  }) {
    return BranchesLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      name: name ?? this.name,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (status.present) {
      map['status'] = Variable<bool>(status.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<int>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BranchesLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ActiveBranchLocalTable extends ActiveBranchLocal
    with TableInfo<$ActiveBranchLocalTable, ActiveBranchLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ActiveBranchLocalTable(this.attachedDatabase, [this._alias]);
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
  @override
  List<GeneratedColumn> get $columns => [businessId, branchId, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'active_branch_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<ActiveBranchLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
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
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {businessId};
  @override
  ActiveBranchLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ActiveBranchLocalData(
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $ActiveBranchLocalTable createAlias(String alias) {
    return $ActiveBranchLocalTable(attachedDatabase, alias);
  }
}

class ActiveBranchLocalData extends DataClass
    implements Insertable<ActiveBranchLocalData> {
  final String businessId;

  /// Currently selected branch UUID (from branches_local.id)
  final String branchId;
  final int updatedAt;
  const ActiveBranchLocalData({
    required this.businessId,
    required this.branchId,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  ActiveBranchLocalCompanion toCompanion(bool nullToAbsent) {
    return ActiveBranchLocalCompanion(
      businessId: Value(businessId),
      branchId: Value(branchId),
      updatedAt: Value(updatedAt),
    );
  }

  factory ActiveBranchLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ActiveBranchLocalData(
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  ActiveBranchLocalData copyWith({
    String? businessId,
    String? branchId,
    int? updatedAt,
  }) => ActiveBranchLocalData(
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  ActiveBranchLocalData copyWithCompanion(ActiveBranchLocalCompanion data) {
    return ActiveBranchLocalData(
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ActiveBranchLocalData(')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(businessId, branchId, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ActiveBranchLocalData &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.updatedAt == this.updatedAt);
}

class ActiveBranchLocalCompanion
    extends UpdateCompanion<ActiveBranchLocalData> {
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const ActiveBranchLocalCompanion({
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ActiveBranchLocalCompanion.insert({
    required String businessId,
    required String branchId,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : businessId = Value(businessId),
       branchId = Value(branchId),
       updatedAt = Value(updatedAt);
  static Insertable<ActiveBranchLocalData> custom({
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ActiveBranchLocalCompanion copyWith({
    Value<String>? businessId,
    Value<String>? branchId,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return ActiveBranchLocalCompanion(
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ActiveBranchLocalCompanion(')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CartLocalTable extends CartLocal
    with TableInfo<$CartLocalTable, CartLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CartLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    check: () => const CustomExpression(
      "status IN ('ACTIVE', 'CHECKED_OUT', 'ABANDONED')",
    ),
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
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    status,
    createdAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cart_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<CartLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
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
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CartLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CartLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $CartLocalTable createAlias(String alias) {
    return $CartLocalTable(attachedDatabase, alias);
  }
}

class CartLocalData extends DataClass implements Insertable<CartLocalData> {
  final String id;
  final String businessId;
  final String status;
  final int createdAt;
  final int updatedAt;
  const CartLocalData({
    required this.id,
    required this.businessId,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['status'] = Variable<String>(status);
    map['created_at'] = Variable<int>(createdAt);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  CartLocalCompanion toCompanion(bool nullToAbsent) {
    return CartLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      status: Value(status),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory CartLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CartLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      status: serializer.fromJson<String>(json['status']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'status': serializer.toJson<String>(status),
      'createdAt': serializer.toJson<int>(createdAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  CartLocalData copyWith({
    String? id,
    String? businessId,
    String? status,
    int? createdAt,
    int? updatedAt,
  }) => CartLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  CartLocalData copyWithCompanion(CartLocalCompanion data) {
    return CartLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CartLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, businessId, status, createdAt, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CartLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.status == this.status &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt);
}

class CartLocalCompanion extends UpdateCompanion<CartLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> status;
  final Value<int> createdAt;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const CartLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CartLocalCompanion.insert({
    required String id,
    required String businessId,
    required String status,
    required int createdAt,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       status = Value(status),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<CartLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? status,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CartLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? status,
    Value<int>? createdAt,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return CartLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CartLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CartItemsLocalTable extends CartItemsLocal
    with TableInfo<$CartItemsLocalTable, CartItemsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CartItemsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cartIdMeta = const VerificationMeta('cartId');
  @override
  late final GeneratedColumn<String> cartId = GeneratedColumn<String>(
    'cart_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES cart_local (id)',
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
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES products_local (id)',
    ),
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
  static const VerificationMeta _addedAtMeta = const VerificationMeta(
    'addedAt',
  );
  @override
  late final GeneratedColumn<int> addedAt = GeneratedColumn<int>(
    'added_at',
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
  @override
  List<GeneratedColumn> get $columns => [
    id,
    cartId,
    productId,
    quantity,
    unitPriceMinor,
    addedAt,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cart_items_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<CartItemsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('cart_id')) {
      context.handle(
        _cartIdMeta,
        cartId.isAcceptableOrUnknown(data['cart_id']!, _cartIdMeta),
      );
    } else if (isInserting) {
      context.missing(_cartIdMeta);
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
    if (data.containsKey('added_at')) {
      context.handle(
        _addedAtMeta,
        addedAt.isAcceptableOrUnknown(data['added_at']!, _addedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_addedAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CartItemsLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CartItemsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      cartId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cart_id'],
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
      addedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}added_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $CartItemsLocalTable createAlias(String alias) {
    return $CartItemsLocalTable(attachedDatabase, alias);
  }
}

class CartItemsLocalData extends DataClass
    implements Insertable<CartItemsLocalData> {
  final String id;
  final String cartId;
  final String productId;

  /// Quantity >= 1 (INTEGER)
  final int quantity;

  /// Frozen price snapshot at time of add to cart.
  /// Does NOT update when catalog refreshes.
  final int unitPriceMinor;
  final int addedAt;
  final int updatedAt;
  const CartItemsLocalData({
    required this.id,
    required this.cartId,
    required this.productId,
    required this.quantity,
    required this.unitPriceMinor,
    required this.addedAt,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['cart_id'] = Variable<String>(cartId);
    map['product_id'] = Variable<String>(productId);
    map['quantity'] = Variable<int>(quantity);
    map['unit_price_minor'] = Variable<int>(unitPriceMinor);
    map['added_at'] = Variable<int>(addedAt);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  CartItemsLocalCompanion toCompanion(bool nullToAbsent) {
    return CartItemsLocalCompanion(
      id: Value(id),
      cartId: Value(cartId),
      productId: Value(productId),
      quantity: Value(quantity),
      unitPriceMinor: Value(unitPriceMinor),
      addedAt: Value(addedAt),
      updatedAt: Value(updatedAt),
    );
  }

  factory CartItemsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CartItemsLocalData(
      id: serializer.fromJson<String>(json['id']),
      cartId: serializer.fromJson<String>(json['cartId']),
      productId: serializer.fromJson<String>(json['productId']),
      quantity: serializer.fromJson<int>(json['quantity']),
      unitPriceMinor: serializer.fromJson<int>(json['unitPriceMinor']),
      addedAt: serializer.fromJson<int>(json['addedAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'cartId': serializer.toJson<String>(cartId),
      'productId': serializer.toJson<String>(productId),
      'quantity': serializer.toJson<int>(quantity),
      'unitPriceMinor': serializer.toJson<int>(unitPriceMinor),
      'addedAt': serializer.toJson<int>(addedAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  CartItemsLocalData copyWith({
    String? id,
    String? cartId,
    String? productId,
    int? quantity,
    int? unitPriceMinor,
    int? addedAt,
    int? updatedAt,
  }) => CartItemsLocalData(
    id: id ?? this.id,
    cartId: cartId ?? this.cartId,
    productId: productId ?? this.productId,
    quantity: quantity ?? this.quantity,
    unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
    addedAt: addedAt ?? this.addedAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  CartItemsLocalData copyWithCompanion(CartItemsLocalCompanion data) {
    return CartItemsLocalData(
      id: data.id.present ? data.id.value : this.id,
      cartId: data.cartId.present ? data.cartId.value : this.cartId,
      productId: data.productId.present ? data.productId.value : this.productId,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      unitPriceMinor: data.unitPriceMinor.present
          ? data.unitPriceMinor.value
          : this.unitPriceMinor,
      addedAt: data.addedAt.present ? data.addedAt.value : this.addedAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CartItemsLocalData(')
          ..write('id: $id, ')
          ..write('cartId: $cartId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('unitPriceMinor: $unitPriceMinor, ')
          ..write('addedAt: $addedAt, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    cartId,
    productId,
    quantity,
    unitPriceMinor,
    addedAt,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CartItemsLocalData &&
          other.id == this.id &&
          other.cartId == this.cartId &&
          other.productId == this.productId &&
          other.quantity == this.quantity &&
          other.unitPriceMinor == this.unitPriceMinor &&
          other.addedAt == this.addedAt &&
          other.updatedAt == this.updatedAt);
}

class CartItemsLocalCompanion extends UpdateCompanion<CartItemsLocalData> {
  final Value<String> id;
  final Value<String> cartId;
  final Value<String> productId;
  final Value<int> quantity;
  final Value<int> unitPriceMinor;
  final Value<int> addedAt;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const CartItemsLocalCompanion({
    this.id = const Value.absent(),
    this.cartId = const Value.absent(),
    this.productId = const Value.absent(),
    this.quantity = const Value.absent(),
    this.unitPriceMinor = const Value.absent(),
    this.addedAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CartItemsLocalCompanion.insert({
    required String id,
    required String cartId,
    required String productId,
    required int quantity,
    required int unitPriceMinor,
    required int addedAt,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       cartId = Value(cartId),
       productId = Value(productId),
       quantity = Value(quantity),
       unitPriceMinor = Value(unitPriceMinor),
       addedAt = Value(addedAt),
       updatedAt = Value(updatedAt);
  static Insertable<CartItemsLocalData> custom({
    Expression<String>? id,
    Expression<String>? cartId,
    Expression<String>? productId,
    Expression<int>? quantity,
    Expression<int>? unitPriceMinor,
    Expression<int>? addedAt,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (cartId != null) 'cart_id': cartId,
      if (productId != null) 'product_id': productId,
      if (quantity != null) 'quantity': quantity,
      if (unitPriceMinor != null) 'unit_price_minor': unitPriceMinor,
      if (addedAt != null) 'added_at': addedAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CartItemsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? cartId,
    Value<String>? productId,
    Value<int>? quantity,
    Value<int>? unitPriceMinor,
    Value<int>? addedAt,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return CartItemsLocalCompanion(
      id: id ?? this.id,
      cartId: cartId ?? this.cartId,
      productId: productId ?? this.productId,
      quantity: quantity ?? this.quantity,
      unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
      addedAt: addedAt ?? this.addedAt,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (cartId.present) {
      map['cart_id'] = Variable<String>(cartId.value);
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
    if (addedAt.present) {
      map['added_at'] = Variable<int>(addedAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CartItemsLocalCompanion(')
          ..write('id: $id, ')
          ..write('cartId: $cartId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('unitPriceMinor: $unitPriceMinor, ')
          ..write('addedAt: $addedAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CustomersLocalTable extends CustomersLocal
    with TableInfo<$CustomersLocalTable, CustomersLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CustomersLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _phoneMeta = const VerificationMeta('phone');
  @override
  late final GeneratedColumn<String> phone = GeneratedColumn<String>(
    'phone',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _emailMeta = const VerificationMeta('email');
  @override
  late final GeneratedColumn<String> email = GeneratedColumn<String>(
    'email',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _localStatusMeta = const VerificationMeta(
    'localStatus',
  );
  @override
  late final GeneratedColumn<String> localStatus = GeneratedColumn<String>(
    'local_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('synced'),
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<int> isActive = GeneratedColumn<int>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastSyncedAtMeta = const VerificationMeta(
    'lastSyncedAt',
  );
  @override
  late final GeneratedColumn<int> lastSyncedAt = GeneratedColumn<int>(
    'last_synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    name,
    phone,
    email,
    localStatus,
    isActive,
    serverVersion,
    lastSyncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'customers_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<CustomersLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('phone')) {
      context.handle(
        _phoneMeta,
        phone.isAcceptableOrUnknown(data['phone']!, _phoneMeta),
      );
    }
    if (data.containsKey('email')) {
      context.handle(
        _emailMeta,
        email.isAcceptableOrUnknown(data['email']!, _emailMeta),
      );
    }
    if (data.containsKey('local_status')) {
      context.handle(
        _localStatusMeta,
        localStatus.isAcceptableOrUnknown(
          data['local_status']!,
          _localStatusMeta,
        ),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('last_synced_at')) {
      context.handle(
        _lastSyncedAtMeta,
        lastSyncedAt.isAcceptableOrUnknown(
          data['last_synced_at']!,
          _lastSyncedAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CustomersLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CustomersLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      phone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phone'],
      ),
      email: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}email'],
      ),
      localStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_status'],
      )!,
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}is_active'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      lastSyncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_synced_at'],
      ),
    );
  }

  @override
  $CustomersLocalTable createAlias(String alias) {
    return $CustomersLocalTable(attachedDatabase, alias);
  }
}

class CustomersLocalData extends DataClass
    implements Insertable<CustomersLocalData> {
  final String id;
  final String businessId;
  final String name;
  final String? phone;
  final String? email;
  final String localStatus;
  final int isActive;
  final int serverVersion;
  final int? lastSyncedAt;
  const CustomersLocalData({
    required this.id,
    required this.businessId,
    required this.name,
    this.phone,
    this.email,
    required this.localStatus,
    required this.isActive,
    required this.serverVersion,
    this.lastSyncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || phone != null) {
      map['phone'] = Variable<String>(phone);
    }
    if (!nullToAbsent || email != null) {
      map['email'] = Variable<String>(email);
    }
    map['local_status'] = Variable<String>(localStatus);
    map['is_active'] = Variable<int>(isActive);
    map['server_version'] = Variable<int>(serverVersion);
    if (!nullToAbsent || lastSyncedAt != null) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt);
    }
    return map;
  }

  CustomersLocalCompanion toCompanion(bool nullToAbsent) {
    return CustomersLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      name: Value(name),
      phone: phone == null && nullToAbsent
          ? const Value.absent()
          : Value(phone),
      email: email == null && nullToAbsent
          ? const Value.absent()
          : Value(email),
      localStatus: Value(localStatus),
      isActive: Value(isActive),
      serverVersion: Value(serverVersion),
      lastSyncedAt: lastSyncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncedAt),
    );
  }

  factory CustomersLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CustomersLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      name: serializer.fromJson<String>(json['name']),
      phone: serializer.fromJson<String?>(json['phone']),
      email: serializer.fromJson<String?>(json['email']),
      localStatus: serializer.fromJson<String>(json['localStatus']),
      isActive: serializer.fromJson<int>(json['isActive']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      lastSyncedAt: serializer.fromJson<int?>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'name': serializer.toJson<String>(name),
      'phone': serializer.toJson<String?>(phone),
      'email': serializer.toJson<String?>(email),
      'localStatus': serializer.toJson<String>(localStatus),
      'isActive': serializer.toJson<int>(isActive),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'lastSyncedAt': serializer.toJson<int?>(lastSyncedAt),
    };
  }

  CustomersLocalData copyWith({
    String? id,
    String? businessId,
    String? name,
    Value<String?> phone = const Value.absent(),
    Value<String?> email = const Value.absent(),
    String? localStatus,
    int? isActive,
    int? serverVersion,
    Value<int?> lastSyncedAt = const Value.absent(),
  }) => CustomersLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    name: name ?? this.name,
    phone: phone.present ? phone.value : this.phone,
    email: email.present ? email.value : this.email,
    localStatus: localStatus ?? this.localStatus,
    isActive: isActive ?? this.isActive,
    serverVersion: serverVersion ?? this.serverVersion,
    lastSyncedAt: lastSyncedAt.present ? lastSyncedAt.value : this.lastSyncedAt,
  );
  CustomersLocalData copyWithCompanion(CustomersLocalCompanion data) {
    return CustomersLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      name: data.name.present ? data.name.value : this.name,
      phone: data.phone.present ? data.phone.value : this.phone,
      email: data.email.present ? data.email.value : this.email,
      localStatus: data.localStatus.present
          ? data.localStatus.value
          : this.localStatus,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CustomersLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('email: $email, ')
          ..write('localStatus: $localStatus, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    name,
    phone,
    email,
    localStatus,
    isActive,
    serverVersion,
    lastSyncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CustomersLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.name == this.name &&
          other.phone == this.phone &&
          other.email == this.email &&
          other.localStatus == this.localStatus &&
          other.isActive == this.isActive &&
          other.serverVersion == this.serverVersion &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class CustomersLocalCompanion extends UpdateCompanion<CustomersLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> name;
  final Value<String?> phone;
  final Value<String?> email;
  final Value<String> localStatus;
  final Value<int> isActive;
  final Value<int> serverVersion;
  final Value<int?> lastSyncedAt;
  final Value<int> rowid;
  const CustomersLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.name = const Value.absent(),
    this.phone = const Value.absent(),
    this.email = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CustomersLocalCompanion.insert({
    required String id,
    required String businessId,
    required String name,
    this.phone = const Value.absent(),
    this.email = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       name = Value(name);
  static Insertable<CustomersLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? name,
    Expression<String>? phone,
    Expression<String>? email,
    Expression<String>? localStatus,
    Expression<int>? isActive,
    Expression<int>? serverVersion,
    Expression<int>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (name != null) 'name': name,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      if (localStatus != null) 'local_status': localStatus,
      if (isActive != null) 'is_active': isActive,
      if (serverVersion != null) 'server_version': serverVersion,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CustomersLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? name,
    Value<String?>? phone,
    Value<String?>? email,
    Value<String>? localStatus,
    Value<int>? isActive,
    Value<int>? serverVersion,
    Value<int?>? lastSyncedAt,
    Value<int>? rowid,
  }) {
    return CustomersLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      localStatus: localStatus ?? this.localStatus,
      isActive: isActive ?? this.isActive,
      serverVersion: serverVersion ?? this.serverVersion,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (phone.present) {
      map['phone'] = Variable<String>(phone.value);
    }
    if (email.present) {
      map['email'] = Variable<String>(email.value);
    }
    if (localStatus.present) {
      map['local_status'] = Variable<String>(localStatus.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<int>(isActive.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CustomersLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('email: $email, ')
          ..write('localStatus: $localStatus, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

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
  static const VerificationMeta _receiptNumberMeta = const VerificationMeta(
    'receiptNumber',
  );
  @override
  late final GeneratedColumn<String> receiptNumber = GeneratedColumn<String>(
    'receipt_number',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _receiptSequenceMeta = const VerificationMeta(
    'receiptSequence',
  );
  @override
  late final GeneratedColumn<int> receiptSequence = GeneratedColumn<int>(
    'receipt_sequence',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _receiptDateMeta = const VerificationMeta(
    'receiptDate',
  );
  @override
  late final GeneratedColumn<String> receiptDate = GeneratedColumn<String>(
    'receipt_date',
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
      "'SYNCED', 'SYNC_FAILED', 'CONFLICT', 'RECEIPT_CONFLICT', 'CANCELLED')",
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
    receiptNumber,
    receiptSequence,
    receiptDate,
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
    if (data.containsKey('receipt_number')) {
      context.handle(
        _receiptNumberMeta,
        receiptNumber.isAcceptableOrUnknown(
          data['receipt_number']!,
          _receiptNumberMeta,
        ),
      );
    }
    if (data.containsKey('receipt_sequence')) {
      context.handle(
        _receiptSequenceMeta,
        receiptSequence.isAcceptableOrUnknown(
          data['receipt_sequence']!,
          _receiptSequenceMeta,
        ),
      );
    }
    if (data.containsKey('receipt_date')) {
      context.handle(
        _receiptDateMeta,
        receiptDate.isAcceptableOrUnknown(
          data['receipt_date']!,
          _receiptDateMeta,
        ),
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
      receiptNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}receipt_number'],
      ),
      receiptSequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}receipt_sequence'],
      ),
      receiptDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}receipt_date'],
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

  /// V2 additions: Structured receipt fields (D4)
  final String? receiptNumber;
  final int? receiptSequence;
  final String? receiptDate;

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
    this.receiptNumber,
    this.receiptSequence,
    this.receiptDate,
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
    if (!nullToAbsent || receiptNumber != null) {
      map['receipt_number'] = Variable<String>(receiptNumber);
    }
    if (!nullToAbsent || receiptSequence != null) {
      map['receipt_sequence'] = Variable<int>(receiptSequence);
    }
    if (!nullToAbsent || receiptDate != null) {
      map['receipt_date'] = Variable<String>(receiptDate);
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
      receiptNumber: receiptNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(receiptNumber),
      receiptSequence: receiptSequence == null && nullToAbsent
          ? const Value.absent()
          : Value(receiptSequence),
      receiptDate: receiptDate == null && nullToAbsent
          ? const Value.absent()
          : Value(receiptDate),
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
      receiptNumber: serializer.fromJson<String?>(json['receiptNumber']),
      receiptSequence: serializer.fromJson<int?>(json['receiptSequence']),
      receiptDate: serializer.fromJson<String?>(json['receiptDate']),
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
      'receiptNumber': serializer.toJson<String?>(receiptNumber),
      'receiptSequence': serializer.toJson<int?>(receiptSequence),
      'receiptDate': serializer.toJson<String?>(receiptDate),
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
    Value<String?> receiptNumber = const Value.absent(),
    Value<int?> receiptSequence = const Value.absent(),
    Value<String?> receiptDate = const Value.absent(),
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
    receiptNumber: receiptNumber.present
        ? receiptNumber.value
        : this.receiptNumber,
    receiptSequence: receiptSequence.present
        ? receiptSequence.value
        : this.receiptSequence,
    receiptDate: receiptDate.present ? receiptDate.value : this.receiptDate,
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
      receiptNumber: data.receiptNumber.present
          ? data.receiptNumber.value
          : this.receiptNumber,
      receiptSequence: data.receiptSequence.present
          ? data.receiptSequence.value
          : this.receiptSequence,
      receiptDate: data.receiptDate.present
          ? data.receiptDate.value
          : this.receiptDate,
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
          ..write('receiptNumber: $receiptNumber, ')
          ..write('receiptSequence: $receiptSequence, ')
          ..write('receiptDate: $receiptDate, ')
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
    receiptNumber,
    receiptSequence,
    receiptDate,
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
          other.receiptNumber == this.receiptNumber &&
          other.receiptSequence == this.receiptSequence &&
          other.receiptDate == this.receiptDate &&
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
  final Value<String?> receiptNumber;
  final Value<int?> receiptSequence;
  final Value<String?> receiptDate;
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
    this.receiptNumber = const Value.absent(),
    this.receiptSequence = const Value.absent(),
    this.receiptDate = const Value.absent(),
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
    this.receiptNumber = const Value.absent(),
    this.receiptSequence = const Value.absent(),
    this.receiptDate = const Value.absent(),
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
    Expression<String>? receiptNumber,
    Expression<int>? receiptSequence,
    Expression<String>? receiptDate,
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
      if (receiptNumber != null) 'receipt_number': receiptNumber,
      if (receiptSequence != null) 'receipt_sequence': receiptSequence,
      if (receiptDate != null) 'receipt_date': receiptDate,
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
    Value<String?>? receiptNumber,
    Value<int?>? receiptSequence,
    Value<String?>? receiptDate,
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
      receiptNumber: receiptNumber ?? this.receiptNumber,
      receiptSequence: receiptSequence ?? this.receiptSequence,
      receiptDate: receiptDate ?? this.receiptDate,
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
    if (receiptNumber.present) {
      map['receipt_number'] = Variable<String>(receiptNumber.value);
    }
    if (receiptSequence.present) {
      map['receipt_sequence'] = Variable<int>(receiptSequence.value);
    }
    if (receiptDate.present) {
      map['receipt_date'] = Variable<String>(receiptDate.value);
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
          ..write('receiptNumber: $receiptNumber, ')
          ..write('receiptSequence: $receiptSequence, ')
          ..write('receiptDate: $receiptDate, ')
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

class $SuppliersLocalTable extends SuppliersLocal
    with TableInfo<$SuppliersLocalTable, SuppliersLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SuppliersLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
    'code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _contactMeta = const VerificationMeta(
    'contact',
  );
  @override
  late final GeneratedColumn<String> contact = GeneratedColumn<String>(
    'contact',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _phoneMeta = const VerificationMeta('phone');
  @override
  late final GeneratedColumn<String> phone = GeneratedColumn<String>(
    'phone',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _emailMeta = const VerificationMeta('email');
  @override
  late final GeneratedColumn<String> email = GeneratedColumn<String>(
    'email',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _termMeta = const VerificationMeta('term');
  @override
  late final GeneratedColumn<String> term = GeneratedColumn<String>(
    'term',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('tunai'),
  );
  static const VerificationMeta _localStatusMeta = const VerificationMeta(
    'localStatus',
  );
  @override
  late final GeneratedColumn<String> localStatus = GeneratedColumn<String>(
    'local_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('synced'),
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<int> isActive = GeneratedColumn<int>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
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
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
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
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _deletedAtMeta = const VerificationMeta(
    'deletedAt',
  );
  @override
  late final GeneratedColumn<int> deletedAt = GeneratedColumn<int>(
    'deleted_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastSyncedAtMeta = const VerificationMeta(
    'lastSyncedAt',
  );
  @override
  late final GeneratedColumn<int> lastSyncedAt = GeneratedColumn<int>(
    'last_synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    code,
    name,
    contact,
    phone,
    email,
    category,
    term,
    localStatus,
    isActive,
    serverVersion,
    createdAt,
    updatedAt,
    deletedAt,
    lastSyncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'suppliers_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<SuppliersLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('code')) {
      context.handle(
        _codeMeta,
        code.isAcceptableOrUnknown(data['code']!, _codeMeta),
      );
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('contact')) {
      context.handle(
        _contactMeta,
        contact.isAcceptableOrUnknown(data['contact']!, _contactMeta),
      );
    }
    if (data.containsKey('phone')) {
      context.handle(
        _phoneMeta,
        phone.isAcceptableOrUnknown(data['phone']!, _phoneMeta),
      );
    }
    if (data.containsKey('email')) {
      context.handle(
        _emailMeta,
        email.isAcceptableOrUnknown(data['email']!, _emailMeta),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('term')) {
      context.handle(
        _termMeta,
        term.isAcceptableOrUnknown(data['term']!, _termMeta),
      );
    }
    if (data.containsKey('local_status')) {
      context.handle(
        _localStatusMeta,
        localStatus.isAcceptableOrUnknown(
          data['local_status']!,
          _localStatusMeta,
        ),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    if (data.containsKey('deleted_at')) {
      context.handle(
        _deletedAtMeta,
        deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta),
      );
    }
    if (data.containsKey('last_synced_at')) {
      context.handle(
        _lastSyncedAtMeta,
        lastSyncedAt.isAcceptableOrUnknown(
          data['last_synced_at']!,
          _lastSyncedAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SuppliersLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SuppliersLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      code: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}code'],
      ),
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      contact: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}contact'],
      ),
      phone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phone'],
      ),
      email: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}email'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      term: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}term'],
      )!,
      localStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_status'],
      )!,
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}is_active'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
      deletedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}deleted_at'],
      ),
      lastSyncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_synced_at'],
      ),
    );
  }

  @override
  $SuppliersLocalTable createAlias(String alias) {
    return $SuppliersLocalTable(attachedDatabase, alias);
  }
}

class SuppliersLocalData extends DataClass
    implements Insertable<SuppliersLocalData> {
  final String id;
  final String businessId;
  final String? code;
  final String name;
  final String? contact;
  final String? phone;
  final String? email;
  final String? category;
  final String term;
  final String localStatus;
  final int isActive;
  final int serverVersion;
  final int createdAt;
  final int updatedAt;
  final int? deletedAt;
  final int? lastSyncedAt;
  const SuppliersLocalData({
    required this.id,
    required this.businessId,
    this.code,
    required this.name,
    this.contact,
    this.phone,
    this.email,
    this.category,
    required this.term,
    required this.localStatus,
    required this.isActive,
    required this.serverVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    this.lastSyncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    if (!nullToAbsent || code != null) {
      map['code'] = Variable<String>(code);
    }
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || contact != null) {
      map['contact'] = Variable<String>(contact);
    }
    if (!nullToAbsent || phone != null) {
      map['phone'] = Variable<String>(phone);
    }
    if (!nullToAbsent || email != null) {
      map['email'] = Variable<String>(email);
    }
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    map['term'] = Variable<String>(term);
    map['local_status'] = Variable<String>(localStatus);
    map['is_active'] = Variable<int>(isActive);
    map['server_version'] = Variable<int>(serverVersion);
    map['created_at'] = Variable<int>(createdAt);
    map['updated_at'] = Variable<int>(updatedAt);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<int>(deletedAt);
    }
    if (!nullToAbsent || lastSyncedAt != null) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt);
    }
    return map;
  }

  SuppliersLocalCompanion toCompanion(bool nullToAbsent) {
    return SuppliersLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      code: code == null && nullToAbsent ? const Value.absent() : Value(code),
      name: Value(name),
      contact: contact == null && nullToAbsent
          ? const Value.absent()
          : Value(contact),
      phone: phone == null && nullToAbsent
          ? const Value.absent()
          : Value(phone),
      email: email == null && nullToAbsent
          ? const Value.absent()
          : Value(email),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      term: Value(term),
      localStatus: Value(localStatus),
      isActive: Value(isActive),
      serverVersion: Value(serverVersion),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      lastSyncedAt: lastSyncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncedAt),
    );
  }

  factory SuppliersLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SuppliersLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      code: serializer.fromJson<String?>(json['code']),
      name: serializer.fromJson<String>(json['name']),
      contact: serializer.fromJson<String?>(json['contact']),
      phone: serializer.fromJson<String?>(json['phone']),
      email: serializer.fromJson<String?>(json['email']),
      category: serializer.fromJson<String?>(json['category']),
      term: serializer.fromJson<String>(json['term']),
      localStatus: serializer.fromJson<String>(json['localStatus']),
      isActive: serializer.fromJson<int>(json['isActive']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
      deletedAt: serializer.fromJson<int?>(json['deletedAt']),
      lastSyncedAt: serializer.fromJson<int?>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'code': serializer.toJson<String?>(code),
      'name': serializer.toJson<String>(name),
      'contact': serializer.toJson<String?>(contact),
      'phone': serializer.toJson<String?>(phone),
      'email': serializer.toJson<String?>(email),
      'category': serializer.toJson<String?>(category),
      'term': serializer.toJson<String>(term),
      'localStatus': serializer.toJson<String>(localStatus),
      'isActive': serializer.toJson<int>(isActive),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'createdAt': serializer.toJson<int>(createdAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
      'deletedAt': serializer.toJson<int?>(deletedAt),
      'lastSyncedAt': serializer.toJson<int?>(lastSyncedAt),
    };
  }

  SuppliersLocalData copyWith({
    String? id,
    String? businessId,
    Value<String?> code = const Value.absent(),
    String? name,
    Value<String?> contact = const Value.absent(),
    Value<String?> phone = const Value.absent(),
    Value<String?> email = const Value.absent(),
    Value<String?> category = const Value.absent(),
    String? term,
    String? localStatus,
    int? isActive,
    int? serverVersion,
    int? createdAt,
    int? updatedAt,
    Value<int?> deletedAt = const Value.absent(),
    Value<int?> lastSyncedAt = const Value.absent(),
  }) => SuppliersLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    code: code.present ? code.value : this.code,
    name: name ?? this.name,
    contact: contact.present ? contact.value : this.contact,
    phone: phone.present ? phone.value : this.phone,
    email: email.present ? email.value : this.email,
    category: category.present ? category.value : this.category,
    term: term ?? this.term,
    localStatus: localStatus ?? this.localStatus,
    isActive: isActive ?? this.isActive,
    serverVersion: serverVersion ?? this.serverVersion,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
    lastSyncedAt: lastSyncedAt.present ? lastSyncedAt.value : this.lastSyncedAt,
  );
  SuppliersLocalData copyWithCompanion(SuppliersLocalCompanion data) {
    return SuppliersLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      code: data.code.present ? data.code.value : this.code,
      name: data.name.present ? data.name.value : this.name,
      contact: data.contact.present ? data.contact.value : this.contact,
      phone: data.phone.present ? data.phone.value : this.phone,
      email: data.email.present ? data.email.value : this.email,
      category: data.category.present ? data.category.value : this.category,
      term: data.term.present ? data.term.value : this.term,
      localStatus: data.localStatus.present
          ? data.localStatus.value
          : this.localStatus,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SuppliersLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('contact: $contact, ')
          ..write('phone: $phone, ')
          ..write('email: $email, ')
          ..write('category: $category, ')
          ..write('term: $term, ')
          ..write('localStatus: $localStatus, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    code,
    name,
    contact,
    phone,
    email,
    category,
    term,
    localStatus,
    isActive,
    serverVersion,
    createdAt,
    updatedAt,
    deletedAt,
    lastSyncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SuppliersLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.code == this.code &&
          other.name == this.name &&
          other.contact == this.contact &&
          other.phone == this.phone &&
          other.email == this.email &&
          other.category == this.category &&
          other.term == this.term &&
          other.localStatus == this.localStatus &&
          other.isActive == this.isActive &&
          other.serverVersion == this.serverVersion &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.deletedAt == this.deletedAt &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class SuppliersLocalCompanion extends UpdateCompanion<SuppliersLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String?> code;
  final Value<String> name;
  final Value<String?> contact;
  final Value<String?> phone;
  final Value<String?> email;
  final Value<String?> category;
  final Value<String> term;
  final Value<String> localStatus;
  final Value<int> isActive;
  final Value<int> serverVersion;
  final Value<int> createdAt;
  final Value<int> updatedAt;
  final Value<int?> deletedAt;
  final Value<int?> lastSyncedAt;
  final Value<int> rowid;
  const SuppliersLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.code = const Value.absent(),
    this.name = const Value.absent(),
    this.contact = const Value.absent(),
    this.phone = const Value.absent(),
    this.email = const Value.absent(),
    this.category = const Value.absent(),
    this.term = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SuppliersLocalCompanion.insert({
    required String id,
    required String businessId,
    this.code = const Value.absent(),
    required String name,
    this.contact = const Value.absent(),
    this.phone = const Value.absent(),
    this.email = const Value.absent(),
    this.category = const Value.absent(),
    this.term = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.isActive = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       name = Value(name);
  static Insertable<SuppliersLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? code,
    Expression<String>? name,
    Expression<String>? contact,
    Expression<String>? phone,
    Expression<String>? email,
    Expression<String>? category,
    Expression<String>? term,
    Expression<String>? localStatus,
    Expression<int>? isActive,
    Expression<int>? serverVersion,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<int>? deletedAt,
    Expression<int>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (code != null) 'code': code,
      if (name != null) 'name': name,
      if (contact != null) 'contact': contact,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      if (category != null) 'category': category,
      if (term != null) 'term': term,
      if (localStatus != null) 'local_status': localStatus,
      if (isActive != null) 'is_active': isActive,
      if (serverVersion != null) 'server_version': serverVersion,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SuppliersLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String?>? code,
    Value<String>? name,
    Value<String?>? contact,
    Value<String?>? phone,
    Value<String?>? email,
    Value<String?>? category,
    Value<String>? term,
    Value<String>? localStatus,
    Value<int>? isActive,
    Value<int>? serverVersion,
    Value<int>? createdAt,
    Value<int>? updatedAt,
    Value<int?>? deletedAt,
    Value<int?>? lastSyncedAt,
    Value<int>? rowid,
  }) {
    return SuppliersLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      code: code ?? this.code,
      name: name ?? this.name,
      contact: contact ?? this.contact,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      category: category ?? this.category,
      term: term ?? this.term,
      localStatus: localStatus ?? this.localStatus,
      isActive: isActive ?? this.isActive,
      serverVersion: serverVersion ?? this.serverVersion,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (contact.present) {
      map['contact'] = Variable<String>(contact.value);
    }
    if (phone.present) {
      map['phone'] = Variable<String>(phone.value);
    }
    if (email.present) {
      map['email'] = Variable<String>(email.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (term.present) {
      map['term'] = Variable<String>(term.value);
    }
    if (localStatus.present) {
      map['local_status'] = Variable<String>(localStatus.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<int>(isActive.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<int>(deletedAt.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SuppliersLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('contact: $contact, ')
          ..write('phone: $phone, ')
          ..write('email: $email, ')
          ..write('category: $category, ')
          ..write('term: $term, ')
          ..write('localStatus: $localStatus, ')
          ..write('isActive: $isActive, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PurchasesLocalTable extends PurchasesLocal
    with TableInfo<$PurchasesLocalTable, PurchasesLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PurchasesLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _supplierIdMeta = const VerificationMeta(
    'supplierId',
  );
  @override
  late final GeneratedColumn<String> supplierId = GeneratedColumn<String>(
    'supplier_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _supplierNameMeta = const VerificationMeta(
    'supplierName',
  );
  @override
  late final GeneratedColumn<String> supplierName = GeneratedColumn<String>(
    'supplier_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _supplierCodeMeta = const VerificationMeta(
    'supplierCode',
  );
  @override
  late final GeneratedColumn<String> supplierCode = GeneratedColumn<String>(
    'supplier_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
    'code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<String> date = GeneratedColumn<String>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dueDateMeta = const VerificationMeta(
    'dueDate',
  );
  @override
  late final GeneratedColumn<String> dueDate = GeneratedColumn<String>(
    'due_date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _supplierTermMeta = const VerificationMeta(
    'supplierTerm',
  );
  @override
  late final GeneratedColumn<String> supplierTerm = GeneratedColumn<String>(
    'supplier_term',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('Tunai'),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('draft'),
  );
  static const VerificationMeta _totalMinorMeta = const VerificationMeta(
    'totalMinor',
  );
  @override
  late final GeneratedColumn<int> totalMinor = GeneratedColumn<int>(
    'total_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _receivedMinorMeta = const VerificationMeta(
    'receivedMinor',
  );
  @override
  late final GeneratedColumn<int> receivedMinor = GeneratedColumn<int>(
    'received_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _paidMinorMeta = const VerificationMeta(
    'paidMinor',
  );
  @override
  late final GeneratedColumn<int> paidMinor = GeneratedColumn<int>(
    'paid_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _outstandingMinorMeta = const VerificationMeta(
    'outstandingMinor',
  );
  @override
  late final GeneratedColumn<int> outstandingMinor = GeneratedColumn<int>(
    'outstanding_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _noteMeta = const VerificationMeta('note');
  @override
  late final GeneratedColumn<String> note = GeneratedColumn<String>(
    'note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _localStatusMeta = const VerificationMeta(
    'localStatus',
  );
  @override
  late final GeneratedColumn<String> localStatus = GeneratedColumn<String>(
    'local_status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('synced'),
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
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
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
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _deletedAtMeta = const VerificationMeta(
    'deletedAt',
  );
  @override
  late final GeneratedColumn<int> deletedAt = GeneratedColumn<int>(
    'deleted_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastSyncedAtMeta = const VerificationMeta(
    'lastSyncedAt',
  );
  @override
  late final GeneratedColumn<int> lastSyncedAt = GeneratedColumn<int>(
    'last_synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    branchId,
    supplierId,
    supplierName,
    supplierCode,
    code,
    date,
    dueDate,
    supplierTerm,
    status,
    totalMinor,
    receivedMinor,
    paidMinor,
    outstandingMinor,
    note,
    serverVersion,
    localStatus,
    createdAt,
    updatedAt,
    deletedAt,
    lastSyncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'purchases_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<PurchasesLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
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
    if (data.containsKey('supplier_id')) {
      context.handle(
        _supplierIdMeta,
        supplierId.isAcceptableOrUnknown(data['supplier_id']!, _supplierIdMeta),
      );
    } else if (isInserting) {
      context.missing(_supplierIdMeta);
    }
    if (data.containsKey('supplier_name')) {
      context.handle(
        _supplierNameMeta,
        supplierName.isAcceptableOrUnknown(
          data['supplier_name']!,
          _supplierNameMeta,
        ),
      );
    }
    if (data.containsKey('supplier_code')) {
      context.handle(
        _supplierCodeMeta,
        supplierCode.isAcceptableOrUnknown(
          data['supplier_code']!,
          _supplierCodeMeta,
        ),
      );
    }
    if (data.containsKey('code')) {
      context.handle(
        _codeMeta,
        code.isAcceptableOrUnknown(data['code']!, _codeMeta),
      );
    } else if (isInserting) {
      context.missing(_codeMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('due_date')) {
      context.handle(
        _dueDateMeta,
        dueDate.isAcceptableOrUnknown(data['due_date']!, _dueDateMeta),
      );
    } else if (isInserting) {
      context.missing(_dueDateMeta);
    }
    if (data.containsKey('supplier_term')) {
      context.handle(
        _supplierTermMeta,
        supplierTerm.isAcceptableOrUnknown(
          data['supplier_term']!,
          _supplierTermMeta,
        ),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('total_minor')) {
      context.handle(
        _totalMinorMeta,
        totalMinor.isAcceptableOrUnknown(data['total_minor']!, _totalMinorMeta),
      );
    }
    if (data.containsKey('received_minor')) {
      context.handle(
        _receivedMinorMeta,
        receivedMinor.isAcceptableOrUnknown(
          data['received_minor']!,
          _receivedMinorMeta,
        ),
      );
    }
    if (data.containsKey('paid_minor')) {
      context.handle(
        _paidMinorMeta,
        paidMinor.isAcceptableOrUnknown(data['paid_minor']!, _paidMinorMeta),
      );
    }
    if (data.containsKey('outstanding_minor')) {
      context.handle(
        _outstandingMinorMeta,
        outstandingMinor.isAcceptableOrUnknown(
          data['outstanding_minor']!,
          _outstandingMinorMeta,
        ),
      );
    }
    if (data.containsKey('note')) {
      context.handle(
        _noteMeta,
        note.isAcceptableOrUnknown(data['note']!, _noteMeta),
      );
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('local_status')) {
      context.handle(
        _localStatusMeta,
        localStatus.isAcceptableOrUnknown(
          data['local_status']!,
          _localStatusMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    if (data.containsKey('deleted_at')) {
      context.handle(
        _deletedAtMeta,
        deletedAt.isAcceptableOrUnknown(data['deleted_at']!, _deletedAtMeta),
      );
    }
    if (data.containsKey('last_synced_at')) {
      context.handle(
        _lastSyncedAtMeta,
        lastSyncedAt.isAcceptableOrUnknown(
          data['last_synced_at']!,
          _lastSyncedAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PurchasesLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PurchasesLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      supplierId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}supplier_id'],
      )!,
      supplierName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}supplier_name'],
      ),
      supplierCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}supplier_code'],
      ),
      code: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}code'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}date'],
      )!,
      dueDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}due_date'],
      )!,
      supplierTerm: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}supplier_term'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      totalMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_minor'],
      )!,
      receivedMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}received_minor'],
      )!,
      paidMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}paid_minor'],
      )!,
      outstandingMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}outstanding_minor'],
      )!,
      note: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note'],
      ),
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      localStatus: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
      deletedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}deleted_at'],
      ),
      lastSyncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_synced_at'],
      ),
    );
  }

  @override
  $PurchasesLocalTable createAlias(String alias) {
    return $PurchasesLocalTable(attachedDatabase, alias);
  }
}

class PurchasesLocalData extends DataClass
    implements Insertable<PurchasesLocalData> {
  final String id;
  final String businessId;
  final String branchId;
  final String supplierId;
  final String? supplierName;
  final String? supplierCode;
  final String code;
  final String date;
  final String dueDate;
  final String supplierTerm;
  final String status;
  final int totalMinor;
  final int receivedMinor;
  final int paidMinor;
  final int outstandingMinor;
  final String? note;
  final int serverVersion;
  final String localStatus;
  final int createdAt;
  final int updatedAt;
  final int? deletedAt;
  final int? lastSyncedAt;
  const PurchasesLocalData({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.supplierId,
    this.supplierName,
    this.supplierCode,
    required this.code,
    required this.date,
    required this.dueDate,
    required this.supplierTerm,
    required this.status,
    required this.totalMinor,
    required this.receivedMinor,
    required this.paidMinor,
    required this.outstandingMinor,
    this.note,
    required this.serverVersion,
    required this.localStatus,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    this.lastSyncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['supplier_id'] = Variable<String>(supplierId);
    if (!nullToAbsent || supplierName != null) {
      map['supplier_name'] = Variable<String>(supplierName);
    }
    if (!nullToAbsent || supplierCode != null) {
      map['supplier_code'] = Variable<String>(supplierCode);
    }
    map['code'] = Variable<String>(code);
    map['date'] = Variable<String>(date);
    map['due_date'] = Variable<String>(dueDate);
    map['supplier_term'] = Variable<String>(supplierTerm);
    map['status'] = Variable<String>(status);
    map['total_minor'] = Variable<int>(totalMinor);
    map['received_minor'] = Variable<int>(receivedMinor);
    map['paid_minor'] = Variable<int>(paidMinor);
    map['outstanding_minor'] = Variable<int>(outstandingMinor);
    if (!nullToAbsent || note != null) {
      map['note'] = Variable<String>(note);
    }
    map['server_version'] = Variable<int>(serverVersion);
    map['local_status'] = Variable<String>(localStatus);
    map['created_at'] = Variable<int>(createdAt);
    map['updated_at'] = Variable<int>(updatedAt);
    if (!nullToAbsent || deletedAt != null) {
      map['deleted_at'] = Variable<int>(deletedAt);
    }
    if (!nullToAbsent || lastSyncedAt != null) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt);
    }
    return map;
  }

  PurchasesLocalCompanion toCompanion(bool nullToAbsent) {
    return PurchasesLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      branchId: Value(branchId),
      supplierId: Value(supplierId),
      supplierName: supplierName == null && nullToAbsent
          ? const Value.absent()
          : Value(supplierName),
      supplierCode: supplierCode == null && nullToAbsent
          ? const Value.absent()
          : Value(supplierCode),
      code: Value(code),
      date: Value(date),
      dueDate: Value(dueDate),
      supplierTerm: Value(supplierTerm),
      status: Value(status),
      totalMinor: Value(totalMinor),
      receivedMinor: Value(receivedMinor),
      paidMinor: Value(paidMinor),
      outstandingMinor: Value(outstandingMinor),
      note: note == null && nullToAbsent ? const Value.absent() : Value(note),
      serverVersion: Value(serverVersion),
      localStatus: Value(localStatus),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      deletedAt: deletedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(deletedAt),
      lastSyncedAt: lastSyncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncedAt),
    );
  }

  factory PurchasesLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PurchasesLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      supplierId: serializer.fromJson<String>(json['supplierId']),
      supplierName: serializer.fromJson<String?>(json['supplierName']),
      supplierCode: serializer.fromJson<String?>(json['supplierCode']),
      code: serializer.fromJson<String>(json['code']),
      date: serializer.fromJson<String>(json['date']),
      dueDate: serializer.fromJson<String>(json['dueDate']),
      supplierTerm: serializer.fromJson<String>(json['supplierTerm']),
      status: serializer.fromJson<String>(json['status']),
      totalMinor: serializer.fromJson<int>(json['totalMinor']),
      receivedMinor: serializer.fromJson<int>(json['receivedMinor']),
      paidMinor: serializer.fromJson<int>(json['paidMinor']),
      outstandingMinor: serializer.fromJson<int>(json['outstandingMinor']),
      note: serializer.fromJson<String?>(json['note']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      localStatus: serializer.fromJson<String>(json['localStatus']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
      deletedAt: serializer.fromJson<int?>(json['deletedAt']),
      lastSyncedAt: serializer.fromJson<int?>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'supplierId': serializer.toJson<String>(supplierId),
      'supplierName': serializer.toJson<String?>(supplierName),
      'supplierCode': serializer.toJson<String?>(supplierCode),
      'code': serializer.toJson<String>(code),
      'date': serializer.toJson<String>(date),
      'dueDate': serializer.toJson<String>(dueDate),
      'supplierTerm': serializer.toJson<String>(supplierTerm),
      'status': serializer.toJson<String>(status),
      'totalMinor': serializer.toJson<int>(totalMinor),
      'receivedMinor': serializer.toJson<int>(receivedMinor),
      'paidMinor': serializer.toJson<int>(paidMinor),
      'outstandingMinor': serializer.toJson<int>(outstandingMinor),
      'note': serializer.toJson<String?>(note),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'localStatus': serializer.toJson<String>(localStatus),
      'createdAt': serializer.toJson<int>(createdAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
      'deletedAt': serializer.toJson<int?>(deletedAt),
      'lastSyncedAt': serializer.toJson<int?>(lastSyncedAt),
    };
  }

  PurchasesLocalData copyWith({
    String? id,
    String? businessId,
    String? branchId,
    String? supplierId,
    Value<String?> supplierName = const Value.absent(),
    Value<String?> supplierCode = const Value.absent(),
    String? code,
    String? date,
    String? dueDate,
    String? supplierTerm,
    String? status,
    int? totalMinor,
    int? receivedMinor,
    int? paidMinor,
    int? outstandingMinor,
    Value<String?> note = const Value.absent(),
    int? serverVersion,
    String? localStatus,
    int? createdAt,
    int? updatedAt,
    Value<int?> deletedAt = const Value.absent(),
    Value<int?> lastSyncedAt = const Value.absent(),
  }) => PurchasesLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    supplierId: supplierId ?? this.supplierId,
    supplierName: supplierName.present ? supplierName.value : this.supplierName,
    supplierCode: supplierCode.present ? supplierCode.value : this.supplierCode,
    code: code ?? this.code,
    date: date ?? this.date,
    dueDate: dueDate ?? this.dueDate,
    supplierTerm: supplierTerm ?? this.supplierTerm,
    status: status ?? this.status,
    totalMinor: totalMinor ?? this.totalMinor,
    receivedMinor: receivedMinor ?? this.receivedMinor,
    paidMinor: paidMinor ?? this.paidMinor,
    outstandingMinor: outstandingMinor ?? this.outstandingMinor,
    note: note.present ? note.value : this.note,
    serverVersion: serverVersion ?? this.serverVersion,
    localStatus: localStatus ?? this.localStatus,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    deletedAt: deletedAt.present ? deletedAt.value : this.deletedAt,
    lastSyncedAt: lastSyncedAt.present ? lastSyncedAt.value : this.lastSyncedAt,
  );
  PurchasesLocalData copyWithCompanion(PurchasesLocalCompanion data) {
    return PurchasesLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      supplierId: data.supplierId.present
          ? data.supplierId.value
          : this.supplierId,
      supplierName: data.supplierName.present
          ? data.supplierName.value
          : this.supplierName,
      supplierCode: data.supplierCode.present
          ? data.supplierCode.value
          : this.supplierCode,
      code: data.code.present ? data.code.value : this.code,
      date: data.date.present ? data.date.value : this.date,
      dueDate: data.dueDate.present ? data.dueDate.value : this.dueDate,
      supplierTerm: data.supplierTerm.present
          ? data.supplierTerm.value
          : this.supplierTerm,
      status: data.status.present ? data.status.value : this.status,
      totalMinor: data.totalMinor.present
          ? data.totalMinor.value
          : this.totalMinor,
      receivedMinor: data.receivedMinor.present
          ? data.receivedMinor.value
          : this.receivedMinor,
      paidMinor: data.paidMinor.present ? data.paidMinor.value : this.paidMinor,
      outstandingMinor: data.outstandingMinor.present
          ? data.outstandingMinor.value
          : this.outstandingMinor,
      note: data.note.present ? data.note.value : this.note,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      localStatus: data.localStatus.present
          ? data.localStatus.value
          : this.localStatus,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      deletedAt: data.deletedAt.present ? data.deletedAt.value : this.deletedAt,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PurchasesLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('supplierId: $supplierId, ')
          ..write('supplierName: $supplierName, ')
          ..write('supplierCode: $supplierCode, ')
          ..write('code: $code, ')
          ..write('date: $date, ')
          ..write('dueDate: $dueDate, ')
          ..write('supplierTerm: $supplierTerm, ')
          ..write('status: $status, ')
          ..write('totalMinor: $totalMinor, ')
          ..write('receivedMinor: $receivedMinor, ')
          ..write('paidMinor: $paidMinor, ')
          ..write('outstandingMinor: $outstandingMinor, ')
          ..write('note: $note, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('localStatus: $localStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    id,
    businessId,
    branchId,
    supplierId,
    supplierName,
    supplierCode,
    code,
    date,
    dueDate,
    supplierTerm,
    status,
    totalMinor,
    receivedMinor,
    paidMinor,
    outstandingMinor,
    note,
    serverVersion,
    localStatus,
    createdAt,
    updatedAt,
    deletedAt,
    lastSyncedAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PurchasesLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.supplierId == this.supplierId &&
          other.supplierName == this.supplierName &&
          other.supplierCode == this.supplierCode &&
          other.code == this.code &&
          other.date == this.date &&
          other.dueDate == this.dueDate &&
          other.supplierTerm == this.supplierTerm &&
          other.status == this.status &&
          other.totalMinor == this.totalMinor &&
          other.receivedMinor == this.receivedMinor &&
          other.paidMinor == this.paidMinor &&
          other.outstandingMinor == this.outstandingMinor &&
          other.note == this.note &&
          other.serverVersion == this.serverVersion &&
          other.localStatus == this.localStatus &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.deletedAt == this.deletedAt &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class PurchasesLocalCompanion extends UpdateCompanion<PurchasesLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> supplierId;
  final Value<String?> supplierName;
  final Value<String?> supplierCode;
  final Value<String> code;
  final Value<String> date;
  final Value<String> dueDate;
  final Value<String> supplierTerm;
  final Value<String> status;
  final Value<int> totalMinor;
  final Value<int> receivedMinor;
  final Value<int> paidMinor;
  final Value<int> outstandingMinor;
  final Value<String?> note;
  final Value<int> serverVersion;
  final Value<String> localStatus;
  final Value<int> createdAt;
  final Value<int> updatedAt;
  final Value<int?> deletedAt;
  final Value<int?> lastSyncedAt;
  final Value<int> rowid;
  const PurchasesLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.supplierId = const Value.absent(),
    this.supplierName = const Value.absent(),
    this.supplierCode = const Value.absent(),
    this.code = const Value.absent(),
    this.date = const Value.absent(),
    this.dueDate = const Value.absent(),
    this.supplierTerm = const Value.absent(),
    this.status = const Value.absent(),
    this.totalMinor = const Value.absent(),
    this.receivedMinor = const Value.absent(),
    this.paidMinor = const Value.absent(),
    this.outstandingMinor = const Value.absent(),
    this.note = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PurchasesLocalCompanion.insert({
    required String id,
    required String businessId,
    required String branchId,
    required String supplierId,
    this.supplierName = const Value.absent(),
    this.supplierCode = const Value.absent(),
    required String code,
    required String date,
    required String dueDate,
    this.supplierTerm = const Value.absent(),
    this.status = const Value.absent(),
    this.totalMinor = const Value.absent(),
    this.receivedMinor = const Value.absent(),
    this.paidMinor = const Value.absent(),
    this.outstandingMinor = const Value.absent(),
    this.note = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.localStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deletedAt = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       branchId = Value(branchId),
       supplierId = Value(supplierId),
       code = Value(code),
       date = Value(date),
       dueDate = Value(dueDate);
  static Insertable<PurchasesLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? supplierId,
    Expression<String>? supplierName,
    Expression<String>? supplierCode,
    Expression<String>? code,
    Expression<String>? date,
    Expression<String>? dueDate,
    Expression<String>? supplierTerm,
    Expression<String>? status,
    Expression<int>? totalMinor,
    Expression<int>? receivedMinor,
    Expression<int>? paidMinor,
    Expression<int>? outstandingMinor,
    Expression<String>? note,
    Expression<int>? serverVersion,
    Expression<String>? localStatus,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<int>? deletedAt,
    Expression<int>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (supplierId != null) 'supplier_id': supplierId,
      if (supplierName != null) 'supplier_name': supplierName,
      if (supplierCode != null) 'supplier_code': supplierCode,
      if (code != null) 'code': code,
      if (date != null) 'date': date,
      if (dueDate != null) 'due_date': dueDate,
      if (supplierTerm != null) 'supplier_term': supplierTerm,
      if (status != null) 'status': status,
      if (totalMinor != null) 'total_minor': totalMinor,
      if (receivedMinor != null) 'received_minor': receivedMinor,
      if (paidMinor != null) 'paid_minor': paidMinor,
      if (outstandingMinor != null) 'outstanding_minor': outstandingMinor,
      if (note != null) 'note': note,
      if (serverVersion != null) 'server_version': serverVersion,
      if (localStatus != null) 'local_status': localStatus,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (deletedAt != null) 'deleted_at': deletedAt,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PurchasesLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? supplierId,
    Value<String?>? supplierName,
    Value<String?>? supplierCode,
    Value<String>? code,
    Value<String>? date,
    Value<String>? dueDate,
    Value<String>? supplierTerm,
    Value<String>? status,
    Value<int>? totalMinor,
    Value<int>? receivedMinor,
    Value<int>? paidMinor,
    Value<int>? outstandingMinor,
    Value<String?>? note,
    Value<int>? serverVersion,
    Value<String>? localStatus,
    Value<int>? createdAt,
    Value<int>? updatedAt,
    Value<int?>? deletedAt,
    Value<int?>? lastSyncedAt,
    Value<int>? rowid,
  }) {
    return PurchasesLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      supplierCode: supplierCode ?? this.supplierCode,
      code: code ?? this.code,
      date: date ?? this.date,
      dueDate: dueDate ?? this.dueDate,
      supplierTerm: supplierTerm ?? this.supplierTerm,
      status: status ?? this.status,
      totalMinor: totalMinor ?? this.totalMinor,
      receivedMinor: receivedMinor ?? this.receivedMinor,
      paidMinor: paidMinor ?? this.paidMinor,
      outstandingMinor: outstandingMinor ?? this.outstandingMinor,
      note: note ?? this.note,
      serverVersion: serverVersion ?? this.serverVersion,
      localStatus: localStatus ?? this.localStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (supplierId.present) {
      map['supplier_id'] = Variable<String>(supplierId.value);
    }
    if (supplierName.present) {
      map['supplier_name'] = Variable<String>(supplierName.value);
    }
    if (supplierCode.present) {
      map['supplier_code'] = Variable<String>(supplierCode.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (date.present) {
      map['date'] = Variable<String>(date.value);
    }
    if (dueDate.present) {
      map['due_date'] = Variable<String>(dueDate.value);
    }
    if (supplierTerm.present) {
      map['supplier_term'] = Variable<String>(supplierTerm.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (totalMinor.present) {
      map['total_minor'] = Variable<int>(totalMinor.value);
    }
    if (receivedMinor.present) {
      map['received_minor'] = Variable<int>(receivedMinor.value);
    }
    if (paidMinor.present) {
      map['paid_minor'] = Variable<int>(paidMinor.value);
    }
    if (outstandingMinor.present) {
      map['outstanding_minor'] = Variable<int>(outstandingMinor.value);
    }
    if (note.present) {
      map['note'] = Variable<String>(note.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (localStatus.present) {
      map['local_status'] = Variable<String>(localStatus.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (deletedAt.present) {
      map['deleted_at'] = Variable<int>(deletedAt.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PurchasesLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('supplierId: $supplierId, ')
          ..write('supplierName: $supplierName, ')
          ..write('supplierCode: $supplierCode, ')
          ..write('code: $code, ')
          ..write('date: $date, ')
          ..write('dueDate: $dueDate, ')
          ..write('supplierTerm: $supplierTerm, ')
          ..write('status: $status, ')
          ..write('totalMinor: $totalMinor, ')
          ..write('receivedMinor: $receivedMinor, ')
          ..write('paidMinor: $paidMinor, ')
          ..write('outstandingMinor: $outstandingMinor, ')
          ..write('note: $note, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('localStatus: $localStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deletedAt: $deletedAt, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PurchaseItemsLocalTable extends PurchaseItemsLocal
    with TableInfo<$PurchaseItemsLocalTable, PurchaseItemsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PurchaseItemsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _purchaseIdMeta = const VerificationMeta(
    'purchaseId',
  );
  @override
  late final GeneratedColumn<String> purchaseId = GeneratedColumn<String>(
    'purchase_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _productIdMeta = const VerificationMeta(
    'productId',
  );
  @override
  late final GeneratedColumn<String> productId = GeneratedColumn<String>(
    'product_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _productNameMeta = const VerificationMeta(
    'productName',
  );
  @override
  late final GeneratedColumn<String> productName = GeneratedColumn<String>(
    'product_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _orderedQtyMeta = const VerificationMeta(
    'orderedQty',
  );
  @override
  late final GeneratedColumn<int> orderedQty = GeneratedColumn<int>(
    'ordered_qty',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _receivedQtyMeta = const VerificationMeta(
    'receivedQty',
  );
  @override
  late final GeneratedColumn<int> receivedQty = GeneratedColumn<int>(
    'received_qty',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _unitCostMinorMeta = const VerificationMeta(
    'unitCostMinor',
  );
  @override
  late final GeneratedColumn<int> unitCostMinor = GeneratedColumn<int>(
    'unit_cost_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
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
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    purchaseId,
    productId,
    productName,
    orderedQty,
    receivedQty,
    unitCostMinor,
    subtotalMinor,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'purchase_items_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<PurchaseItemsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('purchase_id')) {
      context.handle(
        _purchaseIdMeta,
        purchaseId.isAcceptableOrUnknown(data['purchase_id']!, _purchaseIdMeta),
      );
    } else if (isInserting) {
      context.missing(_purchaseIdMeta);
    }
    if (data.containsKey('product_id')) {
      context.handle(
        _productIdMeta,
        productId.isAcceptableOrUnknown(data['product_id']!, _productIdMeta),
      );
    }
    if (data.containsKey('product_name')) {
      context.handle(
        _productNameMeta,
        productName.isAcceptableOrUnknown(
          data['product_name']!,
          _productNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_productNameMeta);
    }
    if (data.containsKey('ordered_qty')) {
      context.handle(
        _orderedQtyMeta,
        orderedQty.isAcceptableOrUnknown(data['ordered_qty']!, _orderedQtyMeta),
      );
    } else if (isInserting) {
      context.missing(_orderedQtyMeta);
    }
    if (data.containsKey('received_qty')) {
      context.handle(
        _receivedQtyMeta,
        receivedQty.isAcceptableOrUnknown(
          data['received_qty']!,
          _receivedQtyMeta,
        ),
      );
    }
    if (data.containsKey('unit_cost_minor')) {
      context.handle(
        _unitCostMinorMeta,
        unitCostMinor.isAcceptableOrUnknown(
          data['unit_cost_minor']!,
          _unitCostMinorMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_unitCostMinorMeta);
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
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PurchaseItemsLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PurchaseItemsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      purchaseId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}purchase_id'],
      )!,
      productId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_id'],
      ),
      productName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_name'],
      )!,
      orderedQty: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}ordered_qty'],
      )!,
      receivedQty: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}received_qty'],
      )!,
      unitCostMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_cost_minor'],
      )!,
      subtotalMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}subtotal_minor'],
      )!,
    );
  }

  @override
  $PurchaseItemsLocalTable createAlias(String alias) {
    return $PurchaseItemsLocalTable(attachedDatabase, alias);
  }
}

class PurchaseItemsLocalData extends DataClass
    implements Insertable<PurchaseItemsLocalData> {
  final String id;
  final String purchaseId;
  final String? productId;
  final String productName;
  final int orderedQty;
  final int receivedQty;
  final int unitCostMinor;
  final int subtotalMinor;
  const PurchaseItemsLocalData({
    required this.id,
    required this.purchaseId,
    this.productId,
    required this.productName,
    required this.orderedQty,
    required this.receivedQty,
    required this.unitCostMinor,
    required this.subtotalMinor,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['purchase_id'] = Variable<String>(purchaseId);
    if (!nullToAbsent || productId != null) {
      map['product_id'] = Variable<String>(productId);
    }
    map['product_name'] = Variable<String>(productName);
    map['ordered_qty'] = Variable<int>(orderedQty);
    map['received_qty'] = Variable<int>(receivedQty);
    map['unit_cost_minor'] = Variable<int>(unitCostMinor);
    map['subtotal_minor'] = Variable<int>(subtotalMinor);
    return map;
  }

  PurchaseItemsLocalCompanion toCompanion(bool nullToAbsent) {
    return PurchaseItemsLocalCompanion(
      id: Value(id),
      purchaseId: Value(purchaseId),
      productId: productId == null && nullToAbsent
          ? const Value.absent()
          : Value(productId),
      productName: Value(productName),
      orderedQty: Value(orderedQty),
      receivedQty: Value(receivedQty),
      unitCostMinor: Value(unitCostMinor),
      subtotalMinor: Value(subtotalMinor),
    );
  }

  factory PurchaseItemsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PurchaseItemsLocalData(
      id: serializer.fromJson<String>(json['id']),
      purchaseId: serializer.fromJson<String>(json['purchaseId']),
      productId: serializer.fromJson<String?>(json['productId']),
      productName: serializer.fromJson<String>(json['productName']),
      orderedQty: serializer.fromJson<int>(json['orderedQty']),
      receivedQty: serializer.fromJson<int>(json['receivedQty']),
      unitCostMinor: serializer.fromJson<int>(json['unitCostMinor']),
      subtotalMinor: serializer.fromJson<int>(json['subtotalMinor']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'purchaseId': serializer.toJson<String>(purchaseId),
      'productId': serializer.toJson<String?>(productId),
      'productName': serializer.toJson<String>(productName),
      'orderedQty': serializer.toJson<int>(orderedQty),
      'receivedQty': serializer.toJson<int>(receivedQty),
      'unitCostMinor': serializer.toJson<int>(unitCostMinor),
      'subtotalMinor': serializer.toJson<int>(subtotalMinor),
    };
  }

  PurchaseItemsLocalData copyWith({
    String? id,
    String? purchaseId,
    Value<String?> productId = const Value.absent(),
    String? productName,
    int? orderedQty,
    int? receivedQty,
    int? unitCostMinor,
    int? subtotalMinor,
  }) => PurchaseItemsLocalData(
    id: id ?? this.id,
    purchaseId: purchaseId ?? this.purchaseId,
    productId: productId.present ? productId.value : this.productId,
    productName: productName ?? this.productName,
    orderedQty: orderedQty ?? this.orderedQty,
    receivedQty: receivedQty ?? this.receivedQty,
    unitCostMinor: unitCostMinor ?? this.unitCostMinor,
    subtotalMinor: subtotalMinor ?? this.subtotalMinor,
  );
  PurchaseItemsLocalData copyWithCompanion(PurchaseItemsLocalCompanion data) {
    return PurchaseItemsLocalData(
      id: data.id.present ? data.id.value : this.id,
      purchaseId: data.purchaseId.present
          ? data.purchaseId.value
          : this.purchaseId,
      productId: data.productId.present ? data.productId.value : this.productId,
      productName: data.productName.present
          ? data.productName.value
          : this.productName,
      orderedQty: data.orderedQty.present
          ? data.orderedQty.value
          : this.orderedQty,
      receivedQty: data.receivedQty.present
          ? data.receivedQty.value
          : this.receivedQty,
      unitCostMinor: data.unitCostMinor.present
          ? data.unitCostMinor.value
          : this.unitCostMinor,
      subtotalMinor: data.subtotalMinor.present
          ? data.subtotalMinor.value
          : this.subtotalMinor,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PurchaseItemsLocalData(')
          ..write('id: $id, ')
          ..write('purchaseId: $purchaseId, ')
          ..write('productId: $productId, ')
          ..write('productName: $productName, ')
          ..write('orderedQty: $orderedQty, ')
          ..write('receivedQty: $receivedQty, ')
          ..write('unitCostMinor: $unitCostMinor, ')
          ..write('subtotalMinor: $subtotalMinor')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    purchaseId,
    productId,
    productName,
    orderedQty,
    receivedQty,
    unitCostMinor,
    subtotalMinor,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PurchaseItemsLocalData &&
          other.id == this.id &&
          other.purchaseId == this.purchaseId &&
          other.productId == this.productId &&
          other.productName == this.productName &&
          other.orderedQty == this.orderedQty &&
          other.receivedQty == this.receivedQty &&
          other.unitCostMinor == this.unitCostMinor &&
          other.subtotalMinor == this.subtotalMinor);
}

class PurchaseItemsLocalCompanion
    extends UpdateCompanion<PurchaseItemsLocalData> {
  final Value<String> id;
  final Value<String> purchaseId;
  final Value<String?> productId;
  final Value<String> productName;
  final Value<int> orderedQty;
  final Value<int> receivedQty;
  final Value<int> unitCostMinor;
  final Value<int> subtotalMinor;
  final Value<int> rowid;
  const PurchaseItemsLocalCompanion({
    this.id = const Value.absent(),
    this.purchaseId = const Value.absent(),
    this.productId = const Value.absent(),
    this.productName = const Value.absent(),
    this.orderedQty = const Value.absent(),
    this.receivedQty = const Value.absent(),
    this.unitCostMinor = const Value.absent(),
    this.subtotalMinor = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PurchaseItemsLocalCompanion.insert({
    required String id,
    required String purchaseId,
    this.productId = const Value.absent(),
    required String productName,
    required int orderedQty,
    this.receivedQty = const Value.absent(),
    required int unitCostMinor,
    required int subtotalMinor,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       purchaseId = Value(purchaseId),
       productName = Value(productName),
       orderedQty = Value(orderedQty),
       unitCostMinor = Value(unitCostMinor),
       subtotalMinor = Value(subtotalMinor);
  static Insertable<PurchaseItemsLocalData> custom({
    Expression<String>? id,
    Expression<String>? purchaseId,
    Expression<String>? productId,
    Expression<String>? productName,
    Expression<int>? orderedQty,
    Expression<int>? receivedQty,
    Expression<int>? unitCostMinor,
    Expression<int>? subtotalMinor,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (purchaseId != null) 'purchase_id': purchaseId,
      if (productId != null) 'product_id': productId,
      if (productName != null) 'product_name': productName,
      if (orderedQty != null) 'ordered_qty': orderedQty,
      if (receivedQty != null) 'received_qty': receivedQty,
      if (unitCostMinor != null) 'unit_cost_minor': unitCostMinor,
      if (subtotalMinor != null) 'subtotal_minor': subtotalMinor,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PurchaseItemsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? purchaseId,
    Value<String?>? productId,
    Value<String>? productName,
    Value<int>? orderedQty,
    Value<int>? receivedQty,
    Value<int>? unitCostMinor,
    Value<int>? subtotalMinor,
    Value<int>? rowid,
  }) {
    return PurchaseItemsLocalCompanion(
      id: id ?? this.id,
      purchaseId: purchaseId ?? this.purchaseId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      orderedQty: orderedQty ?? this.orderedQty,
      receivedQty: receivedQty ?? this.receivedQty,
      unitCostMinor: unitCostMinor ?? this.unitCostMinor,
      subtotalMinor: subtotalMinor ?? this.subtotalMinor,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (purchaseId.present) {
      map['purchase_id'] = Variable<String>(purchaseId.value);
    }
    if (productId.present) {
      map['product_id'] = Variable<String>(productId.value);
    }
    if (productName.present) {
      map['product_name'] = Variable<String>(productName.value);
    }
    if (orderedQty.present) {
      map['ordered_qty'] = Variable<int>(orderedQty.value);
    }
    if (receivedQty.present) {
      map['received_qty'] = Variable<int>(receivedQty.value);
    }
    if (unitCostMinor.present) {
      map['unit_cost_minor'] = Variable<int>(unitCostMinor.value);
    }
    if (subtotalMinor.present) {
      map['subtotal_minor'] = Variable<int>(subtotalMinor.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PurchaseItemsLocalCompanion(')
          ..write('id: $id, ')
          ..write('purchaseId: $purchaseId, ')
          ..write('productId: $productId, ')
          ..write('productName: $productName, ')
          ..write('orderedQty: $orderedQty, ')
          ..write('receivedQty: $receivedQty, ')
          ..write('unitCostMinor: $unitCostMinor, ')
          ..write('subtotalMinor: $subtotalMinor, ')
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
  static const VerificationMeta _changeMinorMeta = const VerificationMeta(
    'changeMinor',
  );
  @override
  late final GeneratedColumn<int> changeMinor = GeneratedColumn<int>(
    'change_minor',
    aliasedName,
    true,
    check: () => const CustomExpression('change_minor >= 0'),
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
    changeMinor,
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
    if (data.containsKey('change_minor')) {
      context.handle(
        _changeMinorMeta,
        changeMinor.isAcceptableOrUnknown(
          data['change_minor']!,
          _changeMinorMeta,
        ),
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
      changeMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}change_minor'],
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

  /// V2 addition: Change given for cash payments (D8)
  final int? changeMinor;
  const PaymentsLocalData({
    required this.clientPaymentId,
    required this.clientTransactionId,
    required this.paymentMethod,
    required this.amountMinor,
    required this.recordStatus,
    required this.verificationStatus,
    required this.createdAt,
    this.syncedAt,
    this.changeMinor,
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
    if (!nullToAbsent || changeMinor != null) {
      map['change_minor'] = Variable<int>(changeMinor);
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
      changeMinor: changeMinor == null && nullToAbsent
          ? const Value.absent()
          : Value(changeMinor),
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
      changeMinor: serializer.fromJson<int?>(json['changeMinor']),
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
      'changeMinor': serializer.toJson<int?>(changeMinor),
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
    Value<int?> changeMinor = const Value.absent(),
  }) => PaymentsLocalData(
    clientPaymentId: clientPaymentId ?? this.clientPaymentId,
    clientTransactionId: clientTransactionId ?? this.clientTransactionId,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    amountMinor: amountMinor ?? this.amountMinor,
    recordStatus: recordStatus ?? this.recordStatus,
    verificationStatus: verificationStatus ?? this.verificationStatus,
    createdAt: createdAt ?? this.createdAt,
    syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
    changeMinor: changeMinor.present ? changeMinor.value : this.changeMinor,
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
      changeMinor: data.changeMinor.present
          ? data.changeMinor.value
          : this.changeMinor,
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
          ..write('syncedAt: $syncedAt, ')
          ..write('changeMinor: $changeMinor')
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
    changeMinor,
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
          other.syncedAt == this.syncedAt &&
          other.changeMinor == this.changeMinor);
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
  final Value<int?> changeMinor;
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
    this.changeMinor = const Value.absent(),
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
    this.changeMinor = const Value.absent(),
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
    Expression<int>? changeMinor,
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
      if (changeMinor != null) 'change_minor': changeMinor,
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
    Value<int?>? changeMinor,
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
      changeMinor: changeMinor ?? this.changeMinor,
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
    if (changeMinor.present) {
      map['change_minor'] = Variable<int>(changeMinor.value);
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
          ..write('changeMinor: $changeMinor, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReceiptSequencesLocalTable extends ReceiptSequencesLocal
    with TableInfo<$ReceiptSequencesLocalTable, ReceiptSequencesLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReceiptSequencesLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _sequenceDateMeta = const VerificationMeta(
    'sequenceDate',
  );
  @override
  late final GeneratedColumn<String> sequenceDate = GeneratedColumn<String>(
    'sequence_date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lastSequenceMeta = const VerificationMeta(
    'lastSequence',
  );
  @override
  late final GeneratedColumn<int> lastSequence = GeneratedColumn<int>(
    'last_sequence',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
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
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    branchId,
    sequenceDate,
    lastSequence,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'receipt_sequences_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<ReceiptSequencesLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
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
    if (data.containsKey('sequence_date')) {
      context.handle(
        _sequenceDateMeta,
        sequenceDate.isAcceptableOrUnknown(
          data['sequence_date']!,
          _sequenceDateMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_sequenceDateMeta);
    }
    if (data.containsKey('last_sequence')) {
      context.handle(
        _lastSequenceMeta,
        lastSequence.isAcceptableOrUnknown(
          data['last_sequence']!,
          _lastSequenceMeta,
        ),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ReceiptSequencesLocalData map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReceiptSequencesLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      sequenceDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sequence_date'],
      )!,
      lastSequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_sequence'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $ReceiptSequencesLocalTable createAlias(String alias) {
    return $ReceiptSequencesLocalTable(attachedDatabase, alias);
  }
}

class ReceiptSequencesLocalData extends DataClass
    implements Insertable<ReceiptSequencesLocalData> {
  final String id;
  final String businessId;
  final String branchId;

  /// Format: YYYYMMDD (derived from business timezone, not device timezone)
  final String sequenceDate;

  /// Last used sequence number
  final int lastSequence;
  final int updatedAt;
  const ReceiptSequencesLocalData({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.sequenceDate,
    required this.lastSequence,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['sequence_date'] = Variable<String>(sequenceDate);
    map['last_sequence'] = Variable<int>(lastSequence);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  ReceiptSequencesLocalCompanion toCompanion(bool nullToAbsent) {
    return ReceiptSequencesLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      branchId: Value(branchId),
      sequenceDate: Value(sequenceDate),
      lastSequence: Value(lastSequence),
      updatedAt: Value(updatedAt),
    );
  }

  factory ReceiptSequencesLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReceiptSequencesLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      sequenceDate: serializer.fromJson<String>(json['sequenceDate']),
      lastSequence: serializer.fromJson<int>(json['lastSequence']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'sequenceDate': serializer.toJson<String>(sequenceDate),
      'lastSequence': serializer.toJson<int>(lastSequence),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  ReceiptSequencesLocalData copyWith({
    String? id,
    String? businessId,
    String? branchId,
    String? sequenceDate,
    int? lastSequence,
    int? updatedAt,
  }) => ReceiptSequencesLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    sequenceDate: sequenceDate ?? this.sequenceDate,
    lastSequence: lastSequence ?? this.lastSequence,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  ReceiptSequencesLocalData copyWithCompanion(
    ReceiptSequencesLocalCompanion data,
  ) {
    return ReceiptSequencesLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      sequenceDate: data.sequenceDate.present
          ? data.sequenceDate.value
          : this.sequenceDate,
      lastSequence: data.lastSequence.present
          ? data.lastSequence.value
          : this.lastSequence,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptSequencesLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('sequenceDate: $sequenceDate, ')
          ..write('lastSequence: $lastSequence, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    branchId,
    sequenceDate,
    lastSequence,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReceiptSequencesLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.sequenceDate == this.sequenceDate &&
          other.lastSequence == this.lastSequence &&
          other.updatedAt == this.updatedAt);
}

class ReceiptSequencesLocalCompanion
    extends UpdateCompanion<ReceiptSequencesLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> sequenceDate;
  final Value<int> lastSequence;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const ReceiptSequencesLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.sequenceDate = const Value.absent(),
    this.lastSequence = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReceiptSequencesLocalCompanion.insert({
    required String id,
    required String businessId,
    required String branchId,
    required String sequenceDate,
    this.lastSequence = const Value.absent(),
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       branchId = Value(branchId),
       sequenceDate = Value(sequenceDate),
       updatedAt = Value(updatedAt);
  static Insertable<ReceiptSequencesLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? sequenceDate,
    Expression<int>? lastSequence,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (sequenceDate != null) 'sequence_date': sequenceDate,
      if (lastSequence != null) 'last_sequence': lastSequence,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReceiptSequencesLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? sequenceDate,
    Value<int>? lastSequence,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return ReceiptSequencesLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      sequenceDate: sequenceDate ?? this.sequenceDate,
      lastSequence: lastSequence ?? this.lastSequence,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (sequenceDate.present) {
      map['sequence_date'] = Variable<String>(sequenceDate.value);
    }
    if (lastSequence.present) {
      map['last_sequence'] = Variable<int>(lastSequence.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptSequencesLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('sequenceDate: $sequenceDate, ')
          ..write('lastSequence: $lastSequence, ')
          ..write('updatedAt: $updatedAt, ')
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
  static const VerificationMeta _requestFingerprintMeta =
      const VerificationMeta('requestFingerprint');
  @override
  late final GeneratedColumn<String> requestFingerprint =
      GeneratedColumn<String>(
        'request_fingerprint',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  @override
  List<GeneratedColumn> get $columns => [
    key,
    businessId,
    entityType,
    createdAt,
    requestFingerprint,
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
    if (data.containsKey('request_fingerprint')) {
      context.handle(
        _requestFingerprintMeta,
        requestFingerprint.isAcceptableOrUnknown(
          data['request_fingerprint']!,
          _requestFingerprintMeta,
        ),
      );
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
      requestFingerprint: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}request_fingerprint'],
      ),
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

  /// V3 addition: Fingerprint of the original checkout request.
  /// Nullable for backward compatibility with V2 rows.
  /// All new rows MUST have a fingerprint.
  final String? requestFingerprint;
  const LocalIdempotencyKey({
    required this.key,
    required this.businessId,
    required this.entityType,
    required this.createdAt,
    this.requestFingerprint,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['business_id'] = Variable<String>(businessId);
    map['entity_type'] = Variable<String>(entityType);
    map['created_at'] = Variable<int>(createdAt);
    if (!nullToAbsent || requestFingerprint != null) {
      map['request_fingerprint'] = Variable<String>(requestFingerprint);
    }
    return map;
  }

  LocalIdempotencyKeysCompanion toCompanion(bool nullToAbsent) {
    return LocalIdempotencyKeysCompanion(
      key: Value(key),
      businessId: Value(businessId),
      entityType: Value(entityType),
      createdAt: Value(createdAt),
      requestFingerprint: requestFingerprint == null && nullToAbsent
          ? const Value.absent()
          : Value(requestFingerprint),
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
      requestFingerprint: serializer.fromJson<String?>(
        json['requestFingerprint'],
      ),
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
      'requestFingerprint': serializer.toJson<String?>(requestFingerprint),
    };
  }

  LocalIdempotencyKey copyWith({
    String? key,
    String? businessId,
    String? entityType,
    int? createdAt,
    Value<String?> requestFingerprint = const Value.absent(),
  }) => LocalIdempotencyKey(
    key: key ?? this.key,
    businessId: businessId ?? this.businessId,
    entityType: entityType ?? this.entityType,
    createdAt: createdAt ?? this.createdAt,
    requestFingerprint: requestFingerprint.present
        ? requestFingerprint.value
        : this.requestFingerprint,
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
      requestFingerprint: data.requestFingerprint.present
          ? data.requestFingerprint.value
          : this.requestFingerprint,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalIdempotencyKey(')
          ..write('key: $key, ')
          ..write('businessId: $businessId, ')
          ..write('entityType: $entityType, ')
          ..write('createdAt: $createdAt, ')
          ..write('requestFingerprint: $requestFingerprint')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(key, businessId, entityType, createdAt, requestFingerprint);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalIdempotencyKey &&
          other.key == this.key &&
          other.businessId == this.businessId &&
          other.entityType == this.entityType &&
          other.createdAt == this.createdAt &&
          other.requestFingerprint == this.requestFingerprint);
}

class LocalIdempotencyKeysCompanion
    extends UpdateCompanion<LocalIdempotencyKey> {
  final Value<String> key;
  final Value<String> businessId;
  final Value<String> entityType;
  final Value<int> createdAt;
  final Value<String?> requestFingerprint;
  final Value<int> rowid;
  const LocalIdempotencyKeysCompanion({
    this.key = const Value.absent(),
    this.businessId = const Value.absent(),
    this.entityType = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.requestFingerprint = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalIdempotencyKeysCompanion.insert({
    required String key,
    required String businessId,
    required String entityType,
    required int createdAt,
    this.requestFingerprint = const Value.absent(),
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
    Expression<String>? requestFingerprint,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (businessId != null) 'business_id': businessId,
      if (entityType != null) 'entity_type': entityType,
      if (createdAt != null) 'created_at': createdAt,
      if (requestFingerprint != null) 'request_fingerprint': requestFingerprint,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalIdempotencyKeysCompanion copyWith({
    Value<String>? key,
    Value<String>? businessId,
    Value<String>? entityType,
    Value<int>? createdAt,
    Value<String?>? requestFingerprint,
    Value<int>? rowid,
  }) {
    return LocalIdempotencyKeysCompanion(
      key: key ?? this.key,
      businessId: businessId ?? this.businessId,
      entityType: entityType ?? this.entityType,
      createdAt: createdAt ?? this.createdAt,
      requestFingerprint: requestFingerprint ?? this.requestFingerprint,
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
    if (requestFingerprint.present) {
      map['request_fingerprint'] = Variable<String>(requestFingerprint.value);
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
          ..write('requestFingerprint: $requestFingerprint, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncOutboxTable extends SyncOutbox
    with TableInfo<$SyncOutboxTable, SyncOutboxData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncOutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operationMeta = const VerificationMeta(
    'operation',
  );
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
    'operation',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idempotencyKeyMeta = const VerificationMeta(
    'idempotencyKey',
  );
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
    'idempotency_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _attemptCountMeta = const VerificationMeta(
    'attemptCount',
  );
  @override
  late final GeneratedColumn<int> attemptCount = GeneratedColumn<int>(
    'attempt_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<int> nextAttemptAt = GeneratedColumn<int>(
    'next_attempt_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
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
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
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
    entityType,
    operation,
    payloadJson,
    idempotencyKey,
    attemptCount,
    nextAttemptAt,
    lastError,
    status,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncOutboxData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(
        _operationMeta,
        operation.isAcceptableOrUnknown(data['operation']!, _operationMeta),
      );
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
        _idempotencyKeyMeta,
        idempotencyKey.isAcceptableOrUnknown(
          data['idempotency_key']!,
          _idempotencyKeyMeta,
        ),
      );
    }
    if (data.containsKey('attempt_count')) {
      context.handle(
        _attemptCountMeta,
        attemptCount.isAcceptableOrUnknown(
          data['attempt_count']!,
          _attemptCountMeta,
        ),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_nextAttemptAtMeta);
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
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
  SyncOutboxData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncOutboxData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      operation: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operation'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      idempotencyKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}idempotency_key'],
      ),
      attemptCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempt_count'],
      )!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}next_attempt_at'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SyncOutboxTable createAlias(String alias) {
    return $SyncOutboxTable(attachedDatabase, alias);
  }
}

class SyncOutboxData extends DataClass implements Insertable<SyncOutboxData> {
  final String id;
  final String entityType;
  final String operation;
  final String payloadJson;
  final String? idempotencyKey;
  final int attemptCount;
  final int nextAttemptAt;
  final String? lastError;
  final String status;
  final int createdAt;
  const SyncOutboxData({
    required this.id,
    required this.entityType,
    required this.operation,
    required this.payloadJson,
    this.idempotencyKey,
    required this.attemptCount,
    required this.nextAttemptAt,
    this.lastError,
    required this.status,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['entity_type'] = Variable<String>(entityType);
    map['operation'] = Variable<String>(operation);
    map['payload_json'] = Variable<String>(payloadJson);
    if (!nullToAbsent || idempotencyKey != null) {
      map['idempotency_key'] = Variable<String>(idempotencyKey);
    }
    map['attempt_count'] = Variable<int>(attemptCount);
    map['next_attempt_at'] = Variable<int>(nextAttemptAt);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['status'] = Variable<String>(status);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  SyncOutboxCompanion toCompanion(bool nullToAbsent) {
    return SyncOutboxCompanion(
      id: Value(id),
      entityType: Value(entityType),
      operation: Value(operation),
      payloadJson: Value(payloadJson),
      idempotencyKey: idempotencyKey == null && nullToAbsent
          ? const Value.absent()
          : Value(idempotencyKey),
      attemptCount: Value(attemptCount),
      nextAttemptAt: Value(nextAttemptAt),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      status: Value(status),
      createdAt: Value(createdAt),
    );
  }

  factory SyncOutboxData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncOutboxData(
      id: serializer.fromJson<String>(json['id']),
      entityType: serializer.fromJson<String>(json['entityType']),
      operation: serializer.fromJson<String>(json['operation']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      idempotencyKey: serializer.fromJson<String?>(json['idempotencyKey']),
      attemptCount: serializer.fromJson<int>(json['attemptCount']),
      nextAttemptAt: serializer.fromJson<int>(json['nextAttemptAt']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      status: serializer.fromJson<String>(json['status']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'entityType': serializer.toJson<String>(entityType),
      'operation': serializer.toJson<String>(operation),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'idempotencyKey': serializer.toJson<String?>(idempotencyKey),
      'attemptCount': serializer.toJson<int>(attemptCount),
      'nextAttemptAt': serializer.toJson<int>(nextAttemptAt),
      'lastError': serializer.toJson<String?>(lastError),
      'status': serializer.toJson<String>(status),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  SyncOutboxData copyWith({
    String? id,
    String? entityType,
    String? operation,
    String? payloadJson,
    Value<String?> idempotencyKey = const Value.absent(),
    int? attemptCount,
    int? nextAttemptAt,
    Value<String?> lastError = const Value.absent(),
    String? status,
    int? createdAt,
  }) => SyncOutboxData(
    id: id ?? this.id,
    entityType: entityType ?? this.entityType,
    operation: operation ?? this.operation,
    payloadJson: payloadJson ?? this.payloadJson,
    idempotencyKey: idempotencyKey.present
        ? idempotencyKey.value
        : this.idempotencyKey,
    attemptCount: attemptCount ?? this.attemptCount,
    nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
    lastError: lastError.present ? lastError.value : this.lastError,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
  );
  SyncOutboxData copyWithCompanion(SyncOutboxCompanion data) {
    return SyncOutboxData(
      id: data.id.present ? data.id.value : this.id,
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      operation: data.operation.present ? data.operation.value : this.operation,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      attemptCount: data.attemptCount.present
          ? data.attemptCount.value
          : this.attemptCount,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncOutboxData(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('attemptCount: $attemptCount, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    entityType,
    operation,
    payloadJson,
    idempotencyKey,
    attemptCount,
    nextAttemptAt,
    lastError,
    status,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncOutboxData &&
          other.id == this.id &&
          other.entityType == this.entityType &&
          other.operation == this.operation &&
          other.payloadJson == this.payloadJson &&
          other.idempotencyKey == this.idempotencyKey &&
          other.attemptCount == this.attemptCount &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.lastError == this.lastError &&
          other.status == this.status &&
          other.createdAt == this.createdAt);
}

class SyncOutboxCompanion extends UpdateCompanion<SyncOutboxData> {
  final Value<String> id;
  final Value<String> entityType;
  final Value<String> operation;
  final Value<String> payloadJson;
  final Value<String?> idempotencyKey;
  final Value<int> attemptCount;
  final Value<int> nextAttemptAt;
  final Value<String?> lastError;
  final Value<String> status;
  final Value<int> createdAt;
  final Value<int> rowid;
  const SyncOutboxCompanion({
    this.id = const Value.absent(),
    this.entityType = const Value.absent(),
    this.operation = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.attemptCount = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncOutboxCompanion.insert({
    required String id,
    required String entityType,
    required String operation,
    required String payloadJson,
    this.idempotencyKey = const Value.absent(),
    this.attemptCount = const Value.absent(),
    required int nextAttemptAt,
    this.lastError = const Value.absent(),
    this.status = const Value.absent(),
    required int createdAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       entityType = Value(entityType),
       operation = Value(operation),
       payloadJson = Value(payloadJson),
       nextAttemptAt = Value(nextAttemptAt),
       createdAt = Value(createdAt);
  static Insertable<SyncOutboxData> custom({
    Expression<String>? id,
    Expression<String>? entityType,
    Expression<String>? operation,
    Expression<String>? payloadJson,
    Expression<String>? idempotencyKey,
    Expression<int>? attemptCount,
    Expression<int>? nextAttemptAt,
    Expression<String>? lastError,
    Expression<String>? status,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (entityType != null) 'entity_type': entityType,
      if (operation != null) 'operation': operation,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (attemptCount != null) 'attempt_count': attemptCount,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (lastError != null) 'last_error': lastError,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncOutboxCompanion copyWith({
    Value<String>? id,
    Value<String>? entityType,
    Value<String>? operation,
    Value<String>? payloadJson,
    Value<String?>? idempotencyKey,
    Value<int>? attemptCount,
    Value<int>? nextAttemptAt,
    Value<String?>? lastError,
    Value<String>? status,
    Value<int>? createdAt,
    Value<int>? rowid,
  }) {
    return SyncOutboxCompanion(
      id: id ?? this.id,
      entityType: entityType ?? this.entityType,
      operation: operation ?? this.operation,
      payloadJson: payloadJson ?? this.payloadJson,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      attemptCount: attemptCount ?? this.attemptCount,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastError: lastError ?? this.lastError,
      status: status ?? this.status,
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
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (attemptCount.present) {
      map['attempt_count'] = Variable<int>(attemptCount.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<int>(nextAttemptAt.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
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
    return (StringBuffer('SyncOutboxCompanion(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('attemptCount: $attemptCount, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncMetaTable extends SyncMeta
    with TableInfo<$SyncMetaTable, SyncMetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncMetaData> instance, {
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
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  SyncMetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncMetaData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $SyncMetaTable createAlias(String alias) {
    return $SyncMetaTable(attachedDatabase, alias);
  }
}

class SyncMetaData extends DataClass implements Insertable<SyncMetaData> {
  final String key;
  final String value;
  const SyncMetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  SyncMetaCompanion toCompanion(bool nullToAbsent) {
    return SyncMetaCompanion(key: Value(key), value: Value(value));
  }

  factory SyncMetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncMetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  SyncMetaData copyWith({String? key, String? value}) =>
      SyncMetaData(key: key ?? this.key, value: value ?? this.value);
  SyncMetaData copyWithCompanion(SyncMetaCompanion data) {
    return SyncMetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncMetaData &&
          other.key == this.key &&
          other.value == this.value);
}

class SyncMetaCompanion extends UpdateCompanion<SyncMetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const SyncMetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncMetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<SyncMetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncMetaCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return SyncMetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncMetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $StocksLocalTable extends StocksLocal
    with TableInfo<$StocksLocalTable, StocksLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StocksLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
  static const VerificationMeta _productNameMeta = const VerificationMeta(
    'productName',
  );
  @override
  late final GeneratedColumn<String> productName = GeneratedColumn<String>(
    'product_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _skuMeta = const VerificationMeta('sku');
  @override
  late final GeneratedColumn<String> sku = GeneratedColumn<String>(
    'sku',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryMeta = const VerificationMeta(
    'category',
  );
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
    'category',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _barcodeMeta = const VerificationMeta(
    'barcode',
  );
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
    'barcode',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _priceMinorMeta = const VerificationMeta(
    'priceMinor',
  );
  @override
  late final GeneratedColumn<int> priceMinor = GeneratedColumn<int>(
    'price_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _costMinorMeta = const VerificationMeta(
    'costMinor',
  );
  @override
  late final GeneratedColumn<int> costMinor = GeneratedColumn<int>(
    'cost_minor',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _quantityMeta = const VerificationMeta(
    'quantity',
  );
  @override
  late final GeneratedColumn<int> quantity = GeneratedColumn<int>(
    'quantity',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
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
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<int> cachedAt = GeneratedColumn<int>(
    'cached_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    branchId,
    productId,
    productName,
    sku,
    category,
    barcode,
    priceMinor,
    costMinor,
    quantity,
    serverVersion,
    createdAt,
    updatedAt,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'stocks_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<StocksLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
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
    if (data.containsKey('product_id')) {
      context.handle(
        _productIdMeta,
        productId.isAcceptableOrUnknown(data['product_id']!, _productIdMeta),
      );
    } else if (isInserting) {
      context.missing(_productIdMeta);
    }
    if (data.containsKey('product_name')) {
      context.handle(
        _productNameMeta,
        productName.isAcceptableOrUnknown(
          data['product_name']!,
          _productNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_productNameMeta);
    }
    if (data.containsKey('sku')) {
      context.handle(
        _skuMeta,
        sku.isAcceptableOrUnknown(data['sku']!, _skuMeta),
      );
    }
    if (data.containsKey('category')) {
      context.handle(
        _categoryMeta,
        category.isAcceptableOrUnknown(data['category']!, _categoryMeta),
      );
    }
    if (data.containsKey('barcode')) {
      context.handle(
        _barcodeMeta,
        barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta),
      );
    }
    if (data.containsKey('price_minor')) {
      context.handle(
        _priceMinorMeta,
        priceMinor.isAcceptableOrUnknown(data['price_minor']!, _priceMinorMeta),
      );
    } else if (isInserting) {
      context.missing(_priceMinorMeta);
    }
    if (data.containsKey('cost_minor')) {
      context.handle(
        _costMinorMeta,
        costMinor.isAcceptableOrUnknown(data['cost_minor']!, _costMinorMeta),
      );
    }
    if (data.containsKey('quantity')) {
      context.handle(
        _quantityMeta,
        quantity.isAcceptableOrUnknown(data['quantity']!, _quantityMeta),
      );
    } else if (isInserting) {
      context.missing(_quantityMeta);
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StocksLocalData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StocksLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      productId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_id'],
      )!,
      productName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_name'],
      )!,
      sku: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sku'],
      ),
      category: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category'],
      ),
      barcode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}barcode'],
      ),
      priceMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}price_minor'],
      )!,
      costMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}cost_minor'],
      ),
      quantity: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}quantity'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      ),
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      ),
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}cached_at'],
      ),
    );
  }

  @override
  $StocksLocalTable createAlias(String alias) {
    return $StocksLocalTable(attachedDatabase, alias);
  }
}

class StocksLocalData extends DataClass implements Insertable<StocksLocalData> {
  /// Server-generated UUID (stocks.id)
  final String id;

  /// Tenant isolation
  final String businessId;

  /// Branch scope
  final String branchId;

  /// Product identifier
  final String productId;

  /// Product display fields (denormalized from products join)
  final String productName;
  final String? sku;
  final String? category;
  final String? barcode;

  /// Price and cost in minor units (INTEGER, no floating point)
  final int priceMinor;
  final int? costMinor;

  /// Current on-hand quantity (server-authoritative, INTEGER >= 0)
  final int quantity;

  /// Optimistic-lock version for stock adjustments (STOCK_VERSION_CONFLICT)
  final int serverVersion;

  /// Server timestamps (epoch ms)
  final int? createdAt;
  final int? updatedAt;

  /// Local sync metadata (epoch ms)
  final int? cachedAt;
  const StocksLocalData({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.productName,
    this.sku,
    this.category,
    this.barcode,
    required this.priceMinor,
    this.costMinor,
    required this.quantity,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
    this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['product_id'] = Variable<String>(productId);
    map['product_name'] = Variable<String>(productName);
    if (!nullToAbsent || sku != null) {
      map['sku'] = Variable<String>(sku);
    }
    if (!nullToAbsent || category != null) {
      map['category'] = Variable<String>(category);
    }
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    map['price_minor'] = Variable<int>(priceMinor);
    if (!nullToAbsent || costMinor != null) {
      map['cost_minor'] = Variable<int>(costMinor);
    }
    map['quantity'] = Variable<int>(quantity);
    map['server_version'] = Variable<int>(serverVersion);
    if (!nullToAbsent || createdAt != null) {
      map['created_at'] = Variable<int>(createdAt);
    }
    if (!nullToAbsent || updatedAt != null) {
      map['updated_at'] = Variable<int>(updatedAt);
    }
    if (!nullToAbsent || cachedAt != null) {
      map['cached_at'] = Variable<int>(cachedAt);
    }
    return map;
  }

  StocksLocalCompanion toCompanion(bool nullToAbsent) {
    return StocksLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      branchId: Value(branchId),
      productId: Value(productId),
      productName: Value(productName),
      sku: sku == null && nullToAbsent ? const Value.absent() : Value(sku),
      category: category == null && nullToAbsent
          ? const Value.absent()
          : Value(category),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
      priceMinor: Value(priceMinor),
      costMinor: costMinor == null && nullToAbsent
          ? const Value.absent()
          : Value(costMinor),
      quantity: Value(quantity),
      serverVersion: Value(serverVersion),
      createdAt: createdAt == null && nullToAbsent
          ? const Value.absent()
          : Value(createdAt),
      updatedAt: updatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(updatedAt),
      cachedAt: cachedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(cachedAt),
    );
  }

  factory StocksLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StocksLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      productId: serializer.fromJson<String>(json['productId']),
      productName: serializer.fromJson<String>(json['productName']),
      sku: serializer.fromJson<String?>(json['sku']),
      category: serializer.fromJson<String?>(json['category']),
      barcode: serializer.fromJson<String?>(json['barcode']),
      priceMinor: serializer.fromJson<int>(json['priceMinor']),
      costMinor: serializer.fromJson<int?>(json['costMinor']),
      quantity: serializer.fromJson<int>(json['quantity']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      createdAt: serializer.fromJson<int?>(json['createdAt']),
      updatedAt: serializer.fromJson<int?>(json['updatedAt']),
      cachedAt: serializer.fromJson<int?>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'productId': serializer.toJson<String>(productId),
      'productName': serializer.toJson<String>(productName),
      'sku': serializer.toJson<String?>(sku),
      'category': serializer.toJson<String?>(category),
      'barcode': serializer.toJson<String?>(barcode),
      'priceMinor': serializer.toJson<int>(priceMinor),
      'costMinor': serializer.toJson<int?>(costMinor),
      'quantity': serializer.toJson<int>(quantity),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'createdAt': serializer.toJson<int?>(createdAt),
      'updatedAt': serializer.toJson<int?>(updatedAt),
      'cachedAt': serializer.toJson<int?>(cachedAt),
    };
  }

  StocksLocalData copyWith({
    String? id,
    String? businessId,
    String? branchId,
    String? productId,
    String? productName,
    Value<String?> sku = const Value.absent(),
    Value<String?> category = const Value.absent(),
    Value<String?> barcode = const Value.absent(),
    int? priceMinor,
    Value<int?> costMinor = const Value.absent(),
    int? quantity,
    int? serverVersion,
    Value<int?> createdAt = const Value.absent(),
    Value<int?> updatedAt = const Value.absent(),
    Value<int?> cachedAt = const Value.absent(),
  }) => StocksLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    productId: productId ?? this.productId,
    productName: productName ?? this.productName,
    sku: sku.present ? sku.value : this.sku,
    category: category.present ? category.value : this.category,
    barcode: barcode.present ? barcode.value : this.barcode,
    priceMinor: priceMinor ?? this.priceMinor,
    costMinor: costMinor.present ? costMinor.value : this.costMinor,
    quantity: quantity ?? this.quantity,
    serverVersion: serverVersion ?? this.serverVersion,
    createdAt: createdAt.present ? createdAt.value : this.createdAt,
    updatedAt: updatedAt.present ? updatedAt.value : this.updatedAt,
    cachedAt: cachedAt.present ? cachedAt.value : this.cachedAt,
  );
  StocksLocalData copyWithCompanion(StocksLocalCompanion data) {
    return StocksLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      productId: data.productId.present ? data.productId.value : this.productId,
      productName: data.productName.present
          ? data.productName.value
          : this.productName,
      sku: data.sku.present ? data.sku.value : this.sku,
      category: data.category.present ? data.category.value : this.category,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      priceMinor: data.priceMinor.present
          ? data.priceMinor.value
          : this.priceMinor,
      costMinor: data.costMinor.present ? data.costMinor.value : this.costMinor,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StocksLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('productId: $productId, ')
          ..write('productName: $productName, ')
          ..write('sku: $sku, ')
          ..write('category: $category, ')
          ..write('barcode: $barcode, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('costMinor: $costMinor, ')
          ..write('quantity: $quantity, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    branchId,
    productId,
    productName,
    sku,
    category,
    barcode,
    priceMinor,
    costMinor,
    quantity,
    serverVersion,
    createdAt,
    updatedAt,
    cachedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StocksLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.productId == this.productId &&
          other.productName == this.productName &&
          other.sku == this.sku &&
          other.category == this.category &&
          other.barcode == this.barcode &&
          other.priceMinor == this.priceMinor &&
          other.costMinor == this.costMinor &&
          other.quantity == this.quantity &&
          other.serverVersion == this.serverVersion &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.cachedAt == this.cachedAt);
}

class StocksLocalCompanion extends UpdateCompanion<StocksLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> productId;
  final Value<String> productName;
  final Value<String?> sku;
  final Value<String?> category;
  final Value<String?> barcode;
  final Value<int> priceMinor;
  final Value<int?> costMinor;
  final Value<int> quantity;
  final Value<int> serverVersion;
  final Value<int?> createdAt;
  final Value<int?> updatedAt;
  final Value<int?> cachedAt;
  final Value<int> rowid;
  const StocksLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.productId = const Value.absent(),
    this.productName = const Value.absent(),
    this.sku = const Value.absent(),
    this.category = const Value.absent(),
    this.barcode = const Value.absent(),
    this.priceMinor = const Value.absent(),
    this.costMinor = const Value.absent(),
    this.quantity = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  StocksLocalCompanion.insert({
    required String id,
    required String businessId,
    required String branchId,
    required String productId,
    required String productName,
    this.sku = const Value.absent(),
    this.category = const Value.absent(),
    this.barcode = const Value.absent(),
    required int priceMinor,
    this.costMinor = const Value.absent(),
    required int quantity,
    this.serverVersion = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       branchId = Value(branchId),
       productId = Value(productId),
       productName = Value(productName),
       priceMinor = Value(priceMinor),
       quantity = Value(quantity);
  static Insertable<StocksLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? productId,
    Expression<String>? productName,
    Expression<String>? sku,
    Expression<String>? category,
    Expression<String>? barcode,
    Expression<int>? priceMinor,
    Expression<int>? costMinor,
    Expression<int>? quantity,
    Expression<int>? serverVersion,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<int>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (productId != null) 'product_id': productId,
      if (productName != null) 'product_name': productName,
      if (sku != null) 'sku': sku,
      if (category != null) 'category': category,
      if (barcode != null) 'barcode': barcode,
      if (priceMinor != null) 'price_minor': priceMinor,
      if (costMinor != null) 'cost_minor': costMinor,
      if (quantity != null) 'quantity': quantity,
      if (serverVersion != null) 'server_version': serverVersion,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  StocksLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? productId,
    Value<String>? productName,
    Value<String?>? sku,
    Value<String?>? category,
    Value<String?>? barcode,
    Value<int>? priceMinor,
    Value<int?>? costMinor,
    Value<int>? quantity,
    Value<int>? serverVersion,
    Value<int?>? createdAt,
    Value<int?>? updatedAt,
    Value<int?>? cachedAt,
    Value<int>? rowid,
  }) {
    return StocksLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      sku: sku ?? this.sku,
      category: category ?? this.category,
      barcode: barcode ?? this.barcode,
      priceMinor: priceMinor ?? this.priceMinor,
      costMinor: costMinor ?? this.costMinor,
      quantity: quantity ?? this.quantity,
      serverVersion: serverVersion ?? this.serverVersion,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (productId.present) {
      map['product_id'] = Variable<String>(productId.value);
    }
    if (productName.present) {
      map['product_name'] = Variable<String>(productName.value);
    }
    if (sku.present) {
      map['sku'] = Variable<String>(sku.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (priceMinor.present) {
      map['price_minor'] = Variable<int>(priceMinor.value);
    }
    if (costMinor.present) {
      map['cost_minor'] = Variable<int>(costMinor.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<int>(quantity.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<int>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StocksLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('productId: $productId, ')
          ..write('productName: $productName, ')
          ..write('sku: $sku, ')
          ..write('category: $category, ')
          ..write('barcode: $barcode, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('costMinor: $costMinor, ')
          ..write('quantity: $quantity, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $StockMovementsLocalTable extends StockMovementsLocal
    with TableInfo<$StockMovementsLocalTable, StockMovementsLocalData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StockMovementsLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
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
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _movementTypeMeta = const VerificationMeta(
    'movementType',
  );
  @override
  late final GeneratedColumn<String> movementType = GeneratedColumn<String>(
    'movement_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _referenceMeta = const VerificationMeta(
    'reference',
  );
  @override
  late final GeneratedColumn<String> reference = GeneratedColumn<String>(
    'reference',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _actorMeta = const VerificationMeta('actor');
  @override
  late final GeneratedColumn<String> actor = GeneratedColumn<String>(
    'actor',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _timestampMeta = const VerificationMeta(
    'timestamp',
  );
  @override
  late final GeneratedColumn<int> timestamp = GeneratedColumn<int>(
    'timestamp',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<int> cachedAt = GeneratedColumn<int>(
    'cached_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    businessId,
    branchId,
    productId,
    quantity,
    movementType,
    reference,
    actor,
    timestamp,
    cachedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'stock_movements_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<StockMovementsLocalData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
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
    if (data.containsKey('movement_type')) {
      context.handle(
        _movementTypeMeta,
        movementType.isAcceptableOrUnknown(
          data['movement_type']!,
          _movementTypeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_movementTypeMeta);
    }
    if (data.containsKey('reference')) {
      context.handle(
        _referenceMeta,
        reference.isAcceptableOrUnknown(data['reference']!, _referenceMeta),
      );
    }
    if (data.containsKey('actor')) {
      context.handle(
        _actorMeta,
        actor.isAcceptableOrUnknown(data['actor']!, _actorMeta),
      );
    } else if (isInserting) {
      context.missing(_actorMeta);
    }
    if (data.containsKey('timestamp')) {
      context.handle(
        _timestampMeta,
        timestamp.isAcceptableOrUnknown(data['timestamp']!, _timestampMeta),
      );
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StockMovementsLocalData map(
    Map<String, dynamic> data, {
    String? tablePrefix,
  }) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StockMovementsLocalData(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      productId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}product_id'],
      )!,
      quantity: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}quantity'],
      )!,
      movementType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}movement_type'],
      )!,
      reference: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}reference'],
      ),
      actor: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}actor'],
      )!,
      timestamp: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}timestamp'],
      ),
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}cached_at'],
      ),
    );
  }

  @override
  $StockMovementsLocalTable createAlias(String alias) {
    return $StockMovementsLocalTable(attachedDatabase, alias);
  }
}

class StockMovementsLocalData extends DataClass
    implements Insertable<StockMovementsLocalData> {
  /// Server-generated UUID (stock_movements.id)
  final String id;

  /// Tenant isolation
  final String businessId;

  /// Branch scope
  final String branchId;

  /// Product identifier
  final String productId;

  /// Signed quantity delta (positive for STOCK_IN/ADJUSTMENT, negative for STOCK_OUT)
  final int quantity;

  /// Movement type: STOCK_IN | STOCK_OUT | ADJUSTMENT
  final String movementType;

  /// Optional reference (e.g., adjustment reason, purchase order number)
  final String? reference;

  /// Actor user identifier (server-side user who performed the action)
  final String actor;

  /// Event timestamp (epoch ms)
  final int? timestamp;

  /// Local sync metadata (epoch ms)
  final int? cachedAt;
  const StockMovementsLocalData({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.quantity,
    required this.movementType,
    this.reference,
    required this.actor,
    this.timestamp,
    this.cachedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['product_id'] = Variable<String>(productId);
    map['quantity'] = Variable<int>(quantity);
    map['movement_type'] = Variable<String>(movementType);
    if (!nullToAbsent || reference != null) {
      map['reference'] = Variable<String>(reference);
    }
    map['actor'] = Variable<String>(actor);
    if (!nullToAbsent || timestamp != null) {
      map['timestamp'] = Variable<int>(timestamp);
    }
    if (!nullToAbsent || cachedAt != null) {
      map['cached_at'] = Variable<int>(cachedAt);
    }
    return map;
  }

  StockMovementsLocalCompanion toCompanion(bool nullToAbsent) {
    return StockMovementsLocalCompanion(
      id: Value(id),
      businessId: Value(businessId),
      branchId: Value(branchId),
      productId: Value(productId),
      quantity: Value(quantity),
      movementType: Value(movementType),
      reference: reference == null && nullToAbsent
          ? const Value.absent()
          : Value(reference),
      actor: Value(actor),
      timestamp: timestamp == null && nullToAbsent
          ? const Value.absent()
          : Value(timestamp),
      cachedAt: cachedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(cachedAt),
    );
  }

  factory StockMovementsLocalData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StockMovementsLocalData(
      id: serializer.fromJson<String>(json['id']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      productId: serializer.fromJson<String>(json['productId']),
      quantity: serializer.fromJson<int>(json['quantity']),
      movementType: serializer.fromJson<String>(json['movementType']),
      reference: serializer.fromJson<String?>(json['reference']),
      actor: serializer.fromJson<String>(json['actor']),
      timestamp: serializer.fromJson<int?>(json['timestamp']),
      cachedAt: serializer.fromJson<int?>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'productId': serializer.toJson<String>(productId),
      'quantity': serializer.toJson<int>(quantity),
      'movementType': serializer.toJson<String>(movementType),
      'reference': serializer.toJson<String?>(reference),
      'actor': serializer.toJson<String>(actor),
      'timestamp': serializer.toJson<int?>(timestamp),
      'cachedAt': serializer.toJson<int?>(cachedAt),
    };
  }

  StockMovementsLocalData copyWith({
    String? id,
    String? businessId,
    String? branchId,
    String? productId,
    int? quantity,
    String? movementType,
    Value<String?> reference = const Value.absent(),
    String? actor,
    Value<int?> timestamp = const Value.absent(),
    Value<int?> cachedAt = const Value.absent(),
  }) => StockMovementsLocalData(
    id: id ?? this.id,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    productId: productId ?? this.productId,
    quantity: quantity ?? this.quantity,
    movementType: movementType ?? this.movementType,
    reference: reference.present ? reference.value : this.reference,
    actor: actor ?? this.actor,
    timestamp: timestamp.present ? timestamp.value : this.timestamp,
    cachedAt: cachedAt.present ? cachedAt.value : this.cachedAt,
  );
  StockMovementsLocalData copyWithCompanion(StockMovementsLocalCompanion data) {
    return StockMovementsLocalData(
      id: data.id.present ? data.id.value : this.id,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      productId: data.productId.present ? data.productId.value : this.productId,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      movementType: data.movementType.present
          ? data.movementType.value
          : this.movementType,
      reference: data.reference.present ? data.reference.value : this.reference,
      actor: data.actor.present ? data.actor.value : this.actor,
      timestamp: data.timestamp.present ? data.timestamp.value : this.timestamp,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StockMovementsLocalData(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('movementType: $movementType, ')
          ..write('reference: $reference, ')
          ..write('actor: $actor, ')
          ..write('timestamp: $timestamp, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    businessId,
    branchId,
    productId,
    quantity,
    movementType,
    reference,
    actor,
    timestamp,
    cachedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StockMovementsLocalData &&
          other.id == this.id &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.productId == this.productId &&
          other.quantity == this.quantity &&
          other.movementType == this.movementType &&
          other.reference == this.reference &&
          other.actor == this.actor &&
          other.timestamp == this.timestamp &&
          other.cachedAt == this.cachedAt);
}

class StockMovementsLocalCompanion
    extends UpdateCompanion<StockMovementsLocalData> {
  final Value<String> id;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> productId;
  final Value<int> quantity;
  final Value<String> movementType;
  final Value<String?> reference;
  final Value<String> actor;
  final Value<int?> timestamp;
  final Value<int?> cachedAt;
  final Value<int> rowid;
  const StockMovementsLocalCompanion({
    this.id = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.productId = const Value.absent(),
    this.quantity = const Value.absent(),
    this.movementType = const Value.absent(),
    this.reference = const Value.absent(),
    this.actor = const Value.absent(),
    this.timestamp = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  StockMovementsLocalCompanion.insert({
    required String id,
    required String businessId,
    required String branchId,
    required String productId,
    required int quantity,
    required String movementType,
    this.reference = const Value.absent(),
    required String actor,
    this.timestamp = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       businessId = Value(businessId),
       branchId = Value(branchId),
       productId = Value(productId),
       quantity = Value(quantity),
       movementType = Value(movementType),
       actor = Value(actor);
  static Insertable<StockMovementsLocalData> custom({
    Expression<String>? id,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? productId,
    Expression<int>? quantity,
    Expression<String>? movementType,
    Expression<String>? reference,
    Expression<String>? actor,
    Expression<int>? timestamp,
    Expression<int>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (productId != null) 'product_id': productId,
      if (quantity != null) 'quantity': quantity,
      if (movementType != null) 'movement_type': movementType,
      if (reference != null) 'reference': reference,
      if (actor != null) 'actor': actor,
      if (timestamp != null) 'timestamp': timestamp,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  StockMovementsLocalCompanion copyWith({
    Value<String>? id,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? productId,
    Value<int>? quantity,
    Value<String>? movementType,
    Value<String?>? reference,
    Value<String>? actor,
    Value<int?>? timestamp,
    Value<int?>? cachedAt,
    Value<int>? rowid,
  }) {
    return StockMovementsLocalCompanion(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      productId: productId ?? this.productId,
      quantity: quantity ?? this.quantity,
      movementType: movementType ?? this.movementType,
      reference: reference ?? this.reference,
      actor: actor ?? this.actor,
      timestamp: timestamp ?? this.timestamp,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (productId.present) {
      map['product_id'] = Variable<String>(productId.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<int>(quantity.value);
    }
    if (movementType.present) {
      map['movement_type'] = Variable<String>(movementType.value);
    }
    if (reference.present) {
      map['reference'] = Variable<String>(reference.value);
    }
    if (actor.present) {
      map['actor'] = Variable<String>(actor.value);
    }
    if (timestamp.present) {
      map['timestamp'] = Variable<int>(timestamp.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<int>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StockMovementsLocalCompanion(')
          ..write('id: $id, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('productId: $productId, ')
          ..write('quantity: $quantity, ')
          ..write('movementType: $movementType, ')
          ..write('reference: $reference, ')
          ..write('actor: $actor, ')
          ..write('timestamp: $timestamp, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $ProductsLocalTable productsLocal = $ProductsLocalTable(this);
  late final $BusinessSettingsLocalTable businessSettingsLocal =
      $BusinessSettingsLocalTable(this);
  late final $BranchesLocalTable branchesLocal = $BranchesLocalTable(this);
  late final $ActiveBranchLocalTable activeBranchLocal =
      $ActiveBranchLocalTable(this);
  late final $CartLocalTable cartLocal = $CartLocalTable(this);
  late final $CartItemsLocalTable cartItemsLocal = $CartItemsLocalTable(this);
  late final $CustomersLocalTable customersLocal = $CustomersLocalTable(this);
  late final $SalesLocalTable salesLocal = $SalesLocalTable(this);
  late final $SaleItemsLocalTable saleItemsLocal = $SaleItemsLocalTable(this);
  late final $SuppliersLocalTable suppliersLocal = $SuppliersLocalTable(this);
  late final $PurchasesLocalTable purchasesLocal = $PurchasesLocalTable(this);
  late final $PurchaseItemsLocalTable purchaseItemsLocal =
      $PurchaseItemsLocalTable(this);
  late final $PaymentsLocalTable paymentsLocal = $PaymentsLocalTable(this);
  late final $ReceiptSequencesLocalTable receiptSequencesLocal =
      $ReceiptSequencesLocalTable(this);
  late final $LocalIdempotencyKeysTable localIdempotencyKeys =
      $LocalIdempotencyKeysTable(this);
  late final $SyncOutboxTable syncOutbox = $SyncOutboxTable(this);
  late final $SyncMetaTable syncMeta = $SyncMetaTable(this);
  late final $StocksLocalTable stocksLocal = $StocksLocalTable(this);
  late final $StockMovementsLocalTable stockMovementsLocal =
      $StockMovementsLocalTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    productsLocal,
    businessSettingsLocal,
    branchesLocal,
    activeBranchLocal,
    cartLocal,
    cartItemsLocal,
    customersLocal,
    salesLocal,
    saleItemsLocal,
    suppliersLocal,
    purchasesLocal,
    purchaseItemsLocal,
    paymentsLocal,
    receiptSequencesLocal,
    localIdempotencyKeys,
    syncOutbox,
    syncMeta,
    stocksLocal,
    stockMovementsLocal,
  ];
}

typedef $$ProductsLocalTableCreateCompanionBuilder =
    ProductsLocalCompanion Function({
      required String id,
      required String businessId,
      required String name,
      Value<String?> description,
      Value<String?> barcode,
      Value<String> localStatus,
      required int priceMinor,
      Value<int?> costMinor,
      Value<String?> category,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });
typedef $$ProductsLocalTableUpdateCompanionBuilder =
    ProductsLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> name,
      Value<String?> description,
      Value<String?> barcode,
      Value<String> localStatus,
      Value<int> priceMinor,
      Value<int?> costMinor,
      Value<String?> category,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });

final class $$ProductsLocalTableReferences
    extends
        BaseReferences<_$AppDatabase, $ProductsLocalTable, ProductsLocalData> {
  $$ProductsLocalTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static MultiTypedResultKey<$CartItemsLocalTable, List<CartItemsLocalData>>
  _cartItemsLocalRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.cartItemsLocal,
    aliasName: 'products_local__id__cart_items_local__product_id',
  );

  $$CartItemsLocalTableProcessedTableManager get cartItemsLocalRefs {
    final manager = $$CartItemsLocalTableTableManager(
      $_db,
      $_db.cartItemsLocal,
    ).filter((f) => f.productId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_cartItemsLocalRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$ProductsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $ProductsLocalTable> {
  $$ProductsLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get costMinor => $composableBuilder(
    column: $table.costMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> cartItemsLocalRefs(
    Expression<bool> Function($$CartItemsLocalTableFilterComposer f) f,
  ) {
    final $$CartItemsLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.cartItemsLocal,
      getReferencedColumn: (t) => t.productId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartItemsLocalTableFilterComposer(
            $db: $db,
            $table: $db.cartItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ProductsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $ProductsLocalTable> {
  $$ProductsLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get costMinor => $composableBuilder(
    column: $table.costMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ProductsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $ProductsLocalTable> {
  $$ProductsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get costMinor =>
      $composableBuilder(column: $table.costMinor, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<int> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => column,
  );

  Expression<T> cartItemsLocalRefs<T extends Object>(
    Expression<T> Function($$CartItemsLocalTableAnnotationComposer a) f,
  ) {
    final $$CartItemsLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.cartItemsLocal,
      getReferencedColumn: (t) => t.productId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartItemsLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.cartItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ProductsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ProductsLocalTable,
          ProductsLocalData,
          $$ProductsLocalTableFilterComposer,
          $$ProductsLocalTableOrderingComposer,
          $$ProductsLocalTableAnnotationComposer,
          $$ProductsLocalTableCreateCompanionBuilder,
          $$ProductsLocalTableUpdateCompanionBuilder,
          (ProductsLocalData, $$ProductsLocalTableReferences),
          ProductsLocalData,
          PrefetchHooks Function({bool cartItemsLocalRefs})
        > {
  $$ProductsLocalTableTableManager(_$AppDatabase db, $ProductsLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ProductsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ProductsLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ProductsLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> description = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> priceMinor = const Value.absent(),
                Value<int?> costMinor = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ProductsLocalCompanion(
                id: id,
                businessId: businessId,
                name: name,
                description: description,
                barcode: barcode,
                localStatus: localStatus,
                priceMinor: priceMinor,
                costMinor: costMinor,
                category: category,
                isActive: isActive,
                serverVersion: serverVersion,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String name,
                Value<String?> description = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                required int priceMinor,
                Value<int?> costMinor = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ProductsLocalCompanion.insert(
                id: id,
                businessId: businessId,
                name: name,
                description: description,
                barcode: barcode,
                localStatus: localStatus,
                priceMinor: priceMinor,
                costMinor: costMinor,
                category: category,
                isActive: isActive,
                serverVersion: serverVersion,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$ProductsLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({cartItemsLocalRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (cartItemsLocalRefs) db.cartItemsLocal,
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (cartItemsLocalRefs)
                    await $_getPrefetchedData<
                      ProductsLocalData,
                      $ProductsLocalTable,
                      CartItemsLocalData
                    >(
                      currentTable: table,
                      referencedTable: $$ProductsLocalTableReferences
                          ._cartItemsLocalRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$ProductsLocalTableReferences(
                            db,
                            table,
                            p0,
                          ).cartItemsLocalRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.productId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$ProductsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ProductsLocalTable,
      ProductsLocalData,
      $$ProductsLocalTableFilterComposer,
      $$ProductsLocalTableOrderingComposer,
      $$ProductsLocalTableAnnotationComposer,
      $$ProductsLocalTableCreateCompanionBuilder,
      $$ProductsLocalTableUpdateCompanionBuilder,
      (ProductsLocalData, $$ProductsLocalTableReferences),
      ProductsLocalData,
      PrefetchHooks Function({bool cartItemsLocalRefs})
    >;
typedef $$BusinessSettingsLocalTableCreateCompanionBuilder =
    BusinessSettingsLocalCompanion Function({
      required String id,
      required String businessId,
      Value<String> branchId,
      Value<int> taxRateBps,
      Value<String> currencyCode,
      Value<int> currencyMinorUnits,
      Value<String> timezone,
      required int updatedAt,
      Value<String> settingsJson,
      Value<int> rowid,
    });
typedef $$BusinessSettingsLocalTableUpdateCompanionBuilder =
    BusinessSettingsLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> branchId,
      Value<int> taxRateBps,
      Value<String> currencyCode,
      Value<int> currencyMinorUnits,
      Value<String> timezone,
      Value<int> updatedAt,
      Value<String> settingsJson,
      Value<int> rowid,
    });

class $$BusinessSettingsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $BusinessSettingsLocalTable> {
  $$BusinessSettingsLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get taxRateBps => $composableBuilder(
    column: $table.taxRateBps,
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

  ColumnFilters<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$BusinessSettingsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $BusinessSettingsLocalTable> {
  $$BusinessSettingsLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get taxRateBps => $composableBuilder(
    column: $table.taxRateBps,
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

  ColumnOrderings<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$BusinessSettingsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $BusinessSettingsLocalTable> {
  $$BusinessSettingsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<int> get taxRateBps => $composableBuilder(
    column: $table.taxRateBps,
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

  GeneratedColumn<String> get timezone =>
      $composableBuilder(column: $table.timezone, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get settingsJson => $composableBuilder(
    column: $table.settingsJson,
    builder: (column) => column,
  );
}

class $$BusinessSettingsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $BusinessSettingsLocalTable,
          BusinessSettingsLocalData,
          $$BusinessSettingsLocalTableFilterComposer,
          $$BusinessSettingsLocalTableOrderingComposer,
          $$BusinessSettingsLocalTableAnnotationComposer,
          $$BusinessSettingsLocalTableCreateCompanionBuilder,
          $$BusinessSettingsLocalTableUpdateCompanionBuilder,
          (
            BusinessSettingsLocalData,
            BaseReferences<
              _$AppDatabase,
              $BusinessSettingsLocalTable,
              BusinessSettingsLocalData
            >,
          ),
          BusinessSettingsLocalData,
          PrefetchHooks Function()
        > {
  $$BusinessSettingsLocalTableTableManager(
    _$AppDatabase db,
    $BusinessSettingsLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BusinessSettingsLocalTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$BusinessSettingsLocalTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$BusinessSettingsLocalTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<int> taxRateBps = const Value.absent(),
                Value<String> currencyCode = const Value.absent(),
                Value<int> currencyMinorUnits = const Value.absent(),
                Value<String> timezone = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<String> settingsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BusinessSettingsLocalCompanion(
                id: id,
                businessId: businessId,
                branchId: branchId,
                taxRateBps: taxRateBps,
                currencyCode: currencyCode,
                currencyMinorUnits: currencyMinorUnits,
                timezone: timezone,
                updatedAt: updatedAt,
                settingsJson: settingsJson,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                Value<String> branchId = const Value.absent(),
                Value<int> taxRateBps = const Value.absent(),
                Value<String> currencyCode = const Value.absent(),
                Value<int> currencyMinorUnits = const Value.absent(),
                Value<String> timezone = const Value.absent(),
                required int updatedAt,
                Value<String> settingsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BusinessSettingsLocalCompanion.insert(
                id: id,
                businessId: businessId,
                branchId: branchId,
                taxRateBps: taxRateBps,
                currencyCode: currencyCode,
                currencyMinorUnits: currencyMinorUnits,
                timezone: timezone,
                updatedAt: updatedAt,
                settingsJson: settingsJson,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$BusinessSettingsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $BusinessSettingsLocalTable,
      BusinessSettingsLocalData,
      $$BusinessSettingsLocalTableFilterComposer,
      $$BusinessSettingsLocalTableOrderingComposer,
      $$BusinessSettingsLocalTableAnnotationComposer,
      $$BusinessSettingsLocalTableCreateCompanionBuilder,
      $$BusinessSettingsLocalTableUpdateCompanionBuilder,
      (
        BusinessSettingsLocalData,
        BaseReferences<
          _$AppDatabase,
          $BusinessSettingsLocalTable,
          BusinessSettingsLocalData
        >,
      ),
      BusinessSettingsLocalData,
      PrefetchHooks Function()
    >;
typedef $$BranchesLocalTableCreateCompanionBuilder =
    BranchesLocalCompanion Function({
      required String id,
      required String businessId,
      required String name,
      required bool status,
      required String createdAt,
      required String updatedAt,
      required int cachedAt,
      Value<int> rowid,
    });
typedef $$BranchesLocalTableUpdateCompanionBuilder =
    BranchesLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> name,
      Value<bool> status,
      Value<String> createdAt,
      Value<String> updatedAt,
      Value<int> cachedAt,
      Value<int> rowid,
    });

class $$BranchesLocalTableFilterComposer
    extends Composer<_$AppDatabase, $BranchesLocalTable> {
  $$BranchesLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$BranchesLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $BranchesLocalTable> {
  $$BranchesLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$BranchesLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $BranchesLocalTable> {
  $$BranchesLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<bool> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$BranchesLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $BranchesLocalTable,
          BranchesLocalData,
          $$BranchesLocalTableFilterComposer,
          $$BranchesLocalTableOrderingComposer,
          $$BranchesLocalTableAnnotationComposer,
          $$BranchesLocalTableCreateCompanionBuilder,
          $$BranchesLocalTableUpdateCompanionBuilder,
          (
            BranchesLocalData,
            BaseReferences<
              _$AppDatabase,
              $BranchesLocalTable,
              BranchesLocalData
            >,
          ),
          BranchesLocalData,
          PrefetchHooks Function()
        > {
  $$BranchesLocalTableTableManager(_$AppDatabase db, $BranchesLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BranchesLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$BranchesLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$BranchesLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<bool> status = const Value.absent(),
                Value<String> createdAt = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<int> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BranchesLocalCompanion(
                id: id,
                businessId: businessId,
                name: name,
                status: status,
                createdAt: createdAt,
                updatedAt: updatedAt,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String name,
                required bool status,
                required String createdAt,
                required String updatedAt,
                required int cachedAt,
                Value<int> rowid = const Value.absent(),
              }) => BranchesLocalCompanion.insert(
                id: id,
                businessId: businessId,
                name: name,
                status: status,
                createdAt: createdAt,
                updatedAt: updatedAt,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$BranchesLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $BranchesLocalTable,
      BranchesLocalData,
      $$BranchesLocalTableFilterComposer,
      $$BranchesLocalTableOrderingComposer,
      $$BranchesLocalTableAnnotationComposer,
      $$BranchesLocalTableCreateCompanionBuilder,
      $$BranchesLocalTableUpdateCompanionBuilder,
      (
        BranchesLocalData,
        BaseReferences<_$AppDatabase, $BranchesLocalTable, BranchesLocalData>,
      ),
      BranchesLocalData,
      PrefetchHooks Function()
    >;
typedef $$ActiveBranchLocalTableCreateCompanionBuilder =
    ActiveBranchLocalCompanion Function({
      required String businessId,
      required String branchId,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$ActiveBranchLocalTableUpdateCompanionBuilder =
    ActiveBranchLocalCompanion Function({
      Value<String> businessId,
      Value<String> branchId,
      Value<int> updatedAt,
      Value<int> rowid,
    });

class $$ActiveBranchLocalTableFilterComposer
    extends Composer<_$AppDatabase, $ActiveBranchLocalTable> {
  $$ActiveBranchLocalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ActiveBranchLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $ActiveBranchLocalTable> {
  $$ActiveBranchLocalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ActiveBranchLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $ActiveBranchLocalTable> {
  $$ActiveBranchLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ActiveBranchLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ActiveBranchLocalTable,
          ActiveBranchLocalData,
          $$ActiveBranchLocalTableFilterComposer,
          $$ActiveBranchLocalTableOrderingComposer,
          $$ActiveBranchLocalTableAnnotationComposer,
          $$ActiveBranchLocalTableCreateCompanionBuilder,
          $$ActiveBranchLocalTableUpdateCompanionBuilder,
          (
            ActiveBranchLocalData,
            BaseReferences<
              _$AppDatabase,
              $ActiveBranchLocalTable,
              ActiveBranchLocalData
            >,
          ),
          ActiveBranchLocalData,
          PrefetchHooks Function()
        > {
  $$ActiveBranchLocalTableTableManager(
    _$AppDatabase db,
    $ActiveBranchLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ActiveBranchLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ActiveBranchLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ActiveBranchLocalTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ActiveBranchLocalCompanion(
                businessId: businessId,
                branchId: branchId,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String businessId,
                required String branchId,
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => ActiveBranchLocalCompanion.insert(
                businessId: businessId,
                branchId: branchId,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ActiveBranchLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ActiveBranchLocalTable,
      ActiveBranchLocalData,
      $$ActiveBranchLocalTableFilterComposer,
      $$ActiveBranchLocalTableOrderingComposer,
      $$ActiveBranchLocalTableAnnotationComposer,
      $$ActiveBranchLocalTableCreateCompanionBuilder,
      $$ActiveBranchLocalTableUpdateCompanionBuilder,
      (
        ActiveBranchLocalData,
        BaseReferences<
          _$AppDatabase,
          $ActiveBranchLocalTable,
          ActiveBranchLocalData
        >,
      ),
      ActiveBranchLocalData,
      PrefetchHooks Function()
    >;
typedef $$CartLocalTableCreateCompanionBuilder =
    CartLocalCompanion Function({
      required String id,
      required String businessId,
      required String status,
      required int createdAt,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$CartLocalTableUpdateCompanionBuilder =
    CartLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> status,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int> rowid,
    });

final class $$CartLocalTableReferences
    extends BaseReferences<_$AppDatabase, $CartLocalTable, CartLocalData> {
  $$CartLocalTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$CartItemsLocalTable, List<CartItemsLocalData>>
  _cartItemsLocalRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.cartItemsLocal,
    aliasName: 'cart_local__id__cart_items_local__cart_id',
  );

  $$CartItemsLocalTableProcessedTableManager get cartItemsLocalRefs {
    final manager = $$CartItemsLocalTableTableManager(
      $_db,
      $_db.cartItemsLocal,
    ).filter((f) => f.cartId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_cartItemsLocalRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$CartLocalTableFilterComposer
    extends Composer<_$AppDatabase, $CartLocalTable> {
  $$CartLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
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

  Expression<bool> cartItemsLocalRefs(
    Expression<bool> Function($$CartItemsLocalTableFilterComposer f) f,
  ) {
    final $$CartItemsLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.cartItemsLocal,
      getReferencedColumn: (t) => t.cartId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartItemsLocalTableFilterComposer(
            $db: $db,
            $table: $db.cartItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$CartLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $CartLocalTable> {
  $$CartLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
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
}

class $$CartLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $CartLocalTable> {
  $$CartLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  Expression<T> cartItemsLocalRefs<T extends Object>(
    Expression<T> Function($$CartItemsLocalTableAnnotationComposer a) f,
  ) {
    final $$CartItemsLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.cartItemsLocal,
      getReferencedColumn: (t) => t.cartId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartItemsLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.cartItemsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$CartLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CartLocalTable,
          CartLocalData,
          $$CartLocalTableFilterComposer,
          $$CartLocalTableOrderingComposer,
          $$CartLocalTableAnnotationComposer,
          $$CartLocalTableCreateCompanionBuilder,
          $$CartLocalTableUpdateCompanionBuilder,
          (CartLocalData, $$CartLocalTableReferences),
          CartLocalData,
          PrefetchHooks Function({bool cartItemsLocalRefs})
        > {
  $$CartLocalTableTableManager(_$AppDatabase db, $CartLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CartLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CartLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CartLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CartLocalCompanion(
                id: id,
                businessId: businessId,
                status: status,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String status,
                required int createdAt,
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => CartLocalCompanion.insert(
                id: id,
                businessId: businessId,
                status: status,
                createdAt: createdAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$CartLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({cartItemsLocalRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (cartItemsLocalRefs) db.cartItemsLocal,
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (cartItemsLocalRefs)
                    await $_getPrefetchedData<
                      CartLocalData,
                      $CartLocalTable,
                      CartItemsLocalData
                    >(
                      currentTable: table,
                      referencedTable: $$CartLocalTableReferences
                          ._cartItemsLocalRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$CartLocalTableReferences(
                            db,
                            table,
                            p0,
                          ).cartItemsLocalRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.cartId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$CartLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CartLocalTable,
      CartLocalData,
      $$CartLocalTableFilterComposer,
      $$CartLocalTableOrderingComposer,
      $$CartLocalTableAnnotationComposer,
      $$CartLocalTableCreateCompanionBuilder,
      $$CartLocalTableUpdateCompanionBuilder,
      (CartLocalData, $$CartLocalTableReferences),
      CartLocalData,
      PrefetchHooks Function({bool cartItemsLocalRefs})
    >;
typedef $$CartItemsLocalTableCreateCompanionBuilder =
    CartItemsLocalCompanion Function({
      required String id,
      required String cartId,
      required String productId,
      required int quantity,
      required int unitPriceMinor,
      required int addedAt,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$CartItemsLocalTableUpdateCompanionBuilder =
    CartItemsLocalCompanion Function({
      Value<String> id,
      Value<String> cartId,
      Value<String> productId,
      Value<int> quantity,
      Value<int> unitPriceMinor,
      Value<int> addedAt,
      Value<int> updatedAt,
      Value<int> rowid,
    });

final class $$CartItemsLocalTableReferences
    extends
        BaseReferences<
          _$AppDatabase,
          $CartItemsLocalTable,
          CartItemsLocalData
        > {
  $$CartItemsLocalTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $CartLocalTable _cartIdTable(_$AppDatabase db) =>
      db.cartLocal.createAlias('cart_items_local__cart_id__cart_local__id');

  $$CartLocalTableProcessedTableManager get cartId {
    final $_column = $_itemColumn<String>('cart_id')!;

    final manager = $$CartLocalTableTableManager(
      $_db,
      $_db.cartLocal,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_cartIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static $ProductsLocalTable _productIdTable(_$AppDatabase db) => db
      .productsLocal
      .createAlias('cart_items_local__product_id__products_local__id');

  $$ProductsLocalTableProcessedTableManager get productId {
    final $_column = $_itemColumn<String>('product_id')!;

    final manager = $$ProductsLocalTableTableManager(
      $_db,
      $_db.productsLocal,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_productIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$CartItemsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $CartItemsLocalTable> {
  $$CartItemsLocalTableFilterComposer({
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

  ColumnFilters<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get addedAt => $composableBuilder(
    column: $table.addedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  $$CartLocalTableFilterComposer get cartId {
    final $$CartLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cartId,
      referencedTable: $db.cartLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartLocalTableFilterComposer(
            $db: $db,
            $table: $db.cartLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ProductsLocalTableFilterComposer get productId {
    final $$ProductsLocalTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.productId,
      referencedTable: $db.productsLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ProductsLocalTableFilterComposer(
            $db: $db,
            $table: $db.productsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CartItemsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $CartItemsLocalTable> {
  $$CartItemsLocalTableOrderingComposer({
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

  ColumnOrderings<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get addedAt => $composableBuilder(
    column: $table.addedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  $$CartLocalTableOrderingComposer get cartId {
    final $$CartLocalTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cartId,
      referencedTable: $db.cartLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartLocalTableOrderingComposer(
            $db: $db,
            $table: $db.cartLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ProductsLocalTableOrderingComposer get productId {
    final $$ProductsLocalTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.productId,
      referencedTable: $db.productsLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ProductsLocalTableOrderingComposer(
            $db: $db,
            $table: $db.productsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CartItemsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $CartItemsLocalTable> {
  $$CartItemsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<int> get unitPriceMinor => $composableBuilder(
    column: $table.unitPriceMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get addedAt =>
      $composableBuilder(column: $table.addedAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  $$CartLocalTableAnnotationComposer get cartId {
    final $$CartLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cartId,
      referencedTable: $db.cartLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$CartLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.cartLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  $$ProductsLocalTableAnnotationComposer get productId {
    final $$ProductsLocalTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.productId,
      referencedTable: $db.productsLocal,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ProductsLocalTableAnnotationComposer(
            $db: $db,
            $table: $db.productsLocal,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$CartItemsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CartItemsLocalTable,
          CartItemsLocalData,
          $$CartItemsLocalTableFilterComposer,
          $$CartItemsLocalTableOrderingComposer,
          $$CartItemsLocalTableAnnotationComposer,
          $$CartItemsLocalTableCreateCompanionBuilder,
          $$CartItemsLocalTableUpdateCompanionBuilder,
          (CartItemsLocalData, $$CartItemsLocalTableReferences),
          CartItemsLocalData,
          PrefetchHooks Function({bool cartId, bool productId})
        > {
  $$CartItemsLocalTableTableManager(
    _$AppDatabase db,
    $CartItemsLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CartItemsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CartItemsLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CartItemsLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> cartId = const Value.absent(),
                Value<String> productId = const Value.absent(),
                Value<int> quantity = const Value.absent(),
                Value<int> unitPriceMinor = const Value.absent(),
                Value<int> addedAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CartItemsLocalCompanion(
                id: id,
                cartId: cartId,
                productId: productId,
                quantity: quantity,
                unitPriceMinor: unitPriceMinor,
                addedAt: addedAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String cartId,
                required String productId,
                required int quantity,
                required int unitPriceMinor,
                required int addedAt,
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => CartItemsLocalCompanion.insert(
                id: id,
                cartId: cartId,
                productId: productId,
                quantity: quantity,
                unitPriceMinor: unitPriceMinor,
                addedAt: addedAt,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable(table),
                  $$CartItemsLocalTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({cartId = false, productId = false}) {
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
                    if (cartId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.cartId,
                                referencedTable: $$CartItemsLocalTableReferences
                                    ._cartIdTable(db),
                                referencedColumn:
                                    $$CartItemsLocalTableReferences
                                        ._cartIdTable(db)
                                        .id,
                              )
                              as T;
                    }
                    if (productId) {
                      state =
                          state.withJoin(
                                currentTable: table,
                                currentColumn: table.productId,
                                referencedTable: $$CartItemsLocalTableReferences
                                    ._productIdTable(db),
                                referencedColumn:
                                    $$CartItemsLocalTableReferences
                                        ._productIdTable(db)
                                        .id,
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

typedef $$CartItemsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CartItemsLocalTable,
      CartItemsLocalData,
      $$CartItemsLocalTableFilterComposer,
      $$CartItemsLocalTableOrderingComposer,
      $$CartItemsLocalTableAnnotationComposer,
      $$CartItemsLocalTableCreateCompanionBuilder,
      $$CartItemsLocalTableUpdateCompanionBuilder,
      (CartItemsLocalData, $$CartItemsLocalTableReferences),
      CartItemsLocalData,
      PrefetchHooks Function({bool cartId, bool productId})
    >;
typedef $$CustomersLocalTableCreateCompanionBuilder =
    CustomersLocalCompanion Function({
      required String id,
      required String businessId,
      required String name,
      Value<String?> phone,
      Value<String?> email,
      Value<String> localStatus,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });
typedef $$CustomersLocalTableUpdateCompanionBuilder =
    CustomersLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> name,
      Value<String?> phone,
      Value<String?> email,
      Value<String> localStatus,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });

class $$CustomersLocalTableFilterComposer
    extends Composer<_$AppDatabase, $CustomersLocalTable> {
  $$CustomersLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CustomersLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $CustomersLocalTable> {
  $$CustomersLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CustomersLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $CustomersLocalTable> {
  $$CustomersLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get phone =>
      $composableBuilder(column: $table.phone, builder: (column) => column);

  GeneratedColumn<String> get email =>
      $composableBuilder(column: $table.email, builder: (column) => column);

  GeneratedColumn<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => column,
  );
}

class $$CustomersLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CustomersLocalTable,
          CustomersLocalData,
          $$CustomersLocalTableFilterComposer,
          $$CustomersLocalTableOrderingComposer,
          $$CustomersLocalTableAnnotationComposer,
          $$CustomersLocalTableCreateCompanionBuilder,
          $$CustomersLocalTableUpdateCompanionBuilder,
          (
            CustomersLocalData,
            BaseReferences<
              _$AppDatabase,
              $CustomersLocalTable,
              CustomersLocalData
            >,
          ),
          CustomersLocalData,
          PrefetchHooks Function()
        > {
  $$CustomersLocalTableTableManager(
    _$AppDatabase db,
    $CustomersLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CustomersLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CustomersLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CustomersLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<String?> email = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CustomersLocalCompanion(
                id: id,
                businessId: businessId,
                name: name,
                phone: phone,
                email: email,
                localStatus: localStatus,
                isActive: isActive,
                serverVersion: serverVersion,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String name,
                Value<String?> phone = const Value.absent(),
                Value<String?> email = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CustomersLocalCompanion.insert(
                id: id,
                businessId: businessId,
                name: name,
                phone: phone,
                email: email,
                localStatus: localStatus,
                isActive: isActive,
                serverVersion: serverVersion,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CustomersLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CustomersLocalTable,
      CustomersLocalData,
      $$CustomersLocalTableFilterComposer,
      $$CustomersLocalTableOrderingComposer,
      $$CustomersLocalTableAnnotationComposer,
      $$CustomersLocalTableCreateCompanionBuilder,
      $$CustomersLocalTableUpdateCompanionBuilder,
      (
        CustomersLocalData,
        BaseReferences<_$AppDatabase, $CustomersLocalTable, CustomersLocalData>,
      ),
      CustomersLocalData,
      PrefetchHooks Function()
    >;
typedef $$SalesLocalTableCreateCompanionBuilder =
    SalesLocalCompanion Function({
      required String clientTransactionId,
      required String businessId,
      required String branchId,
      required String cashierId,
      Value<String?> customerId,
      Value<String?> receiptNumber,
      Value<int?> receiptSequence,
      Value<String?> receiptDate,
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
      Value<String?> receiptNumber,
      Value<int?> receiptSequence,
      Value<String?> receiptDate,
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

  ColumnFilters<String> get receiptNumber => $composableBuilder(
    column: $table.receiptNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get receiptSequence => $composableBuilder(
    column: $table.receiptSequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get receiptDate => $composableBuilder(
    column: $table.receiptDate,
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

  ColumnOrderings<String> get receiptNumber => $composableBuilder(
    column: $table.receiptNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get receiptSequence => $composableBuilder(
    column: $table.receiptSequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get receiptDate => $composableBuilder(
    column: $table.receiptDate,
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

  GeneratedColumn<String> get receiptNumber => $composableBuilder(
    column: $table.receiptNumber,
    builder: (column) => column,
  );

  GeneratedColumn<int> get receiptSequence => $composableBuilder(
    column: $table.receiptSequence,
    builder: (column) => column,
  );

  GeneratedColumn<String> get receiptDate => $composableBuilder(
    column: $table.receiptDate,
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
                Value<String?> receiptNumber = const Value.absent(),
                Value<int?> receiptSequence = const Value.absent(),
                Value<String?> receiptDate = const Value.absent(),
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
                receiptNumber: receiptNumber,
                receiptSequence: receiptSequence,
                receiptDate: receiptDate,
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
                Value<String?> receiptNumber = const Value.absent(),
                Value<int?> receiptSequence = const Value.absent(),
                Value<String?> receiptDate = const Value.absent(),
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
                receiptNumber: receiptNumber,
                receiptSequence: receiptSequence,
                receiptDate: receiptDate,
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
typedef $$SuppliersLocalTableCreateCompanionBuilder =
    SuppliersLocalCompanion Function({
      required String id,
      required String businessId,
      Value<String?> code,
      required String name,
      Value<String?> contact,
      Value<String?> phone,
      Value<String?> email,
      Value<String?> category,
      Value<String> term,
      Value<String> localStatus,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int?> deletedAt,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });
typedef $$SuppliersLocalTableUpdateCompanionBuilder =
    SuppliersLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String?> code,
      Value<String> name,
      Value<String?> contact,
      Value<String?> phone,
      Value<String?> email,
      Value<String?> category,
      Value<String> term,
      Value<String> localStatus,
      Value<int> isActive,
      Value<int> serverVersion,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int?> deletedAt,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });

class $$SuppliersLocalTableFilterComposer
    extends Composer<_$AppDatabase, $SuppliersLocalTable> {
  $$SuppliersLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contact => $composableBuilder(
    column: $table.contact,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get term => $composableBuilder(
    column: $table.term,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
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

  ColumnFilters<int> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SuppliersLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $SuppliersLocalTable> {
  $$SuppliersLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contact => $composableBuilder(
    column: $table.contact,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get term => $composableBuilder(
    column: $table.term,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
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

  ColumnOrderings<int> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SuppliersLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $SuppliersLocalTable> {
  $$SuppliersLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get contact =>
      $composableBuilder(column: $table.contact, builder: (column) => column);

  GeneratedColumn<String> get phone =>
      $composableBuilder(column: $table.phone, builder: (column) => column);

  GeneratedColumn<String> get email =>
      $composableBuilder(column: $table.email, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get term =>
      $composableBuilder(column: $table.term, builder: (column) => column);

  GeneratedColumn<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => column,
  );
}

class $$SuppliersLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SuppliersLocalTable,
          SuppliersLocalData,
          $$SuppliersLocalTableFilterComposer,
          $$SuppliersLocalTableOrderingComposer,
          $$SuppliersLocalTableAnnotationComposer,
          $$SuppliersLocalTableCreateCompanionBuilder,
          $$SuppliersLocalTableUpdateCompanionBuilder,
          (
            SuppliersLocalData,
            BaseReferences<
              _$AppDatabase,
              $SuppliersLocalTable,
              SuppliersLocalData
            >,
          ),
          SuppliersLocalData,
          PrefetchHooks Function()
        > {
  $$SuppliersLocalTableTableManager(
    _$AppDatabase db,
    $SuppliersLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SuppliersLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SuppliersLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SuppliersLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String?> code = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> contact = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<String?> email = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String> term = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int?> deletedAt = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SuppliersLocalCompanion(
                id: id,
                businessId: businessId,
                code: code,
                name: name,
                contact: contact,
                phone: phone,
                email: email,
                category: category,
                term: term,
                localStatus: localStatus,
                isActive: isActive,
                serverVersion: serverVersion,
                createdAt: createdAt,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                Value<String?> code = const Value.absent(),
                required String name,
                Value<String?> contact = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<String?> email = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String> term = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> isActive = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int?> deletedAt = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SuppliersLocalCompanion.insert(
                id: id,
                businessId: businessId,
                code: code,
                name: name,
                contact: contact,
                phone: phone,
                email: email,
                category: category,
                term: term,
                localStatus: localStatus,
                isActive: isActive,
                serverVersion: serverVersion,
                createdAt: createdAt,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SuppliersLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SuppliersLocalTable,
      SuppliersLocalData,
      $$SuppliersLocalTableFilterComposer,
      $$SuppliersLocalTableOrderingComposer,
      $$SuppliersLocalTableAnnotationComposer,
      $$SuppliersLocalTableCreateCompanionBuilder,
      $$SuppliersLocalTableUpdateCompanionBuilder,
      (
        SuppliersLocalData,
        BaseReferences<_$AppDatabase, $SuppliersLocalTable, SuppliersLocalData>,
      ),
      SuppliersLocalData,
      PrefetchHooks Function()
    >;
typedef $$PurchasesLocalTableCreateCompanionBuilder =
    PurchasesLocalCompanion Function({
      required String id,
      required String businessId,
      required String branchId,
      required String supplierId,
      Value<String?> supplierName,
      Value<String?> supplierCode,
      required String code,
      required String date,
      required String dueDate,
      Value<String> supplierTerm,
      Value<String> status,
      Value<int> totalMinor,
      Value<int> receivedMinor,
      Value<int> paidMinor,
      Value<int> outstandingMinor,
      Value<String?> note,
      Value<int> serverVersion,
      Value<String> localStatus,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int?> deletedAt,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });
typedef $$PurchasesLocalTableUpdateCompanionBuilder =
    PurchasesLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> supplierId,
      Value<String?> supplierName,
      Value<String?> supplierCode,
      Value<String> code,
      Value<String> date,
      Value<String> dueDate,
      Value<String> supplierTerm,
      Value<String> status,
      Value<int> totalMinor,
      Value<int> receivedMinor,
      Value<int> paidMinor,
      Value<int> outstandingMinor,
      Value<String?> note,
      Value<int> serverVersion,
      Value<String> localStatus,
      Value<int> createdAt,
      Value<int> updatedAt,
      Value<int?> deletedAt,
      Value<int?> lastSyncedAt,
      Value<int> rowid,
    });

class $$PurchasesLocalTableFilterComposer
    extends Composer<_$AppDatabase, $PurchasesLocalTable> {
  $$PurchasesLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get supplierId => $composableBuilder(
    column: $table.supplierId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get supplierName => $composableBuilder(
    column: $table.supplierName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get supplierCode => $composableBuilder(
    column: $table.supplierCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dueDate => $composableBuilder(
    column: $table.dueDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get supplierTerm => $composableBuilder(
    column: $table.supplierTerm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get receivedMinor => $composableBuilder(
    column: $table.receivedMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get paidMinor => $composableBuilder(
    column: $table.paidMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get outstandingMinor => $composableBuilder(
    column: $table.outstandingMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
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

  ColumnFilters<int> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PurchasesLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $PurchasesLocalTable> {
  $$PurchasesLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get supplierId => $composableBuilder(
    column: $table.supplierId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get supplierName => $composableBuilder(
    column: $table.supplierName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get supplierCode => $composableBuilder(
    column: $table.supplierCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dueDate => $composableBuilder(
    column: $table.dueDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get supplierTerm => $composableBuilder(
    column: $table.supplierTerm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get receivedMinor => $composableBuilder(
    column: $table.receivedMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get paidMinor => $composableBuilder(
    column: $table.paidMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get outstandingMinor => $composableBuilder(
    column: $table.outstandingMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get note => $composableBuilder(
    column: $table.note,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
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

  ColumnOrderings<int> get deletedAt => $composableBuilder(
    column: $table.deletedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PurchasesLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $PurchasesLocalTable> {
  $$PurchasesLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get supplierId => $composableBuilder(
    column: $table.supplierId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get supplierName => $composableBuilder(
    column: $table.supplierName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get supplierCode => $composableBuilder(
    column: $table.supplierCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get dueDate =>
      $composableBuilder(column: $table.dueDate, builder: (column) => column);

  GeneratedColumn<String> get supplierTerm => $composableBuilder(
    column: $table.supplierTerm,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get totalMinor => $composableBuilder(
    column: $table.totalMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get receivedMinor => $composableBuilder(
    column: $table.receivedMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get paidMinor =>
      $composableBuilder(column: $table.paidMinor, builder: (column) => column);

  GeneratedColumn<int> get outstandingMinor => $composableBuilder(
    column: $table.outstandingMinor,
    builder: (column) => column,
  );

  GeneratedColumn<String> get note =>
      $composableBuilder(column: $table.note, builder: (column) => column);

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<String> get localStatus => $composableBuilder(
    column: $table.localStatus,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get deletedAt =>
      $composableBuilder(column: $table.deletedAt, builder: (column) => column);

  GeneratedColumn<int> get lastSyncedAt => $composableBuilder(
    column: $table.lastSyncedAt,
    builder: (column) => column,
  );
}

class $$PurchasesLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PurchasesLocalTable,
          PurchasesLocalData,
          $$PurchasesLocalTableFilterComposer,
          $$PurchasesLocalTableOrderingComposer,
          $$PurchasesLocalTableAnnotationComposer,
          $$PurchasesLocalTableCreateCompanionBuilder,
          $$PurchasesLocalTableUpdateCompanionBuilder,
          (
            PurchasesLocalData,
            BaseReferences<
              _$AppDatabase,
              $PurchasesLocalTable,
              PurchasesLocalData
            >,
          ),
          PurchasesLocalData,
          PrefetchHooks Function()
        > {
  $$PurchasesLocalTableTableManager(
    _$AppDatabase db,
    $PurchasesLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PurchasesLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PurchasesLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PurchasesLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> supplierId = const Value.absent(),
                Value<String?> supplierName = const Value.absent(),
                Value<String?> supplierCode = const Value.absent(),
                Value<String> code = const Value.absent(),
                Value<String> date = const Value.absent(),
                Value<String> dueDate = const Value.absent(),
                Value<String> supplierTerm = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> totalMinor = const Value.absent(),
                Value<int> receivedMinor = const Value.absent(),
                Value<int> paidMinor = const Value.absent(),
                Value<int> outstandingMinor = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int?> deletedAt = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PurchasesLocalCompanion(
                id: id,
                businessId: businessId,
                branchId: branchId,
                supplierId: supplierId,
                supplierName: supplierName,
                supplierCode: supplierCode,
                code: code,
                date: date,
                dueDate: dueDate,
                supplierTerm: supplierTerm,
                status: status,
                totalMinor: totalMinor,
                receivedMinor: receivedMinor,
                paidMinor: paidMinor,
                outstandingMinor: outstandingMinor,
                note: note,
                serverVersion: serverVersion,
                localStatus: localStatus,
                createdAt: createdAt,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String branchId,
                required String supplierId,
                Value<String?> supplierName = const Value.absent(),
                Value<String?> supplierCode = const Value.absent(),
                required String code,
                required String date,
                required String dueDate,
                Value<String> supplierTerm = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> totalMinor = const Value.absent(),
                Value<int> receivedMinor = const Value.absent(),
                Value<int> paidMinor = const Value.absent(),
                Value<int> outstandingMinor = const Value.absent(),
                Value<String?> note = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<String> localStatus = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int?> deletedAt = const Value.absent(),
                Value<int?> lastSyncedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PurchasesLocalCompanion.insert(
                id: id,
                businessId: businessId,
                branchId: branchId,
                supplierId: supplierId,
                supplierName: supplierName,
                supplierCode: supplierCode,
                code: code,
                date: date,
                dueDate: dueDate,
                supplierTerm: supplierTerm,
                status: status,
                totalMinor: totalMinor,
                receivedMinor: receivedMinor,
                paidMinor: paidMinor,
                outstandingMinor: outstandingMinor,
                note: note,
                serverVersion: serverVersion,
                localStatus: localStatus,
                createdAt: createdAt,
                updatedAt: updatedAt,
                deletedAt: deletedAt,
                lastSyncedAt: lastSyncedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PurchasesLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PurchasesLocalTable,
      PurchasesLocalData,
      $$PurchasesLocalTableFilterComposer,
      $$PurchasesLocalTableOrderingComposer,
      $$PurchasesLocalTableAnnotationComposer,
      $$PurchasesLocalTableCreateCompanionBuilder,
      $$PurchasesLocalTableUpdateCompanionBuilder,
      (
        PurchasesLocalData,
        BaseReferences<_$AppDatabase, $PurchasesLocalTable, PurchasesLocalData>,
      ),
      PurchasesLocalData,
      PrefetchHooks Function()
    >;
typedef $$PurchaseItemsLocalTableCreateCompanionBuilder =
    PurchaseItemsLocalCompanion Function({
      required String id,
      required String purchaseId,
      Value<String?> productId,
      required String productName,
      required int orderedQty,
      Value<int> receivedQty,
      required int unitCostMinor,
      required int subtotalMinor,
      Value<int> rowid,
    });
typedef $$PurchaseItemsLocalTableUpdateCompanionBuilder =
    PurchaseItemsLocalCompanion Function({
      Value<String> id,
      Value<String> purchaseId,
      Value<String?> productId,
      Value<String> productName,
      Value<int> orderedQty,
      Value<int> receivedQty,
      Value<int> unitCostMinor,
      Value<int> subtotalMinor,
      Value<int> rowid,
    });

class $$PurchaseItemsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $PurchaseItemsLocalTable> {
  $$PurchaseItemsLocalTableFilterComposer({
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

  ColumnFilters<String> get purchaseId => $composableBuilder(
    column: $table.purchaseId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get orderedQty => $composableBuilder(
    column: $table.orderedQty,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get receivedQty => $composableBuilder(
    column: $table.receivedQty,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitCostMinor => $composableBuilder(
    column: $table.unitCostMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PurchaseItemsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $PurchaseItemsLocalTable> {
  $$PurchaseItemsLocalTableOrderingComposer({
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

  ColumnOrderings<String> get purchaseId => $composableBuilder(
    column: $table.purchaseId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get orderedQty => $composableBuilder(
    column: $table.orderedQty,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get receivedQty => $composableBuilder(
    column: $table.receivedQty,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitCostMinor => $composableBuilder(
    column: $table.unitCostMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PurchaseItemsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $PurchaseItemsLocalTable> {
  $$PurchaseItemsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get purchaseId => $composableBuilder(
    column: $table.purchaseId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get productId =>
      $composableBuilder(column: $table.productId, builder: (column) => column);

  GeneratedColumn<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => column,
  );

  GeneratedColumn<int> get orderedQty => $composableBuilder(
    column: $table.orderedQty,
    builder: (column) => column,
  );

  GeneratedColumn<int> get receivedQty => $composableBuilder(
    column: $table.receivedQty,
    builder: (column) => column,
  );

  GeneratedColumn<int> get unitCostMinor => $composableBuilder(
    column: $table.unitCostMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get subtotalMinor => $composableBuilder(
    column: $table.subtotalMinor,
    builder: (column) => column,
  );
}

class $$PurchaseItemsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PurchaseItemsLocalTable,
          PurchaseItemsLocalData,
          $$PurchaseItemsLocalTableFilterComposer,
          $$PurchaseItemsLocalTableOrderingComposer,
          $$PurchaseItemsLocalTableAnnotationComposer,
          $$PurchaseItemsLocalTableCreateCompanionBuilder,
          $$PurchaseItemsLocalTableUpdateCompanionBuilder,
          (
            PurchaseItemsLocalData,
            BaseReferences<
              _$AppDatabase,
              $PurchaseItemsLocalTable,
              PurchaseItemsLocalData
            >,
          ),
          PurchaseItemsLocalData,
          PrefetchHooks Function()
        > {
  $$PurchaseItemsLocalTableTableManager(
    _$AppDatabase db,
    $PurchaseItemsLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PurchaseItemsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PurchaseItemsLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PurchaseItemsLocalTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> purchaseId = const Value.absent(),
                Value<String?> productId = const Value.absent(),
                Value<String> productName = const Value.absent(),
                Value<int> orderedQty = const Value.absent(),
                Value<int> receivedQty = const Value.absent(),
                Value<int> unitCostMinor = const Value.absent(),
                Value<int> subtotalMinor = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PurchaseItemsLocalCompanion(
                id: id,
                purchaseId: purchaseId,
                productId: productId,
                productName: productName,
                orderedQty: orderedQty,
                receivedQty: receivedQty,
                unitCostMinor: unitCostMinor,
                subtotalMinor: subtotalMinor,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String purchaseId,
                Value<String?> productId = const Value.absent(),
                required String productName,
                required int orderedQty,
                Value<int> receivedQty = const Value.absent(),
                required int unitCostMinor,
                required int subtotalMinor,
                Value<int> rowid = const Value.absent(),
              }) => PurchaseItemsLocalCompanion.insert(
                id: id,
                purchaseId: purchaseId,
                productId: productId,
                productName: productName,
                orderedQty: orderedQty,
                receivedQty: receivedQty,
                unitCostMinor: unitCostMinor,
                subtotalMinor: subtotalMinor,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PurchaseItemsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PurchaseItemsLocalTable,
      PurchaseItemsLocalData,
      $$PurchaseItemsLocalTableFilterComposer,
      $$PurchaseItemsLocalTableOrderingComposer,
      $$PurchaseItemsLocalTableAnnotationComposer,
      $$PurchaseItemsLocalTableCreateCompanionBuilder,
      $$PurchaseItemsLocalTableUpdateCompanionBuilder,
      (
        PurchaseItemsLocalData,
        BaseReferences<
          _$AppDatabase,
          $PurchaseItemsLocalTable,
          PurchaseItemsLocalData
        >,
      ),
      PurchaseItemsLocalData,
      PrefetchHooks Function()
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
      Value<int?> changeMinor,
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
      Value<int?> changeMinor,
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

  ColumnFilters<int> get changeMinor => $composableBuilder(
    column: $table.changeMinor,
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

  ColumnOrderings<int> get changeMinor => $composableBuilder(
    column: $table.changeMinor,
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

  GeneratedColumn<int> get changeMinor => $composableBuilder(
    column: $table.changeMinor,
    builder: (column) => column,
  );

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
                Value<int?> changeMinor = const Value.absent(),
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
                changeMinor: changeMinor,
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
                Value<int?> changeMinor = const Value.absent(),
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
                changeMinor: changeMinor,
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
typedef $$ReceiptSequencesLocalTableCreateCompanionBuilder =
    ReceiptSequencesLocalCompanion Function({
      required String id,
      required String businessId,
      required String branchId,
      required String sequenceDate,
      Value<int> lastSequence,
      required int updatedAt,
      Value<int> rowid,
    });
typedef $$ReceiptSequencesLocalTableUpdateCompanionBuilder =
    ReceiptSequencesLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> sequenceDate,
      Value<int> lastSequence,
      Value<int> updatedAt,
      Value<int> rowid,
    });

class $$ReceiptSequencesLocalTableFilterComposer
    extends Composer<_$AppDatabase, $ReceiptSequencesLocalTable> {
  $$ReceiptSequencesLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sequenceDate => $composableBuilder(
    column: $table.sequenceDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lastSequence => $composableBuilder(
    column: $table.lastSequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ReceiptSequencesLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $ReceiptSequencesLocalTable> {
  $$ReceiptSequencesLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sequenceDate => $composableBuilder(
    column: $table.sequenceDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lastSequence => $composableBuilder(
    column: $table.lastSequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ReceiptSequencesLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $ReceiptSequencesLocalTable> {
  $$ReceiptSequencesLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get sequenceDate => $composableBuilder(
    column: $table.sequenceDate,
    builder: (column) => column,
  );

  GeneratedColumn<int> get lastSequence => $composableBuilder(
    column: $table.lastSequence,
    builder: (column) => column,
  );

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ReceiptSequencesLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ReceiptSequencesLocalTable,
          ReceiptSequencesLocalData,
          $$ReceiptSequencesLocalTableFilterComposer,
          $$ReceiptSequencesLocalTableOrderingComposer,
          $$ReceiptSequencesLocalTableAnnotationComposer,
          $$ReceiptSequencesLocalTableCreateCompanionBuilder,
          $$ReceiptSequencesLocalTableUpdateCompanionBuilder,
          (
            ReceiptSequencesLocalData,
            BaseReferences<
              _$AppDatabase,
              $ReceiptSequencesLocalTable,
              ReceiptSequencesLocalData
            >,
          ),
          ReceiptSequencesLocalData,
          PrefetchHooks Function()
        > {
  $$ReceiptSequencesLocalTableTableManager(
    _$AppDatabase db,
    $ReceiptSequencesLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReceiptSequencesLocalTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$ReceiptSequencesLocalTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$ReceiptSequencesLocalTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> sequenceDate = const Value.absent(),
                Value<int> lastSequence = const Value.absent(),
                Value<int> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReceiptSequencesLocalCompanion(
                id: id,
                businessId: businessId,
                branchId: branchId,
                sequenceDate: sequenceDate,
                lastSequence: lastSequence,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String branchId,
                required String sequenceDate,
                Value<int> lastSequence = const Value.absent(),
                required int updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => ReceiptSequencesLocalCompanion.insert(
                id: id,
                businessId: businessId,
                branchId: branchId,
                sequenceDate: sequenceDate,
                lastSequence: lastSequence,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ReceiptSequencesLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ReceiptSequencesLocalTable,
      ReceiptSequencesLocalData,
      $$ReceiptSequencesLocalTableFilterComposer,
      $$ReceiptSequencesLocalTableOrderingComposer,
      $$ReceiptSequencesLocalTableAnnotationComposer,
      $$ReceiptSequencesLocalTableCreateCompanionBuilder,
      $$ReceiptSequencesLocalTableUpdateCompanionBuilder,
      (
        ReceiptSequencesLocalData,
        BaseReferences<
          _$AppDatabase,
          $ReceiptSequencesLocalTable,
          ReceiptSequencesLocalData
        >,
      ),
      ReceiptSequencesLocalData,
      PrefetchHooks Function()
    >;
typedef $$LocalIdempotencyKeysTableCreateCompanionBuilder =
    LocalIdempotencyKeysCompanion Function({
      required String key,
      required String businessId,
      required String entityType,
      required int createdAt,
      Value<String?> requestFingerprint,
      Value<int> rowid,
    });
typedef $$LocalIdempotencyKeysTableUpdateCompanionBuilder =
    LocalIdempotencyKeysCompanion Function({
      Value<String> key,
      Value<String> businessId,
      Value<String> entityType,
      Value<int> createdAt,
      Value<String?> requestFingerprint,
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

  ColumnFilters<String> get requestFingerprint => $composableBuilder(
    column: $table.requestFingerprint,
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

  ColumnOrderings<String> get requestFingerprint => $composableBuilder(
    column: $table.requestFingerprint,
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

  GeneratedColumn<String> get requestFingerprint => $composableBuilder(
    column: $table.requestFingerprint,
    builder: (column) => column,
  );
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
                Value<String?> requestFingerprint = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalIdempotencyKeysCompanion(
                key: key,
                businessId: businessId,
                entityType: entityType,
                createdAt: createdAt,
                requestFingerprint: requestFingerprint,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String key,
                required String businessId,
                required String entityType,
                required int createdAt,
                Value<String?> requestFingerprint = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalIdempotencyKeysCompanion.insert(
                key: key,
                businessId: businessId,
                entityType: entityType,
                createdAt: createdAt,
                requestFingerprint: requestFingerprint,
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
typedef $$SyncOutboxTableCreateCompanionBuilder =
    SyncOutboxCompanion Function({
      required String id,
      required String entityType,
      required String operation,
      required String payloadJson,
      Value<String?> idempotencyKey,
      Value<int> attemptCount,
      required int nextAttemptAt,
      Value<String?> lastError,
      Value<String> status,
      required int createdAt,
      Value<int> rowid,
    });
typedef $$SyncOutboxTableUpdateCompanionBuilder =
    SyncOutboxCompanion Function({
      Value<String> id,
      Value<String> entityType,
      Value<String> operation,
      Value<String> payloadJson,
      Value<String?> idempotencyKey,
      Value<int> attemptCount,
      Value<int> nextAttemptAt,
      Value<String?> lastError,
      Value<String> status,
      Value<int> createdAt,
      Value<int> rowid,
    });

class $$SyncOutboxTableFilterComposer
    extends Composer<_$AppDatabase, $SyncOutboxTable> {
  $$SyncOutboxTableFilterComposer({
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

  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncOutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncOutboxTable> {
  $$SyncOutboxTableOrderingComposer({
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

  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncOutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncOutboxTable> {
  $$SyncOutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => column,
  );

  GeneratedColumn<int> get attemptCount => $composableBuilder(
    column: $table.attemptCount,
    builder: (column) => column,
  );

  GeneratedColumn<int> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$SyncOutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncOutboxTable,
          SyncOutboxData,
          $$SyncOutboxTableFilterComposer,
          $$SyncOutboxTableOrderingComposer,
          $$SyncOutboxTableAnnotationComposer,
          $$SyncOutboxTableCreateCompanionBuilder,
          $$SyncOutboxTableUpdateCompanionBuilder,
          (
            SyncOutboxData,
            BaseReferences<_$AppDatabase, $SyncOutboxTable, SyncOutboxData>,
          ),
          SyncOutboxData,
          PrefetchHooks Function()
        > {
  $$SyncOutboxTableTableManager(_$AppDatabase db, $SyncOutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncOutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncOutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncOutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> entityType = const Value.absent(),
                Value<String> operation = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<String?> idempotencyKey = const Value.absent(),
                Value<int> attemptCount = const Value.absent(),
                Value<int> nextAttemptAt = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncOutboxCompanion(
                id: id,
                entityType: entityType,
                operation: operation,
                payloadJson: payloadJson,
                idempotencyKey: idempotencyKey,
                attemptCount: attemptCount,
                nextAttemptAt: nextAttemptAt,
                lastError: lastError,
                status: status,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String entityType,
                required String operation,
                required String payloadJson,
                Value<String?> idempotencyKey = const Value.absent(),
                Value<int> attemptCount = const Value.absent(),
                required int nextAttemptAt,
                Value<String?> lastError = const Value.absent(),
                Value<String> status = const Value.absent(),
                required int createdAt,
                Value<int> rowid = const Value.absent(),
              }) => SyncOutboxCompanion.insert(
                id: id,
                entityType: entityType,
                operation: operation,
                payloadJson: payloadJson,
                idempotencyKey: idempotencyKey,
                attemptCount: attemptCount,
                nextAttemptAt: nextAttemptAt,
                lastError: lastError,
                status: status,
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

typedef $$SyncOutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncOutboxTable,
      SyncOutboxData,
      $$SyncOutboxTableFilterComposer,
      $$SyncOutboxTableOrderingComposer,
      $$SyncOutboxTableAnnotationComposer,
      $$SyncOutboxTableCreateCompanionBuilder,
      $$SyncOutboxTableUpdateCompanionBuilder,
      (
        SyncOutboxData,
        BaseReferences<_$AppDatabase, $SyncOutboxTable, SyncOutboxData>,
      ),
      SyncOutboxData,
      PrefetchHooks Function()
    >;
typedef $$SyncMetaTableCreateCompanionBuilder =
    SyncMetaCompanion Function({
      required String key,
      required String value,
      Value<int> rowid,
    });
typedef $$SyncMetaTableUpdateCompanionBuilder =
    SyncMetaCompanion Function({
      Value<String> key,
      Value<String> value,
      Value<int> rowid,
    });

class $$SyncMetaTableFilterComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableFilterComposer({
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

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncMetaTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableOrderingComposer({
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

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncMetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncMetaTable> {
  $$SyncMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$SyncMetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncMetaTable,
          SyncMetaData,
          $$SyncMetaTableFilterComposer,
          $$SyncMetaTableOrderingComposer,
          $$SyncMetaTableAnnotationComposer,
          $$SyncMetaTableCreateCompanionBuilder,
          $$SyncMetaTableUpdateCompanionBuilder,
          (
            SyncMetaData,
            BaseReferences<_$AppDatabase, $SyncMetaTable, SyncMetaData>,
          ),
          SyncMetaData,
          PrefetchHooks Function()
        > {
  $$SyncMetaTableTableManager(_$AppDatabase db, $SyncMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => SyncMetaCompanion.insert(
                key: key,
                value: value,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SyncMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncMetaTable,
      SyncMetaData,
      $$SyncMetaTableFilterComposer,
      $$SyncMetaTableOrderingComposer,
      $$SyncMetaTableAnnotationComposer,
      $$SyncMetaTableCreateCompanionBuilder,
      $$SyncMetaTableUpdateCompanionBuilder,
      (
        SyncMetaData,
        BaseReferences<_$AppDatabase, $SyncMetaTable, SyncMetaData>,
      ),
      SyncMetaData,
      PrefetchHooks Function()
    >;
typedef $$StocksLocalTableCreateCompanionBuilder =
    StocksLocalCompanion Function({
      required String id,
      required String businessId,
      required String branchId,
      required String productId,
      required String productName,
      Value<String?> sku,
      Value<String?> category,
      Value<String?> barcode,
      required int priceMinor,
      Value<int?> costMinor,
      required int quantity,
      Value<int> serverVersion,
      Value<int?> createdAt,
      Value<int?> updatedAt,
      Value<int?> cachedAt,
      Value<int> rowid,
    });
typedef $$StocksLocalTableUpdateCompanionBuilder =
    StocksLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> productId,
      Value<String> productName,
      Value<String?> sku,
      Value<String?> category,
      Value<String?> barcode,
      Value<int> priceMinor,
      Value<int?> costMinor,
      Value<int> quantity,
      Value<int> serverVersion,
      Value<int?> createdAt,
      Value<int?> updatedAt,
      Value<int?> cachedAt,
      Value<int> rowid,
    });

class $$StocksLocalTableFilterComposer
    extends Composer<_$AppDatabase, $StocksLocalTable> {
  $$StocksLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sku => $composableBuilder(
    column: $table.sku,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get costMinor => $composableBuilder(
    column: $table.costMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
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

  ColumnFilters<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StocksLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $StocksLocalTable> {
  $$StocksLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get productId => $composableBuilder(
    column: $table.productId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sku => $composableBuilder(
    column: $table.sku,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get category => $composableBuilder(
    column: $table.category,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get costMinor => $composableBuilder(
    column: $table.costMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get quantity => $composableBuilder(
    column: $table.quantity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
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

  ColumnOrderings<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StocksLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $StocksLocalTable> {
  $$StocksLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get productId =>
      $composableBuilder(column: $table.productId, builder: (column) => column);

  GeneratedColumn<String> get productName => $composableBuilder(
    column: $table.productName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sku =>
      $composableBuilder(column: $table.sku, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get costMinor =>
      $composableBuilder(column: $table.costMinor, builder: (column) => column);

  GeneratedColumn<int> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$StocksLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $StocksLocalTable,
          StocksLocalData,
          $$StocksLocalTableFilterComposer,
          $$StocksLocalTableOrderingComposer,
          $$StocksLocalTableAnnotationComposer,
          $$StocksLocalTableCreateCompanionBuilder,
          $$StocksLocalTableUpdateCompanionBuilder,
          (
            StocksLocalData,
            BaseReferences<_$AppDatabase, $StocksLocalTable, StocksLocalData>,
          ),
          StocksLocalData,
          PrefetchHooks Function()
        > {
  $$StocksLocalTableTableManager(_$AppDatabase db, $StocksLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StocksLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StocksLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StocksLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> productId = const Value.absent(),
                Value<String> productName = const Value.absent(),
                Value<String?> sku = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<int> priceMinor = const Value.absent(),
                Value<int?> costMinor = const Value.absent(),
                Value<int> quantity = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<int?> createdAt = const Value.absent(),
                Value<int?> updatedAt = const Value.absent(),
                Value<int?> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StocksLocalCompanion(
                id: id,
                businessId: businessId,
                branchId: branchId,
                productId: productId,
                productName: productName,
                sku: sku,
                category: category,
                barcode: barcode,
                priceMinor: priceMinor,
                costMinor: costMinor,
                quantity: quantity,
                serverVersion: serverVersion,
                createdAt: createdAt,
                updatedAt: updatedAt,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String branchId,
                required String productId,
                required String productName,
                Value<String?> sku = const Value.absent(),
                Value<String?> category = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                required int priceMinor,
                Value<int?> costMinor = const Value.absent(),
                required int quantity,
                Value<int> serverVersion = const Value.absent(),
                Value<int?> createdAt = const Value.absent(),
                Value<int?> updatedAt = const Value.absent(),
                Value<int?> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StocksLocalCompanion.insert(
                id: id,
                businessId: businessId,
                branchId: branchId,
                productId: productId,
                productName: productName,
                sku: sku,
                category: category,
                barcode: barcode,
                priceMinor: priceMinor,
                costMinor: costMinor,
                quantity: quantity,
                serverVersion: serverVersion,
                createdAt: createdAt,
                updatedAt: updatedAt,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StocksLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $StocksLocalTable,
      StocksLocalData,
      $$StocksLocalTableFilterComposer,
      $$StocksLocalTableOrderingComposer,
      $$StocksLocalTableAnnotationComposer,
      $$StocksLocalTableCreateCompanionBuilder,
      $$StocksLocalTableUpdateCompanionBuilder,
      (
        StocksLocalData,
        BaseReferences<_$AppDatabase, $StocksLocalTable, StocksLocalData>,
      ),
      StocksLocalData,
      PrefetchHooks Function()
    >;
typedef $$StockMovementsLocalTableCreateCompanionBuilder =
    StockMovementsLocalCompanion Function({
      required String id,
      required String businessId,
      required String branchId,
      required String productId,
      required int quantity,
      required String movementType,
      Value<String?> reference,
      required String actor,
      Value<int?> timestamp,
      Value<int?> cachedAt,
      Value<int> rowid,
    });
typedef $$StockMovementsLocalTableUpdateCompanionBuilder =
    StockMovementsLocalCompanion Function({
      Value<String> id,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> productId,
      Value<int> quantity,
      Value<String> movementType,
      Value<String?> reference,
      Value<String> actor,
      Value<int?> timestamp,
      Value<int?> cachedAt,
      Value<int> rowid,
    });

class $$StockMovementsLocalTableFilterComposer
    extends Composer<_$AppDatabase, $StockMovementsLocalTable> {
  $$StockMovementsLocalTableFilterComposer({
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

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
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

  ColumnFilters<String> get movementType => $composableBuilder(
    column: $table.movementType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get reference => $composableBuilder(
    column: $table.reference,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get actor => $composableBuilder(
    column: $table.actor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get timestamp => $composableBuilder(
    column: $table.timestamp,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StockMovementsLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $StockMovementsLocalTable> {
  $$StockMovementsLocalTableOrderingComposer({
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

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
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

  ColumnOrderings<String> get movementType => $composableBuilder(
    column: $table.movementType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get reference => $composableBuilder(
    column: $table.reference,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get actor => $composableBuilder(
    column: $table.actor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get timestamp => $composableBuilder(
    column: $table.timestamp,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StockMovementsLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $StockMovementsLocalTable> {
  $$StockMovementsLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get productId =>
      $composableBuilder(column: $table.productId, builder: (column) => column);

  GeneratedColumn<int> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<String> get movementType => $composableBuilder(
    column: $table.movementType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get reference =>
      $composableBuilder(column: $table.reference, builder: (column) => column);

  GeneratedColumn<String> get actor =>
      $composableBuilder(column: $table.actor, builder: (column) => column);

  GeneratedColumn<int> get timestamp =>
      $composableBuilder(column: $table.timestamp, builder: (column) => column);

  GeneratedColumn<int> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$StockMovementsLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $StockMovementsLocalTable,
          StockMovementsLocalData,
          $$StockMovementsLocalTableFilterComposer,
          $$StockMovementsLocalTableOrderingComposer,
          $$StockMovementsLocalTableAnnotationComposer,
          $$StockMovementsLocalTableCreateCompanionBuilder,
          $$StockMovementsLocalTableUpdateCompanionBuilder,
          (
            StockMovementsLocalData,
            BaseReferences<
              _$AppDatabase,
              $StockMovementsLocalTable,
              StockMovementsLocalData
            >,
          ),
          StockMovementsLocalData,
          PrefetchHooks Function()
        > {
  $$StockMovementsLocalTableTableManager(
    _$AppDatabase db,
    $StockMovementsLocalTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StockMovementsLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StockMovementsLocalTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$StockMovementsLocalTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> productId = const Value.absent(),
                Value<int> quantity = const Value.absent(),
                Value<String> movementType = const Value.absent(),
                Value<String?> reference = const Value.absent(),
                Value<String> actor = const Value.absent(),
                Value<int?> timestamp = const Value.absent(),
                Value<int?> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StockMovementsLocalCompanion(
                id: id,
                businessId: businessId,
                branchId: branchId,
                productId: productId,
                quantity: quantity,
                movementType: movementType,
                reference: reference,
                actor: actor,
                timestamp: timestamp,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String businessId,
                required String branchId,
                required String productId,
                required int quantity,
                required String movementType,
                Value<String?> reference = const Value.absent(),
                required String actor,
                Value<int?> timestamp = const Value.absent(),
                Value<int?> cachedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StockMovementsLocalCompanion.insert(
                id: id,
                businessId: businessId,
                branchId: branchId,
                productId: productId,
                quantity: quantity,
                movementType: movementType,
                reference: reference,
                actor: actor,
                timestamp: timestamp,
                cachedAt: cachedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StockMovementsLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $StockMovementsLocalTable,
      StockMovementsLocalData,
      $$StockMovementsLocalTableFilterComposer,
      $$StockMovementsLocalTableOrderingComposer,
      $$StockMovementsLocalTableAnnotationComposer,
      $$StockMovementsLocalTableCreateCompanionBuilder,
      $$StockMovementsLocalTableUpdateCompanionBuilder,
      (
        StockMovementsLocalData,
        BaseReferences<
          _$AppDatabase,
          $StockMovementsLocalTable,
          StockMovementsLocalData
        >,
      ),
      StockMovementsLocalData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$ProductsLocalTableTableManager get productsLocal =>
      $$ProductsLocalTableTableManager(_db, _db.productsLocal);
  $$BusinessSettingsLocalTableTableManager get businessSettingsLocal =>
      $$BusinessSettingsLocalTableTableManager(_db, _db.businessSettingsLocal);
  $$BranchesLocalTableTableManager get branchesLocal =>
      $$BranchesLocalTableTableManager(_db, _db.branchesLocal);
  $$ActiveBranchLocalTableTableManager get activeBranchLocal =>
      $$ActiveBranchLocalTableTableManager(_db, _db.activeBranchLocal);
  $$CartLocalTableTableManager get cartLocal =>
      $$CartLocalTableTableManager(_db, _db.cartLocal);
  $$CartItemsLocalTableTableManager get cartItemsLocal =>
      $$CartItemsLocalTableTableManager(_db, _db.cartItemsLocal);
  $$CustomersLocalTableTableManager get customersLocal =>
      $$CustomersLocalTableTableManager(_db, _db.customersLocal);
  $$SalesLocalTableTableManager get salesLocal =>
      $$SalesLocalTableTableManager(_db, _db.salesLocal);
  $$SaleItemsLocalTableTableManager get saleItemsLocal =>
      $$SaleItemsLocalTableTableManager(_db, _db.saleItemsLocal);
  $$SuppliersLocalTableTableManager get suppliersLocal =>
      $$SuppliersLocalTableTableManager(_db, _db.suppliersLocal);
  $$PurchasesLocalTableTableManager get purchasesLocal =>
      $$PurchasesLocalTableTableManager(_db, _db.purchasesLocal);
  $$PurchaseItemsLocalTableTableManager get purchaseItemsLocal =>
      $$PurchaseItemsLocalTableTableManager(_db, _db.purchaseItemsLocal);
  $$PaymentsLocalTableTableManager get paymentsLocal =>
      $$PaymentsLocalTableTableManager(_db, _db.paymentsLocal);
  $$ReceiptSequencesLocalTableTableManager get receiptSequencesLocal =>
      $$ReceiptSequencesLocalTableTableManager(_db, _db.receiptSequencesLocal);
  $$LocalIdempotencyKeysTableTableManager get localIdempotencyKeys =>
      $$LocalIdempotencyKeysTableTableManager(_db, _db.localIdempotencyKeys);
  $$SyncOutboxTableTableManager get syncOutbox =>
      $$SyncOutboxTableTableManager(_db, _db.syncOutbox);
  $$SyncMetaTableTableManager get syncMeta =>
      $$SyncMetaTableTableManager(_db, _db.syncMeta);
  $$StocksLocalTableTableManager get stocksLocal =>
      $$StocksLocalTableTableManager(_db, _db.stocksLocal);
  $$StockMovementsLocalTableTableManager get stockMovementsLocal =>
      $$StockMovementsLocalTableTableManager(_db, _db.stockMovementsLocal);
}
