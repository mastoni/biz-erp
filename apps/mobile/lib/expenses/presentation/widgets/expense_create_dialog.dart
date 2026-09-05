import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/expenses/data/expense_repository.dart';

const List<String> kExpenseCategories = [
  'Operasional',
  'Utilitas',
  'Gaji Karyawan',
  'Sewa Tempat',
  'Plastik & Kemasan',
  'Perbaikan & Servis',
  'Lainnya',
];

class ExpenseCreateDialog extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final ExpenseRepository expenseRepo;
  final String userRole;

  const ExpenseCreateDialog({
    super.key,
    required this.businessId,
    this.branchId,
    required this.expenseRepo,
    this.userRole = 'CASHIER',
  });

  @override
  State<ExpenseCreateDialog> createState() => _ExpenseCreateDialogState();
}

class _ExpenseCreateDialogState extends State<ExpenseCreateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _referenceController = TextEditingController();

  String _selectedCategory = kExpenseCategories.first;
  String _selectedMethod = 'cash';
  late String _date;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date =
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';
    if (!isOwner) {
      setState(() => _errorMessage = 'Hanya Owner yang dapat mencatat pengeluaran operasional.');
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    final rawAmountText = _amountController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final amountMinor = int.tryParse(rawAmountText) ?? 0;

    if (amountMinor <= 0) {
      setState(() => _errorMessage = 'Nominal harus lebih besar dari 0.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final created = await widget.expenseRepo.createExpenseOnline(
        businessId: widget.businessId,
        branchId: widget.branchId,
        date: _date,
        amountMinor: amountMinor,
        method: _selectedMethod,
        category: _selectedCategory,
        reference: _referenceController.text.trim().isNotEmpty ? _referenceController.text.trim() : null,
        description: _descriptionController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop(created);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Gagal menyimpan pengeluaran: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Catat Pengeluaran',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFC62828),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const Text(
                    'Catat pengeluaran operasional toko secara online ke server ERP.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),

                  if (!isOwner)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFEF9A9A)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.lock, size: 18, color: Color(0xFFC62828)),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Akses Dibatasi: Hanya role OWNER yang berwenang mencatat pengeluaran toko.',
                              style: TextStyle(fontSize: 12, color: Color(0xFFC62828)),
                            ),
                          ),
                        ],
                      ),
                    ),

                  if (_errorMessage != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFEF9A9A)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(fontSize: 12, color: Color(0xFFC62828)),
                      ),
                    ),

                  // Keterangan / Deskripsi
                  const Text('Keterangan Pengeluaran *', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _descriptionController,
                    enabled: isOwner && !_isSubmitting,
                    decoration: InputDecoration(
                      hintText: 'cth: Listrik & Air toko, Pembelian ATK',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Keterangan pengeluaran wajib diisi';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  // Nominal (Rp)
                  const Text('Nominal (Rp) *', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _amountController,
                    enabled: isOwner && !_isSubmitting,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    decoration: InputDecoration(
                      prefixText: 'Rp ',
                      hintText: '0',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (val) {
                      final raw = val.replaceAll(RegExp(r'[^0-9]'), '');
                      if (raw.isNotEmpty) {
                        final parsed = int.tryParse(raw);
                        if (parsed != null) {
                          final formatted = CurrencyFormatter.formatIDR(parsed).replaceAll('Rp ', '');
                          if (formatted != val) {
                            _amountController.value = TextEditingValue(
                              text: formatted,
                              selection: TextSelection.collapsed(offset: formatted.length),
                            );
                          }
                        }
                      }
                    },
                    validator: (val) {
                      if (val == null || val.isEmpty) {
                        return 'Nominal wajib diisi';
                      }
                      final raw = val.replaceAll(RegExp(r'[^0-9]'), '');
                      final num = int.tryParse(raw) ?? 0;
                      if (num <= 0) {
                        return 'Nominal harus lebih dari 0';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  // Kategori & Metode Row
                  Row(
                    children: [
                      // Kategori
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Kategori', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedCategory,
                              isExpanded: true,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              items: kExpenseCategories
                                  .map((c) => DropdownMenuItem(
                                        value: c,
                                        child: Text(c, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
                                      ))
                                  .toList(),
                              onChanged: (isOwner && !_isSubmitting)
                                  ? (val) {
                                      if (val != null) setState(() => _selectedCategory = val);
                                    }
                                  : null,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Metode
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Metode', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedMethod,
                              isExpanded: true,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'cash', child: Text('Kas Tunai', style: TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                                DropdownMenuItem(value: 'bank_transfer', child: Text('Transfer Bank', style: TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                                DropdownMenuItem(value: 'debit', child: Text('Kartu Debit', style: TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                                DropdownMenuItem(value: 'credit', child: Text('Kartu Kredit', style: TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                              ],
                              onChanged: (isOwner && !_isSubmitting)
                                  ? (val) {
                                      if (val != null) setState(() => _selectedMethod = val);
                                    }
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Tanggal & Referensi
                  Row(
                    children: [
                      // Tanggal
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Tanggal', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 6),
                            TextFormField(
                              initialValue: _date,
                              enabled: isOwner && !_isSubmitting,
                              decoration: InputDecoration(
                                hintText: 'YYYY-MM-DD',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                              ),
                              onChanged: (val) => _date = val.trim(),
                              validator: (val) {
                                if (val == null || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(val)) {
                                  return 'Format YYYY-MM-DD';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Referensi
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Ref / No. Nota', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _referenceController,
                              enabled: isOwner && !_isSubmitting,
                              decoration: InputDecoration(
                                hintText: 'Opsional',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Actions
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Batal'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: (isOwner && !_isSubmitting) ? _submit : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFC62828),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _isSubmitting
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Simpan Pengeluaran', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
