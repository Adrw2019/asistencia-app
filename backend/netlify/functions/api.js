const serverless = require('serverless-http');
const app = require('../../server');

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  if (event.path) {
    let cleanPath = event.path.replace(/^\/\.netlify\/functions\/api/, '');
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    if (!cleanPath.startsWith('/api') && cleanPath !== '/' && !cleanPath.startsWith('/imprimir-qr') && !cleanPath.startsWith('/public') && !cleanPath.startsWith('/descargar-app')) {
      cleanPath = '/api' + cleanPath;
    }
    event.path = cleanPath;
  }
  return await handler(event, context);
};
