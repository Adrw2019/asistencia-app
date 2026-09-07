import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailOrUser = TextEditingController();
  bool _loading = false;

  Future<void> _recover() async {
    if (_emailOrUser.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Por favor ingresa tu usuario o correo')));
      return;
    }

    setState(() => _loading = true);
    final r = await ApiService.forgotPassword(_emailOrUser.text.trim());
    if (!mounted) return;
    setState(() => _loading = false);

    if (r['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(r['message'] ?? 'Instrucciones enviadas')));
      Navigator.pop(context); // Volver al login
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(r['message'] ?? 'Error de recuperación')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recuperar Contraseña')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: Card(
                elevation: 3,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_reset, size: 60),
                      const SizedBox(height: 12),
                      const Text('¿Olvidaste tu contraseña?',
                          style: TextStyle(
                              fontSize: 22, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      const Text(
                          'Ingresa tu usuario o correo electrónico para recibir las instrucciones de recuperación.',
                          textAlign: TextAlign.center),
                      const SizedBox(height: 20),
                      TextField(
                          controller: _emailOrUser,
                          decoration: const InputDecoration(
                              labelText: 'Usuario o correo',
                              border: OutlineInputBorder())),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _loading ? null : _recover,
                          icon: _loading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.send),
                          label: Text(_loading
                              ? 'Enviando...'
                              : 'Recuperar Contraseña'),
                        ),
                      )
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
