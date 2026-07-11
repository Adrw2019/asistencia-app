import 'package:flutter/material.dart';
import '../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cedula = TextEditingController();
  final _nombre = TextEditingController();
  final _celular = TextEditingController();
  final _cargo = TextEditingController();
  bool loading = false;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => loading = true);
    final r = await ApiService.registerEmployee(_cedula.text.trim(), _nombre.text.trim(), _celular.text.trim(), _cargo.text.trim());
    if (!mounted) return;
    setState(() => loading = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r['message'] ?? 'Proceso realizado')));
    if (r['success'] == true) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(title: const Text('Registrar Empleado', style: TextStyle(color: Color(0xFFE0A96D)))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.person_add_alt_1, size: 80, color: Color(0xFFE0A96D)),
            const SizedBox(height: 24),
            const Text('Nuevo Miembro del Equipo', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 32),
            TextField(controller: _nombre, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Nombre Completo', prefixIcon: Icon(Icons.person, color: Color(0xFFE0A96D)))),
            const SizedBox(height: 16),
            TextField(controller: _cedula, keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Número de Cédula (Login)', prefixIcon: Icon(Icons.badge, color: Color(0xFFE0A96D)))),
            const SizedBox(height: 16),
            TextField(controller: _celular, keyboardType: TextInputType.phone, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Celular', prefixIcon: Icon(Icons.phone, color: Color(0xFFE0A96D)))),
            const SizedBox(height: 16),
            TextField(controller: _cargo, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Cargo (Opcional)', prefixIcon: Icon(Icons.work, color: Color(0xFFE0A96D)))),
            const SizedBox(height: 32),
            SizedBox(
              height: 55,
              child: ElevatedButton(
                onPressed: loading ? null : _save,
                child: Text(loading ? 'GUARDANDO...' : 'REGISTRAR EMPLEADO', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
