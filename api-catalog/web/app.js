/**
 * API Catalog — app.js
 * Vanilla JavaScript application for the API Catalog static site.
 * Loads data/apis.json and renders a searchable, filterable catalog
 * with an API Explorer for CORS-enabled endpoints.
 */

'use strict';

// ============================================================
// State
// ============================================================
const state = {
  apis: [],
  filtered: [],
  selectedApi: null,
  searchQuery: '',
  activeCategories: new Set(),
  activeAuthTypes: new Set(['none', 'apiKey', 'OAuth']),
  activeCors: new Set(['true', 'false']),
  viewMode: 'grid',
};

// ============================================================
// DOM References
// ============================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  searchInput: $('searchInput'),
  categoryFilters: $('categoryFilters'),
  apiGrid: $('apiGrid'),
  resultsCount: $('resultsCount'),
  emptyState: $('emptyState'),
  headerStats: $('headerStats'),
  resetFilters: $('resetFilters'),
  clearSearch: $('clearSearch'),
  viewGrid: $('viewGrid'),
  viewList: $('viewList'),
  // Modal
  apiModal: $('apiModal'),
  modalClose: $('modalClose'),
  modalTitle: $('modalTitle'),
  modalCategory: $('modalCategory'),
  modalBadges: $('modalBadges'),
  modalDescription: $('modalDescription'),
  modalInfoGrid: $('modalInfoGrid'),
  modalUseCases: $('modalUseCases'),
  modalNotes: $('modalNotes'),
  modalCodeSnippet: $('modalCodeSnippet'),
  copyCodeBtn: $('copyCodeBtn'),
  explorerSection: $('explorerSection'),
  explorerContent: $('explorerContent'),
  explorerBadge: $('explorerBadge'),
  modalDocsLink: $('modalDocsLink'),
};

// ============================================================
// Data Loading
// ============================================================
async function loadData() {
  try {
    // Resolve the correct path to apis.json regardless of where index.html is served from
    const possiblePaths = ['../data/apis.json', 'data/apis.json', './data/apis.json'];
    let data = null;

    for (const path of possiblePaths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch (_) {
        // try next path
      }
    }

    if (!data) throw new Error('Could not load apis.json from any expected path.');

    state.apis = data.apis || [];
    state.filtered = [...state.apis];

    // Initialise active categories to all
    const categories = getCategories();
    categories.forEach((c) => state.activeCategories.add(c));

    renderHeaderStats(data.meta);
    renderCategoryFilters(categories);
    renderGrid();
  } catch (err) {
    els.apiGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">&#9888;</div>
      <h3>Failed to load API data</h3>
      <p>${err.message}</p>
      <p style="margin-top:8px;font-size:0.8rem;">Make sure you are serving the site from a local server (e.g., <code>npx serve .</code> from the project root).</p>
    </div>`;
  }
}

// ============================================================
// Helpers
// ============================================================
function getCategories() {
  const cats = new Set(state.apis.map((a) => a.category));
  return [...cats].sort();
}

function getCategoryCount(category) {
  return state.apis.filter((a) => a.category === category).length;
}

function authLabel(authType) {
  const map = { none: 'No Auth', apiKey: 'API Key', OAuth: 'OAuth' };
  return map[authType] || authType;
}

function corsLabel(cors) {
  if (cors === true) return '✓ CORS';
  if (cors === false) return '✗ No CORS';
  return '? Unknown';
}

function corsClass(cors) {
  if (cors === true) return 'badge-cors-true';
  if (cors === false) return 'badge-cors-false';
  return 'badge-cors-unknown';
}

function authClass(authType) {
  const map = { none: 'badge-auth-none', apiKey: 'badge-auth-apiKey', OAuth: 'badge-auth-OAuth' };
  return map[authType] || 'badge-auth-none';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Render Header Stats
// ============================================================
function renderHeaderStats(meta) {
  const corsCount = state.apis.filter((a) => a.cors === true).length;
  const noAuthCount = state.apis.filter((a) => a.auth_type === 'none').length;
  els.headerStats.innerHTML = `
    <span class="stat-badge">&#128203; ${state.apis.length} APIs</span>
    <span class="stat-badge">&#9989; ${corsCount} CORS-enabled</span>
    <span class="stat-badge">&#128273; ${noAuthCount} No Auth Required</span>
  `;
}

// ============================================================
// Render Category Filters
// ============================================================
function renderCategoryFilters(categories) {
  els.categoryFilters.innerHTML = categories
    .map(
      (cat) => `
    <label class="category-filter-label">
      <input type="checkbox" class="cat-filter" value="${escapeHtml(cat)}" checked />
      <span>${escapeHtml(cat)}</span>
      <span class="category-count">${getCategoryCount(cat)}</span>
    </label>`
    )
    .join('');

  // Attach listeners
  $$('.cat-filter').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.activeCategories.add(cb.value);
      else state.activeCategories.delete(cb.value);
      applyFilters();
    });
  });
}

// ============================================================
// Filter Logic
// ============================================================
function applyFilters() {
  const q = state.searchQuery.toLowerCase().trim();

  state.filtered = state.apis.filter((api) => {
    // Category filter
    if (!state.activeCategories.has(api.category)) return false;

    // Auth filter
    if (!state.activeAuthTypes.has(api.auth_type)) return false;

    // CORS filter
    const corsVal = String(api.cors);
    if (!state.activeCors.has(corsVal)) return false;

    // Search
    if (q) {
      const haystack = [
        api.name,
        api.description,
        api.category,
        ...(api.use_cases || []),
        api.notes,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  renderGrid();
}

// ============================================================
// Render Grid
// ============================================================
function renderGrid() {
  const count = state.filtered.length;
  els.resultsCount.textContent =
    count === 0
      ? 'No APIs match your filters'
      : `Showing ${count} of ${state.apis.length} APIs`;

  if (count === 0) {
    els.apiGrid.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    return;
  }

  els.emptyState.classList.add('hidden');

  els.apiGrid.innerHTML = state.filtered
    .map(
      (api) => `
    <div class="api-card" data-id="${api.id}" role="button" tabindex="0" aria-label="View details for ${escapeHtml(api.name)}">
      <div class="api-card-header">
        <span class="api-card-name">${escapeHtml(api.name)}</span>
      </div>
      <p class="api-card-description">${escapeHtml(api.description)}</p>
      <div class="api-card-footer">
        <span class="badge badge-category">${escapeHtml(api.category)}</span>
        <span class="badge ${authClass(api.auth_type)}">${authLabel(api.auth_type)}</span>
        <span class="badge ${corsClass(api.cors)}">${corsLabel(api.cors)}</span>
      </div>
    </div>`
    )
    .join('');

  // Attach click listeners
  $$('.api-card').forEach((card) => {
    const openModal = () => {
      const id = parseInt(card.dataset.id, 10);
      const api = state.apis.find((a) => a.id === id);
      if (api) openApiModal(api);
    };
    card.addEventListener('click', openModal);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
  });
}

// ============================================================
// Generate fetch() Code Snippet
// ============================================================
function generateCodeSnippet(api) {
  const url = api.example_endpoint || api.base_url;
  const params = api.example_params || {};
  const hasParams = Object.keys(params).length > 0;

  let paramStr = '';
  if (hasParams) {
    const entries = Object.entries(params)
      .map(([k, v]) => `  ${k}: "${v}"`)
      .join(',\n');
    paramStr = `\nconst params = {\n${entries}\n};\n\nconst queryString = new URLSearchParams(params).toString();\nconst url = \`${url}?\${queryString}\`;\n`;
  }

  const fetchUrl = hasParams ? 'url' : `"${url}"`;
  const headers =
    api.name === 'icanhazdadjoke'
      ? `\n  headers: { "Accept": "application/json" },`
      : '';

  return `// ${api.name}
// ${api.docs_url}
${hasParams ? paramStr : ''}
fetch(${fetchUrl}, {${headers}
  method: "GET"
})
  .then(res => {
    if (!res.ok) throw new Error(\`HTTP error: \${res.status}\`);
    return res.json();
  })
  .then(data => {
    console.log(data);
    // TODO: use data in your app
  })
  .catch(err => console.error("Error:", err));`;
}

// ============================================================
// Open API Modal
// ============================================================
function openApiModal(api) {
  state.selectedApi = api;

  // Title & category
  els.modalTitle.textContent = api.name;
  els.modalCategory.textContent = api.category;

  // Badges
  els.modalBadges.innerHTML = `
    <span class="badge ${authClass(api.auth_type)}">${authLabel(api.auth_type)}</span>
    <span class="badge ${corsClass(api.cors)}">${corsLabel(api.cors)}</span>
    ${api.response_format ? `<span class="badge badge-category">${escapeHtml(api.response_format)}</span>` : ''}
  `;

  // Description
  els.modalDescription.textContent = api.description;

  // Info grid
  const infoItems = [
    { label: 'Base URL', value: api.base_url },
    { label: 'Auth Type', value: authLabel(api.auth_type) },
    { label: 'CORS Support', value: api.cors === true ? 'Yes' : api.cors === false ? 'No' : 'Unknown' },
    { label: 'Response Format', value: api.response_format || 'JSON' },
    { label: 'Free Tier', value: api.free_tier_limits || 'See docs' },
    { label: 'Rate Limits', value: api.rate_limits || 'See docs' },
  ];

  els.modalInfoGrid.innerHTML = infoItems
    .map(
      (item) => `
    <div class="info-item">
      <div class="info-item-label">${escapeHtml(item.label)}</div>
      <div class="info-item-value">${escapeHtml(item.value)}</div>
    </div>`
    )
    .join('');

  // Use cases
  els.modalUseCases.innerHTML = (api.use_cases || [])
    .map((uc) => `<li>${escapeHtml(uc)}</li>`)
    .join('');

  // Notes
  els.modalNotes.textContent = api.notes || '';

  // Code snippet
  const snippet = generateCodeSnippet(api);
  els.modalCodeSnippet.textContent = snippet;

  // Copy button reset
  els.copyCodeBtn.textContent = 'Copy';
  els.copyCodeBtn.classList.remove('copied');

  // Docs link
  els.modalDocsLink.href = api.docs_url || '#';

  // Explorer
  renderExplorer(api);

  // Show modal
  els.apiModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Focus close button for accessibility
  setTimeout(() => els.modalClose.focus(), 50);
}

// ============================================================
// Close Modal
// ============================================================
function closeModal() {
  els.apiModal.classList.add('hidden');
  document.body.style.overflow = '';
  state.selectedApi = null;
}

// ============================================================
// API Explorer
// ============================================================
function renderExplorer(api) {
  if (!api.cors_testable) {
    els.explorerBadge.textContent = 'CORS Not Supported';
    els.explorerBadge.className = 'explorer-badge explorer-disabled';
    els.explorerContent.innerHTML = `
      <div class="explorer-disabled-msg">
        <strong>Testing not available in the browser.</strong><br/>
        This API does not support CORS, so direct browser requests will be blocked.
        To test this API, use a server-side environment, a CORS proxy, or tools like
        <a href="https://www.postman.com/" target="_blank" rel="noopener">Postman</a> or
        <a href="https://insomnia.rest/" target="_blank" rel="noopener">Insomnia</a>.
      </div>`;
    return;
  }

  els.explorerBadge.textContent = 'Live Testing Enabled';
  els.explorerBadge.className = 'explorer-badge explorer-enabled';

  const params = api.example_params || {};
  const paramRows = Object.entries(params)
    .map(
      ([k, v]) => `
    <div class="explorer-param-row">
      <input class="explorer-param-key" type="text" placeholder="key" value="${escapeHtml(k)}" />
      <input class="explorer-param-value" type="text" placeholder="value" value="${escapeHtml(v)}" />
    </div>`
    )
    .join('');

  els.explorerContent.innerHTML = `
    <div class="explorer-form">
      <div class="explorer-url-bar">
        <input
          class="explorer-url-input"
          type="text"
          id="explorerUrl"
          value="${escapeHtml(api.example_endpoint || api.base_url)}"
          placeholder="https://api.example.com/endpoint"
        />
        <button class="btn btn-primary" id="explorerSendBtn">&#9658; Send</button>
      </div>
      ${
        Object.keys(params).length > 0
          ? `<div class="explorer-params">
              <div class="sidebar-heading" style="margin-bottom:4px">Query Parameters</div>
              ${paramRows}
             </div>`
          : ''
      }
    </div>
    <div id="explorerResponseArea" style="display:none">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span class="sidebar-heading">Response</span>
        <span id="explorerStatus" class="explorer-status"></span>
        <span id="explorerTime" style="font-size:0.75rem;color:var(--color-text-muted)"></span>
      </div>
      <div class="explorer-response">
        <pre id="explorerResponseBody"></pre>
      </div>
    </div>
  `;

  // Send button handler
  $('explorerSendBtn').addEventListener('click', () => sendExplorerRequest(api));
}

async function sendExplorerRequest(api) {
  const urlInput = $('explorerUrl');
  const statusEl = $('explorerStatus');
  const timeEl = $('explorerTime');
  const bodyEl = $('explorerResponseBody');
  const responseArea = $('explorerResponseArea');
  const sendBtn = $('explorerSendBtn');

  // Build URL with params from input fields
  let baseUrl = urlInput.value.trim();
  const paramRows = $$('.explorer-param-row');
  const queryParams = {};

  paramRows.forEach((row) => {
    const key = row.querySelector('.explorer-param-key').value.trim();
    const val = row.querySelector('.explorer-param-value').value.trim();
    if (key) queryParams[key] = val;
  });

  // Remove existing query string from base URL if params are provided
  if (Object.keys(queryParams).length > 0) {
    const urlObj = new URL(baseUrl.includes('://') ? baseUrl : 'https://' + baseUrl);
    Object.entries(queryParams).forEach(([k, v]) => urlObj.searchParams.set(k, v));
    baseUrl = urlObj.toString();
  }

  // Show loading state
  responseArea.style.display = 'block';
  statusEl.textContent = 'Loading...';
  statusEl.className = 'explorer-status loading';
  timeEl.textContent = '';
  bodyEl.textContent = 'Sending request...';
  sendBtn.disabled = true;
  sendBtn.textContent = '⏳ Sending...';

  const startTime = Date.now();

  try {
    const fetchOptions = { method: 'GET' };

    // Special headers for certain APIs
    if (api.name === 'icanhazdadjoke') {
      fetchOptions.headers = { Accept: 'application/json' };
    }

    const res = await fetch(baseUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    let responseText;
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('json')) {
      const json = await res.json();
      responseText = JSON.stringify(json, null, 2);
    } else {
      responseText = await res.text();
    }

    statusEl.textContent = `${res.status} ${res.statusText}`;
    statusEl.className = `explorer-status ${res.ok ? 'success' : 'error'}`;
    timeEl.textContent = `${elapsed}ms`;
    bodyEl.textContent = responseText;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    statusEl.textContent = 'Error';
    statusEl.className = 'explorer-status error';
    timeEl.textContent = `${elapsed}ms`;
    bodyEl.textContent = `Failed to fetch: ${err.message}\n\nThis may be due to:\n• CORS restrictions on this endpoint\n• Network connectivity issues\n• Invalid URL or parameters\n\nTry using the API from a server-side environment.`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '▶ Send';
  }
}

// ============================================================
// Event Listeners
// ============================================================
function initEventListeners() {
  // Search
  els.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFilters();
  });

  // Auth filters
  $$('.auth-filter').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.activeAuthTypes.add(cb.value);
      else state.activeAuthTypes.delete(cb.value);
      applyFilters();
    });
  });

  // CORS filters
  $$('.cors-filter').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.activeCors.add(cb.value);
      else state.activeCors.delete(cb.value);
      applyFilters();
    });
  });

  // Reset filters
  els.resetFilters.addEventListener('click', resetAllFilters);

  // Clear search
  els.clearSearch.addEventListener('click', () => {
    els.searchInput.value = '';
    state.searchQuery = '';
    applyFilters();
  });

  // View toggle
  els.viewGrid.addEventListener('click', () => setViewMode('grid'));
  els.viewList.addEventListener('click', () => setViewMode('list'));

  // Modal close
  els.modalClose.addEventListener('click', closeModal);
  els.apiModal.addEventListener('click', (e) => {
    if (e.target === els.apiModal) closeModal();
  });

  // Keyboard: Escape to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.apiModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Copy code button
  els.copyCodeBtn.addEventListener('click', () => {
    const code = els.modalCodeSnippet.textContent;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        els.copyCodeBtn.textContent = '✓ Copied!';
        els.copyCodeBtn.classList.add('copied');
        setTimeout(() => {
          els.copyCodeBtn.textContent = 'Copy';
          els.copyCodeBtn.classList.remove('copied');
        }, 2000);
      })
      .catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        els.copyCodeBtn.textContent = '✓ Copied!';
        els.copyCodeBtn.classList.add('copied');
        setTimeout(() => {
          els.copyCodeBtn.textContent = 'Copy';
          els.copyCodeBtn.classList.remove('copied');
        }, 2000);
      });
  });
}

function resetAllFilters() {
  // Reset search
  els.searchInput.value = '';
  state.searchQuery = '';

  // Reset categories
  const categories = getCategories();
  state.activeCategories = new Set(categories);
  $$('.cat-filter').forEach((cb) => (cb.checked = true));

  // Reset auth
  state.activeAuthTypes = new Set(['none', 'apiKey', 'OAuth']);
  $$('.auth-filter').forEach((cb) => (cb.checked = true));

  // Reset CORS
  state.activeCors = new Set(['true', 'false']);
  $$('.cors-filter').forEach((cb) => (cb.checked = true));

  applyFilters();
}

function setViewMode(mode) {
  state.viewMode = mode;
  if (mode === 'grid') {
    els.apiGrid.classList.remove('list-view');
    els.viewGrid.classList.add('active');
    els.viewList.classList.remove('active');
  } else {
    els.apiGrid.classList.add('list-view');
    els.viewList.classList.add('active');
    els.viewGrid.classList.remove('active');
  }
}

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadData();
});
