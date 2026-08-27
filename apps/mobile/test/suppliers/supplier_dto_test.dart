import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

void main() {
  test('MOBILE-SUPPLIER-001: SupplierDto maps snake_case ↔ camelCase', () async {
    final dto = SupplierDto(
      id: 'sup-001',
      name: 'PT Sumber Jaya',
      code: 'SUP-001',
      contact: 'Budi Santoso',
      phone: '+628123456789',
      email: 'budi@sumberjaya.com',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 5,
      deletedAt: null,
    );

    final json = dto.toJson();
    expect(json['id'], 'sup-001');
    expect(json['name'], 'PT Sumber Jaya');
    expect(json['code'], 'SUP-001');
    expect(json['contact'], 'Budi Santoso');
    expect(json['phone'], '+628123456789');
    expect(json['email'], 'budi@sumberjaya.com');
    expect(json['category'], 'Sembako');
    expect(json['term'], 'tunai');
    expect(json['is_active'], 1);
    expect(json['server_version'], 5);
    expect(json['deleted_at'], isNull);

    final roundTrip = SupplierDto.fromJson(json);
    expect(roundTrip.id, 'sup-001');
    expect(roundTrip.name, 'PT Sumber Jaya');
    expect(roundTrip.code, 'SUP-001');
    expect(roundTrip.contact, 'Budi Santoso');
    expect(roundTrip.phone, '+628123456789');
    expect(roundTrip.email, 'budi@sumberjaya.com');
    expect(roundTrip.category, 'Sembako');
    expect(roundTrip.term, 'tunai');
    expect(roundTrip.isActive, isTrue);
    expect(roundTrip.serverVersion, 5);
    expect(roundTrip.deletedAt, isNull);
  });

  test('MOBILE-SUPPLIER-001b: SupplierDto inactive maps is_active 0 → false', () async {
    final dto = SupplierDto.fromJson({
      'id': 'sup-002',
      'name': 'Supplier Nonaktif',
      'code': null,
      'contact': null,
      'phone': null,
      'email': null,
      'category': null,
      'term': 'tempo_30',
      'is_active': 0,
      'server_version': 10,
      'deleted_at': 1234567890000,
    });

    expect(dto.isActive, isFalse);
    expect(dto.serverVersion, 10);
    expect(dto.deletedAt, 1234567890000);
    expect(dto.category, '');
  });

  test('MOBILE-SUPPLIER-001c: PullSuppliersResponse holds list + has_more + current_version', () async {
    final resp = PullSuppliersResponse(
      [SupplierDto(id: 's1', name: 'A', category: '', term: 'tunai', isActive: true, serverVersion: 1)],
      true,
      1,
    );
    expect(resp.suppliers.length, 1);
    expect(resp.hasMore, isTrue);
    expect(resp.currentVersion, 1);
  });
}
