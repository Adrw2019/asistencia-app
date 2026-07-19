import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  List<dynamic> _resumen = [];
  bool _loading = true;
  int _modoCalculo = 1;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    
    // Obtener configuración para saber si mostrar Semanas o Dinero
    final conf = await ApiService.getConfig();
    if (conf['success'] == true && conf['data'] != null) {
      _modoCalculo = conf['data']['modo_calculo'] ?? 1;
    }

    // Calcular inicio y fin del mes seleccionado
    final startOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final endOfMonth = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
    
    final desde = "${startOfMonth.year}-${startOfMonth.month.toString().padLeft(2, '0')}-01";
    final hasta = "${endOfMonth.year}-${endOfMonth.month.toString().padLeft(2, '0')}-${endOfMonth.day.toString().padLeft(2, '0')}";

    final res = await ApiService.resumen(desde: desde, hasta: hasta);
    if (res['success'] == true) {
      _resumen = res['data'] ?? [];
    }
    setState(() => _loading = false);
  }
  
  void _changeMonth(int delta) {
    setState(() {
      _selectedDate = DateTime(_selectedDate.year, _selectedDate.month + delta, 1);
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final mesActual = "${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}";
    
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(title: const Text('Resumen Mensual', style: TextStyle(color: Color(0xFFE0A96D)))),
      body: Column(
        children: [
          // Selector de Mes
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            color: const Color(0xFF111328),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(icon: const Icon(Icons.arrow_back_ios, color: Color(0xFFE0A96D)), onPressed: () => _changeMonth(-1)),
                Text('Mes: $mesActual', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.arrow_forward_ios, color: Color(0xFFE0A96D)), onPressed: () => _changeMonth(1)),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _resumen.isEmpty
                    ? const Center(child: Text('No hay registros en este mes.', style: TextStyle(color: Colors.white70)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _resumen.length,
                        itemBuilder: (context, index) {
                          final item = _resumen[index];
                          final double horasT = double.tryParse(item['horas']?.toString() ?? '0') ?? 0;
                          final int totalDinero = int.tryParse(item['total']?.toString() ?? '0') ?? 0;
                          final double semanas = horasT / 42.0;

                          return Card(
                            color: const Color(0xFF1D1E33),
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Colors.white10)),
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${item['nombre']}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18)),
                                  const SizedBox(height: 4),
                                  Text('C.C: ${item['cedula']}', style: const TextStyle(color: Colors.white70)),
                                  const Divider(color: Colors.white24, height: 24),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Turnos completados:', style: TextStyle(color: Colors.white70)),
                                      Text('${item['turnos']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Horas trabajadas:', style: TextStyle(color: Colors.white70)),
                                      Text('${horasT.toStringAsFixed(2)} h', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                  const Divider(color: Colors.white24, height: 24),
                                  if (_modoCalculo == 1) ...[
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('Total a pagar (Aprox):', style: TextStyle(color: Color(0xFFE0A96D), fontSize: 16)),
                                        Text('\$$totalDinero', style: const TextStyle(color: Color(0xFFE0A96D), fontWeight: FontWeight.bold, fontSize: 18)),
                                      ],
                                    ),
                                  ] else ...[
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('Semanas trabajadas (42h):', style: TextStyle(color: Color(0xFFE0A96D), fontSize: 16)),
                                        Text('${semanas.toStringAsFixed(2)} Semanas', style: const TextStyle(color: Color(0xFFE0A96D), fontWeight: FontWeight.bold, fontSize: 18)),
                                      ],
                                    ),
                                  ]
                                ],
                              ),
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
