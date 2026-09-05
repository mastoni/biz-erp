import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/receivables/data/receivable_repository.dart';
import 'package:biz_erp_mobile/receivables/domain/receivable.dart';

class PaymentCollectionDialog extends StatefulWidget {
  final Receivable receivable;
  final ReceivableRepository receivableRepo;
  final String userRole;

  const PaymentCollectionDialog({
    super.key,
    required this.receivable,
    required this.receivableRepo,
    required this.userRole,
  });

  @override
  State<PaymentCollectionDialog> createState() => _PaymentCollectionDialogState();
}

class _PaymentCollectionDialogState extends State<PaymentCollectionDialog> {
  final _amountController = TextEditingController();
  final _refController = TextEditingController();

  String _selectedMethod = 'cash';
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Default to full outstanding balance
    _amountController.text = (widget.receivable.outstandingMinor).toString();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _refController.dispose();
    super.dispose();
  }

  int get _parsedAmount {
    return int.tryParse(_amountController.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
  }

  Future<void> _submitPayment() async {
    if (widget.userRole.toUpperCase() != 'OWNER') {
      setState(() {
        _errorMessage = 'Hanya OWNER yang memiliki izin untuk memproses pembayaran piutang.';
      });
      return;
    }

    final amount = _parsedAmount;
    if (amount <= 0) {
      setState(() {
        _errorMessage = 'Nominal pembayaran harus lebih dari 0.';
      });
      return;
    }

    if (amount > widget.receivable.outstandingMinor) {
      setState(() {
        _errorMessage = 'Nominal pembayaran tidak boleh melebihi sisa tagihan (${CurrencyFormatter.formatIDR(widget.receivable.outstandingMinor)}).';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final result = await widget.receivableRepo.collectPayment(
        receivableId: widget.receivable.id,
        amountMinor: amount,
        method: _selectedMethod,
        customerId: widget.receivable.customerId,
        reference: _refController.text.trim().isNotEmpty ? _refController.text.trim() : null,
      );

      if (mounted) {
        Navigator.of(context).pop(result);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final receivable = widget.receivable;
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Title
              Row(
                children: [
                  const Icon(Icons.payment, color: Color(0xFF1565C0)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Terima Pembayaran Piutang',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 16),

              // Outstanding Info
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F9FF),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBBDEFB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Pelanggan:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(
                          receivable.customerName ?? 'Pelanggan #${receivable.customerId.length > 8 ? receivable.customerId.substring(0, 8) : receivable.customerId}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Sisa Tagihan:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(
                          CurrencyFormatter.formatIDR(receivable.outstandingMinor),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFC62828),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              if (!isOwner) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFFCDD2)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.lock, color: Colors.red, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Hanya akun dengan role OWNER yang dapat memproses pembayaran piutang.',
                          style: TextStyle(color: Colors.red, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Amount Input
              const Text('Jumlah Pembayaran (Rp)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                enabled: !_isSubmitting && isOwner,
                decoration: InputDecoration(
                  prefixText: 'Rp ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),

              // Quick Amount Buttons
              if (isOwner)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isSubmitting
                            ? null
                            : () {
                                _amountController.text = receivable.outstandingMinor.toString();
                                setState(() {});
                              },
                        child: const Text('Bayar Lunas', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isSubmitting
                            ? null
                            : () {
                                final half = (receivable.outstandingMinor / 2).round();
                                _amountController.text = half.toString();
                                setState(() {});
                              },
                        child: const Text('50%', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),

              // Payment Method
              const Text('Metode Pembayaran', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedMethod,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Tunai (Cash)')),
                  DropdownMenuItem(value: 'bank_transfer', child: Text('Transfer Bank')),
                  DropdownMenuItem(value: 'debit', child: Text('Kartu Debit')),
                  DropdownMenuItem(value: 'credit', child: Text('Kartu Kredit')),
                ],
                onChanged: (isOwner && !_isSubmitting)
                    ? (val) {
                        if (val != null) setState(() => _selectedMethod = val);
                      }
                    : null,
              ),
              const SizedBox(height: 12),

              // Reference / Note
              const Text('Referensi / Catatan (Opsional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              TextField(
                controller: _refController,
                enabled: !_isSubmitting && isOwner,
                decoration: InputDecoration(
                  hintText: 'Misal: Bukti transfer BCA #1234',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),

              // Error banner
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red, fontSize: 12),
                  ),
                ),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                      child: const Text('Batal'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1565C0),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: (isOwner && !_isSubmitting) ? _submitPayment : null,
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Simpan Pembayaran', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
