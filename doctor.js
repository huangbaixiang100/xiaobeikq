const DISEASE_LABELS = ['非乳牙滞留', '乳牙滞留', '龋病', '牙周炎'];
let currentReviewCaseId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (Auth.getRole() === 'doctor' && Auth.getToken()) {
    showWorkSection();
    loadReviewList();
  }

  document.getElementById('doctorLoginForm')?.addEventListener('submit', handleDoctorLogin);
  document.getElementById('doctorLogoutBtn')?.addEventListener('click', doctorLogout);
  document.getElementById('filterDays')?.addEventListener('change', loadReviewList);
  document.getElementById('refreshListBtn')?.addEventListener('click', loadReviewList);
  document.getElementById('reviewModalClose')?.addEventListener('click', closeReviewModal);
  document.getElementById('reviewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'reviewModal') closeReviewModal();
  });
  document.getElementById('confirmBtn')?.addEventListener('click', handleConfirm);
  document.getElementById('correctBtn')?.addEventListener('click', handleCorrect);
});

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
    loadReviewList();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
  }
}

function doctorLogout() {
  Auth.clear();
  document.getElementById('doctorWorkSection').style.display = 'none';
  document.getElementById('doctorLoginSection').style.display = 'block';
  document.getElementById('doctorGreeting').style.display = 'none';
  document.getElementById('doctorLogoutBtn').style.display = 'none';
}

function showWorkSection() {
  document.getElementById('doctorLoginSection').style.display = 'none';
  document.getElementById('doctorWorkSection').style.display = 'block';
  document.getElementById('doctorGreeting').textContent = `医生：${Auth.getUsername()}`;
  document.getElementById('doctorGreeting').style.display = 'inline';
  document.getElementById('doctorLogoutBtn').style.display = 'inline-block';
}

async function loadReviewList() {
  const days = document.getElementById('filterDays').value;
  const listEl = document.getElementById('reviewList');
  const emptyEl = document.getElementById('reviewListEmpty');

  try {
    const json = await API.reviewList({ status: 'pending', days: Number(days) });
    const data = json.data;
    document.getElementById('pendingCount').textContent = data.pending_count ?? data.total ?? 0;

    const items = data.items || [];
    if (items.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = items
      .map(
        (item) => `
      <div class="review-list-item" data-case-id="${item.case_id}">
        <img src="${API.caseImageUrl(item.case_id)}" alt="缩略图" class="review-thumb">
        <div class="review-list-info">
          <p><strong>${escapeHtml(item.ai_label)}</strong> · ${((item.confidence || 0) * 100).toFixed(1)}%</p>
          <p class="review-list-meta">${item.source === 'guest' ? '快速使用' : '注册用户'} · ${formatDate(item.created_at)}</p>
        </div>
        <button type="button" class="btn-primary btn-sm" onclick="openReview('${item.case_id}')">复核</button>
      </div>`
      )
      .join('');
  } catch (error) {
    if (error.status === 401) {
      doctorLogout();
      document.getElementById('doctorLoginError').textContent = '登录已过期，请重新登录';
      document.getElementById('doctorLoginError').style.display = 'block';
    } else {
      emptyEl.textContent = error.message;
      emptyEl.style.display = 'block';
    }
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
      `${data.source === 'guest' ? '快速使用' : '注册用户'} · ${formatDate(data.created_at)}`;

    const labelSelect = document.getElementById('correctLabel');
    labelSelect.innerHTML = DISEASE_LABELS.map(
      (l) => `<option value="${l}" ${l === ai.label ? 'selected' : ''}>${l}</option>`
    ).join('');

    document.getElementById('reviewModal').style.display = 'flex';
  } catch (error) {
    alert(error.message);
  }
}

function closeReviewModal() {
  document.getElementById('reviewModal').style.display = 'none';
  currentReviewCaseId = null;
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
      loadReviewList();
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
      loadReviewList();
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
