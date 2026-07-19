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
  String _turno = '06:00';
  final Map<String, String> _turnosOpciones = {
    '06:00': '06:00 a 14:00 (6 AM - 2 PM)',
    '07:00': '07:00 a 15:00 (7 AM - 3 PM)',
    '14:00': '14:00 a 22:00 (2 PM - 10 PM)',
    '15:00': '15:00 a 23:00 (3 PM - 11 PM)',
  };
  bool loading = false;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => loading = true);
    try {
      final r = await ApiService.registerEmployee(_cedula.text.trim(), _nombre.text.trim(), _celular.text.trim(), _cargo.text.trim(), _turno);
      if (!mounted) return;
      setState(() => loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r['message'] ?? 'Proceso realizado')));
      if (r['success'] == true) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => loading = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error de conexión con el servidor')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E21),
      appBar: AppBar(title: const Text('Registrar Empleado', style: TextStyle(color: Color(0xFFE0A96D)))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.person_add_alt_1, size: 80, color: Color(0xFFE0A96D)),
              const SizedBox(height: 24),
              const Text('Nuevo Miembro del Equipo', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 32),
              TextFormField(
                controller: _nombre, 
                style: const TextStyle(color: Colors.white), 
                decoration: const InputDecoration(labelText: 'Nombre Completo', prefixIcon: Icon(Icons.person, color: Color(0xFFE0A96D))),
                validator: (value) => value!.isEmpty ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _cedula, 
                keyboardType: TextInputType.number, 
                style: const TextStyle(color: Colors.white), 
                decoration: const InputDecoration(labelText: 'Número de Cédula (Login)', prefixIcon: Icon(Icons.badge, color: Color(0xFFE0A96D))),
                validator: (value) => value!.isEmpty ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _celular, 
                keyboardType: TextInputType.phone, 
                style: const TextStyle(color: Colors.white), 
                decoration: const InputDecoration(labelText: 'Celular', prefixIcon: Icon(Icons.phone, color: Color(0xFFE0A96D))),
                validator: (value) => value!.isEmpty ? 'Campo requerido' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _cargo, 
                style: const TextStyle(color: Colors.white), 
                decoration: const InputDecoration(labelText: 'Cargo (Opcional)', prefixIcon: Icon(Icons.work, color: Color(0xFFE0A96D))),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _turno,
                dropdownColor: const Color(0xFF1E2235),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Turno Asignado', prefixIcon: Icon(Icons.access_time, color: Color(0xFFE0A96D))),
                items: _turnosOpciones.entries.map((entry) {
                  return DropdownMenuItem<String>(
                    value: entry.key,
                    child: Text(entry.value),
                  );
                }).toList(),
                onChanged: (newValue) {
                  if (newValue != null) {
                    setState(() { _turno = newValue; });
                  }
                },
              ),
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
      ),
    );
  }
}
