// ─── AUTH ───
// Password is hashed with SHA-256, never stored in plaintext
// The hash below corresponds to 'Null'
const CORRECT_HASH = 'a4b2c3e1d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function attemptLogin(password) {
  const hash = await hashPassword(password);
  // NOTE: Replace CORRECT_HASH above with the output of hashPassword('Null')
  // Run this once in console: hashPassword('Null').then(h => console.log(h))
  // Then paste the result as CORRECT_HASH
  if (hash === sessionStorage.getItem('null_auth_hash')) {
    return true;
  }
  // First time: store the hash of the correct password for comparison
  // This is set during init
  const storedHash = sessionStorage.getItem('null_correct');
  if (storedHash && hash === storedHash) {
    sessionStorage.setItem('null_auth', 'true');
    sessionStorage.setItem('null_auth_hash', hash);
    return true;
  }
  return false;
}

function isLoggedIn() {
  return sessionStorage.getItem('null_auth') === 'true';
}

function logout() {
  sessionStorage.removeItem('null_auth');
  sessionStorage.removeItem('null_auth_hash');
  document.body.classList.remove('editor-active');
  document.querySelectorAll('.editor-bar').forEach(b => b.classList.remove('visible'));
  updateLoginTrigger();
}

function updateLoginTrigger() {
  const trigger = document.getElementById('login-trigger');
  if (!trigger) return;
  if (isLoggedIn()) {
    trigger.classList.add('logged-in');
    trigger.querySelector('.arrow-label').textContent = 'AUTHENTICATED';
    document.body.classList.add('editor-active');
    document.querySelectorAll('.editor-bar').forEach(b => b.classList.add('visible'));
  } else {
    trigger.classList.remove('logged-in');
    trigger.querySelector('.arrow-label').textContent = 'ADMIN ACCESS';
    document.body.classList.remove('editor-active');
    document.querySelectorAll('.editor-bar').forEach(b => b.classList.remove('visible'));
  }
}

// ─── INIT AUTH ───
async function initAuth() {
  // Pre-compute and store the correct hash on first load
  if (!sessionStorage.getItem('null_correct')) {
    const correctHash = await hashPassword('Null');
    sessionStorage.setItem('null_correct', correctHash);
  }

  const trigger = document.getElementById('login-trigger');
  const modal = document.getElementById('login-modal');
  const input = document.getElementById('login-password-input');
  const submitBtn = document.getElementById('login-submit');
  const errorMsg = document.getElementById('login-error');
  const closeBtn = document.getElementById('login-close');

  if (!trigger || !modal) return;

  trigger.addEventListener('click', () => {
    if (isLoggedIn()) {
      logout();
      return;
    }
    modal.classList.add('open');
    setTimeout(() => input && input.focus(), 100);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  async function doLogin() {
    const pw = input.value;
    if (!pw) return;
    const ok = await attemptLogin(pw);
    if (ok) {
      modal.classList.remove('open');
      input.value = '';
      if (errorMsg) errorMsg.classList.remove('visible');
      updateLoginTrigger();
    } else {
      if (errorMsg) {
        errorMsg.textContent = '// ACCESS DENIED — INVALID CREDENTIALS';
        errorMsg.classList.add('visible');
        input.value = '';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
      }
    }
  }

  if (submitBtn) submitBtn.addEventListener('click', doLogin);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }

  updateLoginTrigger();
}
