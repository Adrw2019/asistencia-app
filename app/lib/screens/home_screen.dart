import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'register_screen.dart';
import 'login_screen.dart';
import 'config_screen.dart';
import 'history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> empleados = [];
  bool loading = true;
  String empresa = '';

  @override
  void initState() {
    super.initState();
    SocketService.connect();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final r = await ApiService.getEmployees();
    if (!mounted) return;
    setState(() {
      empresa = prefs.getString('empresa_nombre') ?? '';
      empleados = r['success'] == true ? (r['data'] ?? []) : [];
      loading = false;
    });
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    SocketService.disconnect();
    if (!mounted) return;
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  void _showQR() async {
    final prefs = await SharedPreferences.getInstance();
    final empresaId = prefs.getInt('empresa_id');
    final url = ApiService.baseUrl.replaceAll('/api', '/public/formulario.html?empresa=$empresaId');
    
    showDialog(context: context, builder: (_) => AlertDialog(
      title: const Text('QR para Empleados', textAlign: TextAlign.center),
      content: SizedBox(
        width: 250,
        height: 250,
        child: QrImageView(data: url, version: QrVersions.auto, size: 250),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cerrar'))]
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(empresa.isEmpty ? 'Asistencia' : empresa),
        actions: [IconButton(onPressed: _logout, icon: const Icon(Icons.logout))],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
          _load();
        },
        icon: const Icon(Icons.person_add),
        label: const Text('Empleado'),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.primaryContainer),
                      icon: const Icon(Icons.qr_code_2),
                      label: const Text('Mostrar QR de la Empresa (Para Imprimir)'),
                      onPressed: _showQR,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.history),
                          label: const Text('Historial'),
                          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HistoryScreen())),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.settings),
                          label: const Text('Config.'),
                          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ConfigScreen())),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text('Empleados de esta empresa', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (empleados.isEmpty) const Text('No hay empleados registrados.'),
                  ...empleados.map((e) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.badge),
                          title: Text(e['nombre'] ?? ''),
                          subtitle: Text('Cédula: ${e['cedula']} - ${e['cargo'] ?? ''}'),
                          trailing: IconButton(
                            icon: const Icon(Icons.qr_code),
                            onPressed: () async {
                              final r = await ApiService.scanCedula('${e['cedula']}');
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r['message'] ?? 'Registrado')));
                            },
                          ),
                        ),
                      )),
                ],
              ),
            ),
    );
  }
}
