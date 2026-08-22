import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import 'customer_edit_screen.dart';

enum CustomerFilter { all, active, inactive, dirty, conflict }

class CustomerListScreen extends StatefulWidget {
  final String businessId;
  final CustomerRepository customerRepo;
  final SyncOutboxRepository outboxRepo;
  final SyncStatusNotifier syncStatusNotifier;
  final String userRole;

  const CustomerListScreen({
    super.key,
    required this.businessId,
    required this.customerRepo,
    required this.outboxRepo,
    required this.syncStatusNotifier,
    required this.userRole,
  });

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  List<Customer> _allCustomers = [];
  bool _isLoading = true;
  String? _error;
  CustomerFilter _filter = CustomerFilter.all;
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
      final customers = await widget.customerRepo.listAllCustomers(widget.businessId);
      if (!mounted) return;
      setState(() {
        _allCustomers = customers;
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

  List<Customer> get _filteredCustomers {
    var list = _allCustomers;
    switch (_filter) {
      case CustomerFilter.active:
        list = list.where((c) => c.isActive).toList();
        break;
      case CustomerFilter.inactive:
        list = list.where((c) => !c.isActive).toList();
        break;
      case CustomerFilter.dirty:
        list = list.where((c) => c.isDirty).toList();
        break;
      case CustomerFilter.conflict:
        list = list.where((c) => c.isDirty && _hasConflict(c)).toList();
        break;
      case CustomerFilter.all:
        break;
    }
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((c) {
        return c.name.toLowerCase().contains(q) ||
            (c.phone?.toLowerCase().contains(q) ?? false) ||
            (c.email?.toLowerCase().contains(q) ?? false);
      }).toList();
    }
    return list;
  }

  bool _hasConflict(Customer customer) {
    // Conflict detection would need outbox integration
    // For now, treat dirty items that have been retried as potential conflicts
    return false;
  }

  Future<void> _openEdit(Customer customer) async {
    if (widget.userRole != 'OWNER') return;
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerEditScreen(
          businessId: widget.businessId,
          customerId: customer.id,
          customerRepo: widget.customerRepo,
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
        builder: (_) => CustomerEditScreen(
          businessId: widget.businessId,
          customerId: null,
          customerRepo: widget.customerRepo,
          outboxRepo: widget.outboxRepo,
        ),
      ),
    );
    if (saved == true && mounted) _load();
  }

  Future<void> _deactivate(Customer customer) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nonaktifkan Pelanggan'),
        content: Text('Yakin nonaktifkan "${customer.name}"? Pelanggan akan disembunyikan dari POS.'),
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
      await widget.customerRepo.deleteCustomer(customer.id, widget.businessId, widget.outboxRepo);
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
    final filtered = _filteredCustomers;
    final isOnline = widget.syncStatusNotifier.isOnline;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kelola Pelanggan'),
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
                hintText: 'Cari nama, telepon, atau email...',
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
                children: CustomerFilter.values.map((f) {
                  final selected = _filter == f;
                  final label = switch (f) {
                    CustomerFilter.all => 'Semua',
                    CustomerFilter.active => 'Aktif',
                    CustomerFilter.inactive => 'Nonaktif',
                    CustomerFilter.dirty => 'Belum Sync',
                    CustomerFilter.conflict => 'Konflik',
                  };
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(label),
                      selected: selected,
                      onSelected: (_) => setState(() => _filter = f),
                      selectedColor: const Color(0xFFE6A017).withOpacity(0.2),
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

  Widget _buildBody(List<Customer> filtered) {
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
              Text('Gagal memuat pelanggan', style: Theme.of(context).textTheme.titleMedium),
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
              Icon(Icons.people_outline, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 12),
              Text(
                _allCustomers.isEmpty ? 'Belum ada pelanggan' : 'Tidak ada pelanggan yang cocok',
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
      itemBuilder: (context, i) => _CustomerListItem(
        customer: filtered[i],
        onTap: _isOwner ? () => _openEdit(filtered[i]) : null,
        onDeactivate: _isOwner ? () => _deactivate(filtered[i]) : null,
      ),
    );
  }
}

class _CustomerListItem extends StatelessWidget {
  final Customer customer;
  final VoidCallback? onTap;
  final VoidCallback? onDeactivate;

  const _CustomerListItem({
    required this.customer,
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
                  color: customer.isActive ? const Color(0xFFE6A017).withOpacity(0.1) : Colors.grey[200],
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.person,
                  color: customer.isActive ? const Color(0xFFE6A017) : Colors.grey[500],
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
                            customer.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: Color(0xFF1A1A2E),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!customer.isActive)
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
                        if (customer.isDirty) ...[
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
                    if (customer.phone != null && customer.phone!.isNotEmpty) ...[
                      Row(
                        children: [
                          Icon(Icons.phone, size: 13, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            customer.phone!,
                            style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                    ],
                    if (customer.email != null && customer.email!.isNotEmpty) ...[
                      Row(
                        children: [
                          Icon(Icons.email, size: 13, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            customer.email!,
                            style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                          ),
                        ],
                      ),
                    ],
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
                    if (onDeactivate != null && customer.isActive)
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