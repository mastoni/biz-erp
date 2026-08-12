import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path_provider/path_provider.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Android encrypted DB opener verification', (tester) async {
    final appDir = await getApplicationDocumentsDirectory();
    final keyService = DbKeyService(); // Uses real flutter_secure_storage
    final opener = DbOpener(keyService: keyService, appRoot: appDir);

    const businessId = '550e8400-e29b-41d4-a716-446655440000';

    try {
      // DB-001: Open encrypted DB
      final db = await opener.open(businessId);
      print('DB-001 PASS: Encrypted DB opened');

      // DB-002: Write/read through Drift
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'android-opener-test',
              businessId: businessId,
              branchId: 'branch-1',
              cashierId: 'cashier-1',
              status: SaleStatus.draft,
              subtotalMinor: 9999,
              totalMinor: 9999,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'android-device',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      final sale =
          await (db.select(db.salesLocal)..where(
                (t) => t.clientTransactionId.equals('android-opener-test'),
              ))
              .getSingle();
      expect(sale.totalMinor, 9999);
      print('DB-002 PASS: Write/read through Drift');

      // DB-007: Close and reopen
      await opener.close(businessId);
      final db2 = await opener.open(businessId);
      final sale2 =
          await (db2.select(db2.salesLocal)..where(
                (t) => t.clientTransactionId.equals('android-opener-test'),
              ))
              .getSingle();
      expect(sale2.totalMinor, 9999);
      print('DB-007 PASS: Close/reopen persistence');

      // DB-OPEN-004: Verify file is not plaintext
      final dbFile = File(opener.dbPathFor(businessId));
      final bytes = dbFile.readAsBytesSync();
      final header = String.fromCharCodes(bytes.take(15));
      expect(header, isNot('SQLite format 3'));
      print('DB-OPEN-004 PASS: File is encrypted (not plaintext)');

      // Cleanup
      await opener.closeAll();

      print('\nALL ANDROID DB OPENER TESTS PASSED');
    } catch (e) {
      await opener.closeAll();
      rethrow;
    }
  });
}
