import 'product.dart';

enum BarcodeLookupStatus { found, notFound, inactive, duplicate }

class BarcodeLookup {
  final BarcodeLookupStatus status;
  final Product? product;
  const BarcodeLookup(this.status, this.product);
}
