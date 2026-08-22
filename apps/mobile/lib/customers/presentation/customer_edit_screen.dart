import 'package:uuid/uuid.dart';
import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

class CustomerEditScreen extends StatefulWidget {
  final String businessId;
  final String? customerId;
  final CustomerRepository customerRepo;
  final SyncOutboxRepository outboxRepo;

  const CustomerEditScreen({
    super.key,
    required this.businessId,
    required this.customerId,
    required this.customerRepo,
    required this.outboxRepo,
  });

  @override
  State<CustomerEditScreen> createState() => _CustomerEditScreenState();
}

class _CustomerEditScreenState extends State<CustomerEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _isActive = true;

  Customer? _original;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    if (widget.customerId == null) {
      _original = Customer(
        id: const Uuid().v4(),
        businessId: widget.businessId,
        name: '',
        phone: null,
        email: null,
        isActive: true,
        serverVersion: 0,
        localStatus: 'dirty',
      );
      _isActive = true;
      _isLoading = false;
    } else {
      _load();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.customerId == null) return;
    try {
      final c = await widget.customerRepo.getCustomerById(
        widget.customerId!,
        widget.businessId,
      );
      if (!mounted) return;
      if (c == null) {
        setState(() => _loadError = 'Pelanggan tidak ditemukan');
        return;
      }
      setState(() {
        _original = c;
        _nameCtrl.text = c.name;
        _phoneCtrl.text = c.phone ?? '';
        _emailCtrl.text = c.email ?? '';
        _isActive = c.isActive;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.toString());
    }
  }

  bool get _hasChanges {
    if (_original == null) return false;
    return _nameCtrl.text != _original!.name ||
        _phoneCtrl.text != (_original!.phone ?? '') ||
        _emailCtrl.text != (_original!.email ?? '') ||
        _isActive != _original!.isActive;
  }

  Future<bool> _onWillPop() async {
    if (!_hasChanges) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Perubahan belum disimpan'),
        content: const Text('Perubahan yang Anda buat akan hilang jika keluar sekarang.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tinggalkan', style: TextStyle(color: Color(0xFFC0392B))),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_original == null) return;

    setState(() => _isSaving = true);

    final updated = Customer(
      id: _original!.id,
      businessId: _original!.businessId,
      name: _nameCtrl.text.trim(),
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
      isActive: _isActive,
      serverVersion: _original!.serverVersion,
      lastSyncedAt: _original!.lastSyncedAt,
      localStatus: 'dirty',
    );

    try {
      if (widget.customerId == null) {
        await widget.customerRepo.createCustomer(updated, widget.outboxRepo);
      } else {
        await widget.customerRepo.updateCustomer(updated, widget.outboxRepo);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perubahan disimpan. Menunggu sinkronisasi.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } on ArgumentError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal menyimpan: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.customerId == null ? 'Tambah Pelanggan' : 'Edit Pelanggan'),
          backgroundColor: const Color(0xFF1A1A2E),
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && context.mounted) Navigator.pop(context);
            },
          ),
          actions: [
            if (!_isLoading && _loadError == null)
              TextButton.icon(
                onPressed: _isSaving || !_hasChanges ? null : _save,
                icon: const Icon(Icons.save, color: Colors.white),
                label: const Text('Simpan', style: TextStyle(color: Colors.white)),
              ),
          ],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFE6A017)));
    }
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text('Gagal memuat pelanggan', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(_loadError!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }
    final o = _original!;
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _nameCtrl,
            decoration: InputDecoration(
              labelText: 'Nama Pelanggan *',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.person),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 100,
            textCapitalization: TextCapitalization.words,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Nama pelanggan wajib diisi';
              return null;
            },
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _phoneCtrl,
            decoration: InputDecoration(
              labelText: 'Nomor Telepon',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.phone),
              hintText: 'Opsional',
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 20,
            keyboardType: TextInputType.phone,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _emailCtrl,
            decoration: InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.email),
              hintText: 'Opsional',
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 100,
            keyboardType: TextInputType.emailAddress,
            validator: (v) {
              if (v != null && v.trim().isNotEmpty) {
                final email = v.trim();
                if (!email.contains('@') || !email.contains('.')) {
                  return 'Format email tidak valid';
                }
              }
              return null;
            },
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Pelanggan Aktif'),
            subtitle: Text(_isActive ? 'Ditampilkan di POS' : 'Disembunyikan dari POS'),
            value: _isActive,
            onChanged: (v) => setState(() => _isActive = v),
            activeThumbColor: const Color(0xFFE6A017),
            contentPadding: EdgeInsets.zero,
          ),
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),
          Text(
            'Info Sinkronisasi',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          _InfoRow(label: 'Versi Lokal', value: '${o.serverVersion}'),
          _InfoRow(
            label: 'Status',
            value: o.isDirty ? 'Belum tersinkron' : 'Tersinkron',
            valueColor: o.isDirty ? Colors.orange : Colors.green[700],
          ),
          if (o.lastSyncedAt != null)
            _InfoRow(
              label: 'Terakhir Sync',
              value: DateTime.fromMillisecondsSinceEpoch(o.lastSyncedAt!).toString().substring(0, 19),
            ),
          if (o.isDirty)
            _InfoRow(
              label: 'Catatan',
              value: 'Data ini akan dikirim ke server saat online',
              valueColor: Colors.blue[700],
            ),
          if (_isSaving)
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Center(child: CircularProgressIndicator(color: Color(0xFFE6A017))),
            ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _InfoRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: TextStyle(color: valueColor ?? const Color(0xFF1A1A2E), fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}