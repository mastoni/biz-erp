import 'package:flutter/material.dart';
import '../tenant_models.dart';

class TenantSelectionScreen extends StatelessWidget {
  final List<TenantInfo> tenants;
  final String? activeTenantId;
  final ValueChanged<String> onSelectTenant;

  const TenantSelectionScreen({
    super.key,
    required this.tenants,
    this.activeTenantId,
    required this.onSelectTenant,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0EFE7),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Pilih Bisnis / Tenant',
          style: TextStyle(
            color: Color(0xFF1A1D1A),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        iconTheme: const IconThemeData(color: Color(0xFF1A1D1A)),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Text(
                'Pilih unit usaha untuk melanjutkan ke ruang kerja ERP:',
                style: TextStyle(
                  color: Color(0xFF7A827B),
                  fontSize: 14,
                ),
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: tenants.length,
                separatorBuilder: (context, index) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final tenant = tenants[index];
                  final isActive = tenant.id == activeTenantId;

                  return InkWell(
                    onTap: () => onSelectTenant(tenant.id),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isActive
                              ? const Color(0xFF17593E)
                              : const Color(0xFFE2E0D5),
                          width: isActive ? 2 : 1,
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x0A1A1D1A),
                            blurRadius: 4,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: isActive
                                  ? const Color(0xFF17593E)
                                  : const Color(0xFFE2ECE7),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.storefront_outlined,
                              color: isActive
                                  ? const Color(0xFFF0EFE7)
                                  : const Color(0xFF17593E),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        tenant.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFF1A1D1A),
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    if (isActive)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE2ECE7),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Text(
                                          'Aktif',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF17593E),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    if (tenant.role != null) ...[
                                      Text(
                                        tenant.role!.toLowerCase(),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF7A827B),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        '•',
                                        style: TextStyle(color: Color(0xFF7A827B)),
                                      ),
                                      const SizedBox(width: 8),
                                    ],
                                    Text(
                                      tenant.id.length > 8
                                          ? '${tenant.id.substring(0, 8)}...'
                                          : tenant.id,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontFamily: 'monospace',
                                        color: Color(0xFF7A827B),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            isActive
                                ? Icons.check_circle
                                : Icons.arrow_forward_ios,
                            color: isActive
                                ? const Color(0xFF17593E)
                                : const Color(0xFF7A827B),
                            size: isActive ? 22 : 14,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
