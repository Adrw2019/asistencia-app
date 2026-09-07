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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Por favor completa todos los campos requeridos')));
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
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('¡Empresa registrada exitosamente!')));
      Navigator.pop(context); // Volver al login
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(r['message'] ?? 'Error de registro')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(
        title: const Text('Registrar Empresa',
            style: TextStyle(color: Color(0xFFE0A96D))),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.storefront,
                      size: 80, color: Color(0xFFE0A96D)),
                  const SizedBox(height: 24),
                  const Text('Crea tu cuenta empresarial',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                  const SizedBox(height: 32),
                  TextField(
                      controller: _empresa,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                          labelText: 'Nombre de la Empresa',
                          labelStyle: TextStyle(color: Colors.white70),
                          prefixIcon:
                              Icon(Icons.business, color: Color(0xFFE0A96D)),
                          enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white30)))),
                  const SizedBox(height: 16),
                  TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                          labelText: 'Correo Electrónico',
                          labelStyle: TextStyle(color: Colors.white70),
                          prefixIcon:
                              Icon(Icons.email, color: Color(0xFFE0A96D)),
                          enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white30)))),
                  const SizedBox(height: 16),
                  TextField(
                      controller: _user,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                          labelText: 'Usuario Administrador',
                          labelStyle: TextStyle(color: Colors.white70),
                          prefixIcon:
                              Icon(Icons.person, color: Color(0xFFE0A96D)),
                          enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white30)))),
                  const SizedBox(height: 16),
                  TextField(
                      controller: _pass,
                      obscureText: true,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                          labelText: 'Contraseña',
                          labelStyle: TextStyle(color: Colors.white70),
                          prefixIcon:
                              Icon(Icons.lock, color: Color(0xFFE0A96D)),
                          enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.white30)))),
                  const SizedBox(height: 32),
                  SizedBox(
                    height: 55,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE0A96D)),
                      onPressed: _loading ? null : _register,
                      child: Text(
                          _loading ? 'CREANDO CUENTA...' : 'CREAR EMPRESA',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.black)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
