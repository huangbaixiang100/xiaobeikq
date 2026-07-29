const DISEASE_LABELS = ['非乳牙滞留', '乳牙滞留', '龋病', '牙周炎'];
const REVIEWED_DAYS = 30;
const REVIEWED_STATUSES = new Set(['confirmed', 'corrected', 'archived']);

let currentTab = 'pending';
let currentReviewCaseId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (Auth.getRole() === 'doctor' && Auth.getToken()) {
    showWorkSection();
    loadCurrentTab();
  }

  document.getElementById('doctorLoginForm')?.addEventListener('submit', handleDoctorLogin);
  document.getElementById('doctorLogoutBtn')?.addEventListener('click', doctorLogout);
  document.getElementById('doctorLogoutToolbarBtn')?.addEventListener('click', doctorLogout);
  document.getElementById('filterDays')?.addEventListener('change', loadReviewList);
  document.getElementById('refreshListBtn')?.addEventListener('click', loadReviewList);
  document.getElementById('refreshReviewedBtn')?.addEventListener('click', loadReviewedList);

  document.querySelectorAll('.doctor-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('reviewModalClose')?.addEventListener('click', closeReviewModal);
  document.getElementById('reviewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'reviewModal') closeReviewModal();
  });
  document.getElementById('reviewedModalClose')?.addEventListener('click', closeReviewedModal);
  document.getElementById('reviewedModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'reviewedModal') closeReviewedModal();
  });

  document.getElementById('confirmBtn')?.addEventListener('click', handleConfirm);
  document.getElementById('correctBtn')?.addEventListener('click', handleCorrect);
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.doctor-tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const isPending = tab === 'pending';
  document.getElementById('listTitle').innerHTML = isPending
    ? '待复核队列 <span id="pendingCount" class="pending-badge">0</span>'
    : '已复核（近30天）';
  document.getElementById('pendingFilters').style.display = isPending ? 'flex' : 'none';
  document.getElementById('reviewedFilters').style.display = isPending ? 'none' : 'flex';

  loadCurrentTab();
}

function loadCurrentTab() {
  if (currentTab === 'pending') loadReviewList();
  else loadReviewedList();
}

async function handleDoctorLogin(e) {
  e.preventDefault();
  const username = document.getElementById('doctorUsername').value.trim();
  const password = document.getElementById('doctorPassword').value;
  const errEl = document.getElementById('doctorLoginError');
  errEl.style.display = 'none';

  try {
    const json = await API.login(username, password);
    if (json.data.role !== 'doctor') {
      Auth.clear();
      throw new Error('此账号不是医生账号');
    }
    showWorkSection();
    loadCurrentTab();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
  }
}

function doctorLogout() {
  Auth.clear();
  currentTab = 'pending';
  document.getElementById('doctorWorkSection').style.display = 'none';
  document.getElementById('doctorLoginSection').style.display = 'block';
  document.getElementById('doctorGreeting').style.display = 'none';
  document.getElementById('doctorLogoutBtn').style.display = 'none';
  document.getElementById('doctorLogoutToolbarBtn').style.display = 'none';
  document.getElementById('doctorPassword').value = '';
}

function showWorkSection() {
  document.getElementById('doctorLoginSection').style.display = 'none';
  document.getElementById('doctorWorkSection').style.display = 'block';
  document.getElementById('doctorGreeting').textContent = `医生：${Auth.getUsername()}`;
  document.getElementById('doctorGreeting').style.display = 'inline';
  document.getElementById('doctorLogoutBtn').style.display = 'inline-block';
  document.getElementById('doctorLogoutToolbarBtn').style.display = 'inline-block';
}

async function loadReviewList() {
  const days = document.getElementById('filterDays').value;
  const listEl = document.getElementById('reviewList');
  const emptyEl = document.getElementById('reviewListEmpty');
  emptyEl.textContent = '暂无待复核病例';

  try {
    const json = await API.reviewList({ status: 'pending', days: Number(days) });
    const data = json.data;
    const badge = document.getElementById('pendingCount');
    if (badge) badge.textContent = data.pending_count ?? data.total ?? 0;

    renderPendingItems(data.items || [], listEl, emptyEl);
  } catch (error) {
    handleListError(error, emptyEl);
  }
}

async function loadReviewedList() {
  const listEl = document.getElementById('reviewList');
  const emptyEl = document.getElementById('reviewListEmpty');
  emptyEl.textContent = '近 30 天内暂无已复核病例';

  try {
    // 后端仅支持 status=pending|all，days=1|7|0（不支持 30、reviewed）
    const json = await API.reviewList({ status: 'all', days: 0, page_size: 100 });
    const items = (json.data?.items || [])
      .filter((item) => isReviewedItem(item))
      .filter((item) => isWithinLastDays(item.reviewed_at || item.created_at, REVIEWED_DAYS))
      .sort((a, b) => new Date(b.reviewed_at || b.created_at) - new Date(a.reviewed_at || a.created_at));

    renderReviewedItems(items, listEl, emptyEl);
  } catch (error) {
    handleListError(error, emptyEl);
  }
}

function isReviewedItem(item) {
  if (item.status) return REVIEWED_STATUSES.has(item.status);
  // 部分后端不在 list 里返回 status，用复核字段判断
  return Boolean(item.reviewed_at || item.doctor_label || item.review_action);
}

function isWithinLastDays(dateStr, days) {
  if (!dateStr) return true;
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return true;
  return time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function renderPendingItems(items, listEl, emptyEl) {
  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = items
    .map(
      (item) => `
    <div class="review-list-item">
      <img src="${API.caseImageUrl(item.case_id)}" alt="缩略图" class="review-thumb">
      <div class="review-list-info">
        <p><strong>${escapeHtml(item.ai_label)}</strong> · ${((item.confidence || 0) * 100).toFixed(1)}%</p>
        <p class="review-list-meta">${sourceLabel(item.source)} · ${formatDate(item.created_at)}</p>
      </div>
      <button type="button" class="btn-primary btn-sm" onclick="openReview('${item.case_id}')">复核</button>
    </div>`
    )
    .join('');
}

function renderReviewedItems(items, listEl, emptyEl) {
  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = items
    .map((item) => {
      const actionLabel = item.review_action === 'correct' ? '已校正' : '已确认';
      const doctorLabel = item.doctor_label || item.ai_label || '—';
      return `
    <div class="review-list-item review-list-item-done">
      <img src="${API.caseImageUrl(item.case_id)}" alt="缩略图" class="review-thumb">
      <div class="review-list-info">
        <p>
          <span class="review-done-badge">${actionLabel}</span>
          AI：${escapeHtml(item.ai_label)} · 医生：${escapeHtml(doctorLabel)}
        </p>
        <p class="review-list-meta">
          ${sourceLabel(item.source)} · 复核于 ${formatDate(item.reviewed_at || item.created_at)}
        </p>
      </div>
      <button type="button" class="btn-secondary btn-sm" onclick="openReviewedCase('${item.case_id}')">查看</button>
    </div>`;
    })
    .join('');
}

function handleListError(error, emptyEl) {
  if (error.status === 401) {
    doctorLogout();
    document.getElementById('doctorLoginError').textContent = '登录已过期，请重新登录';
    document.getElementById('doctorLoginError').style.display = 'block';
  } else {
    emptyEl.textContent = error.message;
    emptyEl.style.display = 'block';
  }
}

async function openReview(caseId) {
  currentReviewCaseId = caseId;
  document.getElementById('reviewActionError').style.display = 'none';
  document.getElementById('reviewActionSuccess').style.display = 'none';

  try {
    const json = await API.reviewDetail(caseId);
    const data = json.data;
    const ai = data.ai_result || {};

    document.getElementById('reviewImage').src = API.caseImageUrl(caseId);
    document.getElementById('reviewAiInfo').innerHTML = `
      <p><strong>AI 判定：</strong>${escapeHtml(ai.label)}（${((ai.confidence || 0) * 100).toFixed(1)}%）</p>
      ${ai.recommendations?.length ? `<ul>${ai.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
    `;
    document.getElementById('reviewMeta').textContent =
      `${sourceLabel(data.source)} · ${formatDate(data.created_at)}`;

    const labelSelect = document.getElementById('correctLabel');
    labelSelect.innerHTML = DISEASE_LABELS.map(
      (l) => `<option value="${l}" ${l === ai.label ? 'selected' : ''}>${l}</option>`
    ).join('');

    document.getElementById('reviewModal').style.display = 'flex';
  } catch (error) {
    alert(error.message);
  }
}

async function openReviewedCase(caseId) {
  try {
    const [caseJson, reportJson] = await Promise.all([
      API.getCase(caseId),
      API.getProfessionalReport(caseId).catch(() => null),
    ]);
    const data = caseJson.data;
    const ai = data.ai_result || {};
    const review = data.review || {};
    const report = reportJson?.data;

    document.getElementById('reviewedImage').src = API.caseImageUrl(caseId);
    document.getElementById('reviewedDetailContent').innerHTML = `
      <p class="review-meta">${sourceLabel(data.source)} · 上传于 ${formatDate(data.created_at)}</p>
      <div class="reviewed-compare">
        <p><strong>AI 判定：</strong>${escapeHtml(ai.label)}（${((ai.confidence || 0) * 100).toFixed(1)}%）</p>
        <p><strong>医生结论：</strong>${escapeHtml(review.doctor_label || report?.doctor_diagnosis?.label || '—')}</p>
        <p><strong>复核操作：</strong>${review.action === 'correct' ? '校正' : '确认'}</p>
        ${review.note ? `<p><strong>校正说明：</strong>${escapeHtml(review.note)}</p>` : ''}
        ${review.reviewed_at ? `<p class="review-list-meta">复核时间：${formatDate(review.reviewed_at)}</p>` : ''}
      </div>
      ${report?.comparison ? `<p class="report-note">${escapeHtml(report.comparison)}</p>` : ''}
      ${report?.recommendations?.length ? `<ul>${report.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
    `;
    document.getElementById('reviewedModal').style.display = 'flex';
  } catch (error) {
    alert(error.message);
  }
}

function closeReviewModal() {
  document.getElementById('reviewModal').style.display = 'none';
  currentReviewCaseId = null;
}

function closeReviewedModal() {
  document.getElementById('reviewedModal').style.display = 'none';
}

async function handleConfirm() {
  if (!currentReviewCaseId) return;
  setReviewButtonsDisabled(true);
  try {
    await API.reviewConfirm(currentReviewCaseId);
    document.getElementById('reviewActionSuccess').textContent = '已确认，报告已生成';
    document.getElementById('reviewActionSuccess').style.display = 'block';
    setTimeout(() => {
      closeReviewModal();
      loadCurrentTab();
    }, 800);
  } catch (error) {
    document.getElementById('reviewActionError').textContent = error.message;
    document.getElementById('reviewActionError').style.display = 'block';
  } finally {
    setReviewButtonsDisabled(false);
  }
}

async function handleCorrect() {
  if (!currentReviewCaseId) return;
  const label = document.getElementById('correctLabel').value;
  const note = document.getElementById('correctNote').value.trim();
  if (!note) {
    document.getElementById('reviewActionError').textContent = '请填写校正说明';
    document.getElementById('reviewActionError').style.display = 'block';
    return;
  }

  setReviewButtonsDisabled(true);
  try {
    await API.reviewCorrect(currentReviewCaseId, label, note);
    document.getElementById('reviewActionSuccess').textContent = '已校正，报告已生成';
    document.getElementById('reviewActionSuccess').style.display = 'block';
    setTimeout(() => {
      closeReviewModal();
      loadCurrentTab();
    }, 800);
  } catch (error) {
    document.getElementById('reviewActionError').textContent = error.message;
    document.getElementById('reviewActionError').style.display = 'block';
  } finally {
    setReviewButtonsDisabled(false);
  }
}

function setReviewButtonsDisabled(disabled) {
  document.getElementById('confirmBtn').disabled = disabled;
  document.getElementById('correctBtn').disabled = disabled;
}

function sourceLabel(source) {
  return source === 'guest' ? '快速使用' : '注册用户';
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

window.openReview = openReview;
window.openReviewedCase = openReviewedCase;
