import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'home_screen.dart';
import 'register_company_screen.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController(text: 'admin');
  final _pass = TextEditingController(text: '1234');
  bool _loading = false;

  Future<void> _login() async {
    setState(() => _loading = true);
    final r = await ApiService.login(_user.text.trim(), _pass.text.trim());
    if (!mounted) return;
    setState(() => _loading = false);
    if (r['success'] == true) {
      await SocketService.connect();
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r['message'] ?? 'Error de login')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                  Image.asset('assets/logo.png', width: 100, height: 100, errorBuilder: (c, e, s) => const Icon(Icons.qr_code_scanner, size: 70)),
                  const SizedBox(height: 12),
                  const Text('Control de Asistencia', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  TextField(controller: _user, decoration: const InputDecoration(labelText: 'Usuario o correo', border: OutlineInputBorder())),
                  const SizedBox(height: 12),
                  TextField(controller: _pass, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña', border: OutlineInputBorder())),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _loading ? null : _login,
                      icon: _loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.login),
                      label: Text(_loading ? 'Ingresando...' : 'Ingresar'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterCompanyScreen())),
                    child: const Text('¿No tienes cuenta? Registra tu empresa aquí', textAlign: TextAlign.center),
                  ),
                  TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                    child: const Text('Olvidé mi contraseña', textAlign: TextAlign.center),
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
