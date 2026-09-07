import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../screens/login_screen.dart';

class AppLockWrapper extends StatefulWidget {
  final Widget child;
  const AppLockWrapper({super.key, required this.child});

  @override
  State<AppLockWrapper> createState() => _AppLockWrapperState();
}

class _AppLockWrapperState extends State<AppLockWrapper>
    with WidgetsBindingObserver {
  Timer? _timer;
  bool _isLocked = false;
  bool _isLoading = false;
  final TextEditingController _pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startTimer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _lockApp();
    } else if (state == AppLifecycleState.resumed) {
      _handleUserInteraction();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer(const Duration(minutes: 2), _lockApp);
  }

  void _handleUserInteraction([_]) {
    if (!_isLocked) {
      _startTimer();
    }
  }

  Future<void> _lockApp() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token != null && token.isNotEmpty) {
      setState(() {
        _isLocked = true;
      });
    }
  }

  Future<void> _unlockApp() async {
    if (_pinController.text.isNotEmpty) {
      setState(() => _isLoading = true);
      final prefs = await SharedPreferences.getInstance();
      final username = prefs.getString('username') ?? '';

      // Llamamos a un servicio de validación o reutilizamos el login para validar la contraseña
      // Aquí simulamos que usamos ApiService.login, asumiendo que está importado en este archivo.
      // (Añadiremos la importación de ApiService arriba).
      final r = await ApiService.login(username, _pinController.text);

      setState(() => _isLoading = false);

      if (r['success'] == true) {
        setState(() {
          _isLocked = false;
          _pinController.clear();
        });
        _startTimer();
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Contraseña incorrecta')));
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Ingrese la contraseña para desbloquear')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _handleUserInteraction,
      onPanDown: _handleUserInteraction,
      onScaleStart: _handleUserInteraction,
      child: Stack(
        children: [
          widget.child,
          if (_isLocked)
            Material(
              color: Theme.of(context).scaffoldBackgroundColor,
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24.0, vertical: 24.0),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 520),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(Icons.lock,
                              size: 80, color: Color(0xFFE0A96D)),
                          const SizedBox(height: 24),
                          const Text(
                            'Aplicación Bloqueada',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 24, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Por seguridad, la aplicación se ha bloqueado por inactividad. Sigue recibiendo notificaciones en segundo plano.',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 32),
                          TextField(
                            controller: _pinController,
                            obscureText: true,
                            decoration: const InputDecoration(
                              labelText: 'Contraseña para desbloquear',
                              prefixIcon: Icon(Icons.password),
                            ),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _unlockApp,
                              child: Text(_isLoading
                                  ? 'Verificando...'
                                  : 'Desbloquear'),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Center(
                            child: TextButton(
                              onPressed: () async {
                                final prefs =
                                    await SharedPreferences.getInstance();
                                await prefs.clear();
                                if (!mounted) return;
                                setState(() {
                                  _isLocked = false;
                                  _pinController.clear();
                                });
                                Navigator.pushAndRemoveUntil(
                                  context,
                                  MaterialPageRoute(
                                      builder: (context) =>
                                          const LoginScreen()),
                                  (Route<dynamic> route) => false,
                                );
                              },
                              child: const Text('Cerrar Sesión',
                                  style: TextStyle(color: Colors.white70)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
