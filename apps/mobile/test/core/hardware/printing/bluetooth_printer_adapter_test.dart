import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('com.biz_erp/bluetooth_printer');

  BluetoothPrinterAdapter adapterWith(
    Future<Object?> Function(MethodCall) handler,
  ) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, handler);
    return BluetoothPrinterAdapter();
  }

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('PRINT-008 connect sukses & paired devices ter-mapping', () async {
    final adapter = adapterWith((call) async {
      if (call.method == 'getPairedDevices') {
        return [
          {'name': 'RPP02N', 'address': '00:11:22:33:44:55'},
        ];
      }
      if (call.method == 'connect') return true;
      return null;
    });

    final devices = await adapter.pairedDevices();
    expect(devices.length, 1);
    expect(devices.first.name, 'RPP02N');

    await adapter.connect('00:11:22:33:44:55'); // tidak throw
  });

  test('PRINT-009 connect gagal propagate pesan native', () async {
    final adapter = adapterWith((call) async {
      throw PlatformException(
        code: 'CONNECT_FAILED',
        message: 'UUID failed: read failed',
      );
    });

    expect(
      () => adapter.connect('AA:BB'),
      throwsA(
        isA<PrinterException>().having(
          (e) => e.message,
          'message',
          contains('UUID failed'),
        ),
      ),
    );
  });

  test('PRINT-010 writeBytes gagal propagate pesan native', () async {
    final adapter = adapterWith((call) async {
      throw PlatformException(
        code: 'WRITE_FAILED',
        message: 'Socket reports disconnected',
      );
    });

    expect(
      () => adapter.writeBytes(Uint8List.fromList([0x1B, 0x40])),
      throwsA(
        isA<PrinterException>().having(
          (e) => e.message,
          'message',
          contains('Socket reports disconnected'),
        ),
      ),
    );
  });
}
