import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';

import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';

/// Create / Edit a Purchase Order DRAFT only.
///
/// No send / receive / pay / cancel / delete is implemented here.
/// Offline: persists locally (Drift) and queues via SyncOutbox.
/// Online: attempts an immediate server push; on success the canonical
/// server response replaces the local draft; on 409 conflict the local
/// draft is preserved (queued) without silently overwriting server data.
class PurchaseCreateScreen extends StatefulWidget {
  final String businessId;
  final String branchId;
  final PurchaseRepository purchaseRepo;
  final SupplierRepository supplierRepo;
  final ProductRepository productRepo;
  final SyncOutboxRepository outboxRepo;
  final SyncApiClient? syncApiClient;
  final bool isOnline;
  final String userRole;
  final String? purchaseId;

  const PurchaseCreateScreen({
    super.key,
    required this.businessId,
    required this.branchId,
    required this.purchaseRepo,
    required this.supplierRepo,
    required this.productRepo,
    required this.outboxRepo,
    this.syncApiClient,
    this.isOnline = true,
    this.userRole = 'OWNER',
    this.purchaseId,
  });

  @override
  State<PurchaseCreateScreen> createState() => _PurchaseCreateScreenState();
}

class _DraftLine {
  final String? productId;
  final String productName;
  int unitCostMinor;
  int qty;

  _DraftLine({
    required this.productId,
    required this.productName,
    required this.unitCostMinor,
    this.qty = 1,
  });
}

class _PurchaseCreateScreenState extends State<PurchaseCreateScreen> {
  final _noteCtrl = TextEditingController();
  final _uuid = const Uuid();

  Purchase? _original;
  Supplier? _supplier;
  List<_DraftLine> _lines = [];
  DateTime _orderDate = DateTime.now();
  DateTime _dueDate = DateTime.now();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _loadError;
  String? _conflictMsg;

  bool get _isEditing => widget.purchaseId != null;
  bool get _canEdit => widget.userRole == 'OWNER';

  String get _supplierTermDisplay =>
      _supplier == null ? '' : _displayTerm(_supplier!.term);

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      _load();
    } else {
      _isLoading = false;
    }
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final po = await widget.purchaseRepo.getPurchaseById(
      widget.purchaseId!,
      widget.businessId,
      widget.branchId,
    );
    if (!mounted) return;
    if (po == null) {
      setState(() {
        _loadError = 'Purchase order tidak ditemukan.';
        _isLoading = false;
      });
      return;
    }
    if (po.status != 'draft') {
      setState(() {
        _loadError = 'Hanya purchase order draft yang dapat diedit.';
        _isLoading = false;
      });
      return;
    }
    final sup = await widget.supplierRepo.getSupplierById(po.supplierId, widget.businessId);
    if (!mounted) return;
    setState(() {
      _original = po;
      _supplier = sup ??
          Supplier(
            id: po.supplierId,
            businessId: widget.businessId,
            name: po.supplierName ?? '-',
            code: po.supplierCode,
            category: '',
            term: po.supplierTerm,
            isActive: true,
            serverVersion: 0,
          );
      _noteCtrl.text = po.note ?? '';
      _orderDate = _parseDate(po.date) ?? DateTime.now();
      _dueDate = _parseDate(po.dueDate) ?? _orderDate;
      _lines = po.items
          .map(
            (i) => _DraftLine(
              productId: i.productId,
              productName: i.productName,
              unitCostMinor: i.unitCostMinor,
              qty: i.orderedQty,
            ),
          )
          .toList();
      _isLoading = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  static String _displayTerm(String t) {
    final s = t.toLowerCase();
    if (s.contains('14')) return 'Tempo 14';
    if (s.contains('30')) return 'Tempo 30';
    if (s.contains('tunai')) return 'Tunai';
    return t;
  }

  static int _termDays(String t) {
    final s = t.toLowerCase();
    if (s.contains('14')) return 14;
    if (s.contains('30')) return 30;
    return 0;
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static DateTime? _parseDate(String? s) {
    if (s == null || s.isEmpty) return null;
    final parts = s.split('-');
    if (parts.length != 3) return null;
    return DateTime.tryParse(
      '${parts[0]}-${parts[1].padLeft(2, '0')}-${parts[2].padLeft(2, '0')}',
    );
  }

  DateTime _computeDue(DateTime order, String term) =>
      order.add(Duration(days: _termDays(term)));

  int get _totalMinor =>
      _lines.fold(0, (s, l) => s + l.qty * l.unitCostMinor);

  int get _outstandingMinor {
    final tunai = _supplierTermDisplay.toLowerCase().startsWith('tunai');
    return tunai ? 0 : _totalMinor;
  }

  // ---------------------------------------------------------------------------
  // Build domain + DTO
  // ---------------------------------------------------------------------------
  Purchase _buildPurchase(String id) {
    final term = _supplierTermDisplay;
    return Purchase(
      id: id,
      businessId: widget.businessId,
      branchId: widget.branchId,
      supplierId: _supplier!.id,
      supplierName: _supplier!.name,
      supplierCode: _supplier!.code,
      code: _isEditing ? _original!.code : 'DRAFT',
      date: _fmt(_orderDate),
      dueDate: _fmt(_dueDate),
      supplierTerm: term,
      status: 'draft',
      totalMinor: _totalMinor,
      receivedMinor: 0,
      paidMinor: 0,
      outstandingMinor: _outstandingMinor,
      note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
      serverVersion: _original?.serverVersion ?? 0,
      localStatus: 'dirty',
      items: _lines
          .map(
            (l) => PurchaseItem(
              id: _uuid.v4(),
              purchaseId: id,
              productId: l.productId,
              productName: l.productName,
              orderedQty: l.qty,
              receivedQty: 0,
              unitCostMinor: l.unitCostMinor,
              subtotalMinor: l.qty * l.unitCostMinor,
            ),
          )
          .toList(),
    );
  }

  PurchaseDto _buildDto(Purchase p) => PurchaseDto(
        id: p.id,
        businessId: p.businessId,
        branchId: p.branchId,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        supplierCode: p.supplierCode,
        code: p.code,
        date: p.date,
        dueDate: p.dueDate,
        supplierTerm: p.supplierTerm,
        status: p.status,
        totalMinor: p.totalMinor,
        receivedMinor: p.receivedMinor,
        paidMinor: p.paidMinor,
        outstandingMinor: p.outstandingMinor,
        note: p.note,
        serverVersion: p.serverVersion,
        items: p.items
            .map(
              (i) => PurchaseItemDto(
                id: i.id,
                purchaseId: i.purchaseId,
                productId: i.productId,
                productName: i.productName,
                orderedQty: i.orderedQty,
                receivedQty: i.receivedQty,
                unitCostMinor: i.unitCostMinor,
                subtotalMinor: i.subtotalMinor,
              ),
            )
            .toList(),
      );

  String? _validate() {
    if (_supplier == null) return 'Pilih supplier terlebih dahulu.';
    if (_lines.isEmpty) return 'Tambahkan minimal satu item produk.';
    final withId = _lines.where((l) => l.productId != null).toList();
    final uniqueIds = withId.map((l) => l.productId).toSet();
    if (uniqueIds.length != withId.length) return 'Terdapat produk duplikat.';
    for (final l in _lines) {
      if (l.qty <= 0) return 'Jumlah item harus lebih dari 0.';
      if (l.unitCostMinor < 0) return 'Biaya satuan tidak valid.';
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  Future<void> _save() async {
    final err = _validate();
    if (err != null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: Colors.red),
      );
      return;
    }
    if (!_canEdit) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Hanya OWNER yang dapat membuat/mengubah draft PO.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    final id = widget.purchaseId ?? _uuid.v4();
    final purchase = _buildPurchase(id);
    final dto = _buildDto(purchase);
    final mutationId = _uuid.v4();
    final isEdit = _isEditing;

    try {
      if (widget.isOnline && widget.syncApiClient != null) {
        final result = isEdit
            ? await widget.syncApiClient!.updatePurchaseDraft(
                dto,
                ifMatchVersion: purchase.serverVersion,
                idempotencyKey: mutationId,
              )
            : await widget.syncApiClient!.createPurchaseDraft(
                dto,
                idempotencyKey: mutationId,
              );

        if (result.conflict) {
          // Preserve local draft (queue) but DO NOT overwrite server data.
          if (isEdit) {
            await widget.purchaseRepo.updateDraft(purchase, purchase.items, widget.outboxRepo);
          } else {
            await widget.purchaseRepo.createDraft(purchase, purchase.items, widget.outboxRepo);
          }
          if (!mounted) return;
          setState(() {
            _conflictMsg =
                'Konflik versi: data di server telah berubah. Jangan menimpa data server.';
            _isSaving = false;
          });
          return;
        }

        await widget.purchaseRepo.applyServerSync(result.serverState ?? dto, widget.businessId);
        if (!mounted) return;
        _finishSave();
        return;
      }

      if (isEdit) {
        await widget.purchaseRepo.updateDraft(purchase, purchase.items, widget.outboxRepo);
      } else {
        await widget.purchaseRepo.createDraft(purchase, purchase.items, widget.outboxRepo);
      }
      if (!mounted) return;
      _finishSave();
    } on ArgumentError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message.toString()), backgroundColor: Colors.red),
      );
      setState(() => _isSaving = false);
    } catch (e) {
      // Network / unexpected failure -> fall back to offline queue.
      try {
        if (isEdit) {
          await widget.purchaseRepo.updateDraft(purchase, purchase.items, widget.outboxRepo);
        } else {
          await widget.purchaseRepo.createDraft(purchase, purchase.items, widget.outboxRepo);
        }
        if (!mounted) return;
        _finishSave();
      } catch (e2) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menyimpan: $e2'), backgroundColor: Colors.red),
        );
        setState(() => _isSaving = false);
      }
    }
  }

  void _finishSave() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Draft disimpan. Menunggu sinkronisasi.'),
        backgroundColor: Colors.green,
      ),
    );
    Navigator.pop(context, true);
  }

  // ---------------------------------------------------------------------------
  // Pickers
  // ---------------------------------------------------------------------------
  Future<void> _pickSupplier() async {
    final suppliers = await widget.supplierRepo.listActiveSuppliers(widget.businessId);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PickerSheet(
        title: 'Pilih Supplier',
        searchHint: 'Cari supplier...',
        items: suppliers
            .map(
              (s) => _PickerItem(
                id: s.id,
                title: s.name,
                subtitle: s.code,
                raw: s,
              ),
            )
            .toList(),
        onSelected: (item) {
          final s = item.raw as Supplier;
          setState(() {
            _supplier = s;
            _dueDate = _computeDue(_orderDate, s.term);
          });
        },
      ),
    );
  }

  Future<void> _pickProduct() async {
    final products = await widget.productRepo.listActiveProducts(widget.businessId);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PickerSheet(
        title: 'Pilih Produk',
        searchHint: 'Cari produk...',
        items: products
            .map(
              (p) => _PickerItem(
                id: p.id,
                title: p.name,
                subtitle: p.costMinor != null
                    ? CurrencyFormatter.formatIDR(p.costMinor!)
                    : 'HPP belum disetel',
                raw: p,
              ),
            )
            .toList(),
        onSelected: (item) {
          final p = item.raw as Product;
          if (_lines.any((l) => l.productId == p.id)) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Produk sudah ditambahkan.'),
                backgroundColor: Colors.orange,
              ),
            );
            return;
          }
          // HPP (costMinor) is required for Purchase. Reject if null.
          if (p.costMinor == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('HPP produk belum tersedia. Produk tidak dapat ditambahkan ke PO.'),
                backgroundColor: Colors.red,
              ),
            );
            return;
          }
          // unitCostMinor snapshot = product HPP (costMinor), not sale price (priceMinor)
          setState(() => _lines.add(
                _DraftLine(
                  productId: p.id,
                  productName: p.name,
                  unitCostMinor: p.costMinor!,
                  qty: 1,
                ),
              ));
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Date helpers UI
  // ---------------------------------------------------------------------------
  Future<void> _pickOrderDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _orderDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _orderDate = picked;
        if (_supplier != null) _dueDate = _computeDue(picked, _supplier!.term);
      });
    }
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    final canSave = _canEdit && !_isSaving;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit Purchase Order' : 'Buat Purchase Order'),
        backgroundColor: const Color(0xFF17593E),
        foregroundColor: Colors.white,
        actions: [
          if (!_isLoading && _loadError == null)
            TextButton.icon(
              key: const Key('purchase_save_button'),
              onPressed: canSave ? _save : null,
              icon: const Icon(Icons.save, color: Colors.white),
              label: const Text('Simpan', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF17593E)));
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
              Text(_loadError!, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_conflictMsg != null)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_outlined, color: Colors.red.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _conflictMsg!,
                    style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        if (!_canEdit)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              'Hanya OWNER yang dapat membuat/mengubah draft PO.',
              style: TextStyle(fontSize: 13, color: Colors.black87),
            ),
          ),
        _SupplierField(
          key: const Key('supplier_picker'),
          supplier: _supplier,
          termDisplay: _supplierTermDisplay,
          onTap: _canEdit ? _pickSupplier : null,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: InkWell(
                onTap: _pickOrderDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Tanggal Pesan',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.calendar_today),
                  ),
                  child: Text(_fmt(_orderDate)),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: InkWell(
                onTap: _pickDueDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Jatuh Tempo',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.event),
                  ),
                  child: Text(_fmt(_dueDate)),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          key: const Key('po_note'),
          controller: _noteCtrl,
          decoration: const InputDecoration(
            labelText: 'Catatan (opsional)',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.notes),
          ),
          maxLines: 2,
          maxLength: 500,
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Item Pesanan', style: Theme.of(context).textTheme.titleMedium),
            TextButton.icon(
              key: const Key('add_product'),
              onPressed: _canEdit ? _pickProduct : null,
              icon: const Icon(Icons.add),
              label: const Text('Tambah'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_lines.isEmpty)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text('Belum ada item. Tap "Tambah" untuk memilih produk.'),
            ),
          )
        else
          ..._lines.asMap().entries.map((e) {
            final i = e.key;
            final line = e.value;
            return _LineCard(
              index: i,
              line: line,
              onQtyChanged: (q) => setState(() => line.qty = q),
              onCostChanged: (c) => setState(() => line.unitCostMinor = c),
              onRemove: () => setState(() => _lines.removeAt(i)),
            );
          }),
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _SummaryRow('Total (draft)', CurrencyFormatter.formatIDR(_totalMinor)),
                const Divider(height: 16),
                _SummaryRow(
                  'Outstanding (draft)',
                  CurrencyFormatter.formatIDR(_outstandingMinor),
                  valueColor: _outstandingMinor > 0
                      ? Colors.red.shade700
                      : const Color(0xFF17593E),
                ),
                const SizedBox(height: 6),
                Text(
                  _supplierTermDisplay.toLowerCase().startsWith('tunai')
                      ? 'Tunai: outstanding = 0 (draft).'
                      : 'Tempo: outstanding = total (draft).',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        if (_isSaving) const Center(child: CircularProgressIndicator(color: Color(0xFF17593E))),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _SummaryRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.black87)),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: valueColor ?? Colors.black87,
            ),
          ),
        ],
      );
}

class _SupplierField extends StatelessWidget {
  final Supplier? supplier;
  final String termDisplay;
  final VoidCallback? onTap;
  const _SupplierField({super.key, required this.supplier, required this.termDisplay, this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: 'Supplier *',
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.local_shipping),
            suffixIcon: onTap == null ? null : const Icon(Icons.arrow_drop_down),
          ),
          child: supplier == null
              ? const Text('Pilih supplier', style: TextStyle(color: Colors.grey))
              : Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(supplier!.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.blueGrey.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.blueGrey.shade200),
                      ),
                      child: Text(
                        termDisplay,
                        style: TextStyle(fontSize: 11, color: Colors.blueGrey.shade900),
                      ),
                    ),
                  ],
                ),
        ),
      );
}

class _LineCard extends StatelessWidget {
  final int index;
  final _DraftLine line;
  final ValueChanged<int> onQtyChanged;
  final ValueChanged<int> onCostChanged;
  final VoidCallback onRemove;

  const _LineCard({
    required this.index,
    required this.line,
    required this.onQtyChanged,
    required this.onCostChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 10),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.grey.shade300),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(line.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: onRemove,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('Jumlah:', style: TextStyle(fontSize: 13)),
                  IconButton(
                    key: Key('dec_$index'),
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: line.qty > 1 ? () => onQtyChanged(line.qty - 1) : null,
                    visualDensity: VisualDensity.compact,
                  ),
                  Text('${line.qty}', key: Key('qty_$index'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  IconButton(
                    key: Key('inc_$index'),
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: () => onQtyChanged(line.qty + 1),
                    visualDensity: VisualDensity.compact,
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 140,
                    child: _LineCostField(
                      initial: line.unitCostMinor,
                      onChanged: onCostChanged,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Subtotal: ${CurrencyFormatter.formatIDR(line.qty * line.unitCostMinor)}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
      );
}

class _LineCostField extends StatefulWidget {
  final int initial;
  final ValueChanged<int> onChanged;
  const _LineCostField({required this.initial, required this.onChanged});

  @override
  State<_LineCostField> createState() => _LineCostFieldState();
}

class _LineCostFieldState extends State<_LineCostField> {
  late TextEditingController _c;

  @override
  void initState() {
    super.initState();
    _c = TextEditingController(text: widget.initial.toString());
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _c,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: const InputDecoration(
          labelText: 'HPP (Rp)',
          border: OutlineInputBorder(),
          isDense: true,
          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        ),
        onChanged: (v) {
          final n = int.tryParse(v.replaceAll('.', '')) ?? 0;
          widget.onChanged(n);
        },
      );
}

class _PickerItem {
  final String id;
  final String title;
  final String? subtitle;
  final Object raw;
  const _PickerItem({required this.id, required this.title, this.subtitle, required this.raw});
}

class _PickerSheet extends StatefulWidget {
  final String title;
  final String searchHint;
  final List<_PickerItem> items;
  final void Function(_PickerItem) onSelected;

  const _PickerSheet({
    required this.title,
    required this.searchHint,
    required this.items,
    required this.onSelected,
  });

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  final _searchCtrl = TextEditingController();
  List<_PickerItem> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.items;
    _searchCtrl.addListener(_onSearch);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch() {
    final q = _searchCtrl.text.trim().toLowerCase();
    setState(() {
      _filtered = widget.items.where((it) {
        return it.title.toLowerCase().contains(q) ||
            (it.subtitle?.toLowerCase().contains(q) ?? false);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(widget.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: widget.searchHint,
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _filtered.length,
                  itemBuilder: (_, i) {
                    final it = _filtered[i];
                    return ListTile(
                      title: Text(it.title),
                      subtitle: it.subtitle != null ? Text(it.subtitle!) : null,
                      onTap: () {
                        widget.onSelected(it);
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      );
}
