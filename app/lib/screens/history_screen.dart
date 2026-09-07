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
  int _modoCalculo = 1;
  DateTime _selectedDate = DateTime.now();

  List<dynamic> _empleados = [];
  String? _selectedCedula;

  @override
  void initState() {
    super.initState();
    _loadEmpleados();
    _load();
  }

  Future<void> _loadEmpleados() async {
    final res = await ApiService.getEmployees();
    if (res['success'] == true) {
      if (mounted) {
        setState(() {
          _empleados = res['data'] ?? [];
        });
      }
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final conf = await ApiService.getConfig();
    if (conf['success'] == true && conf['data'] != null) {
      _modoCalculo = conf['data']['modo_calculo'] ?? 1;
    }

    final startOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final endOfMonth = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
    final desde =
        "${startOfMonth.year}-${startOfMonth.month.toString().padLeft(2, '0')}-01";
    final hasta =
        "${endOfMonth.year}-${endOfMonth.month.toString().padLeft(2, '0')}-${endOfMonth.day.toString().padLeft(2, '0')}";

    final res = await ApiService.historial(
        desde: desde, hasta: hasta, cedula: _selectedCedula);
    if (res['success'] == true) {
      _historial = res['data'] ?? [];
    }
    setState(() => _loading = false);
  }

  void _changeMonth(int delta) {
    setState(() {
      _selectedDate =
          DateTime(_selectedDate.year, _selectedDate.month + delta, 1);
    });
    _load();
  }

  Map<String, List<dynamic>> get _historialAgrupado {
    Map<String, List<dynamic>> grouped = {};
    for (var item in _historial) {
      final key = '${item['nombre']} - ${item['cedula']}';
      if (!grouped.containsKey(key)) {
        grouped[key] = [];
      }
      grouped[key]!.add(item);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final mesActual =
        "${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}";

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        title: const Text('Historial de Asistencias',
            style: TextStyle(color: Color(0xFFE0A96D))),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep, color: Colors.redAccent),
            tooltip: 'Borrar mes actual',
            onPressed: () => _confirmDeleteMonth(mesActual),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1200),
            child: Column(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  color: const Color(0xFF111328),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                              icon: const Icon(Icons.arrow_back_ios,
                                  color: Color(0xFFE0A96D)),
                              onPressed: () => _changeMonth(-1)),
                          Text('Mes: $mesActual',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold)),
                          IconButton(
                              icon: const Icon(Icons.arrow_forward_ios,
                                  color: Color(0xFFE0A96D)),
                              onPressed: () => _changeMonth(1)),
                        ],
                      ),
                      if (_empleados.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        DropdownButton<String>(
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1D1E33),
                          value: _selectedCedula,
                          hint: const Text('Todos los empleados',
                              style: TextStyle(color: Colors.white54)),
                          icon: const Icon(Icons.person,
                              color: Color(0xFFE0A96D)),
                          underline:
                              Container(height: 1, color: Colors.white24),
                          style: const TextStyle(color: Colors.white),
                          onChanged: (String? newValue) {
                            setState(() {
                              _selectedCedula = newValue;
                            });
                            _load();
                          },
                          items: [
                            const DropdownMenuItem<String>(
                              value: null,
                              child: Text('Todos los empleados'),
                            ),
                            ..._empleados.map<DropdownMenuItem<String>>((emp) {
                              return DropdownMenuItem<String>(
                                value: emp['cedula'].toString(),
                                child:
                                    Text('${emp['nombre']} - ${emp['cedula']}'),
                              );
                            }),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _historial.isEmpty
                          ? const Center(
                              child: Text('No hay registros todavía.',
                                  style: TextStyle(color: Colors.white70)))
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                              itemCount: _historialAgrupado.keys.length,
                              itemBuilder: (context, index) {
                                final String empleadoKey =
                                    _historialAgrupado.keys.elementAt(index);
                                final List<dynamic> registros =
                                    _historialAgrupado[empleadoKey]!;

                                return Card(
                                  color: const Color(0xFF111328),
                                  margin: const EdgeInsets.only(bottom: 12),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      side: const BorderSide(
                                          color: Colors.white10)),
                                  child: ExpansionTile(
                                    iconColor: const Color(0xFFE0A96D),
                                    collapsedIconColor: Colors.white54,
                                    leading: const Icon(Icons.person,
                                        color: Color(0xFFE0A96D)),
                                    title: Text(empleadoKey,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white)),
                                    subtitle: Text(
                                        '${registros.length} registros en el mes',
                                        style: const TextStyle(
                                            color: Colors.white70)),
                                    children: registros.map((item) {
                                      final String fecha = (item['fecha'] ?? '')
                                          .toString()
                                          .split('T')
                                          .first;
                                      final String entrada =
                                          item['hora_entrada'] ?? '?';
                                      final String salida =
                                          item['hora_salida'] ?? 'En turno';
                                      final double horasT = double.tryParse(
                                              item['horas_trabajadas']
                                                      ?.toString() ??
                                                  '0') ??
                                          0;
                                      final double horasN = double.tryParse(
                                              item['horas_nocturnas']
                                                      ?.toString() ??
                                                  '0') ??
                                          0;
                                      final int pago = int.tryParse(
                                              item['pago']?.toString() ??
                                                  '0') ??
                                          0;
                                      final int descuento = int.tryParse(
                                              item['descuento']?.toString() ??
                                                  '0') ??
                                          0;
                                      final int minutosTarde = int.tryParse(
                                              item['minutos_tarde']
                                                      ?.toString() ??
                                                  '0') ??
                                          0;

                                      return Padding(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8.0, vertical: 4.0),
                                        child: Card(
                                          color: const Color(0xFF1D1E33),
                                          shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                              side: const BorderSide(
                                                  color: Colors.white10)),
                                          child: ExpansionTile(
                                            iconColor: const Color(0xFFE0A96D),
                                            collapsedIconColor: Colors.white54,
                                            leading: const Icon(
                                                Icons.calendar_today,
                                                color: Color(0xFFE0A96D),
                                                size: 20),
                                            title: Text(fecha,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.white)),
                                            subtitle: Text(
                                                'Entrada: $entrada | Salida: $salida',
                                                style: const TextStyle(
                                                    color: Colors.white70,
                                                    fontSize: 12)),
                                            children: [
                                              Container(
                                                padding:
                                                    const EdgeInsets.all(16.0),
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF111328),
                                                  borderRadius:
                                                      BorderRadius.vertical(
                                                          bottom:
                                                              Radius.circular(
                                                                  8)),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      mainAxisAlignment:
                                                          MainAxisAlignment
                                                              .spaceBetween,
                                                      children: [
                                                        const Text(
                                                            'Horas trabajadas:',
                                                            style: TextStyle(
                                                                color: Colors
                                                                    .white70)),
                                                        Text('$horasT h',
                                                            style: const TextStyle(
                                                                color: Colors
                                                                    .white,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .bold)),
                                                      ],
                                                    ),
                                                    if (horasN > 0) ...[
                                                      const SizedBox(height: 8),
                                                      Row(
                                                        mainAxisAlignment:
                                                            MainAxisAlignment
                                                                .spaceBetween,
                                                        children: [
                                                          const Text(
                                                              'Horas nocturnas:',
                                                              style: TextStyle(
                                                                  color: Colors
                                                                      .white70)),
                                                          Text('$horasN h',
                                                              style: const TextStyle(
                                                                  color: Colors
                                                                      .white,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold)),
                                                        ],
                                                      ),
                                                    ],
                                                    if (minutosTarde > 0) ...[
                                                      const SizedBox(height: 8),
                                                      Row(
                                                        mainAxisAlignment:
                                                            MainAxisAlignment
                                                                .spaceBetween,
                                                        children: [
                                                          const Text(
                                                              'Llegó tarde:',
                                                              style: TextStyle(
                                                                  color: Colors
                                                                      .redAccent)),
                                                          Text(
                                                              '$minutosTarde min',
                                                              style: const TextStyle(
                                                                  color: Colors
                                                                      .redAccent,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold)),
                                                        ],
                                                      ),
                                                    ],
                                                    if (_modoCalculo == 1) ...[
                                                      if (descuento > 0) ...[
                                                        const SizedBox(
                                                            height: 8),
                                                        Row(
                                                          mainAxisAlignment:
                                                              MainAxisAlignment
                                                                  .spaceBetween,
                                                          children: [
                                                            const Text(
                                                                'Descuento por tardanza:',
                                                                style: TextStyle(
                                                                    color: Colors
                                                                        .redAccent)),
                                                            Text(
                                                                '-\$$descuento',
                                                                style: const TextStyle(
                                                                    color: Colors
                                                                        .redAccent,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .bold)),
                                                          ],
                                                        ),
                                                      ],
                                                      const Divider(
                                                          color: Colors.white24,
                                                          height: 24),
                                                      Row(
                                                        mainAxisAlignment:
                                                            MainAxisAlignment
                                                                .spaceBetween,
                                                        children: [
                                                          const Text(
                                                              'Total a pagar (Aprox):',
                                                              style: TextStyle(
                                                                  color: Color(
                                                                      0xFFE0A96D),
                                                                  fontSize:
                                                                      14)),
                                                          Text('\$$pago',
                                                              style: const TextStyle(
                                                                  color: Color(
                                                                      0xFFE0A96D),
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold,
                                                                  fontSize:
                                                                      16)),
                                                        ],
                                                      ),
                                                    ] else ...[
                                                      const Divider(
                                                          color: Colors.white24,
                                                          height: 24),
                                                      Row(
                                                        mainAxisAlignment:
                                                            MainAxisAlignment
                                                                .spaceBetween,
                                                        children: [
                                                          const Text(
                                                              'Semanas trabajadas (Turno):',
                                                              style: TextStyle(
                                                                  color: Color(
                                                                      0xFFE0A96D),
                                                                  fontSize:
                                                                      14)),
                                                          Text(
                                                              '${(horasT / 42.0).toStringAsFixed(2)} Semanas',
                                                              style: const TextStyle(
                                                                  color: Color(
                                                                      0xFFE0A96D),
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold,
                                                                  fontSize:
                                                                      16)),
                                                        ],
                                                      ),
                                                    ],
                                                    const SizedBox(height: 16),
                                                    Align(
                                                      alignment:
                                                          Alignment.centerRight,
                                                      child: TextButton.icon(
                                                        onPressed: () =>
                                                            _confirmDelete(
                                                                item['id']),
                                                        icon: const Icon(
                                                            Icons.delete,
                                                            color: Colors
                                                                .redAccent,
                                                            size: 18),
                                                        label: const Text(
                                                            'Eliminar Registro',
                                                            style: TextStyle(
                                                                color: Colors
                                                                    .redAccent)),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              )
                                            ],
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                );
                              },
                            ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmDelete(int id) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF111328),
        title: const Text('Eliminar Registro',
            style: TextStyle(color: Colors.white)),
        content: const Text(
            '¿Estás seguro que deseas eliminar permanentemente este registro de asistencia?',
            style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar',
                  style: TextStyle(color: Colors.white54))),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteHistory(id);
            },
            child: const Text('Eliminar',
                style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteHistory(int id) async {
    setState(() => _loading = true);
    final res = await ApiService.deleteHistory(id);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(res['message'] ?? 'Eliminado')));
    }
    _load();
  }

  void _confirmDeleteMonth(String mesActual) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF111328),
        title: const Text('Borrar Mes Completo',
            style: TextStyle(color: Colors.white)),
        content: Text(
            '¿Estás seguro que deseas eliminar TODOS los registros de asistencia del mes $mesActual?\n\nEsta acción no se puede deshacer.',
            style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar',
                  style: TextStyle(color: Colors.white54))),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteHistoryMonth();
            },
            child: const Text('Eliminar Todo',
                style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteHistoryMonth() async {
    setState(() => _loading = true);

    final startOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final endOfMonth = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
    final desde =
        "${startOfMonth.year}-${startOfMonth.month.toString().padLeft(2, '0')}-01";
    final hasta =
        "${endOfMonth.year}-${endOfMonth.month.toString().padLeft(2, '0')}-${endOfMonth.day.toString().padLeft(2, '0')}";

    final res = await ApiService.deleteHistoryMonth(desde: desde, hasta: hasta);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Registros eliminados')));
    }
    _load();
  }
}
