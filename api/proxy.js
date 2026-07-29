const fetch = require('node-fetch');
const getRawBody = require('raw-body');

const BACKEND = 'http://60.28.106.46:15025';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const path = req.query.path || '';
    const backendPath = `/api/v1/${path}`;

    const qs = new URLSearchParams();
    Object.entries(req.query).forEach(([key, val]) => {
      if (key !== 'path' && val != null) qs.set(key, val);
    });
    const queryStr = qs.toString();
    const url = `${BACKEND}${backendPath}${queryStr ? `?${queryStr}` : ''}`;

    const headers = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (req.headers['accept']) headers['Accept'] = req.headers['accept'];

    const init = { method: req.method, headers };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const rawBody = await getRawBody(req);
      if (rawBody.length) init.body = rawBody;
    }

    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
      return;
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    const buffer = await response.buffer();
    res.status(response.status).send(buffer);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      detail: {
        success: false,
        error_code: 'PROXY_ERROR',
        message: error.message,
      },
    });
  }
};
