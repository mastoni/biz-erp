import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

class CustomerRepository {
  CustomerRepository(this._db);
  final AppDatabase _db;

  Customer _mapToDomain(CustomersLocalData data) {
    return Customer(
      id: data.id,
      businessId: data.businessId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      isActive: data.isActive == 1,
      serverVersion: data.serverVersion,
      lastSyncedAt: data.lastSyncedAt,
      localStatus: data.localStatus,
    );
  }

  Future<void> upsertCustomer(Customer customer) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db
        .into(_db.customersLocal)
        .insertOnConflictUpdate(
          CustomersLocalCompanion(
            id: Value(customer.id),
            businessId: Value(customer.businessId),
            name: Value(customer.name),
            phone: Value(customer.phone),
            email: Value(customer.email),
            isActive: Value(customer.isActive ? 1 : 0),
            serverVersion: Value(customer.serverVersion),
            lastSyncedAt: Value(customer.lastSyncedAt ?? now),
          ),
        );
  }

  Future<Customer?> getCustomerById(String id, String businessId) async {
    final query = _db.select(_db.customersLocal)
      ..where((t) => t.id.equals(id) & t.businessId.equals(businessId));
    final result = await query.getSingleOrNull();
    return result == null ? null : _mapToDomain(result);
  }

  Future<List<Customer>> listActiveCustomers(String businessId) async {
    final query = _db.select(_db.customersLocal)
      ..where((t) => t.businessId.equals(businessId) & t.isActive.equals(1));
    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  Future<List<Customer>> listAllCustomers(String businessId) async {
    final query = _db.select(_db.customersLocal)
      ..where((t) => t.businessId.equals(businessId));
    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  Future<int> maxServerVersion(String businessId) async {
    final row = await _db
        .customSelect(
          'SELECT COALESCE(MAX(server_version), 0) AS v FROM customers_local WHERE business_id = ?',
          variables: [Variable.withString(businessId)],
        )
        .getSingle();
    return row.read<int>('v');
  }

  Future<bool> applyServerSync(CustomerDto dto, String businessId) async {
    final existing = await (_db.select(
      _db.customersLocal,
    )..where((t) => t.id.equals(dto.id))).getSingleOrNull();
    if (existing != null && existing.localStatus != 'synced') {
      return false;
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db
        .into(_db.customersLocal)
        .insertOnConflictUpdate(
          CustomersLocalCompanion.insert(
            id: dto.id,
            businessId: businessId,
            name: dto.name,
            phone: Value(dto.phone),
            email: Value(dto.email),
            isActive: Value(dto.isActive ? 1 : 0),
            serverVersion: Value(dto.serverVersion),
            lastSyncedAt: Value(now),
          ),
        );
    return true;
  }
}
