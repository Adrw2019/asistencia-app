import 'package:flutter/material.dart';
import '../services/api_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<dynamic> _historial = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await ApiService.historial();
    if (res['success'] == true) {
      _historial = res['data'] ?? [];
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Historial de Asistencias')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _historial.isEmpty
              ? const Center(child: Text('No hay registros todavía.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: _historial.length,
                  itemBuilder: (context, index) {
                    final item = _historial[index];
                    final String fecha = (item['fecha'] ?? '').toString().split('T').first;
                    final String entrada = item['hora_entrada'] ?? '?';
                    final String salida = item['hora_salida'] ?? 'En turno';
                    final double horasT = double.tryParse(item['horas_trabajadas']?.toString() ?? '0') ?? 0;
                    final double horasE = double.tryParse(item['horas_extra']?.toString() ?? '0') ?? 0;
                    final int pago = item['pago'] ?? 0;
                    final int descuento = item['descuento'] ?? 0;
                    final int minutosTarde = item['minutos_tarde'] ?? 0;

                    return Card(
                      child: ExpansionTile(
                        leading: const Icon(Icons.access_time),
                        title: Text('${item['nombre']} - $fecha'),
                        subtitle: Text('Entrada: $entrada | Salida: $salida'),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Cargo: ${item['cargo'] ?? '-'} | C.C: ${item['cedula']}'),
                                const Divider(),
                                Text('Horas trabajadas: $horasT h'),
                                Text('Horas extra: $horasE h'),
                                if (minutosTarde > 0)
                                  Text('Llegó tarde: $minutosTarde min', style: const TextStyle(color: Colors.red)),
                                if (descuento > 0)
                                  Text('Descuento por tardanza: -\$$descuento', style: const TextStyle(color: Colors.red)),
                                const SizedBox(height: 8),
                                Text('Total a pagar (Aprox): \$$pago', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              ],
                            ),
                          )
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
