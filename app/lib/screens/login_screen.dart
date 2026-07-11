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
      backgroundColor: const Color(0xFF0A0E21),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.business_center, size: 80, color: Color(0xFFE0A96D)),
              const SizedBox(height: 24),
              const Text('Asistencia Premium', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              const Text('Control de personal para empresas', style: TextStyle(fontSize: 16, color: Colors.white54)),
              const SizedBox(height: 48),
              TextField(
                controller: _user,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Usuario / Empresa', labelStyle: TextStyle(color: Colors.white70), prefixIcon: Icon(Icons.person, color: Color(0xFFE0A96D)), enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.white30))),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _pass,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Contraseña', labelStyle: TextStyle(color: Colors.white70), prefixIcon: Icon(Icons.lock, color: Color(0xFFE0A96D)), enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.white30))),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE0A96D)),
                  onPressed: _loading ? null : _login,
                  child: Text(_loading ? 'INGRESANDO...' : 'INGRESAR', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                child: const Text('¿Olvidaste tu contraseña?', style: TextStyle(color: Colors.white70)),
              ),
              TextButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterCompanyScreen())),
                child: const Text('Crear nueva empresa', style: TextStyle(color: Color(0xFFE0A96D), fontWeight: FontWeight.bold)),
              )
            ],
          ),
        ),
      ),
    );
  }
}
