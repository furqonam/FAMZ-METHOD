/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/account.js
   Account Modal — profil user (nama, TG, avatar)
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _account = {
  name: 'Guest',
  tgId: '',
  tgUser: '',
  avatar: ''
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — LOAD / SAVE
   ───────────────────────────────────────────────────────────── */
function loadAccount() {
  try {
    const raw = localStorage.getItem('famz_account');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        _account = Object.assign(_account, data);
      }
    }
  } catch (e) {
    console.warn('[FAMZ] Load account failed', e);
  }
  renderAccount();
}

function saveAccount() {
  const nameEl = document.getElementById('prof_name');
  const tgEl = document.getElementById('tg_id');
  const userEl = document.getElementById('tg_user');

  _account.name = (nameEl ? nameEl.value : '').trim() || 'Guest';
  _account.tgId = (tgEl ? tgEl.value : '').trim();
  _account.tgUser = (userEl ? userEl.value : '').trim();

  try {
    localStorage.setItem('famz_account', JSON.stringify(_account));
    renderAccount();
    showToast('Profile saved', 'success');
    setTimeout(closeAccountModal, 800);
  } catch (e) {
    showToast('Save gagal', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — RENDER
   ───────────────────────────────────────────────────────────── */
function renderAccount() {
  const nameEl = document.getElementById('who_name');
  const roleEl = document.getElementById('who_role');
  const initEl = document.getElementById('av_initial');
  const imgEl = document.getElementById('av_img');
  const nameInput = document.getElementById('prof_name');
  const tgInput = document.getElementById('tg_id');
  const userInput = document.getElementById('tg_user');

  const name = _account.name || 'Guest';

  if (nameEl) nameEl.textContent = name;
  if (roleEl) {
    roleEl.textContent = _account.tgId ? 'Telegram Linked' : 'Guest User';
  }
  if (initEl) initEl.textContent = name.charAt(0).toUpperCase();
  if (nameInput) nameInput.value = (name !== 'Guest') ? name : '';
  if (tgInput) tgInput.value = _account.tgId || '';
  if (userInput) userInput.value = _account.tgUser || '';

  // Avatar
  if (imgEl && _account.avatar) {
    imgEl.src = _account.avatar;
    imgEl.style.display = 'block';
    if (initEl) initEl.style.display = 'none';
  } else if (imgEl) {
    imgEl.style.display = 'none';
    if (initEl) initEl.style.display = 'block';
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — MODAL
   ───────────────────────────────────────────────────────────── */
function openAccountModal() {
  loadAccount();
  renderAccount();

  const modal = document.getElementById('account_modal');
  if (modal) modal.classList.add('is-show');
}

function closeAccountModal() {
  const modal = document.getElementById('account_modal');
  if (modal) modal.classList.remove('is-show');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — AVATAR UPLOAD
   ───────────────────────────────────────────────────────────── */
function onPickAvatar(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Cuma gambar', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Max 5MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (ev) {
    _account.avatar = ev.target.result;
    localStorage.setItem('famz_account', JSON.stringify(_account));

    const imgEl = document.getElementById('av_img');
    const initEl = document.getElementById('av_initial');

    if (imgEl) {
      imgEl.src = ev.target.result;
      imgEl.style.display = 'block';
    }
    if (initEl) initEl.style.display = 'none';

    showToast('Avatar updated', 'success');
  };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — LINK / UNLINK TELEGRAM
   ───────────────────────────────────────────────────────────── */
function linkTelegram() {
  const idEl = document.getElementById('tg_id');
  const userEl = document.getElementById('tg_user');
  const id = (idEl ? idEl.value : '').trim();
  const user = (userEl ? userEl.value : '').trim();

  if (!id) {
    showToast('Masukkan TG ID dulu', 'error');
    return;
  }

  _account.tgId = id;
  _account.tgUser = user;
  localStorage.setItem('famz_account', JSON.stringify(_account));
  renderAccount();
  showToast('Telegram linked', 'success');
}

function unlinkTelegram() {
  _account.tgId = '';
  _account.tgUser = '';
  localStorage.setItem('famz_account', JSON.stringify(_account));
  renderAccount();
  showToast('Telegram unlinked', 'success');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] account.js loaded');
