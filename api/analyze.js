// Vercel Serverless Function
const fetch = require('node-fetch');
const getRawBody = require('raw-body');

async function readRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
  }
  return getRawBody(req, {
    length: req.headers['content-length'],
    limit: '12mb',
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    const API_URL = 'http://60.28.106.46:15025/api/v1/analyze';

    const save_image_flag = req.query.save_image_flag === 'true';
    const include_heatmap = req.query.include_heatmap === 'true';
    const apiUrl = `${API_URL}?save_image_flag=${save_image_flag}&include_heatmap=${include_heatmap}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: rawBody,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(rawBody.length),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}

handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
