import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

class BranchSelector extends StatelessWidget {
  final PosController controller;
  final VoidCallback onBranchChanged;

  const BranchSelector({
    super.key,
    required this.controller,
    required this.onBranchChanged,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<BranchDto>>(
      future: controller.getAvailableBranches(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _buildLoading();
        }
        
        final branches = snapshot.data ?? [];
        
        if (branches.isEmpty) {
          return _buildUnavailable();
        }
        
        // If only one branch, show it but don't allow changing
        if (branches.length == 1) {
          return _buildSingleBranch(branches.first);
        }
        
        return _buildDropdown(branches);
      },
    );
  }

  Widget _buildLoading() {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      child: const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
        ),
      ),
    );
  }

  Widget _buildUnavailable() {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.red[900],
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.warning, color: Colors.white, size: 16),
          const SizedBox(width: 6),
          const Text(
            'Cabang tidak tersedia',
            style: TextStyle(color: Colors.white, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildSingleBranch(BranchDto branch) {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.blueGrey[700],
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.store, color: Colors.white, size: 16),
          const SizedBox(width: 6),
          Text(
            branch.name,
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdown(List<BranchDto> branches) {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: controller.branchId.isNotEmpty ? controller.branchId : null,
          hint: const Text('Pilih Cabang', style: TextStyle(color: Colors.white70, fontSize: 13)),
          icon: const Icon(Icons.arrow_drop_down, color: Colors.white, size: 20),
          dropdownColor: Colors.blueGrey[900],
          style: const TextStyle(color: Colors.white, fontSize: 13),
          items: branches.map((branch) {
            return DropdownMenuItem<String>(
              value: branch.id,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  branch.name,
                  style: TextStyle(
                    color: branch.status ? Colors.white : Colors.white54,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          }).toList(),
          onChanged: (newBranchId) async {
            if (newBranchId != null && newBranchId != controller.branchId) {
              await controller.changeBranch(newBranchId);
              onBranchChanged();
            }
          },
        ),
      ),
    );
  }
}