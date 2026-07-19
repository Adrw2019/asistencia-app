import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // IMPORTANTE:
  // Puede generar la APK para diferentes empresas inyectando la variable BASE_URL.
  // Ejemplo: flutter build apk --release --dart-define=BASE_URL=http://api.empresa1.com
  // Si no se inyecta, usa la IP por defecto.
  static String baseUrl = const String.fromEnvironment('BASE_URL', defaultValue: 'https://asistencia-app-92to.onrender.com/api');

  static Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _headers() async {
    final token = await _token();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    final data = _decode(response);
    if (response.statusCode == 200 && data['success'] == true) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setInt('empresa_id', data['user']['empresa_id'] ?? 0);
      await prefs.setString('empresa_nombre', data['user']['empresa_nombre'] ?? '');
    }
    return data;
  }
  static Future<Map<String, dynamic>> registerCompany(String empresa, String email, String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'empresa_nombre': empresa, 'email': email, 'username': username, 'password': password}),
    );
    return _decode(response);
  }

  static Future<Map<String, dynamic>> forgotPassword(String emailOrUser) async {
    // Placeholder - usually this calls an endpoint that sends an email
    await Future.delayed(const Duration(seconds: 1));
    return {'success': true, 'message': 'Si el usuario existe, se han enviado instrucciones para recuperar la contraseña (Simulado)'};
  }

  static Future<Map<String, dynamic>> registerEmployee(String cedula, String nombre, String celular, String cargo, [String turno = '06:00']) async {
    final response = await http.post(
      Uri.parse('$baseUrl/employees/register'),
      headers: await _headers(),
      body: jsonEncode({'cedula': cedula, 'nombre': nombre, 'celular': celular, 'cargo': cargo, 'turno': turno}),
    );
    return _decode(response);
  }

  static Future<Map<String, dynamic>> updateEmployeeTurno(int id, String turno) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/employees/$id/turno'),
        headers: await _headers(),
        body: jsonEncode({'turno': turno}),
      );
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> getEmployees() async {
    final response = await http.get(Uri.parse('$baseUrl/employees'), headers: await _headers());
    return _decode(response);
  }

  static Future<Map<String, dynamic>> scanCedula(String cedula) async {
    final response = await http.post(
      Uri.parse('$baseUrl/asistencias/scan'),
      headers: await _headers(),
      body: jsonEncode({'cedula': cedula}),
    );
    return _decode(response);
  }

  static Future<Map<String, dynamic>> historial() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/asistencias/historial'), headers: await _headers());
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> resumen({String? desde, String? hasta}) async {
    try {
      String url = '$baseUrl/asistencias/resumen';
      List<String> queryParams = [];
      if (desde != null) queryParams.add('desde=$desde');
      if (hasta != null) queryParams.add('hasta=$hasta');
      if (queryParams.isNotEmpty) {
        url += '?${queryParams.join('&')}';
      }
      final response = await http.get(Uri.parse(url), headers: await _headers());
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> getConfig() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/empresas/config'), headers: await _headers());
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> updateConfig(Map<String, dynamic> config) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/empresas/config'),
        headers: await _headers(),
        body: jsonEncode(config),
      );
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> deleteEmployee(int id) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl/employees/$id'), headers: await _headers());
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> deleteHistory(int id) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl/asistencias/$id'), headers: await _headers());
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Future<Map<String, dynamic>> updateFCMToken(String token) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/fcm-token'),
        headers: await _headers(),
        body: jsonEncode({'fcm_token': token}),
      );
      return _decode(response);
    } catch (e) {
      return {'success': false, 'message': 'Error de conexión: $e'};
    }
  }

  static Map<String, dynamic> _decode(http.Response response) {
    try {
      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) return data;
      return {'success': false, 'message': 'Respuesta inválida'};
    } catch (_) {
      return {'success': false, 'message': response.body.isNotEmpty ? response.body : 'Error ${response.statusCode}'};
    }
  }
}
