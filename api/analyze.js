// Vercel Serverless Function
const fetch = require('node-fetch');
const FormData = require('form-data');

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
    // 转发请求到实际的API
    const API_URL = 'http://60.28.106.46:15025/api/v1/analyze';
    
    // 获取查询参数
    const save_image_flag = req.query.save_image_flag === 'true';
    const apiUrl = `${API_URL}?save_image_flag=${save_image_flag}`;

    // 创建新的 FormData
    const formData = new FormData();
    
    // 从请求中获取文件数据
    if (!req.body || !req.body.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // 添加文件到 FormData
    formData.append('file', req.body.file);

    // 转发请求
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    // 获取响应数据
    const data = await response.json();

    // 返回响应
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};