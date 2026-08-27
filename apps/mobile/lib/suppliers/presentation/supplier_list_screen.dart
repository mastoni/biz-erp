import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';
import 'supplier_edit_screen.dart';

enum SupplierFilter { all, active, inactive, dirty, conflict }

class SupplierListScreen extends StatefulWidget {
  final String businessId;
  final SupplierRepository supplierRepo;
  final SyncOutboxRepository outboxRepo;
  final SyncStatusNotifier syncStatusNotifier;
  final String userRole;

  const SupplierListScreen({
    super.key,
    required this.businessId,
    required this.supplierRepo,
    required this.outboxRepo,
    required this.syncStatusNotifier,
    required this.userRole,
  });

  @override
  State<SupplierListScreen> createState() => _SupplierListScreenState();
}

class _SupplierListScreenState extends State<SupplierListScreen> {
  List<Supplier> _allSuppliers = [];
  bool _isLoading = true;
  String? _error;
  SupplierFilter _filter = SupplierFilter.all;
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();
  bool _isOwner = false;

  @override
  void initState() {
    super.initState();
    _isOwner = widget.userRole == 'OWNER';
    _load();
    widget.syncStatusNotifier.addListener(_onSyncChanged);
  }

  @override
  void dispose() {
    widget.syncStatusNotifier.removeListener(_onSyncChanged);
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSyncChanged() {
    if (mounted) _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final suppliers = await widget.supplierRepo.listSuppliers(widget.businessId);
      if (!mounted) return;
      setState(() {
        _allSuppliers = suppliers;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Supplier> get _filteredSuppliers {
    var list = _allSuppliers;
    switch (_filter) {
      case SupplierFilter.active:
        list = list.where((s) => s.isActive).toList();
        break;
      case SupplierFilter.inactive:
        list = list.where((s) => !s.isActive).toList();
        break;
      case SupplierFilter.dirty:
        list = list.where((s) => s.isDirty).toList();
        break;
      case SupplierFilter.conflict:
        list = list.where((s) => s.isDirty && _hasConflict(s)).toList();
        break;
      case SupplierFilter.all:
        break;
    }
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((s) {
        return s.name.toLowerCase().contains(q) ||
            (s.code?.toLowerCase().contains(q) ?? false) ||
            (s.category.toLowerCase().contains(q));
      }).toList();
    }
    return list;
  }

  bool _hasConflict(Supplier supplier) {
    return false;
  }

  Future<void> _openEdit(Supplier supplier) async {
    if (widget.userRole != 'OWNER') return;
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SupplierEditScreen(
          businessId: widget.businessId,
          supplierId: supplier.id,
          supplierRepo: widget.supplierRepo,
          outboxRepo: widget.outboxRepo,
        ),
      ),
    );
    if (saved == true && mounted) _load();
  }

  Future<void> _openCreate() async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SupplierEditScreen(
          businessId: widget.businessId,
          supplierId: null,
          supplierRepo: widget.supplierRepo,
          outboxRepo: widget.outboxRepo,
        ),
      ),
    );
    if (saved == true && mounted) _load();
  }

  Future<void> _deactivate(Supplier supplier) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nonaktifkan Supplier'),
        content: Text('Yakin nonaktifkan "${supplier.name}"? Supplier akan disembunyikan dari pencarian.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Nonaktifkan', style: TextStyle(color: Color(0xFFC0392B))),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await widget.supplierRepo.deleteSupplier(supplier.id, widget.businessId, widget.outboxRepo);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perubahan disimpan. Menunggu sinkronisasi.'),
          backgroundColor: Colors.green,
        ),
      );
      _load();
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSuppliers;
    final isOnline = widget.syncStatusNotifier.isOnline;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kelola Supplier'),
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: _isOwner
          ? FloatingActionButton(
              onPressed: _openCreate,
              backgroundColor: const Color(0xFFE6A017),
              foregroundColor: const Color(0xFF1A1A2E),
              child: const Icon(Icons.person_add),
            )
          : null,
      body: Column(
        children: [
          if (!isOnline)
            Container(
              width: double.infinity,
              color: Colors.orange.shade100,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              child: const Row(
                children: [
                  Icon(Icons.wifi_off, size: 16, color: Colors.orange),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Anda sedang offline. Perubahan akan disinkronkan saat online.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Cari nama, kode, atau kategori...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE6A017), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: SupplierFilter.values.map((f) {
                  final selected = _filter == f;
                  final label = switch (f) {
                    SupplierFilter.all => 'Semua',
                    SupplierFilter.active => 'Aktif',
                    SupplierFilter.inactive => 'Nonaktif',
                    SupplierFilter.dirty => 'Belum Sync',
                    SupplierFilter.conflict => 'Konflik',
                  };
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(label),
                      selected: selected,
                      onSelected: (_) => setState(() => _filter = f),
                      selectedColor: const Color(0xFFE6A017).withValues(alpha: 0.2),
                      checkmarkColor: const Color(0xFFE6A017),
                      labelStyle: TextStyle(
                        color: selected ? const Color(0xFF1A1A2E) : Colors.grey[700],
                        fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                      ),
                      side: BorderSide(
                        color: selected ? const Color(0xFFE6A017) : Colors.grey.shade300,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _buildBody(filtered),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(List<Supplier> filtered) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFE6A017)));
    }
    if (_error != null) {
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
              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba Lagi'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE6A017),
                  foregroundColor: const Color(0xFF1A1A2E),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.local_shipping, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 12),
              Text(
                _allSuppliers.isEmpty ? 'Belum ada supplier' : 'Tidak ada supplier yang cocok',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      itemCount: filtered.length,
      itemBuilder: (context, i) => _SupplierListItem(
        supplier: filtered[i],
        onTap: _isOwner ? () => _openEdit(filtered[i]) : null,
        onDeactivate: _isOwner ? () => _deactivate(filtered[i]) : null,
      ),
    );
  }
}

class _SupplierListItem extends StatelessWidget {
  final Supplier supplier;
  final VoidCallback? onTap;
  final VoidCallback? onDeactivate;

  const _SupplierListItem({
    required this.supplier,
    this.onTap,
    this.onDeactivate,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: supplier.isActive ? const Color(0xFFE6A017).withValues(alpha: 0.1) : Colors.grey[200],
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.local_shipping,
                  color: supplier.isActive ? const Color(0xFFE6A017) : Colors.grey[500],
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            supplier.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: Color(0xFF1A1A2E),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!supplier.isActive)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Nonaktif',
                              style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w500),
                            ),
                          ),
                        if (supplier.isDirty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.orange[100],
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.cloud_upload_outlined, size: 11, color: Colors.orange),
                                SizedBox(width: 3),
                                Text(
                                  'Belum Sync',
                                  style: TextStyle(fontSize: 11, color: Colors.orange, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (supplier.category.isNotEmpty)
                      Text(
                        supplier.category,
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                    const SizedBox(height: 2),
                    if (supplier.phone != null && supplier.phone!.isNotEmpty)
                      Row(
                        children: [
                          Icon(Icons.phone, size: 13, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            supplier.phone!,
                            style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              if (onTap != null || onDeactivate != null)
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Colors.grey),
                  onSelected: (value) {
                    if (value == 'edit' && onTap != null) onTap!();
                    if (value == 'deactivate' && onDeactivate != null) onDeactivate!();
                  },
                  itemBuilder: (context) => [
                    if (onTap != null)
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit, size: 18),
                            SizedBox(width: 8),
                            Text('Edit'),
                          ],
                        ),
                      ),
                    if (onDeactivate != null && supplier.isActive)
                      const PopupMenuItem(
                        value: 'deactivate',
                        child: Row(
                          children: [
                            Icon(Icons.block, size: 18, color: Colors.red),
                            SizedBox(width: 8),
                            Text('Nonaktifkan', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                      ),
                  ],
                )
              else
                const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
