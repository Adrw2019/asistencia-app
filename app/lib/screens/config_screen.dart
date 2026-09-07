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
  int _modoCalculo = 1;
  bool _requiereGps = false;
  final _latitud = TextEditingController();
  final _longitud = TextEditingController();
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
      String he = (data['hora_entrada_esperada'] ?? '08:00:00').toString();
      _horaEntrada.text = he.length >= 5 ? he.substring(0, 5) : he;
      String hs = (data['hora_salida_esperada'] ?? '17:00:00').toString();
      _horaSalida.text = hs.length >= 5 ? hs.substring(0, 5) : hs;
      _valorDia.text = (data['valor_dia'] ?? 60000).toString();
      _pagaExtras = (data['paga_extras'] ?? 1) == 1;
      _descuentaTarde = (data['descuenta_tarde'] ?? 1) == 1;
      _modoCalculo = data['modo_calculo'] ?? 1;
      _requiereGps = (data['requiere_gps'] ?? 0) == 1;
      _latitud.text = data['latitud'] != null ? data['latitud'].toString() : '';
      _longitud.text =
          data['longitud'] != null ? data['longitud'].toString() : '';
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
      'modo_calculo': _modoCalculo,
      'requiere_gps': _requiereGps ? 1 : 0,
      'latitud': double.tryParse(_latitud.text) ?? 0.0,
      'longitud': double.tryParse(_longitud.text) ?? 0.0,
    });
    setState(() => _loading = false);
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(res['message'] ?? 'Guardado')));
    if (res['success'] == true) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
          title: const Text('Configuración de Empresa',
              style: TextStyle(color: Color(0xFFE0A96D)))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24.0, vertical: 20.0),
                    children: [
                      if (_modoCalculo == 1) ...[
                        _buildSectionTitle(
                            'Horarios Base (Formato 24h ej. 08:00)'),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                                child: TextField(
                                    controller: _horaEntrada,
                                    style: const TextStyle(color: Colors.white),
                                    decoration: const InputDecoration(
                                        labelText: 'Hora Entrada'))),
                            const SizedBox(width: 16),
                            Expanded(
                                child: TextField(
                                    controller: _horaSalida,
                                    style: const TextStyle(color: Colors.white),
                                    decoration: const InputDecoration(
                                        labelText: 'Hora Salida'))),
                          ],
                        ),
                        const SizedBox(height: 32),
                      ],
                      _buildSectionTitle('Modo de Cálculo'),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                            color: const Color(0xFF111328),
                            borderRadius: BorderRadius.circular(12)),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            dropdownColor: const Color(0xFF1D1E33),
                            value: _modoCalculo,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 4),
                            icon: const Icon(Icons.arrow_drop_down,
                                color: Color(0xFFE0A96D)),
                            items: const [
                              DropdownMenuItem(
                                  value: 1,
                                  child: Text('Diario en Dinero',
                                      style: TextStyle(color: Colors.white))),
                              DropdownMenuItem(
                                  value: 2,
                                  child: Text('Por Semanas / Turnos',
                                      style: TextStyle(color: Colors.white))),
                            ],
                            onChanged: (v) =>
                                setState(() => _modoCalculo = v ?? 1),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                      _buildSectionTitle('Sueldo y Reglas'),
                      const SizedBox(height: 16),
                      if (_modoCalculo == 1) ...[
                        TextField(
                          controller: _valorDia,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                              labelText: 'Valor del Día Completo (\$)',
                              prefixIcon: Icon(Icons.attach_money,
                                  color: Color(0xFFE0A96D))),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Container(
                        decoration: BoxDecoration(
                            color: const Color(0xFF111328),
                            borderRadius: BorderRadius.circular(12)),
                        child: SwitchListTile(
                          activeColor: const Color(0xFFE0A96D),
                          title: const Text('Pagar horas extras',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold)),
                          subtitle: const Text(
                              'Si sale después de hora, se calcula al 150%',
                              style: TextStyle(color: Colors.white54)),
                          value: _pagaExtras,
                          onChanged: (v) => setState(() => _pagaExtras = v),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        decoration: BoxDecoration(
                            color: const Color(0xFF111328),
                            borderRadius: BorderRadius.circular(12)),
                        child: SwitchListTile(
                          activeColor: const Color(0xFFE0A96D),
                          title: const Text('Descontar llegadas tarde',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold)),
                          subtitle: const Text(
                              'Descuenta proporcionalmente el tiempo perdido',
                              style: TextStyle(color: Colors.white54)),
                          value: _descuentaTarde,
                          onChanged: (v) => setState(() => _descuentaTarde = v),
                        ),
                      ),
                      const SizedBox(height: 32),
                      _buildSectionTitle('Validación por GPS'),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                            color: const Color(0xFF111328),
                            borderRadius: BorderRadius.circular(12)),
                        child: SwitchListTile(
                          activeColor: const Color(0xFFE0A96D),
                          title: const Text('Requerir GPS',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold)),
                          subtitle: const Text(
                              'Valida que el escaneo se haga a menos de 50m del negocio',
                              style: TextStyle(color: Colors.white54)),
                          value: _requiereGps,
                          onChanged: (v) => setState(() => _requiereGps = v),
                        ),
                      ),
                      if (_requiereGps) ...[
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                                child: TextField(
                                    controller: _latitud,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                            decimal: true),
                                    style: const TextStyle(color: Colors.white),
                                    decoration: const InputDecoration(
                                        labelText: 'Latitud',
                                        prefixIcon: Icon(Icons.location_on,
                                            color: Color(0xFFE0A96D))))),
                            const SizedBox(width: 16),
                            Expanded(
                                child: TextField(
                                    controller: _longitud,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                            decimal: true),
                                    style: const TextStyle(color: Colors.white),
                                    decoration: const InputDecoration(
                                        labelText: 'Longitud',
                                        prefixIcon: Icon(Icons.location_on,
                                            color: Color(0xFFE0A96D))))),
                          ],
                        ),
                      ],
                      const SizedBox(height: 40),
                      SizedBox(
                        width: double.infinity,
                        height: 55,
                        child: ElevatedButton.icon(
                          onPressed: _save,
                          icon: const Icon(Icons.save),
                          label: const Text('GUARDAR CONFIGURACIÓN'),
                        ),
                      )
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Row(
      children: [
        const Icon(Icons.tune, color: Color(0xFFE0A96D), size: 20),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: Color(0xFFE0A96D))),
      ],
    );
  }
}
