import 'package:uuid/uuid.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

class ProductEditScreen extends StatefulWidget {
  final String? productId;
  final ProductRepository productRepo;
  final SyncOutboxRepository outboxRepo;

  const ProductEditScreen({
    super.key,
    required this.productId,
    required this.productRepo,
    required this.outboxRepo,
  });

  @override
  State<ProductEditScreen> createState() => _ProductEditScreenState();
}

class _ProductEditScreenState extends State<ProductEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _barcodeCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _isActive = true;

  Product? _original;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    if (widget.productId == null) {
      _original = Product(id: const Uuid().v4(), businessId: DemoContext.businessId, name: '', priceMinor: 0, isActive: true, serverVersion: 0, localStatus: 'dirty');
      _isActive = true;
      _isLoading = false;
    } else {
      _load();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _barcodeCtrl.dispose();
    _categoryCtrl.dispose();
    _priceCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (widget.productId == null) return;
    try {
      final p = await widget.productRepo.getProductById(
        widget.productId!,
        DemoContext.businessId,
      );
      if (!mounted) return;
      if (p == null) {
        setState(() => _loadError = 'Produk tidak ditemukan');
        return;
      }
      setState(() {
        _original = p;
        _nameCtrl.text = p.name;
        _barcodeCtrl.text = p.barcode ?? '';
        _categoryCtrl.text = p.category ?? '';
        _priceCtrl.text = p.priceMinor.toString();
        _descCtrl.text = p.description ?? '';
        _isActive = p.isActive;
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
        _barcodeCtrl.text != (_original!.barcode ?? '') ||
        _categoryCtrl.text != (_original!.category ?? '') ||
        _priceCtrl.text != _original!.priceMinor.toString() ||
        _descCtrl.text != (_original!.description ?? '') ||
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
            child: const Text('Tinggalkan'),
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

    final price = int.tryParse(_priceCtrl.text.trim()) ?? 0;

    final updated = Product(
      id: _original!.id,
      businessId: _original!.businessId,
      name: _nameCtrl.text.trim(),
      description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
      priceMinor: price,
      category: _categoryCtrl.text.trim().isEmpty ? null : _categoryCtrl.text.trim(),
      isActive: _isActive,
      serverVersion: _original!.serverVersion,
      lastSyncedAt: _original!.lastSyncedAt,
      barcode: _barcodeCtrl.text.trim().isEmpty ? null : _barcodeCtrl.text.trim(),
      localStatus: 'dirty',
    );

    try {
      if (widget.productId == null) {
        final newP = Product(id: _original!.id, businessId: _original!.businessId, name: updated.name, description: updated.description, priceMinor: updated.priceMinor, category: updated.category, isActive: updated.isActive, serverVersion: 0, barcode: updated.barcode, localStatus: 'dirty');
        await widget.productRepo.createProduct(newP, widget.outboxRepo);
      } else {
        await widget.productRepo.updateProduct(updated, widget.outboxRepo);
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
      onPopInvoked: (didPop) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.productId == null ? 'Produk Baru' : 'Edit Produk'),
          backgroundColor: Colors.blueGrey[800],
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
      return const Center(child: CircularProgressIndicator());
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
              Text('Gagal memuat produk'),
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
            decoration: const InputDecoration(
              labelText: 'Nama Produk *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.label),
            ),
            maxLength: 100,
            textCapitalization: TextCapitalization.words,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Nama produk wajib diisi';
              return null;
            },
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _barcodeCtrl,
            decoration: const InputDecoration(
              labelText: 'Barcode',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.qr_code),
              hintText: 'Opsional',
            ),
            maxLength: 50,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _categoryCtrl,
            decoration: const InputDecoration(
              labelText: 'Kategori',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.category),
              hintText: 'Opsional',
            ),
            maxLength: 50,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _priceCtrl,
            decoration: const InputDecoration(
              labelText: 'Harga (Rp) *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.money),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Harga wajib diisi';
              final n = int.tryParse(v.trim());
              if (n == null) return 'Harga harus berupa angka';
              if (n < 0) return 'Harga harus >= 0';
              return null;
            },
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _descCtrl,
            decoration: const InputDecoration(
              labelText: 'Deskripsi',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.notes),
              hintText: 'Opsional',
              alignLabelWithHint: true,
            ),
            maxLines: 3,
            maxLength: 1000,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            title: const Text('Produk Aktif'),
            subtitle: Text(_isActive ? 'Ditampilkan di POS' : 'Disembunyikan dari POS'),
            value: _isActive,
            onChanged: (v) => setState(() => _isActive = v),
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
            valueColor: o.isDirty ? Colors.orange : Colors.green,
          ),
          if (o.lastSyncedAt != null)
            _InfoRow(
              label: 'Terakhir Sync',
              value: DateTime.fromMillisecondsSinceEpoch(o.lastSyncedAt!).toString().substring(0, 19),
            ),
          if (_isSaving)
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Center(child: CircularProgressIndicator()),
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
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: TextStyle(color: valueColor ?? Colors.black87, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
