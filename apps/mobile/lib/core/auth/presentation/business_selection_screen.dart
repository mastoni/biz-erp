import 'package:flutter/material.dart';
import '../auth_models.dart';

/// Business selection screen shown after a 409 BUSINESS_SELECTION_REQUIRED
/// response from POST /v1/auth/login.
///
/// Only IDs returned in [businesses] (from the server response) can be
/// returned by this screen — the Navigator.pop path cannot inject arbitrary IDs.
class BusinessSelectionScreen extends StatelessWidget {
  final List<AuthBusinessSelection> businesses;

  const BusinessSelectionScreen({super.key, required this.businesses});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pilih Bisnis / Workspace'),
        leading: BackButton(
          onPressed: () => Navigator.of(context).pop(null),
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'Akun Anda terdaftar di beberapa bisnis.\nPilih workspace yang ingin diakses:',
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              itemCount: businesses.length,
              separatorBuilder: (_, _) => const SizedBox(height: 4),
              itemBuilder: (context, index) {
                final b = businesses[index];
                return Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: const Icon(Icons.store_outlined, size: 20),
                    ),
                    title: Text(
                      b.name,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    subtitle: b.role != null
                        ? Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: _BusinessRoleChip(role: b.role!),
                          )
                        : null,
                    trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.grey),
                    onTap: () => Navigator.of(context).pop(b.id),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _BusinessRoleChip extends StatelessWidget {
  final String role;

  const _BusinessRoleChip({required this.role});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(
        role.toLowerCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
