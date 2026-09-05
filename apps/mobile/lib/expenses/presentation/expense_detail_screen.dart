import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/printer_selector_sheet.dart';
import 'package:biz_erp_mobile/expenses/data/expense_repository.dart';
import 'package:biz_erp_mobile/expenses/domain/expense.dart';

class ExpenseDetailScreen extends StatefulWidget {
  final String expenseId;
  final String businessId;
  final String? businessName;
  final String? branchName;
  final ExpenseRepository expenseRepo;
  final PrintingService? printingService;
  final String userRole;

  const ExpenseDetailScreen({
    super.key,
    required this.expenseId,
    required this.businessId,
    this.businessName,
    this.branchName,
    required this.expenseRepo,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<ExpenseDetailScreen> createState() => _ExpenseDetailScreenState();
}

class _ExpenseDetailScreenState extends State<ExpenseDetailScreen> {
  Expense? _expense;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isPrinting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final exp = await widget.expenseRepo.getExpenseById(widget.expenseId);

      if (exp == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Data pengeluaran tidak ditemukan.';
        });
        return;
      }

      if (mounted) {
        setState(() {
          _expense = exp;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Gagal memuat data pengeluaran: $e';
        });
      }
    }
  }

  Future<void> _printVoucher() async {
    final printingService = widget.printingService;
    if (printingService == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Layanan printer belum tersedia')),
      );
      return;
    }

    if (printingService.status != PrinterStatus.connected) {
      final selected = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (_) => PrinterSelectorSheet(printingService: printingService),
      );

      if (selected != true || printingService.status != PrinterStatus.connected) {
        return;
      }
    }

    final exp = _expense;
    if (exp == null) return;

    setState(() => _isPrinting = true);

    try {
      final dt = DateTime.tryParse(exp.createdAt) ?? DateTime.now();
      final expIdShort = exp.id.length > 8 ? exp.id.substring(0, 8) : exp.id;
      final receiptData = ReceiptData(
        receiptNumber: 'EXP-${expIdShort.toUpperCase()}',
        businessName: widget.businessName ?? 'BIZ-ERP',
        branchName: widget.branchName ?? 'Cabang',
        cashierId: widget.userRole,
        createdAtEpochMs: dt.millisecondsSinceEpoch,
        subtotalMinor: exp.amountMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: exp.amountMinor,
        cashReceivedMinor: exp.amountMinor,
        changeMinor: 0,
        items: [
          ReceiptItemData(
            productId: 'EXPENSE-ITEM',
            displayName: '${exp.category ?? 'Operasional'}: ${exp.description}',
            quantity: 1,
            unitPriceMinor: exp.amountMinor,
          ),
        ],
      );

      await printingService.printReceipt(receiptData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voucher pengeluaran berhasil dicetak'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mencetak voucher: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPrinting = false);
    }
  }

  String _formatMethod(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Kas Tunai (Cash)';
      case 'bank_transfer':
        return 'Transfer Bank';
      case 'debit':
        return 'Kartu Debit';
      case 'credit':
        return 'Kartu Kredit';
      default:
        return method.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final exp = _expense;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Pengeluaran'),
        backgroundColor: const Color(0xFFC62828),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadData,
          ),
          if (widget.printingService != null && exp != null)
            IconButton(
              icon: const Icon(Icons.print),
              tooltip: 'Cetak Voucher',
              onPressed: _isPrinting ? null : _printVoucher,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadData,
                          child: const Text('Coba Lagi'),
                        ),
                      ],
                    ),
                  ),
                )
              : exp == null
                  ? const Center(child: Text('Data tidak ditemukan'))
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // 1. Header Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        exp.reference ??
                                            'EXP-${(exp.id.length > 8 ? exp.id.substring(0, 8) : exp.id).toUpperCase()}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFFC62828),
                                        ),
                                      ),
                                      _buildStatusBadge(exp.status),
                                    ],
                                  ),
                                  const Divider(height: 20),
                                  _buildInfoRow('Kategori', exp.category ?? 'Operasional'),
                                  _buildInfoRow('Tanggal Transaksi', exp.date),
                                  _buildInfoRow('Metode Pembayaran', _formatMethod(exp.method)),
                                  if (exp.reference != null && exp.reference!.isNotEmpty)
                                    _buildInfoRow('No. Referensi / Nota', exp.reference!),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 2. Nominal Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Nominal Pengeluaran',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    CurrencyFormatter.formatIDR(exp.amountMinor),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 24,
                                      color: Color(0xFFC62828),
                                    ),
                                  ),
                                  const Divider(height: 24),
                                  const Text(
                                    'Keterangan:',
                                    style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    exp.description.isNotEmpty ? exp.description : '—',
                                    style: const TextStyle(fontSize: 14, height: 1.4),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 3. Technical & Audit Metadata Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Informasi Audit Server',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  const SizedBox(height: 12),
                                  _buildInfoRow('ID Pengeluaran', exp.id),
                                  _buildInfoRow('Server Version', exp.serverVersion.toString()),
                                  if (exp.createdAt.isNotEmpty)
                                    _buildInfoRow('Dibuat Pada', exp.createdAt.replaceAll('T', ' ').split('.').first),
                                  if (exp.updatedAt.isNotEmpty)
                                    _buildInfoRow('Diperbarui Pada', exp.updatedAt.replaceAll('T', ' ').split('.').first),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 80),
                        ],
                      ),
                    ),
      bottomNavigationBar: (exp != null && widget.printingService != null)
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x0D000000),
                    offset: Offset(0, -2),
                    blurRadius: 6,
                  ),
                ],
              ),
              child: SafeArea(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC62828),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.print),
                  label: const Text(
                    'Cetak Voucher Pengeluaran',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  onPressed: _isPrinting ? null : _printVoucher,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color text;
    String label;

    switch (status.toLowerCase()) {
      case 'draft':
        bg = const Color(0xFFFFF3E0);
        text = const Color(0xFFE65100);
        label = 'DRAFT';
        break;
      case 'posted':
        bg = const Color(0xFFE8F5E9);
        text = const Color(0xFF2E7D32);
        label = 'POSTED';
        break;
      case 'reversed':
        bg = const Color(0xFFECEFF1);
        text = const Color(0xFF546E7A);
        label = 'DIBATALKAN';
        break;
      default:
        bg = const Color(0xFFF5F5F5);
        text = Colors.grey;
        label = status.toUpperCase();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }
}
