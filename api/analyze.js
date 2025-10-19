// Vercel Serverless Function
const fetch = require('node-fetch');
const FormData = require('form-data');
const getRawBody = require('raw-body');

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 获取原始请求体
    const rawBody = await getRawBody(req);
    
    // 解析multipart/form-data边界
    const boundary = req.headers['content-type'].split('boundary=')[1];
    
    // 转发请求到实际的API
    const API_URL = 'http://60.28.106.46:15025/api/v1/analyze';
    
    // 获取查询参数
    const save_image_flag = req.query.save_image_flag === 'true';
    const apiUrl = `${API_URL}?save_image_flag=${save_image_flag}`;

    console.log('Forwarding request to:', apiUrl);
    console.log('Content-Type:', req.headers['content-type']);

    // 转发请求，保持原始的content-type和body
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: rawBody,
      headers: {
        'Content-Type': req.headers['content-type']
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    // 获取响应数据
    const data = await response.json();

    // 返回响应
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    });
  }
};