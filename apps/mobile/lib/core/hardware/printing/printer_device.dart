/// Model perangkat printer Bluetooth (paired device).
class PrinterDevice {
  final String name;
  final String address;

  const PrinterDevice({required this.name, required this.address});

  @override
  String toString() => '$name ($address)';
}
