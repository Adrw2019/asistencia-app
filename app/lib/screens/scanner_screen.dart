import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_service.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  bool locked = false;
  final manual = TextEditingController();

  String _cedulaFromQr(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri != null && uri.queryParameters['cedula'] != null) return uri.queryParameters['cedula']!;
    return raw.replaceAll(RegExp(r'[^0-9]'), '');
  }

  Future<void> _send(String raw) async {
    final cedula = _cedulaFromQr(raw);
    if (cedula.isEmpty) return;
    setState(() => locked = true);
    final r = await ApiService.scanCedula(cedula);
    if (!mounted) return;
    final tipo = r['tipo'] == 'salida' ? 'SALIDA' : 'ENTRADA';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(r['success'] == true ? tipo : 'Error'),
        content: Text(r['message'] ?? 'Proceso realizado'),
        actions: [TextButton(onPressed: () { Navigator.pop(context); setState(() => locked = false); }, child: const Text('Aceptar'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escanear QR')),
      body: Column(
        children: [
          Expanded(
            child: MobileScanner(
              onDetect: (capture) {
                if (locked) return;
                final code = capture.barcodes.first.rawValue;
                if (code != null) _send(code);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(child: TextField(controller: manual, decoration: const InputDecoration(labelText: 'Cédula manual', border: OutlineInputBorder()))),
                const SizedBox(width: 8),
                ElevatedButton(onPressed: locked ? null : () => _send(manual.text), child: const Text('Enviar')),
              ],
            ),
          )
        ],
      ),
    );
  }
}
