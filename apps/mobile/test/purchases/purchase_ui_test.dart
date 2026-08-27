import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'package:biz_erp_mobile/purchases/presentation/purchase_list_screen.dart';
import 'package:biz_erp_mobile/purchases/presentation/purchase_detail_screen.dart';
import 'package:biz_erp_mobile/purchases/presentation/purchase_status_badge.dart';

/// Fake SyncApiClient used to validate ONLINE payment history rendering.
class FakeSyncApiClient implements SyncApiClient {
  PurchaseDto? detailResponse;
  bool throwError = false;
  PurchasePushResult? sendResult;
  String? capturedIdempotencyKey;
  int? capturedIfMatchVersion;

  @override
  Future<PurchaseDto> getPurchase({required String id}) async {
    if (throwError) throw Exception('Network error');
    if (detailResponse != null) return detailResponse!;
    return PurchaseDto(
      id: id,
      businessId: 'biz-001',
      branchId: 'branch-001',
      supplierId: 'sup-001',
      code: 'PO/001',
      date: '2026-08-20',
      dueDate: '2026-09-03',
      supplierTerm: 'Tempo 14',
      status: 'sent',
      totalMinor: 1000000,
      serverVersion: 1,
      payments: const [
        PurchasePaymentDto(
          id: 'pay-1',
          businessId: 'biz-001',
          purchaseId: 'po-1',
          amountMinor: 400000,
          method: 'bank_transfer',
          reference: 'TRX-123',
          idempotencyKey: 'idem-1',
          createdAt: '2026-08-20 14:00',
        ),
      ],
    );
  }

  @override
  Future<PurchasePushResult> sendPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    capturedIdempotencyKey = idempotencyKey;
    capturedIfMatchVersion = ifMatchVersion;
    return sendResult ?? PurchasePushResult(ok: true, serverVersion: 2);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late AppDatabase db;
  late PurchaseRepository repository;

  setUp(() {
    db = AppDatabase.memory();
    repository = PurchaseRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Widget buildListApp({
    required String businessId,
    required String branchId,
    required String userRole,
    bool isOnline = true,
    SyncApiClient? syncApiClient,
  }) {
    return MaterialApp(
      home: PurchaseListScreen(
        businessId: businessId,
        branchId: branchId,
        purchaseRepo: repository,
        syncApiClient: syncApiClient,
        userRole: userRole,
        isOnline: isOnline,
      ),
    );
  }

  Widget buildDetailApp({
    required String purchaseId,
    required String businessId,
    required String branchId,
    required String userRole,
    bool isOnline = true,
    SyncApiClient? syncApiClient,
  }) {
    return MaterialApp(
      home: PurchaseDetailScreen(
        purchaseId: purchaseId,
        businessId: businessId,
        branchId: branchId,
        purchaseRepo: repository,
        syncApiClient: syncApiClient,
        userRole: userRole,
        isOnline: isOnline,
      ),
    );
  }

  Future<void> seed(PurchaseDto dto, String businessId) =>
      repository.applyServerSync(dto, businessId);

  group('Phase 9B.7.1 Mobile Purchase UI Tests', () {
    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-001: List renders cached records
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-001: PurchaseListScreen renders cached records', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-1',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          supplierName: 'PT Sumber Pangan',
          code: 'PO/2026/001',
          date: '2026-08-20',
          dueDate: '2026-09-03',
          supplierTerm: 'Tempo 14',
          status: 'sent',
          totalMinor: 1500000,
          receivedMinor: 500000,
          paidMinor: 500000,
          outstandingMinor: 1000000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Pembelian (PO)'), findsOneWidget);
      expect(find.text('PO/2026/001'), findsOneWidget);
      expect(find.text('PT Sumber Pangan'), findsOneWidget);
      expect(
        find.descendant(of: find.byType(PurchaseStatusBadge), matching: find.text('Dikirim')),
        findsOneWidget,
      );
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-002: PO code renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-002: PO code renders correctly in list and detail', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-100',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'MKM/PO/0826/0099',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 500000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('MKM/PO/0826/0099'), findsOneWidget);

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-100', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('po_code_text')), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-003: Supplier renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-003: Supplier name renders', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-sup',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-99',
          supplierName: 'UD Makmur Sentosa',
          code: 'PO/SUP/01',
          date: '2026-08-20',
          dueDate: '2026-09-19',
          supplierTerm: 'Tempo 30',
          status: 'draft',
          totalMinor: 800000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('UD Makmur Sentosa'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-004: Status renders correctly
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-004: Status renders with correct canonical label', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-status',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/STAT',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'partial',
          totalMinor: 1000000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: find.byType(PurchaseStatusBadge), matching: find.text('Parsial')),
        findsOneWidget,
      );
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-005: Total/received/paid/outstanding render
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-005: Total/received/paid/outstanding render', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-fin',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/FIN',
          date: '2026-08-20',
          dueDate: '2026-09-03',
          supplierTerm: 'Tempo 14',
          status: 'sent',
          totalMinor: 2500000,
          receivedMinor: 1000000,
          paidMinor: 500000,
          outstandingMinor: 2000000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-fin', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Rp 2.500.000'), findsOneWidget); // Total
      expect(find.text('Rp 1.000.000'), findsOneWidget); // Received
      expect(find.text('Rp 500.000'), findsOneWidget); // Paid
      expect(find.text('Rp 2.000.000'), findsOneWidget); // Outstanding
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-006: Due date renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-006: Due date renders in list and detail', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-due',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/DUE',
          date: '2026-08-20',
          dueDate: '2026-09-30',
          supplierTerm: 'Tempo 30',
          status: 'sent',
          totalMinor: 1000000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('Jatuh Tempo: 2026-09-30'), findsOneWidget);

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-due', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('Jatuh Tempo'), findsOneWidget);
      expect(find.text('2026-09-30'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-007: Purchase detail renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-007: Purchase detail screen renders sections', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-detail',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          supplierName: 'PT Sinar Abadi',
          code: 'PO/DETAIL/01',
          date: '2026-08-20',
          dueDate: '2026-09-03',
          supplierTerm: 'Tempo 14',
          status: 'sent',
          totalMinor: 1200000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-detail', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Detail Pembelian'), findsOneWidget);
      expect(find.byKey(const Key('po_code_text')), findsOneWidget);
      expect(find.text('Progres Penerimaan Barang'), findsOneWidget);
      expect(find.textContaining('Daftar Barang'), findsOneWidget);
      expect(find.text('Ringkasan Keuangan'), findsOneWidget);
      expect(find.text('Riwayat Pembayaran'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-008: Line items render
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-008: Line items render product, unit cost and subtotal', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-items',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/ITEMS',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 600000,
          serverVersion: 1,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              purchaseId: 'po-items',
              productName: 'Beras Pandan Wangi 5kg',
              orderedQty: 10,
              receivedQty: 0,
              unitCostMinor: 60000,
              subtotalMinor: 600000,
            ),
          ],
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-items', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Beras Pandan Wangi 5kg'), findsOneWidget);
      expect(find.text('@ Rp 60.000'), findsOneWidget);
      expect(find.text('Rp 600.000'), findsNWidgets(2)); // subtotal + financial total
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-009: Ordered/received/remaining quantities render
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-009: Ordered/received/remaining quantities render', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-qty',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/QTY',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'partial',
          totalMinor: 1000000,
          serverVersion: 1,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              purchaseId: 'po-qty',
              productName: 'Minyak Goreng 2L',
              orderedQty: 20,
              receivedQty: 8,
              unitCostMinor: 50000,
              subtotalMinor: 1000000,
            ),
          ],
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-qty', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Pesan: 20 | Diterima: 8 | Sisa: 12'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-010: Receiving progress renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-010: Receiving progress renders received vs ordered', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-prog',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/PROG',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'partial',
          totalMinor: 1000000,
          serverVersion: 1,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              purchaseId: 'po-prog',
              productId: 'p-1',
              productName: 'Minyak Goreng 2L',
              orderedQty: 20,
              receivedQty: 10,
              unitCostMinor: 50000,
              subtotalMinor: 1000000,
            ),
          ],
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-prog', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('10 dari 20 item telah diterima'), findsOneWidget);
      expect(find.text('50%'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-011: Supplier term snapshot renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-011: Supplier term snapshot renders', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-term',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          supplierName: 'UD Makmur',
          code: 'PO/TERM',
          date: '2026-08-20',
          dueDate: '2026-09-19',
          supplierTerm: 'Tempo 30',
          status: 'draft',
          totalMinor: 800000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('Tempo 30'), findsOneWidget);

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-term', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('Term Pembayaran'), findsOneWidget);
      expect(find.text('Tempo 30'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-012: Online payment history renders
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-012: Online payment history renders audit rows', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-pay-online',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/PAY/ON',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'received',
          totalMinor: 400000,
          paidMinor: 400000,
          outstandingMinor: 0,
          serverVersion: 2,
        ),
        'biz-1',
      );

      final fakeApi = FakeSyncApiClient();

      await tester.pumpWidget(
        buildDetailApp(
          purchaseId: 'po-pay-online',
          businessId: 'biz-1',
          branchId: 'br-1',
          userRole: 'OWNER',
          isOnline: true,
          syncApiClient: fakeApi,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Transfer Bank'), findsOneWidget);
      expect(find.text('Ref: TRX-123'), findsOneWidget);
      expect(find.text('Rp 400.000'), findsNWidgets(3)); // Total, Paid, Payment history
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-013: Offline payment history placeholder
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-013: Offline placeholder without fabricated payments', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-pay-off',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/PAY/OFF',
          date: '2026-08-20',
          dueDate: '2026-09-03',
          supplierTerm: 'Tempo 14',
          status: 'received',
          totalMinor: 1000000,
          paidMinor: 500000,
          outstandingMinor: 500000,
          serverVersion: 2,
        ),
        'biz-1',
      );

      await tester.pumpWidget(
        buildDetailApp(
          purchaseId: 'po-pay-off',
          businessId: 'biz-1',
          branchId: 'br-1',
          userRole: 'OWNER',
          isOnline: false,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Riwayat pembayaran tersedia saat online.'), findsOneWidget);
      expect(find.text('Rp 500.000'), findsNWidgets(2)); // Paid and Outstanding still visible
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-014: Tenant isolation
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-014: Tenant isolation prevents cross-business leak', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-biz-a',
          businessId: 'biz-A',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/BIZ/A',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-A',
      );

      await seed(
        PurchaseDto(
          id: 'po-biz-b',
          businessId: 'biz-B',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/BIZ/B',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 200000,
          serverVersion: 1,
        ),
        'biz-B',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-A', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('PO/BIZ/A'), findsOneWidget);
      expect(find.text('PO/BIZ/B'), findsNothing);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-015: Branch isolation
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-015: Branch isolation prevents cross-branch leak', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-br-1',
          businessId: 'biz-1',
          branchId: 'branch-1',
          supplierId: 'sup-1',
          code: 'PO/BRANCH/1',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await seed(
        PurchaseDto(
          id: 'po-br-2',
          businessId: 'biz-1',
          branchId: 'branch-2',
          supplierId: 'sup-1',
          code: 'PO/BRANCH/2',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 200000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'branch-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('PO/BRANCH/1'), findsOneWidget);
      expect(find.text('PO/BRANCH/2'), findsNothing);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-016: Loading state
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-016: Loading state renders progress indicator', (tester) async {
      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-017: Empty state
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-017: Empty state renders informative message', (tester) async {
      await tester.pumpWidget(buildListApp(businessId: 'biz-empty', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Tidak ada data pembelian'), findsOneWidget);
      expect(find.text('Belum ada pesanan pembelian di cabang ini.'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-018: Error state
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-018: Error state renders retry button', (tester) async {
      await tester.pumpWidget(
        buildDetailApp(purchaseId: 'non-existent-po', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pesanan pembelian tidak ditemukan.'), findsOneWidget);
      expect(find.text('Coba Lagi'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-019: OWNER read access
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-019: OWNER has read access to purchase list', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-owner',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/OWNER/01',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();
      expect(find.text('PO/OWNER/01'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-020: CASHIER read access
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-020: CASHIER has read access to purchase list', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-cashier',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/CASHIER/01',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'CASHIER'));
      await tester.pumpAndSettle();
      expect(find.text('PO/CASHIER/01'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-021: No mutation actions (except Send for OWNER on draft)
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-021: Send available for OWNER on draft; receive/pay/cancel not implemented', (tester) async {
      final fakeApi = FakeSyncApiClient();
      await seed(
        PurchaseDto(
          id: 'po-nomut',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/NOMUT',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(
        purchaseId: 'po-nomut',
        businessId: 'biz-1',
        branchId: 'br-1',
        userRole: 'OWNER',
        syncApiClient: fakeApi,
      ));
      await tester.pumpAndSettle();

      // Send action IS available for OWNER on draft (Phase 9B.7.3A)
      expect(find.text('Kirim ke Supplier'), findsOneWidget);
      // But receive/pay/cancel are NOT implemented yet
      expect(find.text('Terima Barang (+ Stok)'), findsNothing);
      expect(find.text('Batalkan PO'), findsNothing);
      expect(find.text('Bayar Sekarang'), findsNothing);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-021b: CASHIER cannot see Send on draft
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-021b: CASHIER cannot see Send action on draft', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-nomut2',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/NOMUT2',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(
        purchaseId: 'po-nomut2',
        businessId: 'biz-1',
        branchId: 'br-1',
        userRole: 'CASHIER',
        syncApiClient: FakeSyncApiClient(),
      ));
      await tester.pumpAndSettle();

      // CASHIER cannot see Send action
      expect(find.text('Kirim ke Supplier'), findsNothing);
      expect(find.text('Terima Barang (+ Stok)'), findsNothing);
      expect(find.text('Batalkan PO'), findsNothing);
      expect(find.text('Bayar Sekarang'), findsNothing);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-022: No fake financial data
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-022: Financial numbers match canonical data exactly', (tester) async {
      const total = 1234567;
      const received = 765432;
      const paid = 500000;
      const outstanding = 734567;

      await seed(
        PurchaseDto(
          id: 'po-exact',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/EXACT',
          date: '2026-08-20',
          dueDate: '2026-09-03',
          supplierTerm: 'Tempo 14',
          status: 'sent',
          totalMinor: total,
          receivedMinor: received,
          paidMinor: paid,
          outstandingMinor: outstanding,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-exact', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Rp 1.234.567'), findsOneWidget);
      expect(find.text('Rp 765.432'), findsOneWidget);
      expect(find.text('Rp 500.000'), findsOneWidget);
      expect(find.text('Rp 734.567'), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-023: No direct inventory mutation
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-023: Rendering never mutates local inventory/products', (tester) async {
      await seed(
        PurchaseDto(
          id: 'po-no-inv',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/NO/INV',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildListApp(businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      final products = await db.select(db.productsLocal).get();
      expect(products, isEmpty);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-024: Tunai financial semantics
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-024: Tunai semantics outstanding = received - paid (backend authoritative)', (tester) async {
      // Canonical: Tunai outstanding = receivedMinor - paidMinor
      const total = 1000000;
      const received = 750000;
      const paid = 500000;
      const outstanding = 250000; // 750000 - 500000

      await seed(
        PurchaseDto(
          id: 'po-tunai',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/TUNAI',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'received',
          totalMinor: total,
          receivedMinor: received,
          paidMinor: paid,
          outstandingMinor: outstanding,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-tunai', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Tunai'), findsOneWidget);
      expect(find.text('Rp 750.000'), findsOneWidget); // received
      expect(find.text('Rp 500.000'), findsOneWidget); // paid
      expect(find.text('Rp 250.000'), findsOneWidget); // outstanding (received - paid)
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-UI-025: Tempo financial semantics
    // -----------------------------------------------------------------------
    testWidgets('MOBILE-PURCHASE-UI-025: Tempo semantics outstanding = total - paid (backend authoritative)', (tester) async {
      // Canonical: Tempo outstanding = totalMinor - paidMinor
      const total = 1000000;
      const received = 200000;
      const paid = 400000;
      const outstanding = 600000; // 1000000 - 400000

      await seed(
        PurchaseDto(
          id: 'po-tempo',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'PO/TEMPO',
          date: '2026-08-20',
          dueDate: '2026-09-19',
          supplierTerm: 'Tempo 30',
          status: 'partial',
          totalMinor: total,
          receivedMinor: received,
          paidMinor: paid,
          outstandingMinor: outstanding,
          serverVersion: 1,
        ),
        'biz-1',
      );

      await tester.pumpWidget(buildDetailApp(purchaseId: 'po-tempo', businessId: 'biz-1', branchId: 'br-1', userRole: 'OWNER'));
      await tester.pumpAndSettle();

      expect(find.text('Tempo 30'), findsOneWidget);
      expect(find.text('Rp 1.000.000'), findsOneWidget); // total
      expect(find.text('Rp 400.000'), findsOneWidget); // paid
      expect(find.text('Rp 600.000'), findsOneWidget); // outstanding (total - paid)
    });
  });
}
