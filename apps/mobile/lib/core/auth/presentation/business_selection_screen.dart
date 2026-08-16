import 'package:flutter/material.dart';
import '../auth_models.dart';

class BusinessSelectionScreen extends StatelessWidget {
  final List<AuthBusinessSelection> businesses;

  const BusinessSelectionScreen({super.key, required this.businesses});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pilih Bisnis')),
      body: ListView.builder(
        itemCount: businesses.length,
        itemBuilder: (context, index) {
          final b = businesses[index];
          return ListTile(
            title: Text(b.name),
            subtitle: Text(b.id),
            onTap: () {
              Navigator.of(context).pop(b.id);
            },
          );
        },
      ),
    );
  }
}
