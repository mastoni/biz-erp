import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:uuid/uuid.dart';

class SupplierRepository {
  SupplierRepository(this._db);
  final AppDatabase _db;
  final _uuid = const Uuid();

  Supplier _mapToDomain(SuppliersLocalData data) {
    return Supplier(
      id: data.id,
      businessId: data.businessId,
      name: data.name,
      code: data.code,
      contact: data.contact,
      phone: data.phone,
      email: data.email,
      category: data.category ?? '',
      term: data.term,
      isActive: data.deletedAt == null ? (data.isActive == 1) : false,
      serverVersion: data.serverVersion,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      deletedAt: data.deletedAt,
      lastSyncedAt: data.lastSyncedAt,
      localStatus: data.localStatus,
    );
  }

  Future<void> upsertSupplier(Supplier supplier) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.into(_db.suppliersLocal).insertOnConflictUpdate(
      SuppliersLocalCompanion(
        id: Value(supplier.id),
        businessId: Value(supplier.businessId),
        code: Value(supplier.code),
        name: Value(supplier.name),
        contact: Value(supplier.contact),
        phone: Value(supplier.phone),
        email: Value(supplier.email),
        category: Value(supplier.category),
        term: Value(supplier.term),
        isActive: Value(supplier.isActive ? 1 : 0),
        serverVersion: Value(supplier.serverVersion),
        createdAt: Value(supplier.createdAt ?? now),
        updatedAt: Value(supplier.updatedAt ?? now),
        deletedAt: Value(supplier.deletedAt),
        lastSyncedAt: Value(supplier.lastSyncedAt ?? now),
        localStatus: Value(supplier.localStatus),
      ),
    );
  }

  Future<Supplier?> getSupplierById(String id, String businessId) async {
    final query = _db.select(_db.suppliersLocal)
      ..where((t) => t.id.equals(id) & t.businessId.equals(businessId));
    final result = await query.getSingleOrNull();
    return result == null ? null : _mapToDomain(result);
  }

  Future<List<Supplier>> listSuppliers(String businessId) async {
    final query = _db.select(_db.suppliersLocal)
      ..where((t) => t.businessId.equals(businessId));
    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  Future<List<Supplier>> listActiveSuppliers(String businessId) async {
    final query = _db.select(_db.suppliersLocal)
      ..where((t) => t.businessId.equals(businessId) & t.isActive.equals(1));
    final results = await query.get();
    return results.map((e) => _mapToDomain(e)).toList();
  }

  Future<int> maxServerVersion(String businessId) async {
    final row = await _db.customSelect(
      'SELECT COALESCE(MAX(server_version), 0) AS v FROM suppliers_local WHERE business_id = ?',
      variables: [Variable.withString(businessId)],
    ).getSingle();
    return row.read<int>('v');
  }

  Future<void> createSupplier(Supplier supplier, SyncOutboxRepository outbox) async {
    if (supplier.name.trim().isEmpty) {
      throw ArgumentError('Nama supplier wajib diisi');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final mutationId = _uuid.v4();
    await _db.transaction(() async {
      await _db.into(_db.suppliersLocal).insert(
        SuppliersLocalCompanion.insert(
          id: supplier.id,
          businessId: supplier.businessId,
          code: Value(supplier.code),
          name: supplier.name,
          contact: Value(supplier.contact),
          phone: Value(supplier.phone),
          email: Value(supplier.email),
          category: Value(supplier.category),
          term: Value(supplier.term),
          isActive: Value(supplier.isActive ? 1 : 0),
          serverVersion: const Value(0),
          createdAt: Value(supplier.createdAt ?? now),
          updatedAt: Value(supplier.updatedAt ?? now),
          deletedAt: Value(supplier.deletedAt),
          lastSyncedAt: Value(supplier.lastSyncedAt),
          localStatus: const Value('dirty'),
        ),
      );

      final dto = SupplierDto(
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        contact: supplier.contact,
        phone: supplier.phone,
        email: supplier.email,
        category: supplier.category,
        term: supplier.term,
        isActive: supplier.isActive,
        serverVersion: 0,
      );
      await outbox.enqueueSupplierCreate(dto, idempotencyKey: mutationId);
    });
  }

  Future<void> updateSupplier(Supplier updated, SyncOutboxRepository outbox) async {
    if (updated.name.trim().isEmpty) {
      throw ArgumentError('Nama supplier wajib diisi');
    }

    final existing = await getSupplierById(updated.id, updated.businessId);
    if (existing == null) {
      throw ArgumentError('Supplier tidak ditemukan');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.into(_db.suppliersLocal).insertOnConflictUpdate(
      SuppliersLocalCompanion(
        id: Value(updated.id),
        businessId: Value(updated.businessId),
        code: Value(updated.code),
        name: Value(updated.name),
        contact: Value(updated.contact),
        phone: Value(updated.phone),
        email: Value(updated.email),
        category: Value(updated.category),
        term: Value(updated.term),
        isActive: Value(updated.isActive ? 1 : 0),
        serverVersion: Value(existing.serverVersion),
        createdAt: Value(existing.createdAt ?? now),
        updatedAt: Value(now),
        deletedAt: Value(updated.deletedAt),
        lastSyncedAt: Value(existing.lastSyncedAt),
        localStatus: const Value('dirty'),
      ),
    );

    final mutationId = _uuid.v4();
    final dto = SupplierDto(
      id: updated.id,
      name: updated.name,
      code: updated.code,
      contact: updated.contact,
      phone: updated.phone,
      email: updated.email,
      category: updated.category,
      term: updated.term,
      isActive: updated.isActive,
      serverVersion: existing.serverVersion,
    );
    await outbox.enqueueSupplierUpsert(dto, idempotencyKey: mutationId);
  }

  Future<void> deleteSupplier(String id, String businessId, SyncOutboxRepository outbox) async {
    final existing = await getSupplierById(id, businessId);
    if (existing == null) {
      throw ArgumentError('Supplier tidak ditemukan');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final mutationId = _uuid.v4();
    await _db.transaction(() async {
      await (_db.update(_db.suppliersLocal)
            ..where((t) => t.id.equals(id) & t.businessId.equals(businessId)))
        .write(
          SuppliersLocalCompanion(
            isActive: const Value(0),
            deletedAt: Value(now),
            localStatus: const Value('dirty'),
          ),
        );

      final dto = SupplierDto(
        id: existing.id,
        name: existing.name,
        code: existing.code,
        contact: existing.contact,
        phone: existing.phone,
        email: existing.email,
        category: existing.category,
        term: existing.term,
        isActive: false,
        serverVersion: existing.serverVersion,
      );
      await outbox.enqueueSupplierUpsert(dto, idempotencyKey: mutationId);
    });
  }

  Future<bool> applyServerSync(SupplierDto dto, String businessId) async {
    final existing = await (_db.select(
      _db.suppliersLocal,
    )..where((t) => t.id.equals(dto.id))).getSingleOrNull();
    if (existing != null && existing.localStatus != 'synced') {
      return false;
    }

    final isDeleted = dto.deletedAt != null && dto.deletedAt! > 0;
    final now = DateTime.now().millisecondsSinceEpoch;

    await _db.into(_db.suppliersLocal).insertOnConflictUpdate(
      SuppliersLocalCompanion.insert(
        id: dto.id,
        businessId: businessId,
        code: Value(dto.code),
        name: dto.name,
        contact: Value(dto.contact),
        phone: Value(dto.phone),
        email: Value(dto.email),
        category: Value(dto.category),
        term: Value(dto.term),
        isActive: Value(isDeleted ? 0 : (dto.isActive ? 1 : 0)),
        serverVersion: Value(dto.serverVersion),
        createdAt: Value(existing?.createdAt ?? now),
        updatedAt: Value(now),
        deletedAt: Value(dto.deletedAt),
        lastSyncedAt: Value(now),
      ),
    );
    return true;
  }

  Future<void> markSyncedAfterPush(String id, int serverVersion) async {
    await (_db.update(_db.suppliersLocal)..where((t) => t.id.equals(id))).write(
      SuppliersLocalCompanion(
        localStatus: const Value('synced'),
        serverVersion: Value(serverVersion),
        lastSyncedAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
  }
}
