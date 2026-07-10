PROYECTO ASISTENCIA CORREGIDO - MULTIEMPRESA + DOBLE TURNO

CAMBIOS REALIZADOS
1. Sistema multiempresa:
   - Se agregó tabla empresas.
   - usuarios, empleados, asistencias y fcm_tokens ahora usan empresa_id.
   - Cada administrador solo ve empleados y reportes de su empresa.

2. Doble turno:
   - Si el empleado escanea y no tiene turno abierto, registra ENTRADA.
   - Si el empleado escanea y tiene turno abierto, registra SALIDA.
   - Después de la salida puede volver a escanear y abre otra ENTRADA.
   - Esto permite: entrada/salida/entrada/salida el mismo día.

3. Cálculos:
   - Lunes a sábado: 08:00 a 17:30, 9.5 horas.
   - Domingo: 09:00 a 14:00, 5 horas.
   - Valor día: 60.000 COP.
   - Valor hora lunes-sábado: 60000 / 9.5.
   - Extras: antes de la hora de entrada y después de la hora de salida.
   - Extra al 150%.
   - Descuento por llegada tarde y salida anticipada.

4. App Flutter:
   - Login corregido.
   - Se quitó Firebase para evitar error de configuración.
   - Se agregó escáner QR con mobile_scanner.
   - Se agregó registro manual por cédula.
   - IMPORTANTE: en app/lib/services/api_service.dart cambie la IP por la IP de su PC.

COMO INSTALAR EN WAMP
1. Abra phpMyAdmin.
2. Cree o seleccione la base asistencia.
3. Si quiere borrar y empezar limpio, importe:
   backend/sql/asistencia_multiempresa.sql
4. Si quiere conservar datos actuales, primero haga copia de seguridad y luego importe:
   backend/sql/migracion_sin_borrar_datos.sql

COMO CORRER EL BACKEND
1. Abra CMD en la carpeta backend.
2. Ejecute:
   npm install
   npm start

Debe salir:
Servidor funcionando en http://localhost:5000

USUARIO DE PRUEBA
Usuario: admin
Contraseña: 1234

COMO CORRER LA APP
1. En app/lib/services/api_service.dart cambie:
   http://192.168.0.13:5000/api
   por la IP real del PC donde corre el backend.
2. Abra CMD en la carpeta app.
3. Ejecute:
   flutter pub get
   flutter run

COMO GENERAR APK
En la carpeta app ejecute:
flutter clean
flutter pub get
flutter build apk --release

La APK queda en:
build/app/outputs/flutter-apk/app-release.apk
