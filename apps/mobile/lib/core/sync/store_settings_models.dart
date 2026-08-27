// apps/mobile/lib/core/sync/store_settings_models.dart

/// Canonical store settings DTO — maps the backend GET /v1/settings/store
/// response. This is the authoritative resolved configuration
/// (branch override → business default → canonical defaults).
class StoreSettingsDto {
  final String id;
  final String businessId;
  final String? branchId;
  final String storeName;
  final String address;
  final String phone;
  final int taxRateBps;
  final String receiptFooter;
  final PaymentMethodsConfig paymentMethods;
  final PrinterConfig printerConfig;
  final DrawerConfig drawerConfig;
  final ScannerConfig scannerConfig;
  final BarcodeConfig barcodeConfig;
  final String createdAt;
  final String updatedAt;

  const StoreSettingsDto({
    required this.id,
    required this.businessId,
    this.branchId,
    required this.storeName,
    required this.address,
    required this.phone,
    required this.taxRateBps,
    required this.receiptFooter,
    required this.paymentMethods,
    required this.printerConfig,
    required this.drawerConfig,
    required this.scannerConfig,
    required this.barcodeConfig,
    required this.createdAt,
    required this.updatedAt,
  });

  factory StoreSettingsDto.fromJson(Map<String, dynamic> j) => StoreSettingsDto(
        id: j['id'] as String,
        businessId: j['business_id'] as String,
        branchId: j['branch_id'] as String?,
        storeName: j['store_name'] as String,
        address: j['address'] as String,
        phone: j['phone'] as String,
        taxRateBps: (j['tax_rate_bps'] as num).toInt(),
        receiptFooter: j['receipt_footer'] as String,
        paymentMethods:
            PaymentMethodsConfig.fromJson(j['payment_methods'] as Map<String, dynamic>),
        printerConfig:
            PrinterConfig.fromJson(j['printer_config'] as Map<String, dynamic>),
        drawerConfig:
            DrawerConfig.fromJson(j['drawer_config'] as Map<String, dynamic>),
        scannerConfig:
            ScannerConfig.fromJson(j['scanner_config'] as Map<String, dynamic>),
        barcodeConfig:
            BarcodeConfig.fromJson(j['barcode_config'] as Map<String, dynamic>),
        createdAt: j['created_at'] as String,
        updatedAt: j['updated_at'] as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'business_id': businessId,
        'branch_id': branchId,
        'store_name': storeName,
        'address': address,
        'phone': phone,
        'tax_rate_bps': taxRateBps,
        'receipt_footer': receiptFooter,
        'payment_methods': paymentMethods.toJson(),
        'printer_config': printerConfig.toJson(),
        'drawer_config': drawerConfig.toJson(),
        'scanner_config': scannerConfig.toJson(),
        'barcode_config': barcodeConfig.toJson(),
        'created_at': createdAt,
        'updated_at': updatedAt,
      };
}

class PaymentMethodsConfig {
  final bool cash;
  final bool qris;
  final bool debit;

  const PaymentMethodsConfig({
    required this.cash,
    required this.qris,
    required this.debit,
  });

  factory PaymentMethodsConfig.fromJson(Map<String, dynamic> j) =>
      PaymentMethodsConfig(
        cash: j['cash'] as bool,
        qris: j['qris'] as bool,
        debit: j['debit'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'cash': cash,
        'qris': qris,
        'debit': debit,
      };
}

class PrinterConfig {
  final String model;
  final String paper;
  final int copies;
  final bool autoCut;
  final bool printLogo;
  final bool autoPrint;
  final String? connectionType;

  const PrinterConfig({
    required this.model,
    required this.paper,
    required this.copies,
    required this.autoCut,
    required this.printLogo,
    required this.autoPrint,
    this.connectionType,
  });

  factory PrinterConfig.fromJson(Map<String, dynamic> j) => PrinterConfig(
        model: j['model'] as String,
        paper: j['paper'] as String,
        copies: (j['copies'] as num).toInt(),
        autoCut: j['autoCut'] as bool,
        printLogo: j['printLogo'] as bool,
        autoPrint: j['autoPrint'] as bool,
        connectionType: j['connectionType'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'model': model,
        'paper': paper,
        'copies': copies,
        'autoCut': autoCut,
        'printLogo': printLogo,
        'autoPrint': autoPrint,
        'connectionType': connectionType,
      };
}

class DrawerConfig {
  final bool openOnPayment;
  final bool openOnShift;
  final int delayMs;

  const DrawerConfig({
    required this.openOnPayment,
    required this.openOnShift,
    required this.delayMs,
  });

  factory DrawerConfig.fromJson(Map<String, dynamic> j) => DrawerConfig(
        openOnPayment: j['openOnPayment'] as bool,
        openOnShift: j['openOnShift'] as bool,
        delayMs: (j['delayMs'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'openOnPayment': openOnPayment,
        'openOnShift': openOnShift,
        'delayMs': delayMs,
      };
}

class ScannerConfig {
  final String type;
  final bool autoEnter;
  final bool sound;

  const ScannerConfig({
    required this.type,
    required this.autoEnter,
    required this.sound,
  });

  factory ScannerConfig.fromJson(Map<String, dynamic> j) => ScannerConfig(
        type: j['type'] as String,
        autoEnter: j['autoEnter'] as bool,
        sound: j['sound'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'autoEnter': autoEnter,
        'sound': sound,
      };
}

class BarcodeConfig {
  final String format;
  final String prefix;
  final bool autoGenerate;
  final String labelSize;
  final bool showPrice;

  const BarcodeConfig({
    required this.format,
    required this.prefix,
    required this.autoGenerate,
    required this.labelSize,
    required this.showPrice,
  });

  factory BarcodeConfig.fromJson(Map<String, dynamic> j) => BarcodeConfig(
        format: j['format'] as String,
        prefix: j['prefix'] as String,
        autoGenerate: j['autoGenerate'] as bool,
        labelSize: j['labelSize'] as String,
        showPrice: j['showPrice'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'format': format,
        'prefix': prefix,
        'autoGenerate': autoGenerate,
        'labelSize': labelSize,
        'showPrice': showPrice,
      };
}
