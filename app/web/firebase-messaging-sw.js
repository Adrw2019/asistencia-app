// Firebase Cloud Messaging Service Worker para Web Push en segundo plano
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCdftcgffAtHMpBoeIw2frkjyxR_Zuw6uU",
  authDomain: "asistenciaapp-3ec4a.firebaseapp.com",
  projectId: "asistenciaapp-3ec4a",
  storageBucket: "asistenciaapp-3ec4a.firebasestorage.app",
  messagingSenderId: "543127917229",
  appId: "1:543127917229:android:3a734ce31cd08f28ccec24"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje push recibido en segundo plano:', payload);
  const title = payload.notification?.title || payload.data?.titulo || 'Asistencia';
  const options = {
    body: payload.notification?.body || payload.data?.mensaje || '',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    tag: 'asistencia-notificacion',
    renotify: true,
    data: payload.data || {}
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
