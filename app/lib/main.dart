import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'screens/login_screen.dart';
import 'services/notification_service.dart';
import 'widgets/app_lock_wrapper.dart'; // Crearemos este wrapper de seguridad

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: "AIzaSyCdftcgffAtHMpBoeIw2frkjyxR_Zuw6uU",
      appId: "1:543127917229:android:3a734ce31cd08f28ccec24",
      messagingSenderId: "543127917229",
      projectId: "asistenciaapp-3ec4a",
      storageBucket: "asistenciaapp-3ec4a.firebasestorage.app",
    ),
  );
  NotificationService.showNotification(
    title: message.notification?.title ?? 'Notificación',
    body: message.notification?.body ?? '',
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.init();
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: "AIzaSyCdftcgffAtHMpBoeIw2frkjyxR_Zuw6uU",
        appId: "1:543127917229:android:3a734ce31cd08f28ccec24",
        messagingSenderId: "543127917229",
        projectId: "asistenciaapp-3ec4a",
        storageBucket: "asistenciaapp-3ec4a.firebasestorage.app",
      ),
    );
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint("Firebase init error: $e");
  }
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Asistencia',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0E21),
        primaryColor: const Color(0xFF1D1E33),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFE0A96D), // Dorado
          secondary: Color(0xFF1D1E33),
          surface: Color(0xFF1D1E33),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0E21),
          elevation: 0,
          centerTitle: true,
        ),
        textTheme: GoogleFonts.montserratTextTheme(ThemeData.dark().textTheme),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFE0A96D),
            foregroundColor: Colors.black87,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF111328),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE0A96D))),
        ),
      ),
      builder: (context, child) => AppLockWrapper(child: child!),
      home: const LoginScreen(),
    );
  }
}
