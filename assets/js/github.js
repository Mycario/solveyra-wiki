function loadGithubConfig() {
  window.GITHUB_OWNER = localStorage.getItem('solv_gh_owner') || '';
  window.GITHUB_TOKEN = localStorage.getItem('solv_gh_token') || '';
  window.GITHUB_REPO = 'Solveyra-wiki';
  window.GITHUB_BRANCH = 'main';
}

function setGithubConfig(owner, token) {
  localStorage.setItem('solv_gh_owner', owner);
  localStorage.setItem('solv_gh_token', token);
  loadGithubConfig();
}

async function githubGetFile(path) {
  loadGithubConfig();
  const url = `https://api.github.com/repos/${window.GITHUB_OWNER}/${window.GITHUB_REPO}/contents/${path}?ref=${window.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `token ${window.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) { if (res.status === 404) return null; throw new Error(`GitHub GET failed: ${res.status}`); }
  const data = await res.json();
  return { content: JSON.parse(atob(data.content.replace(/\n/g, ''))), sha: data.sha };
}

async function githubSaveFile(path, content, sha, commitMessage) {
  loadGithubConfig();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
  const body = { message: commitMessage || `Update ${path}`, content: encoded, branch: window.GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const url = `https://api.github.com/repos/${window.GITHUB_OWNER}/${window.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `token ${window.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { 
    const err = await res.json(); 
    console.error(`GitHub save failed for ${path}. Status: ${res.status}. Error:`, err);
    throw new Error(`GitHub save failed: ${err.message}`); 
  }
  const result = await res.json();
  console.log(`GitHub save succeeded for ${path}. New SHA: ${result.content?.sha}`);
  return result;
}

async function loadData(filename) {
  loadGithubConfig();
  if (window.GITHUB_OWNER && window.GITHUB_TOKEN) {
    try {
      console.log(`Loading ${filename} from GitHub...`);
      const result = await githubGetFile(`data/${filename}`);
      if (result) {
        console.log(`Successfully loaded ${filename} from GitHub with SHA: ${result.sha}`);
        return result;
      }
    } catch (e) { console.warn('GitHub fetch failed, falling back to local:', e); }
  }
  try {
    console.log(`Loading ${filename} from local...`);
    const res = await fetch(`data/${filename}`);
    if (!res.ok) {
      console.warn(`Local file ${filename} not found, returning empty`);
      return { content: { entries: [] }, sha: null };
    }
    const content = await res.json();
    console.log(`Loaded ${filename} locally (SHA will be null - local file has no version tracking)`);
    return { content, sha: null };
  } catch (e) { 
    console.error(`Failed to load ${filename}:`, e);
    return { content: { entries: [] }, sha: null }; 
  }
}

async function saveEntry(filename, entries, sha) {
  loadGithubConfig();
  if (!window.GITHUB_OWNER || !window.GITHUB_TOKEN) throw new Error('GitHub not configured. Enter credentials on the home page.');
  
  const content = { entries, lastUpdated: new Date().toISOString() };
  console.log(`Attempting to save ${filename} with SHA: ${sha}`);
  
  // Retry logic with exponential backoff: if we get a conflict, fetch latest and try again
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Always fetch the latest SHA right before saving
      console.log(`Attempt ${attempt + 1}: Fetching latest SHA for ${filename}...`);
      const result = await githubGetFile(`data/${filename}`);
      if (result) {
        console.log(`Latest SHA from GitHub: ${result.sha}`);
        sha = result.sha;
      }
      
      console.log(`Attempt ${attempt + 1}: Saving with SHA ${sha}...`);
      const saveResult = await githubSaveFile(`data/${filename}`, content, sha, `Update ${filename}`);
      console.log(`Save successful! Returning result with SHA: ${saveResult.content?.sha}`);
      return saveResult;
    } catch (e) {
      const errorMsg = e.message || '';
      console.error(`Attempt ${attempt + 1} failed:`, errorMsg);
      
      // If it's a SHA mismatch error and we have retries left, try again
      if (errorMsg.includes('does not match') && attempt < 4) {
        const backoffMs = Math.pow(2, attempt) * 500 + Math.random() * 500;
        console.warn(`SHA mismatch detected. Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // Otherwise throw the error
      throw e;
    }
  }
}

function initConfigPanel() {
  loadGithubConfig();
  const panel = document.getElementById('github-config-panel');
  if (!panel) return;
  if (!isLoggedIn()) { panel.style.display = 'none'; return; }
  if (window.GITHUB_OWNER && window.GITHUB_TOKEN) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const ownerInput = document.getElementById('config-owner');
  const tokenInput = document.getElementById('config-token');
  const saveBtn = document.getElementById('config-save');
  const status = document.getElementById('config-status');

  if (ownerInput) ownerInput.value = window.GITHUB_OWNER || '';

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const owner = ownerInput?.value.trim();
      const token = tokenInput?.value.trim();
      if (!owner || !token) { if (status) { status.textContent = '// Error: both fields required'; status.className = 'form-status visible error'; } return; }
      setGithubConfig(owner, token);
      if (status) { status.textContent = '// Config saved for this session'; status.className = 'form-status visible success'; }
      setTimeout(() => { panel.style.display = 'none'; }, 1500);
    });
  }
}
