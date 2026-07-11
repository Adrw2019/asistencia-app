import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppLockWrapper extends StatefulWidget {
  final Widget child;
  const AppLockWrapper({super.key, required this.child});

  @override
  State<AppLockWrapper> createState() => _AppLockWrapperState();
}

class _AppLockWrapperState extends State<AppLockWrapper> {
  Timer? _timer;
  bool _isLocked = false;
  final TextEditingController _pinController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _startTimer();
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
      setState(() {
        _isLocked = false;
        _pinController.clear();
      });
      _startTimer();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingrese la contraseña para desbloquear')));
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
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.lock, size: 80, color: Color(0xFFE0A96D)),
                      const SizedBox(height: 24),
                      const Text(
                        'Aplicación Bloqueada',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
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
                        child: ElevatedButton(
                          onPressed: _unlockApp,
                          child: const Text('Desbloquear'),
                        ),
                      )
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
