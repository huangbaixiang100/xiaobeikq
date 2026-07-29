const BACKEND_DIRECT = 'http://60.28.106.46:15025';

/** 本地 vercel dev 对 multipart 代理有 bug，上传直连后端（后端已配 CORS） */
function isLocalDev() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/** 同源 /api/v1 经 Vercel 代理到后端；本地 file:// 可改为完整地址 */
const API_BASE = (() => {
  if (window.location.protocol === 'file:') {
    return BACKEND_DIRECT;
  }
  return '';
})();

const API_V1 = `${API_BASE}/api/v1`;

const Auth = {
  getToken() {
    return localStorage.getItem('token');
  },
  getRole() {
    return localStorage.getItem('role');
  },
  getUsername() {
    return localStorage.getItem('username');
  },
  isLoggedIn() {
    return !!this.getToken() && this.getRole() === 'user';
  },
  saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
  },
  authHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  let body;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  if (!res.ok) {
    const err = body?.detail || body;
    let msg = err?.message || err?.detail;
    // FastAPI 422 校验错误：detail 是数组
    if (!msg && Array.isArray(err)) {
      msg = err.map((e) => e.msg || e.message).filter(Boolean).join('；');
    }
    if (!msg && typeof err === 'string') msg = err;
    if (!msg) msg = `请求失败 (${res.status})`;
    const error = new Error(msg);
    error.status = res.status;
    error.code = err?.error_code;
    error.body = body;
    throw error;
  }
  return body;
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_V1}${path}`, options);
  return parseResponse(res);
}

const API = {
  async register(username, password) {
    const json = await apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (json.data?.token) {
      Auth.saveSession({ ...json.data, role: 'user' });
    }
    return json;
  },

  async login(username, password) {
    const json = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (json.data?.token) Auth.saveSession(json.data);
    return json;
  },

  async me() {
    return apiRequest('/auth/me', { headers: { ...Auth.authHeaders() } });
  },

  async uploadCase(file) {
    const fd = new FormData();
    fd.append('file', file);
    const uploadUrl = isLocalDev()
      ? `${BACKEND_DIRECT}/api/v1/cases/upload`
      : `${API_V1}/cases/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { ...Auth.authHeaders() },
      body: fd,
    });
    return parseResponse(res);
  },

  async getCase(caseId) {
    return apiRequest(`/cases/${caseId}`);
  },

  async getMyCases(page = 1, pageSize = 20) {
    return apiRequest(`/cases/my?page=${page}&page_size=${pageSize}`, {
      headers: { ...Auth.authHeaders() },
    });
  },

  caseImageUrl(caseId) {
    return `${API_V1}/cases/${caseId}/image`;
  },

  async getReport(caseId, type = 'patient') {
    return apiRequest(`/reports/${caseId}?type=${type}`);
  },

  async pollCase(caseId, { maxAttempts = 120, intervalMs = 5000, onTick } = {}) {
    for (let i = 0; i < maxAttempts; i++) {
      const json = await this.getCase(caseId);
      const data = json.data;
      if (onTick) onTick(data, i);
      if (data.status === 'archived' || data.review) return data;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('等待医生复核超时，请稍后凭链接再次查看');
  },

  async reviewList(params = {}) {
    const q = new URLSearchParams({
      status: params.status || 'pending',
      days: params.days ?? 7,
      page: params.page || 1,
      page_size: params.page_size || 20,
    });
    return apiRequest(`/review/list?${q}`, { headers: { ...Auth.authHeaders() } });
  },

  async reviewDetail(caseId) {
    return apiRequest(`/review/${caseId}`, { headers: { ...Auth.authHeaders() } });
  },

  async reviewConfirm(caseId) {
    return apiRequest(`/review/${caseId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.authHeaders() },
      body: '{}',
    });
  },

  async reviewCorrect(caseId, label, note) {
    return apiRequest(`/review/${caseId}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.authHeaders() },
      body: JSON.stringify({ label, note }),
    });
  },

  async getProfessionalReport(caseId) {
    return this.getReport(caseId, 'professional');
  },
};

window.API = API;
window.Auth = Auth;
window.API_BASE = API_BASE;
