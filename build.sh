#!/usr/bin/env bash
set -e

# 1. Configurar Flutter 3.41.6
if [ ! -d "/tmp/flutter" ]; then
  git clone --depth 1 --branch 3.41.6 https://github.com/flutter/flutter.git /tmp/flutter
fi
export PATH="/tmp/flutter/bin:$PATH"
flutter --version

# 2. Instalar dependencias del Backend
npm ci --prefix backend

# 3. Compilar Flutter Web
cd app
flutter pub get
flutter build web --release --dart-define=BASE_URL=https://asistencia-app-andres.netlify.app/api
cd ..

# 4. Copiar páginas auxiliares y APK
mkdir -p app/build/web/public
cp backend/public/formulario.html app/build/web/public/
cp backend/public/generar-qr.html app/build/web/public/
cp backend/public/app-release.apk app/build/web/public/
