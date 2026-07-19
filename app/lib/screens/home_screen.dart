import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'register_screen.dart';
import 'login_screen.dart';
import 'config_screen.dart';
import 'history_screen.dart';
import 'summary_screen.dart';

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
    _setupFCM();
  }

  Future<void> _setupFCM() async {
    FirebaseMessaging messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    String? token = await messaging.getToken();
    if (token != null) {
      await ApiService.updateFCMToken(token);
    }
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
    final downloadUrl = ApiService.baseUrl.replaceAll('/api', '/imprimir-qr?empresa_id=$empresaId');
    
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF111328),
      title: const Text('QR para Empleados', textAlign: TextAlign.center, style: TextStyle(color: Colors.white)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
            child: SizedBox(
              width: 250,
              height: 250,
              child: QrImageView(data: url, version: QrVersions.auto, size: 250, backgroundColor: Colors.white),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              final uri = Uri.parse(downloadUrl);
              launchUrl(uri, mode: LaunchMode.externalApplication).catchError((e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al abrir el navegador')));
                }
                return false;
              });
            },
            icon: const Icon(Icons.download),
            label: const Text('Descargar para imprimir'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE0A96D),
              foregroundColor: const Color(0xFF0A0E21),
            ),
          ),
        ],
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cerrar', style: TextStyle(color: Colors.white54)))]
    ));
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF111328),
        title: const Text('Eliminar Empleado', style: TextStyle(color: Colors.white)),
        content: Text('¿Estás seguro que deseas eliminar a $nombre?', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.white54))),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteEmployee(id);
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteEmployee(int id) async {
    setState(() => loading = true);
    final res = await ApiService.deleteEmployee(id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Eliminado')));
    }
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E21),
        title: Text(empresa.isEmpty ? 'Asistencia' : empresa, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE0A96D))),
        actions: [
          IconButton(icon: const Icon(Icons.logout, color: Colors.white70), onPressed: _logout),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Opciones Principales', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildOptionCard(
                          icon: Icons.qr_code,
                          title: 'Código QR',
                          onTap: _showQR,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildOptionCard(
                          icon: Icons.history,
                          title: 'Historial',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HistoryScreen())),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildOptionCard(
                          icon: Icons.bar_chart,
                          title: 'Resumen',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SummaryScreen())),
                        ),
                      ),
                      const SizedBox(width: 8),
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
                  ...empleados.map((e) => Card(
                    color: const Color(0xFF111328),
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: ListTile(
                      leading: const Icon(Icons.badge, color: Color(0xFFE0A96D)),
                      title: Text(e['nombre'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      subtitle: Text('Cédula: ${e['cedula']} - ${e['cargo'] ?? ''}', style: const TextStyle(color: Colors.white54)),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.redAccent),
                        onPressed: () => _confirmDelete(e['id'], e['nombre']),
                      ),
                    ),
                  )).toList(),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())).then((_) => _load()),
        backgroundColor: const Color(0xFFE0A96D),
        foregroundColor: const Color(0xFF0A0E21),
        icon: const Icon(Icons.person_add),
        label: const Text('Empleado', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildOptionCard({required IconData icon, required String title, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: const Color(0xFF1D1E33),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white10),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 4))],
        ),
        child: Column(
          children: [
            Icon(icon, size: 36, color: const Color(0xFFE0A96D)),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}
