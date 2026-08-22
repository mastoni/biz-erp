import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:uuid/uuid.dart';

class CustomerRepository {
  CustomerRepository(this._db);
  final AppDatabase _db;
  final _uuid = const Uuid();

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

  /// Create a new customer locally and enqueue for sync.
  /// Transactionally saves local customer (serverVersion=0, dirty) and enqueues CREATE outbox.
  Future<void> createCustomer(Customer customer, SyncOutboxRepository outbox) async {
    if (customer.name.trim().isEmpty) {
      throw ArgumentError('Nama pelanggan wajib diisi');
    }

    final mutationId = _uuid.v4();
    await _db.transaction(() async {
      await _db.into(_db.customersLocal).insert(
        CustomersLocalCompanion.insert(
          id: customer.id,
          businessId: customer.businessId,
          name: customer.name,
          phone: Value(customer.phone),
          email: Value(customer.email),
          isActive: Value(customer.isActive ? 1 : 0),
          serverVersion: const Value(0),
          lastSyncedAt: Value(customer.lastSyncedAt),
          localStatus: const Value('dirty'),
        ),
      );

      final dto = CustomerDto(
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        isActive: customer.isActive,
        serverVersion: 0,
      );
      await outbox.enqueueCustomerCreate(dto, idempotencyKey: mutationId);
    });
  }

  /// Update an existing customer locally and enqueue for sync.
  /// Preserves serverVersion for optimistic locking. Marks local as dirty.
  Future<void> updateCustomer(Customer updated, SyncOutboxRepository outbox) async {
    if (updated.name.trim().isEmpty) {
      throw ArgumentError('Nama pelanggan wajib diisi');
    }

    final existing = await getCustomerById(updated.id, updated.businessId);
    if (existing == null) {
      throw ArgumentError('Pelanggan tidak ditemukan');
    }

    // Update local DB FIRST (preserves dirty state even if enqueue fails)
    await _db.into(_db.customersLocal).insertOnConflictUpdate(
      CustomersLocalCompanion(
        id: Value(updated.id),
        businessId: Value(updated.businessId),
        name: Value(updated.name),
        phone: Value(updated.phone),
        email: Value(updated.email),
        isActive: Value(updated.isActive ? 1 : 0),
        // PRESERVE existing serverVersion — only SyncEngine bumps it on push success
        serverVersion: Value(existing.serverVersion),
        lastSyncedAt: Value(existing.lastSyncedAt),
        localStatus: const Value('dirty'),
      ),
    );

    // THEN enqueue to outbox. If this throws, customer stays dirty (safe).
    final mutationId = _uuid.v4();
    final dto = CustomerDto(
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      isActive: updated.isActive,
      serverVersion: existing.serverVersion,
    );
    await outbox.enqueueCustomerUpsert(dto, idempotencyKey: mutationId);
  }

  /// Soft-delete a customer locally and enqueue for sync.
  /// Atomic: updates local DB and enqueues outbox in a single transaction.
  Future<void> deleteCustomer(String id, String businessId, SyncOutboxRepository outbox) async {
    final existing = await getCustomerById(id, businessId);
    if (existing == null) {
      throw ArgumentError('Pelanggan tidak ditemukan');
    }

    final mutationId = _uuid.v4();
    await _db.transaction(() async {
      await (_db.update(_db.customersLocal)
            ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
          .write(const CustomersLocalCompanion(
            isActive: Value(0),
            localStatus: Value('dirty'),
          ));

      final dto = CustomerDto(
        id: existing.id,
        name: existing.name,
        phone: existing.phone,
        email: existing.email,
        isActive: false,
        serverVersion: existing.serverVersion,
      );
      await outbox.enqueueCustomerUpsert(dto, idempotencyKey: mutationId);
    });
  }

  /// After push succeeds: mark synced + update server version.
  Future<void> markSyncedAfterPush(String id, int serverVersion) async {
    await (_db.update(_db.customersLocal)..where((t) => t.id.equals(id))).write(
      CustomersLocalCompanion(
        localStatus: const Value('synced'),
        serverVersion: Value(serverVersion),
      ),
    );
  }

  /// Apply server sync (pull). Handles tombstones (deletedAt != null).
  /// If local is dirty, skip (policy B).
  Future<bool> applyServerSync(CustomerDto dto, String businessId) async {
    final existing = await (_db.select(
      _db.customersLocal,
    )..where((t) => t.id.equals(dto.id))).getSingleOrNull();
    if (existing != null && existing.localStatus != 'synced') {
      return false;
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    
    // Handle tombstone: server has deleted this customer
    final isDeleted = dto.deletedAt != null && dto.deletedAt! > 0;
    final isActive = isDeleted ? 0 : (dto.isActive ? 1 : 0);
    
    await _db
        .into(_db.customersLocal)
        .insertOnConflictUpdate(
          CustomersLocalCompanion.insert(
            id: dto.id,
            businessId: businessId,
            name: dto.name,
            phone: Value(dto.phone),
            email: Value(dto.email),
            isActive: Value(isActive),
            serverVersion: Value(dto.serverVersion),
            lastSyncedAt: Value(now),
          ),
        );
    return true;
  }
}
