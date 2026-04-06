// ─── GITHUB API CONFIG ───
// Set these via the admin panel or environment — NEVER hardcode token here
let GITHUB_TOKEN = sessionStorage.getItem('null_gh_token') || '';
let GITHUB_OWNER = '';
let GITHUB_REPO = 'Nullward-wiki';
let GITHUB_BRANCH = 'main';

function setGithubConfig(owner, token) {
  GITHUB_OWNER = owner;
  GITHUB_TOKEN = token;
  sessionStorage.setItem('null_gh_token', token);
  sessionStorage.setItem('null_gh_owner', owner);
}

function loadGithubConfig() {
  GITHUB_OWNER = sessionStorage.getItem('null_gh_owner') || '';
  GITHUB_TOKEN = sessionStorage.getItem('null_gh_token') || '';
}

// ─── FETCH FILE FROM GITHUB ───
async function githubGetFile(path) {
  loadGithubConfig();
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub GET failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    content: JSON.parse(atob(data.content.replace(/\n/g, ''))),
    sha: data.sha
  };
}

// ─── SAVE FILE TO GITHUB ───
async function githubSaveFile(path, content, sha, commitMessage) {
  loadGithubConfig();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
  const body = {
    message: commitMessage || `Update ${path}`,
    content: encoded,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub save failed: ${err.message}`);
  }
  return await res.json();
}

// ─── LOAD DATA FILE (with fallback to local) ───
async function loadData(filename) {
  // Try GitHub first if configured
  if (GITHUB_OWNER && GITHUB_TOKEN) {
    try {
      const result = await githubGetFile(`data/${filename}`);
      if (result) return result;
    } catch (e) {
      console.warn('GitHub fetch failed, falling back to local:', e);
    }
  }
  // Fallback: local fetch
  try {
    const res = await fetch(`data/${filename}`);
    if (!res.ok) return { content: getDefaultData(filename), sha: null };
    const content = await res.json();
    return { content, sha: null };
  } catch (e) {
    return { content: getDefaultData(filename), sha: null };
  }
}

function getDefaultData(filename) {
  const defaults = {
    'lore.json': { entries: [] },
    'overview.json': { entries: [] },
    'technology.json': { entries: [] },
    'config.json': { lastUpdated: null }
  };
  return defaults[filename] || { entries: [] };
}

// ─── SAVE ENTRY TO DATA FILE ───
async function saveEntry(filename, entries, sha) {
  loadGithubConfig();
  if (!GITHUB_OWNER || !GITHUB_TOKEN) {
    throw new Error('GitHub not configured. Enter owner and token via the config panel.');
  }
  const content = { entries, lastUpdated: new Date().toISOString() };
  const result = await githubSaveFile(
    `data/${filename}`,
    content,
    sha,
    `Update ${filename} — add/edit entry`
  );
  return result;
}

// ─── CONFIG PANEL (shown to logged-in users if GitHub not set up) ───
function initConfigPanel() {
  loadGithubConfig();
  const panel = document.getElementById('github-config-panel');
  if (!panel) return;

  if (GITHUB_OWNER && GITHUB_TOKEN) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  const ownerInput = document.getElementById('config-owner');
  const tokenInput = document.getElementById('config-token');
  const saveConfigBtn = document.getElementById('config-save');
  const configStatus = document.getElementById('config-status');

  if (ownerInput) ownerInput.value = GITHUB_OWNER;

  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const owner = ownerInput?.value.trim();
      const token = tokenInput?.value.trim();
      if (!owner || !token) {
        if (configStatus) { configStatus.textContent = '// Error: both fields required'; configStatus.className = 'form-status visible error'; }
        return;
      }
      setGithubConfig(owner, token);
      if (configStatus) { configStatus.textContent = '// Config saved for this session'; configStatus.className = 'form-status visible success'; }
      setTimeout(() => { panel.style.display = 'none'; }, 1500);
    });
  }
}
