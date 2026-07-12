const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let messaging = null;

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./firebase-adminsdk.json');
  }
  
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  
  messaging = getMessaging(app);
  console.log('Firebase Admin SDK inicializado correctamente');
} catch (error) {
  console.error('Error inicializando Firebase Admin SDK:', error.message);
}

module.exports = messaging;
