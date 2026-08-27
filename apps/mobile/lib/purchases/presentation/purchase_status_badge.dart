import 'package:flutter/material.dart';

class PurchaseStatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const PurchaseStatusBadge({
    super.key,
    required this.status,
    this.fontSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;

    switch (status.toLowerCase()) {
      case 'draft':
        bg = Colors.grey.shade200;
        fg = Colors.grey.shade800;
        label = 'Draft';
        break;
      case 'sent':
      case 'dikirim':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade800;
        label = 'Dikirim';
        break;
      case 'partial':
      case 'parsial':
        bg = Colors.amber.shade100;
        fg = Colors.amber.shade900;
        label = 'Parsial';
        break;
      case 'received':
      case 'diterima':
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF17593E);
        label = 'Diterima';
        break;
      case 'cancelled':
      case 'dibatalkan':
        bg = Colors.red.shade50;
        fg = Colors.red.shade800;
        label = 'Dibatalkan';
        break;
      default:
        bg = Colors.grey.shade100;
        fg = Colors.grey.shade700;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
