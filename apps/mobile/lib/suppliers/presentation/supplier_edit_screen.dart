import 'package:uuid/uuid.dart';
import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

class SupplierEditScreen extends StatefulWidget {
  final String businessId;
  final String? supplierId;
  final SupplierRepository supplierRepo;
  final SyncOutboxRepository outboxRepo;

  const SupplierEditScreen({
    super.key,
    required this.businessId,
    required this.supplierId,
    required this.supplierRepo,
    required this.outboxRepo,
  });

  @override
  State<SupplierEditScreen> createState() => _SupplierEditScreenState();
}

class _SupplierEditScreenState extends State<SupplierEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  String _term = 'tunai';
  bool _isActive = true;

  Supplier? _original;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    if (widget.supplierId == null) {
      _original = Supplier(
        id: const Uuid().v4(),
        businessId: widget.businessId,
        name: '',
        code: null,
        contact: null,
        phone: null,
        email: null,
        category: '',
        term: 'tunai',
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
    _codeCtrl.dispose();
    _contactCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _categoryCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.supplierId == null) return;
    try {
      final s = await widget.supplierRepo.getSupplierById(
        widget.supplierId!,
        widget.businessId,
      );
      if (!mounted) return;
      if (s == null) {
        setState(() => _loadError = 'Supplier tidak ditemukan');
        return;
      }
      setState(() {
        _original = s;
        _nameCtrl.text = s.name;
        _codeCtrl.text = s.code ?? '';
        _contactCtrl.text = s.contact ?? '';
        _phoneCtrl.text = s.phone ?? '';
        _emailCtrl.text = s.email ?? '';
        _categoryCtrl.text = s.category;
        _term = s.term;
        _isActive = s.isActive;
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
        _codeCtrl.text != (_original!.code ?? '') ||
        _contactCtrl.text != (_original!.contact ?? '') ||
        _phoneCtrl.text != (_original!.phone ?? '') ||
        _emailCtrl.text != (_original!.email ?? '') ||
        _categoryCtrl.text != _original!.category ||
        _term != _original!.term ||
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

    final updated = Supplier(
      id: _original!.id,
      businessId: _original!.businessId,
      name: _nameCtrl.text.trim(),
      code: _codeCtrl.text.trim().isEmpty ? null : _codeCtrl.text.trim(),
      contact: _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
      category: _categoryCtrl.text.trim(),
      term: _term,
      isActive: _isActive,
      serverVersion: _original!.serverVersion,
      createdAt: _original!.createdAt,
      updatedAt: DateTime.now().millisecondsSinceEpoch,
      deletedAt: _original!.deletedAt,
      lastSyncedAt: _original!.lastSyncedAt,
      localStatus: 'dirty',
    );

    try {
      if (widget.supplierId == null) {
        await widget.supplierRepo.createSupplier(updated, widget.outboxRepo);
      } else {
        await widget.supplierRepo.updateSupplier(updated, widget.outboxRepo);
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
          title: Text(widget.supplierId == null ? 'Tambah Supplier' : 'Edit Supplier'),
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
              Text('Gagal memuat supplier', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(_loadError!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }
    final o = _original!;
    final termItems = [
      const DropdownMenuItem(value: 'tunai', child: Text('Tunai')),
      const DropdownMenuItem(value: 'tempo_14', child: Text('Tempo 14')),
      const DropdownMenuItem(value: 'tempo_30', child: Text('Tempo 30')),
    ];
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _nameCtrl,
            decoration: InputDecoration(
              labelText: 'Nama Supplier *',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.local_shipping),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 100,
            textCapitalization: TextCapitalization.words,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Nama supplier wajib diisi';
              return null;
            },
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _codeCtrl,
            decoration: InputDecoration(
              labelText: 'Kode Supplier',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.qr_code),
              hintText: 'Opsional',
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 20,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _contactCtrl,
            decoration: InputDecoration(
              labelText: 'Nama Kontak',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.person),
              hintText: 'Opsional',
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 100,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _phoneCtrl,
            decoration: InputDecoration(
              labelText: 'No. Telepon',
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
              labelText: 'Email Order',
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
          TextFormField(
            controller: _categoryCtrl,
            decoration: InputDecoration(
              labelText: 'Kategori Pasokan',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              prefixIcon: const Icon(Icons.category),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            maxLength: 50,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _term.isEmpty ? 'tunai' : _term,
            decoration: InputDecoration(
              labelText: 'Termin Pembayaran',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
              ),
              filled: true,
              fillColor: Colors.grey[50],
            ),
            items: termItems,
            onChanged: (v) => setState(() => _term = v ?? 'tunai'),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Supplier Aktif'),
            subtitle: Text(_isActive ? 'Ditampilkan dalam pencarian' : 'Disembunyikan dari pencarian'),
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
