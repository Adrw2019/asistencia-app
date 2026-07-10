import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';
import 'notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SocketService {
  static IO.Socket? socket;

  static Future<void> connect() async {
    if (socket != null && socket!.connected) return;
    
    final prefs = await SharedPreferences.getInstance();
    final empresaId = prefs.getInt('empresa_id');
    if (empresaId == null) return;

    final url = ApiService.baseUrl.replaceAll('/api', '');
    
    socket = IO.io(url, IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build());

    socket!.connect();

    socket!.on('nueva_asistencia', (data) {
      if (data != null && data['empresa_id'] == empresaId) {
        NotificationService.showNotification(
          title: data['titulo'] ?? 'Asistencia',
          body: data['mensaje'] ?? 'Registro completado'
        );
      }
    });
  }

  static void disconnect() {
    socket?.disconnect();
    socket = null;
  }
}
