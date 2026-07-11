import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ConfigScreen extends StatefulWidget {
  const ConfigScreen({super.key});

  @override
  State<ConfigScreen> createState() => _ConfigScreenState();
}

class _ConfigScreenState extends State<ConfigScreen> {
  final _horaEntrada = TextEditingController();
  final _horaSalida = TextEditingController();
  final _valorDia = TextEditingController();
  bool _pagaExtras = true;
  bool _descuentaTarde = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await ApiService.getConfig();
    if (res['success'] == true) {
      final data = res['data'];
      _horaEntrada.text = (data['hora_entrada_esperada'] ?? '').toString().substring(0, 5);
      _horaSalida.text = (data['hora_salida_esperada'] ?? '').toString().substring(0, 5);
      _valorDia.text = (data['valor_dia'] ?? 60000).toString();
      _pagaExtras = (data['paga_extras'] ?? 1) == 1;
      _descuentaTarde = (data['descuenta_tarde'] ?? 1) == 1;
    }
    setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _loading = true);
    final res = await ApiService.updateConfig({
      'hora_entrada': '${_horaEntrada.text}:00',
      'hora_salida': '${_horaSalida.text}:00',
      'valor_dia': int.tryParse(_valorDia.text) ?? 60000,
      'paga_extras': _pagaExtras ? 1 : 0,
      'descuenta_tarde': _descuentaTarde ? 1 : 0,
    });
    setState(() => _loading = false);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Guardado')));
    if (res['success'] == true) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración de Empresa')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Horarios (Formato 24h ej. 08:00)', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: TextField(controller: _horaEntrada, decoration: const InputDecoration(labelText: 'Hora Entrada'))),
                    const SizedBox(width: 16),
                    Expanded(child: TextField(controller: _horaSalida, decoration: const InputDecoration(labelText: 'Hora Salida'))),
                  ],
                ),
                const SizedBox(height: 24),
                const Text('Sueldo y Reglas', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                TextField(controller: _valorDia, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Valor del Día Completo (\$)')),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Pagar horas extras'),
                  subtitle: const Text('Si sale después de hora, se calcula al 150%'),
                  value: _pagaExtras,
                  onChanged: (v) => setState(() => _pagaExtras = v),
                ),
                SwitchListTile(
                  title: const Text('Descontar llegadas tarde'),
                  subtitle: const Text('Descuenta proporcionalmente el tiempo perdido'),
                  value: _descuentaTarde,
                  onChanged: (v) => setState(() => _descuentaTarde = v),
                ),
                const SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: _save,
                  icon: const Icon(Icons.save),
                  label: const Text('Guardar Configuración'),
                )
              ],
            ),
    );
  }
}
