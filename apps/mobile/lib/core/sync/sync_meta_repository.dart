import '../database/app_database.dart';

class SyncMetaRepository {
  SyncMetaRepository(this._db);
  final AppDatabase _db;

  Future<int> getInt(String key) async {
    final row = await (_db.select(
      _db.syncMeta,
    )..where((t) => t.key.equals(key))).getSingleOrNull();
    return row == null ? 0 : int.tryParse(row.value) ?? 0;
  }

  Future<void> setInt(String key, int value) async {
    await _db
        .into(_db.syncMeta)
        .insertOnConflictUpdate(
          SyncMetaCompanion.insert(key: key, value: value.toString()),
        );
  }
}
