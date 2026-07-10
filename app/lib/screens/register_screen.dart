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
      appBar: AppBar(title: const Text('Registrar empleado')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(controller: _cedula, decoration: const InputDecoration(labelText: 'Cédula'), validator: (v) => v == null || v.isEmpty ? 'Ingrese cédula' : null),
              TextFormField(controller: _nombre, decoration: const InputDecoration(labelText: 'Nombre'), validator: (v) => v == null || v.isEmpty ? 'Ingrese nombre' : null),
              TextFormField(controller: _celular, decoration: const InputDecoration(labelText: 'Celular')),
              TextFormField(controller: _cargo, decoration: const InputDecoration(labelText: 'Cargo')),
              const SizedBox(height: 20),
              SizedBox(width: double.infinity, child: ElevatedButton(onPressed: loading ? null : _save, child: Text(loading ? 'Guardando...' : 'Guardar'))),
            ],
          ),
        ),
      ),
    );
  }
}
