import 'package:flutter/material.dart';
import 'pos_theme.dart';

enum PosBadgeTone { pine, honey, clay, ocean, neutral }

class PosBadge extends StatelessWidget {
  final String label;
  final PosBadgeTone tone;
  final bool hasDot;
  final Widget? icon;

  const PosBadge({
    super.key,
    required this.label,
    this.tone = PosBadgeTone.pine,
    this.hasDot = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg, dotColor) = switch (tone) {
      PosBadgeTone.pine => (PosColors.pineSoft, PosColors.pine, PosColors.pine),
      PosBadgeTone.honey => (PosColors.honeySoft, const Color(0xFF8A5F10), PosColors.honey),
      PosBadgeTone.clay => (PosColors.claySoft, PosColors.clay, PosColors.clay),
      PosBadgeTone.ocean => (PosColors.oceanSoft, PosColors.ocean, PosColors.ocean),
      PosBadgeTone.neutral => (PosColors.surfaceMuted, PosColors.fog, PosColors.fog),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: PosSpacing.sm, vertical: PosSpacing.xxs),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: PosRadius.fullBorderRadius,
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasDot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: PosSpacing.xs),
          ],
          if (icon != null) ...[
            icon!,
            const SizedBox(width: PosSpacing.xs),
          ],
          Text(
            label,
            style: PosTypography.badge.copyWith(color: fg),
          ),
        ],
      ),
    );
  }
}

enum PosButtonVariant { primary, honey, clay, outline }

class PosButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final PosButtonVariant variant;
  final Widget? icon;
  final bool isLoading;
  final bool isExpanded;

  const PosButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = PosButtonVariant.primary,
    this.icon,
    this.isLoading = false,
    this.isExpanded = false,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (variant) {
      PosButtonVariant.primary => (PosColors.pine, PosColors.textOnPrimary, Colors.transparent),
      PosButtonVariant.honey => (PosColors.honey, PosColors.pineDeep, Colors.transparent),
      PosButtonVariant.clay => (PosColors.clay, Colors.white, Colors.transparent),
      PosButtonVariant.outline => (PosColors.surface, PosColors.ink, PosColors.border),
    };

    Widget child = Row(
      mainAxisSize: isExpanded ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(fg),
            ),
          )
        else ...[
          if (icon != null) ...[
            icon!,
            const SizedBox(width: PosSpacing.xs),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ],
    );

    return Material(
      color: onPressed == null ? bg.withValues(alpha: 0.5) : bg,
      borderRadius: PosRadius.mdBorderRadius,
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: PosRadius.mdBorderRadius,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: PosSpacing.lg, vertical: PosSpacing.md),
          decoration: BoxDecoration(
            borderRadius: PosRadius.mdBorderRadius,
            border: Border.all(color: border),
          ),
          child: child,
        ),
      ),
    );
  }
}

class PosCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  const PosCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(PosSpacing.lg),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: PosColors.surface,
        borderRadius: PosRadius.lgBorderRadius,
        border: Border.all(color: PosColors.border),
        boxShadow: PosElevation.cardShadow,
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        borderRadius: PosRadius.lgBorderRadius,
        child: InkWell(
          onTap: onTap,
          borderRadius: PosRadius.lgBorderRadius,
          child: content,
        ),
      );
    }

    return content;
  }
}

class PosSearchInput extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;

  const PosSearchInput({
    super.key,
    this.controller,
    this.hintText = 'Cari produk atau barcode...',
    this.onChanged,
    this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: PosColors.surface,
        borderRadius: PosRadius.mdBorderRadius,
        border: Border.all(color: PosColors.border),
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        style: const TextStyle(fontSize: 14, color: PosColors.ink),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: const TextStyle(fontSize: 14, color: PosColors.fog),
          prefixIcon: const Icon(Icons.search, color: PosColors.fog, size: 20),
          suffixIcon: (controller?.text.isNotEmpty ?? false)
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18, color: PosColors.fog),
                  onPressed: () {
                    controller?.clear();
                    onClear?.call();
                  },
                )
              : null,
          contentPadding: const EdgeInsets.symmetric(horizontal: PosSpacing.md, vertical: PosSpacing.sm),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
        ),
      ),
    );
  }
}

class PosEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? description;
  final Widget? action;

  const PosEmptyState({
    super.key,
    this.icon = Icons.inbox_outlined,
    required this.title,
    this.description,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(PosSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(PosSpacing.lg),
              decoration: const BoxDecoration(
                color: PosColors.pineSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: PosColors.pine),
            ),
            const SizedBox(height: PosSpacing.md),
            Text(
              title,
              style: PosTypography.title,
              textAlign: TextAlign.center,
            ),
            if (description != null) ...[
              const SizedBox(height: PosSpacing.xs),
              Text(
                description!,
                style: PosTypography.caption,
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: PosSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class PosKpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subtitle;
  final Color? valueColor;
  final IconData? icon;

  const PosKpiCard({
    super.key,
    required this.title,
    required this.value,
    this.subtitle,
    this.valueColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return PosCard(
      padding: const EdgeInsets.all(PosSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: PosColors.fog,
                  letterSpacing: 0.8,
                ),
              ),
              if (icon != null) Icon(icon, size: 16, color: PosColors.fog),
            ],
          ),
          const SizedBox(height: PosSpacing.xs),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: valueColor ?? PosColors.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: PosSpacing.xxs),
            Text(
              subtitle!,
              style: const TextStyle(fontSize: 11, color: PosColors.fog),
            ),
          ],
        ],
      ),
    );
  }
}
