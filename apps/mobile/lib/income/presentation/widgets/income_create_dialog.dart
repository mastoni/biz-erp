import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:biz_erp_mobile/income/data/income_repository.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';

/// Daftar kategori pendapatan operasional standar.
const List<String> kIncomeCategories = [
  'Penjualan Non-POS',
  'Jasa & Servis',
  'Komisi & Fee',
  'Sewa & Titipan',
  'Pendapatan Bunga',
  'Hasil Penjualan Aset/Afkir',
  'Lainnya',
];

/// Opsi metode pembayaran.
const Map<String, String> kIncomePaymentMethods = {
  'cash': 'Tunai',
  'bank_transfer': 'Transfer Bank',
  'debit': 'Kartu Debit',
  'credit': 'Kartu Kredit',
};

class IncomeCreateDialog extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final IncomeRepository incomeRepo;
  final String userRole;

  const IncomeCreateDialog({
    super.key,
    required this.businessId,
    this.branchId,
    required this.incomeRepo,
    required this.userRole,
  });

  @override
  State<IncomeCreateDialog> createState() => _IncomeCreateDialogState();
}

class _IncomeCreateDialogState extends State<IncomeCreateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _referenceController = TextEditingController();
  final _dateController = TextEditingController();

  String _selectedCategory = kIncomeCategories.first;
  String _selectedMethod = 'cash';
  DateTime _selectedDate = DateTime.now();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _dateController.text = _formatDateIso(_selectedDate);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    _referenceController.dispose();
    _dateController.dispose();
    super.dispose();
  }

  String _formatDateIso(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  int _parseAmountMinor(String rawText) {
    final clean = rawText.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.isEmpty) return 0;
    return int.tryParse(clean) ?? 0;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _dateController.text = _formatDateIso(picked);
      });
    }
  }

  Future<void> _submit() async {
    if (widget.userRole.toUpperCase() != 'OWNER') {
      setState(() {
        _errorMessage = 'Hanya OWNER yang diizinkan mencatat pendapatan';
      });
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    final amountMinor = _parseAmountMinor(_amountController.text);
    if (amountMinor <= 0) {
      setState(() {
        _errorMessage = 'Nominal harus lebih besar dari Rp 0';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final created = await widget.incomeRepo.createIncomeOnline(
        businessId: widget.businessId,
        branchId: widget.branchId,
        date: _dateController.text.trim(),
        amountMinor: amountMinor,
        method: _selectedMethod,
        category: _selectedCategory,
        reference: _referenceController.text.trim().isEmpty
            ? null
            : _referenceController.text.trim(),
        description: _descriptionController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop(created);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().contains('SocketException') ||
                  e.toString().contains('Network error')
              ? 'Gagal terhubung ke server. Pencatatan pendapatan memerlukan koneksi online.'
              : 'Gagal mencatat pendapatan: ${e.toString().replaceAll('Exception: ', '').replaceAll('HttpException: ', '')}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';

    if (!isOwner) {
      return AlertDialog(
        title: const Text('Akses Ditolak'),
        content: const Text('Hanya pengguna dengan peran OWNER yang dapat mencatat pendapatan operasional.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Tutup'),
          ),
        ],
      );
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        padding: const EdgeInsets.all(20),
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Catat Pendapatan',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const Divider(),
                const SizedBox(height: 8),

                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Nominal
                TextFormField(
                  controller: _amountController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(
                    labelText: 'Nominal (Rp) *',
                    hintText: 'Contoh: 150000',
                    prefixText: 'Rp ',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (val) {
                    final minor = _parseAmountMinor(val);
                    if (minor > 0 && mounted) {
                      setState(() {});
                    }
                  },
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Nominal wajib diisi';
                    }
                    if (_parseAmountMinor(val) <= 0) {
                      return 'Nominal harus lebih dari 0';
                    }
                    return null;
                  },
                ),
                if (_amountController.text.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 4),
                    child: Text(
                      CurrencyFormatter.formatIDR(_parseAmountMinor(_amountController.text)),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.teal.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                const SizedBox(height: 14),

                // Kategori
                DropdownButtonFormField<String>(
                  initialValue: _selectedCategory,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Kategori *',
                    border: OutlineInputBorder(),
                  ),
                  items: kIncomeCategories.map((c) {
                    return DropdownMenuItem(
                      value: c,
                      child: Text(
                        c,
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _selectedCategory = val);
                    }
                  },
                ),
                const SizedBox(height: 14),

                // Metode Pembayaran
                DropdownButtonFormField<String>(
                  initialValue: _selectedMethod,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Metode Pembayaran *',
                    border: OutlineInputBorder(),
                  ),
                  items: kIncomePaymentMethods.entries.map((e) {
                    return DropdownMenuItem(
                      value: e.key,
                      child: Text(
                        e.value,
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _selectedMethod = val);
                    }
                  },
                ),
                const SizedBox(height: 14),

                // Tanggal
                TextFormField(
                  controller: _dateController,
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Tanggal *',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.calendar_today),
                      onPressed: _pickDate,
                    ),
                  ),
                  onTap: _pickDate,
                  validator: (val) => val == null || val.trim().isEmpty ? 'Tanggal wajib diisi' : null,
                ),
                const SizedBox(height: 14),

                // Referensi (opsional)
                TextFormField(
                  controller: _referenceController,
                  decoration: const InputDecoration(
                    labelText: 'Referensi (Opsional)',
                    hintText: 'Contoh: INV-SVC-001',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),

                // Keterangan
                TextFormField(
                  controller: _descriptionController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Keterangan *',
                    hintText: 'Contoh: Jasa servis perbaikan mesin',
                    border: OutlineInputBorder(),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty ? 'Keterangan wajib diisi' : null,
                ),
                const SizedBox(height: 20),

                // Actions
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                      child: const Text('Batal'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D9488),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _isSubmitting ? null : _submit,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Icon(Icons.check, size: 18),
                      label: Text(_isSubmitting ? 'Menyimpan...' : 'Simpan'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
