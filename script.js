let selectedFile = null;
let authMode = 'login';
let pollAbort = false;
let currentCaseId = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  initializeDragAndDrop();
  updateAuthUI();
  if (Auth.isLoggedIn()) loadMyReports();
  handleCaseFromUrl();
});

function initializeEventListeners() {
  const imageInput = document.getElementById('imageInput');
  if (imageInput) imageInput.addEventListener('change', handleFileSelect);

  document.getElementById('selectImageBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('imageInput')?.click();
  });

  document.getElementById('navLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('navRegisterBtn')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('navLogoutBtn')?.addEventListener('click', logout);
  document.getElementById('authModalClose')?.addEventListener('click', closeAuthModal);
  document.getElementById('authSwitchBtn')?.addEventListener('click', toggleAuthMode);
  document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);
  document.getElementById('authModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'authModal') closeAuthModal();
  });

  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      animateHamburger();
    });
    document.querySelectorAll('.nav-menu a').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        resetHamburger();
      });
    });
  }

  initNavHighlight();
}

function initializeDragAndDrop() {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });
  uploadArea.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    document.getElementById('imageInput')?.click();
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('请选择图片文件（JPG、PNG 等格式）');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('图片文件过大，请选择小于 10MB 的图片');
    return;
  }
  selectedFile = file;
  showImagePreview(file);
}

function showImagePreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImage = document.getElementById('previewImage');
    const previewArea = document.getElementById('imagePreview');
    const uploadArea = document.getElementById('uploadArea');
    if (previewImage) previewImage.src = e.target.result;
    if (previewArea && uploadArea) {
      previewArea.style.display = 'block';
      uploadArea.style.display = 'none';
      previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  reader.onerror = () => showError('图片加载失败，请重试');
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  if (!selectedFile) {
    showError('请先选择图片');
    return;
  }

  pollAbort = false;
  showLoadingState('正在上传并分析，请稍候...');

  try {
    const json = await API.uploadCase(selectedFile);
    const data = json.data;
    currentCaseId = data.case_id;
    localStorage.setItem('lastCaseId', data.case_id);

    showUploadResult(data);
    startPolling(data.case_id);
  } catch (error) {
    showError(error.message || '上传分析失败，请重试');
  }
}

function showUploadResult(data) {
  hideAllStates();

  const ai = data.ai_result || {};
  setClassification(ai.label, ai.confidence);
  setRecommendations(ai.recommendations);
  setReviewBadge('pending', '待医生复核');
  showCaseId(data.case_id);

  const heatmapImage = document.getElementById('heatmapImage');
  const heatmapPlaceholder = document.getElementById('heatmapPlaceholder');
  if (heatmapImage && heatmapPlaceholder) {
    heatmapImage.src = API.caseImageUrl(data.case_id);
    heatmapImage.style.display = 'block';
    heatmapPlaceholder.style.display = 'none';
  }

  document.getElementById('doctorReportSection').style.display = 'none';
  document.getElementById('pollStatusText').style.display = 'block';
  document.getElementById('pollStatusText').textContent = '已提交，正在等待医生复核，请稍候...';

  document.getElementById('modelPrediction').style.display = 'block';
  document.getElementById('analysisResult').style.display = 'block';
}

async function startPolling(caseId) {
  try {
    const data = await API.pollCase(caseId, {
      intervalMs: 5000,
      onTick: (d) => {
        if (pollAbort) return;
        const el = document.getElementById('pollStatusText');
        if (el && d.status === 'pending_review') {
          el.textContent = '医生正在复核中，请稍候...';
        }
      },
    });
    if (pollAbort) return;
    await showReviewedResult(caseId, data);
  } catch (error) {
    if (!pollAbort) {
      const el = document.getElementById('pollStatusText');
      if (el) {
        el.style.display = 'block';
        el.textContent = error.message + ' 您可凭报告编号稍后查看。';
      }
    }
  }
}

async function showReviewedResult(caseId, caseData) {
  setReviewBadge('done', '已复核');
  document.getElementById('pollStatusText').style.display = 'none';

  let report = null;
  try {
    const json = await API.getReport(caseId, 'patient');
    report = json.data;
  } catch (_) { /* 报告可能尚未就绪 */ }

  const section = document.getElementById('doctorReportSection');
  const content = document.getElementById('doctorReportContent');
  if (report && section && content) {
    section.style.display = 'block';
    content.innerHTML = `
      <p><strong>${escapeHtml(report.summary || report.doctor_conclusion || '')}</strong></p>
      <p class="report-meta">${escapeHtml(report.ai_preliminary || '')}</p>
      <p class="report-meta">${escapeHtml(report.doctor_conclusion || '')}</p>
      ${report.note ? `<p class="report-note">校正说明：${escapeHtml(report.note)}</p>` : ''}
      ${report.advice?.length ? `<ul>${report.advice.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}
    `;
  } else if (caseData.review) {
    section.style.display = 'block';
    content.innerHTML = `<p>医生已复核：${escapeHtml(caseData.review.doctor_label || caseData.review.action)}</p>`;
  }

  if (Auth.isLoggedIn()) loadMyReports();
}

function setClassification(label, confidence) {
  const el = document.getElementById('classification');
  if (!el) return;
  el.textContent = label || '未知';
  el.className = label === '乳牙滞留' ? 'classification' : 'classification normal';
  document.getElementById('confidence').textContent =
    confidence != null ? `${(confidence * 100).toFixed(2)}%` : 'N/A';
}

function setRecommendations(list) {
  const ul = document.getElementById('recommendationsList');
  if (!ul) return;
  ul.innerHTML = '';
  (list && list.length ? list : ['暂无特殊建议，请保持口腔卫生']).forEach((rec) => {
    const li = document.createElement('li');
    li.textContent = rec;
    ul.appendChild(li);
  });
}

function setReviewBadge(type, text) {
  const badge = document.getElementById('reviewStatusBadge');
  if (!badge) return;
  badge.className = `review-status-badge ${type}`;
  badge.textContent = text;
}

function showCaseId(caseId) {
  const row = document.getElementById('caseIdRow');
  const text = document.getElementById('caseIdText');
  if (row && text) {
    row.style.display = 'flex';
    text.textContent = caseId;
  }
}

function showLoadingState(msg) {
  hideAllStates();
  const loading = document.getElementById('loadingState');
  const loadingText = document.getElementById('loadingText');
  if (loadingText) loadingText.textContent = msg || '正在处理...';
  if (loading) loading.style.display = 'block';
}

function showError(message) {
  hideAllStates();
  document.getElementById('errorText').textContent = message;
  document.getElementById('errorMessage').style.display = 'block';
}

function hideAllStates() {
  ['loadingState', 'modelPrediction', 'analysisResult', 'errorMessage'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function resetUpload() {
  pollAbort = true;
  selectedFile = null;
  currentCaseId = null;
  const imageInput = document.getElementById('imageInput');
  if (imageInput) imageInput.value = '';

  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) uploadArea.style.display = 'block';

  const previewArea = document.getElementById('imagePreview');
  if (previewArea) {
    previewArea.style.display = 'none';
    const previewImage = document.getElementById('previewImage');
    if (previewImage) previewImage.src = '';
  }

  hideAllStates();
  document.getElementById('doctorReportSection').style.display = 'none';
  document.getElementById('pollStatusText').style.display = 'none';
  document.getElementById('caseIdRow').style.display = 'none';

  const heatmapImage = document.getElementById('heatmapImage');
  if (heatmapImage) {
    heatmapImage.src = '';
    heatmapImage.style.display = 'none';
  }
}

/* ===== 账号 ===== */

function openAuthModal(mode) {
  authMode = mode;
  document.getElementById('authModalTitle').textContent = mode === 'login' ? '用户登录' : '用户注册';
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? '登录' : '注册';
  document.getElementById('authSwitchText').textContent = mode === 'login' ? '还没有账号？' : '已有账号？';
  document.getElementById('authSwitchBtn').textContent = mode === 'login' ? '立即注册' : '去登录';
  document.getElementById('authFormError').style.display = 'none';
  document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('authForm').reset();
}

function toggleAuthMode() {
  openAuthModal(authMode === 'login' ? 'register' : 'login');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authFormError');
  const btn = document.getElementById('authSubmitBtn');

  errEl.style.display = 'none';
  btn.disabled = true;

  try {
    if (authMode === 'register') {
      await API.register(username, password);
    } else {
      const json = await API.login(username, password);
      if (json.data.role === 'doctor') {
        window.location.href = 'doctor.html';
        return;
      }
    }
    closeAuthModal();
    updateAuthUI();
    loadMyReports();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  Auth.clear();
  updateAuthUI();
  document.getElementById('my-reports').style.display = 'none';
}

function updateAuthUI() {
  const loggedIn = Auth.isLoggedIn();
  document.getElementById('navLoginBtn').style.display = loggedIn ? 'none' : 'inline-block';
  document.getElementById('navRegisterBtn').style.display = loggedIn ? 'none' : 'inline-block';
  document.getElementById('navLogoutBtn').style.display = loggedIn ? 'inline-block' : 'none';
  document.querySelector('.nav-reports-link').style.display = loggedIn ? 'inline' : 'none';

  const greeting = document.getElementById('navUserGreeting');
  if (loggedIn) {
    greeting.textContent = `你好，${Auth.getUsername()}`;
    greeting.style.display = 'inline';
    document.getElementById('my-reports').style.display = 'block';
  } else {
    greeting.style.display = 'none';
  }
}

async function loadMyReports() {
  if (!Auth.isLoggedIn()) return;
  const listEl = document.getElementById('myReportsList');
  const emptyEl = document.getElementById('myReportsEmpty');
  if (!listEl) return;

  try {
    const json = await API.getMyCases();
    const items = json.data?.items || [];
    if (items.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = items
      .map(
        (item) => `
      <div class="report-card" data-case-id="${item.case_id}">
        <div class="report-card-head">
          <span class="report-status status-${item.status}">${statusLabel(item.status)}</span>
          <span class="report-date">${formatDate(item.created_at)}</span>
        </div>
        <p>AI：${escapeHtml(item.ai_label)}（${((item.confidence || 0) * 100).toFixed(1)}%）</p>
        ${item.doctor_label ? `<p>医生：${escapeHtml(item.doctor_label)}</p>` : ''}
        <button type="button" class="btn-secondary btn-sm" onclick="viewCaseReport('${item.case_id}')">查看详情</button>
      </div>`
      )
      .join('');
  } catch (_) {
    emptyEl.textContent = '加载报告失败，请稍后重试';
    emptyEl.style.display = 'block';
  }
}

async function viewCaseReport(caseId) {
  showLoadingState('加载报告...');
  try {
    const caseJson = await API.getCase(caseId);
    hideAllStates();
    currentCaseId = caseId;
    const data = caseJson.data;
    const ai = data.ai_result || {};
    setClassification(ai.label, ai.confidence);
    setRecommendations(ai.recommendations);
    showCaseId(caseId);

    const heatmapImage = document.getElementById('heatmapImage');
    if (heatmapImage) {
      heatmapImage.src = API.caseImageUrl(caseId);
      heatmapImage.style.display = 'block';
    }
    document.getElementById('heatmapPlaceholder').style.display = 'none';
    document.getElementById('modelPrediction').style.display = 'block';
    document.getElementById('analysisResult').style.display = 'block';

    if (data.status === 'archived' || data.review) {
      await showReviewedResult(caseId, data);
    } else {
      setReviewBadge('pending', '待医生复核');
      document.getElementById('doctorReportSection').style.display = 'none';
      document.getElementById('pollStatusText').style.display = 'block';
      document.getElementById('pollStatusText').textContent = '等待医生复核中...';
      pollAbort = false;
      startPolling(caseId);
    }
    document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showError(error.message);
  }
}

async function handleCaseFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('case');
  if (caseId) await viewCaseReport(caseId);
}

function statusLabel(status) {
  const map = {
    pending_review: '待复核',
    confirmed: '已确认',
    corrected: '已校正',
    archived: '已完成',
  };
  return map[status] || status;
}

function formatDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleString('zh-CN');
  } catch {
    return str;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.analyzeImage = analyzeImage;
window.resetUpload = resetUpload;
window.viewCaseReport = viewCaseReport;

function animateHamburger() {
  const spans = document.querySelectorAll('.hamburger span');
  const navMenu = document.querySelector('.nav-menu');
  spans.forEach((span, index) => {
    if (navMenu.classList.contains('active')) {
      if (index === 0) span.style.transform = 'rotate(45deg) translate(5px, 5px)';
      if (index === 1) span.style.opacity = '0';
      if (index === 2) span.style.transform = 'rotate(-45deg) translate(7px, -6px)';
    } else {
      span.style.transform = 'none';
      span.style.opacity = '1';
    }
  });
}

function resetHamburger() {
  document.querySelectorAll('.hamburger span').forEach((span) => {
    span.style.transform = 'none';
    span.style.opacity = '1';
  });
}

window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  navbar.style.boxShadow =
    window.pageYOffset > 50 ? '0 2px 12px rgba(0, 0, 0, 0.1)' : '0 1px 4px rgba(0, 0, 0, 0.04)';
});

function initNavHighlight() {
  const sections = document.querySelectorAll('#home, #upload, #my-reports, #contact');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateActive() {
    let current = 'home';
    const scrollY = window.pageYOffset + 100;
    sections.forEach((section) => {
      if (section.offsetParent !== null && scrollY >= section.offsetTop) current = section.id;
    });
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }

  window.addEventListener('scroll', updateActive);
  updateActive();
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('.why-card, .process-step').forEach((card) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition = 'all 0.6s ease';
  observer.observe(card);
});

window.addEventListener('load', () => {
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.innerHTML = '↑';
  scrollTopBtn.className = 'scroll-top-btn';
  scrollTopBtn.style.cssText = `
    position: fixed; bottom: 30px; right: 30px; width: 50px; height: 50px;
    background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; border: none;
    border-radius: 50%; font-size: 1.5rem; cursor: pointer; opacity: 0;
    transition: all 0.3s ease; z-index: 999; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(scrollTopBtn);
  window.addEventListener('scroll', () => {
    scrollTopBtn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    scrollTopBtn.style.pointerEvents = window.pageYOffset > 300 ? 'auto' : 'none';
  });
  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});
