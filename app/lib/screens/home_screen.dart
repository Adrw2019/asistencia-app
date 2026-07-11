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
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E21),
        title: Text(empresa.isEmpty ? 'Asistencia Premium' : empresa, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE0A96D))),
        actions: [
          IconButton(icon: const Icon(Icons.logout, color: Colors.white70), onPressed: _logout),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Opciones Principales', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70)),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE0A96D),
                        foregroundColor: const Color(0xFF0A0E21),
                        padding: const EdgeInsets.symmetric(vertical: 20)
                      ),
                      icon: const Icon(Icons.qr_code_2, size: 28),
                      label: const Text('Mostrar QR de la Empresa (Para Imprimir)', style: TextStyle(fontSize: 16)),
                      onPressed: _showQR,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildOptionCard(
                          icon: Icons.history,
                          title: 'Historial',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HistoryScreen())),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildOptionCard(
                          icon: Icons.settings,
                          title: 'Config.',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ConfigScreen())),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Empleados de esta empresa', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70)),
                  const SizedBox(height: 12),
                  ..._empleados.map((e) => Card(
                    color: const Color(0xFF111328),
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: ListTile(
                      leading: const Icon(Icons.badge, color: Color(0xFFE0A96D)),
                      title: Text(e['nombre'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      subtitle: Text('Cédula: ${e['cedula']} - ${e['cargo'] ?? ''}', style: const TextStyle(color: Colors.white54)),
                      trailing: const Icon(Icons.qr_code, color: Colors.white30),
                    ),
                  )).toList(),
                ],
              ),
            ),
    );
  }
}
