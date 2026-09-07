// api/proxy.js - Secure Backend API Proxy to hide the Kirka.io ApiKey from client F12 DevTools
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse target path & host (supports /api -> api.kirka.io, /api2 -> api2.kirka.io)
  const isApi2 = req.url.startsWith('/api2');
  const path = isApi2 ? req.url.replace(/^\/api2/, '') : req.url.replace(/^\/api/, '');
  const targetHost = isApi2 ? 'https://api2.kirka.io' : 'https://api.kirka.io';
  const targetUrl = `${targetHost}/api${path}`;

  const apiKey = process.env.KIRKA_API_KEY || '';
  const headers = {
    'ApiKey': apiKey,
    'Content-Type': 'application/json'
  };

  const options = {
    method: req.method,
    headers
  };

  if (req.method === 'POST' || req.method === 'PUT') {
    if (req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
  }

  try {
    const response = await fetch(targetUrl, options);
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (err) {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
}
