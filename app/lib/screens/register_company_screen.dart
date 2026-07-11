import 'package:flutter/material.dart';
import '../services/api_service.dart';

class RegisterCompanyScreen extends StatefulWidget {
  const RegisterCompanyScreen({super.key});

  @override
  State<RegisterCompanyScreen> createState() => _RegisterCompanyScreenState();
}

class _RegisterCompanyScreenState extends State<RegisterCompanyScreen> {
  final _empresa = TextEditingController();
  final _email = TextEditingController();
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;

  Future<void> _register() async {
    if (_empresa.text.isEmpty || _user.text.isEmpty || _pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor completa todos los campos requeridos')));
      return;
    }

    setState(() => _loading = true);
    final r = await ApiService.registerCompany(
      _empresa.text.trim(),
      _email.text.trim(),
      _user.text.trim(),
      _pass.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (r['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('¡Empresa registrada exitosamente!')));
      Navigator.pop(context); // Volver al login
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r['message'] ?? 'Error de registro')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registrar Empresa')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Card(
            elevation: 3,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.business, size: 60),
                  const SizedBox(height: 12),
                  const Text('Nueva Empresa', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  TextField(controller: _empresa, decoration: const InputDecoration(labelText: 'Nombre de la empresa *', border: OutlineInputBorder())),
                  const SizedBox(height: 12),
                  TextField(controller: _email, decoration: const InputDecoration(labelText: 'Correo electrónico', border: OutlineInputBorder())),
                  const SizedBox(height: 12),
                  TextField(controller: _user, decoration: const InputDecoration(labelText: 'Usuario administrador *', border: OutlineInputBorder())),
                  const SizedBox(height: 12),
                  TextField(controller: _pass, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña *', border: OutlineInputBorder())),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _loading ? null : _register,
                      icon: _loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.app_registration),
                      label: Text(_loading ? 'Registrando...' : 'Registrar Empresa'),
                    ),
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
