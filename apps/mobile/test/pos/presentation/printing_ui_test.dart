import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/receipt_dialog.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';

class _MemPrefs implements PrinterPreferences {
  PrinterDevice? saved;
  @override
  Future<PrinterDevice?> loadLastPrinter() async => saved;
  @override
  Future<void> saveLastPrinter(PrinterDevice device) async => saved = device;
  @override
  Future<void> clearLastPrinter() async => saved = null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('com.biz_erp/bluetooth_printer');

  const result = CheckoutResult(
    clientTransactionId: 'tx-1',
    receiptNumber: 'BRANCH-001-20260813-0001',
    grandTotalMinor: 47952,
    changeMinor: 2048,
  );

  const data = ReceiptData(
    receiptNumber: 'BRANCH-001-20260813-0001',
    businessName: 'WARUNG DEMO',
    branchName: 'CABANG UTAMA',
    cashierId: 'CASHIER-001',
    createdAtEpochMs: 0,
    subtotalMinor: 48000,
    discountMinor: 4800,
    taxMinor: 4752,
    totalMinor: 47952,
    cashReceivedMinor: 50000,
    changeMinor: 2048,
    items: [
      ReceiptItemData(
        productId: 'p1',
        displayName: 'Kopi',
        quantity: 1,
        unitPriceMinor: 18000,
      ),
    ],
  );

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  Future<PrintingService> pumpDialog(WidgetTester tester) async {
    final service = PrintingService(
      adapter: BluetoothPrinterAdapter(),
      prefs: _MemPrefs(),
    );

    // Setup mock channel SEBELUM widget di-build
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          if (call.method == 'getPairedDevices') {
            return [
              {'name': 'RPP02N', 'address': '00:11:22:33:44:55'},
            ];
          }
          if (call.method == 'connect') return true;
          if (call.method == 'writeBytes') return true;
          return null;
        });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () => showDialog(
                  context: context,
                  builder: (_) => ReceiptDialog(
                    result: result,
                    receiptData: data,
                    printingService: service,
                  ),
                ),
                child: const Text('open'),
              );
            },
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return service;
  }

  testWidgets('PRINT-012 selector sheet menampilkan paired device', (
    tester,
  ) async {
    final service = await pumpDialog(tester);

    // Buka dialog cetak
    await tester.tap(find.text('Cetak Struk'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Force load devices (bypass _init permission logic)
    await service.loadPairedDevices();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(find.text('Pilih Printer'), findsOneWidget);
    expect(find.text('RPP02N'), findsOneWidget);
  });

  testWidgets('PRINT-013 connect lalu print sukses memberi feedback', (
    tester,
  ) async {
    final service = await pumpDialog(tester);

    await tester.tap(find.text('Cetak Struk'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Force load devices
    await service.loadPairedDevices();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    // Tap printer
    await tester.tap(find.text('RPP02N'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(find.text('Struk terkirim ke printer'), findsOneWidget);
  });
}
