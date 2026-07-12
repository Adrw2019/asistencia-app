const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK inicializado');
} catch (error) {
  console.error('Error inicializando Firebase Admin SDK:', error);
}

module.exports = admin;
