const fetch = require('node-fetch');
const getRawBody = require('raw-body');

const BACKEND = 'http://60.28.106.46:15025';

async function readRequestBody(req) {
  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');

  if (Buffer.isBuffer(req.body) && req.body.length) return req.body;
  if (typeof req.body === 'string' && req.body.length) return Buffer.from(req.body);
  if (!isMultipart && req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  return getRawBody(req, {
    length: req.headers['content-length'],
    limit: isMultipart ? '12mb' : '2mb',
  });
}

async function handler(req, res) {
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
      const rawBody = await readRequestBody(req);
      if (rawBody.length) {
        init.body = rawBody;
        headers['Content-Length'] = String(rawBody.length);
      }
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
}

// 必须挂在 handler 上再导出，否则 bodyParser:false 不生效，multipart 会丢失
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
