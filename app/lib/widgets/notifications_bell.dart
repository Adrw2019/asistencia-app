import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class NotificationsBell extends StatefulWidget {
  const NotificationsBell({super.key});

  @override
  State<NotificationsBell> createState() => _NotificationsBellState();
}

class _NotificationsBellState extends State<NotificationsBell> {
  int _unreadCount = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _fetchUnreadCount();
    // Consulta ligera del contador cada 20 segundos
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) _fetchUnreadCount();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchUnreadCount() async {
    final res = await ApiService.getNotificacionesNoLeidasCount();
    if (mounted && res['success'] == true) {
      setState(() {
        _unreadCount = res['count'] is int ? res['count'] : int.tryParse(res['count'].toString()) ?? 0;
      });
    }
  }

  void _openNotificationsPanel() {
    final isMobile = MediaQuery.of(context).size.width < 600;
    if (isMobile) {
      showModalBottomSheet(
        context: context,
        backgroundColor: const Color(0xFF111328),
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (_) => _NotificationsContent(
          onNotificationRead: () {
            _fetchUnreadCount();
          },
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (_) => Dialog(
          backgroundColor: const Color(0xFF111328),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480, maxHeight: 600),
            child: _NotificationsContent(
              onNotificationRead: () {
                _fetchUnreadCount();
              },
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          tooltip: 'Notificaciones',
          icon: const Icon(Icons.notifications_outlined, color: Colors.white, size: 26),
          onPressed: _openNotificationsPanel,
        ),
        if (_unreadCount > 0)
          Positioned(
            top: 8,
            right: 8,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Color(0xFFE53935), // Rojo vibrante
                  shape: BoxShape.circle,
                ),
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                child: Text(
                  _unreadCount > 99 ? '99+' : '$_unreadCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _NotificationsContent extends StatefulWidget {
  final VoidCallback onNotificationRead;

  const _NotificationsContent({required this.onNotificationRead});

  @override
  State<_NotificationsContent> createState() => _NotificationsContentState();
}

class _NotificationsContentState extends State<_NotificationsContent> {
  List<dynamic> _notificaciones = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _loading = true);
    final res = await ApiService.getNotificaciones();
    if (mounted) {
      setState(() {
        _notificaciones = res['success'] == true ? (res['data'] ?? []) : [];
        _loading = false;
      });
    }
  }

  Future<void> _markAsRead(dynamic notif, int index) async {
    if (notif['leida'] == 1) return;
    setState(() {
      _notificaciones[index]['leida'] = 1;
    });
    widget.onNotificationRead();
    await ApiService.marcarNotificacionLeida(notif['id']);
  }

  Future<void> _markAllAsRead() async {
    setState(() {
      for (var n in _notificaciones) {
        n['leida'] = 1;
      }
    });
    widget.onNotificationRead();
    await ApiService.marcarTodasNotificacionesLeidas();
  }

  String _formatDateTime(dynamic dtStr) {
    if (dtStr == null) return '';
    try {
      final dt = DateTime.parse(dtStr.toString()).toLocal();
      final day = dt.day.toString().padLeft(2, '0');
      final month = dt.month.toString().padLeft(2, '0');
      final hour = dt.hour.toString().padLeft(2, '0');
      final min = dt.minute.toString().padLeft(2, '0');
      return '$day/$month - $hour:$min';
    } catch (_) {
      return dtStr.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Barra de arrastre para móviles
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Encabezado
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.notifications, color: Color(0xFFE0A96D), size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Notificaciones',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              if (_notificaciones.any((n) => n['leida'] == 0))
                TextButton(
                  onPressed: _markAllAsRead,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFE0A96D),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child: const Text(
                    'Marcar todas leídas',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
            ],
          ),
          const Divider(color: Colors.white12, height: 16),
          // Lista de notificaciones
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFE0A96D)))
                : _notificaciones.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.notifications_none, size: 52, color: Colors.white24),
                            SizedBox(height: 12),
                            Text(
                              'No hay notificaciones nuevas',
                              style: TextStyle(color: Colors.white54, fontSize: 15),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadNotifications,
                        color: const Color(0xFFE0A96D),
                        child: ListView.separated(
                          itemCount: _notificaciones.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final notif = _notificaciones[index];
                            final bool isLeida = notif['leida'] == 1;
                            final bool isEntrada = notif['tipo'] == 'entrada';
                            final String titulo = notif['titulo'] ?? (isEntrada ? 'Nueva entrada' : 'Nueva salida');
                            final String mensaje = notif['mensaje'] ?? '';
                            final String fechaHora = _formatDateTime(notif['created_at']);
                            final dynamic horasTrabajadas = notif['horas_trabajadas'];

                            return Material(
                              color: isLeida ? const Color(0xFF1D1E33) : const Color(0xFF252846),
                              borderRadius: BorderRadius.circular(12),
                              child: InkWell(
                                onTap: () => _markAsRead(notif, index),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Ícono de tipo
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: isEntrada
                                              ? Colors.green.withAlpha(38)
                                              : Colors.orange.withAlpha(38),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          isEntrada ? Icons.login : Icons.logout,
                                          color: isEntrada ? Colors.greenAccent : Colors.orangeAccent,
                                          size: 20,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      // Contenido de la notificación
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  titulo,
                                                  style: TextStyle(
                                                    fontWeight: isLeida ? FontWeight.w600 : FontWeight.bold,
                                                    color: isLeida ? Colors.white70 : Colors.white,
                                                    fontSize: 14,
                                                  ),
                                                ),
                                                Text(
                                                  fechaHora,
                                                  style: const TextStyle(
                                                    color: Colors.white38,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              mensaje,
                                              style: TextStyle(
                                                color: isLeida ? Colors.white60 : Colors.white,
                                                fontSize: 13,
                                              ),
                                            ),
                                            if (horasTrabajadas != null && horasTrabajadas.toString() != '0.00') ...[
                                              const SizedBox(height: 4),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFE0A96D).withAlpha(38),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  'Horas trabajadas: $horasTrabajadas h',
                                                  style: const TextStyle(
                                                    color: Color(0xFFE0A96D),
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      if (!isLeida) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          margin: const EdgeInsets.only(top: 4),
                                          width: 8,
                                          height: 8,
                                          decoration: const BoxDecoration(
                                            color: Color(0xFFE0A96D),
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
