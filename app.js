/* ============================================
   FLUENCY LAB — APP UTILITIES
   Navigation, toast, storage, helpers
   ============================================ */

// ─── NAVIGATION ───────────────────────────────
const NAV = {
  // Navigate to a page, passing data via sessionStorage
  go(page, params = {}) {
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem('navParams', JSON.stringify(params));
    }
    window.location.href = page;
  },

  // Get params passed from previous page
  getParams() {
    const raw = sessionStorage.getItem('navParams');
    if (!raw) return {};
    sessionStorage.removeItem('navParams');
    try { return JSON.parse(raw); }
    catch { return {}; }
  },

  // Go back
  back() {
    window.history.back();
  },
};

// ─── TOAST NOTIFICATIONS ──────────────────────
const TOAST = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.textContent = message;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 5000); },
  info(msg)    { this.show(msg, 'info'); },
};

// ─── LOCAL STORAGE ────────────────────────────
const STORE = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(`fl_${key}`);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },

  set(key, value) {
    try { localStorage.setItem(`fl_${key}`, JSON.stringify(value)); }
    catch (e) { console.error('Storage error:', e); }
  },

  remove(key) { localStorage.removeItem(`fl_${key}`); },

  // Specific app state
  getWarmupDone() {
    const date = this.get('warmupDate');
    return date === new Date().toISOString().split('T')[0];
  },

  setWarmupDone() {
    this.set('warmupDate', new Date().toISOString().split('T')[0]);
  },

  getTongueTieScore() { return this.get('tongueTieBefore', null); },
  setTongueTieScore(score) { this.set('tongueTieBefore', score); },

  getCurrentSession() { return this.get('currentSession', null); },
  setCurrentSession(data) { this.set('currentSession', data); },
  clearCurrentSession() { this.remove('currentSession'); },

  getStreak() { return this.get('streak', 0); },
  updateStreak() {
    const lastDate = this.get('lastPracticeDate');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (lastDate === today) return this.getStreak(); // already counted today
    if (lastDate === yesterday) {
      const newStreak = this.getStreak() + 1;
      this.set('streak', newStreak);
      this.set('lastPracticeDate', today);
      return newStreak;
    }
    // Streak broken
    this.set('streak', 1);
    this.set('lastPracticeDate', today);
    return 1;
  },
};

// ─── CLOUDFLARE WORKERS ───────────────────────
const WORKERS = {
  // Base URL — update when you deploy workers
  BASE_URL: 'https://fluency-lab.kumarvivek-srv.workers.dev',

  async callClaude(prompt, systemPrompt = '') {
    const res = await fetch(`${this.BASE_URL}/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt }),
    });
    if (!res.ok) throw new Error('Claude worker error');
    return res.json();
  },

  async transcribeAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    const res = await fetch(`${this.BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Whisper worker error');
    return res.json();
  },

  async analyzeSession(transcript, phraseTargets, characterName) {
    const prompt = `
You are analyzing a speaking practice session for someone training to speak like ${characterName}.

TRANSCRIPT OF THEIR PRACTICE:
"${transcript}"

TARGET PHRASES THEY WERE SUPPOSED TO DEPLOY:
${phraseTargets.map(p => `- "${p}"`).join('\n')}

Analyze and respond in this EXACT JSON format (no other text):
{
  "listenerUnderstood": "One clear sentence summarizing the core message the listener received",
  "phrasesDeployed": ["list of target phrases actually used"],
  "oneThinDoneWell": "One specific, genuine compliment about delivery or structure",
  "oneMicroUpgrade": "One specific, actionable improvement (not grammar - focus on delivery, structure, or confidence)",
  "confidenceScore": 7,
  "coherenceScore": 6,
  "characterMatch": 65
}
    `;

    return this.callClaude(prompt, 'You are a speaking coach. Always respond with valid JSON only. No markdown, no code blocks.');
  },

  async generateScenario(situationName, characterName, difficulty) {
    const prompt = `
Create a realistic dialogue scenario for speaking practice.

SITUATION: ${situationName}
CHARACTER TO CHANNEL: ${characterName}
DIFFICULTY: ${difficulty}

Respond in this EXACT JSON format (no other text):
{
  "setup": "2-3 sentence description of the exact situation",
  "yourRole": "Who you are in this conversation",
  "theirRole": "Who the other person is",
  "openingLine": "The first thing they say to you (creates immediate pressure)",
  "likelyResponses": ["3 things they might say if you handle it well", "3 things they might say if you struggle"],
  "winCondition": "What 'success' looks like in this scenario"
}
    `;

    return this.callClaude(prompt, 'You are a speaking coach creating realistic practice scenarios. Always respond with valid JSON only.');
  },
};

// ─── DATE/TIME HELPERS ────────────────────────
const TIME = {
  today() { return new Date().toISOString().split('T')[0]; },

  timeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  },

  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  daysSince(dateStr) {
    if (!dateStr) return 999;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
  },
};

// ─── MASTERY HELPERS ──────────────────────────
const MASTERY = {
  levels: ['New', 'Learning', 'Practicing', 'Deployed', 'Muscle Memory', 'Signature Move'],
  colors: {
    'New':           'var(--mastery-new)',
    'Learning':      'var(--mastery-learning)',
    'Practicing':    'var(--mastery-practicing)',
    'Deployed':      'var(--mastery-deployed)',
    'Muscle Memory': 'var(--mastery-muscle)',
    'Signature Move':'var(--mastery-signature)',
  },
  badgeClass: {
    'New':           'badge-new',
    'Learning':      'badge-learning',
    'Practicing':    'badge-practicing',
    'Deployed':      'badge-deployed',
    'Muscle Memory': 'badge-muscle',
    'Signature Move':'badge-signature',
  },

  badge(level) {
    return `<span class="badge ${this.badgeClass[level] || 'badge-muted'}">${level}</span>`;
  },

  nextLevel(current) {
    const idx = this.levels.indexOf(current);
    return idx < this.levels.length - 1 ? this.levels[idx + 1] : null;
  },

  percentage(level) {
    const idx = this.levels.indexOf(level);
    return Math.round(((idx + 1) / this.levels.length) * 100);
  },
};

// ─── DIFFICULTY DOTS ──────────────────────────
function difficultyDots(level) {
  const map = { 'Easy': 1, 'Medium': 2, 'Hard': 3, 'Expert': 4 };
  const filled = map[level] || 2;
  const total = 4;
  let dots = '';
  for (let i = 0; i < total; i++) {
    dots += `<span style="
      display:inline-block; width:8px; height:8px;
      border-radius:50%; margin-right:3px;
      background:${i < filled ? 'var(--teal)' : 'var(--navy-border)'};
    "></span>`;
  }
  return dots;
}

// ─── TAB BAR BUILDER ──────────────────────────
function buildTabBar(activePage) {
  const tabs = [
    { id: 'today',      label: 'Today',      href: 'index.html',      icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { id: 'characters', label: 'Characters', href: 'characters.html', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'phrases',    label: 'Phrases',    href: 'phrases.html',    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { id: 'clarity',    label: 'Clarity',    href: 'clarity.html',    icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4' },
    { id: 'progress',   label: 'Progress',   href: 'progress.html',   icon: 'M18 20V10M12 20V4M6 20v-6' },
  ];

  return `
    <nav class="tab-bar">
      ${tabs.map(tab => `
        <a href="${tab.href}" class="tab-item ${activePage === tab.id ? 'active' : ''}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="${tab.icon}"/>
          </svg>
          <span class="tab-label">${tab.label}</span>
        </a>
      `).join('')}
    </nav>
  `;
}

// ─── LOADING SPINNER ──────────────────────────
function showLoading(container, message = 'Loading...') {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center gap-4" style="padding: 3rem 0;">
      <div class="spinner"></div>
      <p class="body-sm text-muted">${message}</p>
    </div>
  `;
}

// ─── ERROR STATE ──────────────────────────────
function showError(container, message = 'Something went wrong.', retryFn = null) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p class="body-md text-secondary">${message}</p>
      ${retryFn ? `<button class="btn btn-secondary btn-sm" id="retryBtn">Try again</button>` : ''}
    </div>
  `;
  if (retryFn) {
    document.getElementById('retryBtn')?.addEventListener('click', retryFn);
  }
}

// ─── PWA SERVICE WORKER REGISTRATION ─────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

// ─── QUICK WORD CAPTURE ───────────────────────
// A floating "+ Word" button on every page. Tap it the moment you stumble on a
// word; it lands in the Struggle Words table and feeds the "My Words" drill.
// Independent of airtable.js so it works on any page. Queues offline.
const QUICKWORD = {
  TABLE: 'Struggle Words',
  QUEUE_KEY: 'pendingWords',

  _esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); },
  _today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  _url(suffix = '') { return `${WORKERS.BASE_URL}/airtable/${encodeURIComponent(this.TABLE)}${suffix}`; },

  guessLanguage(word) {
    if (/[ऀ-ॿ]/.test(word)) return 'Hindi';
    if (/\b(tha|thi|the|hai|hain|hota|hoti|karta|karti|raha|rahi)\s*$/i.test(word.trim())) return 'Hindi';
    return 'English';
  },

  // Returns { word, count, isNew }. Throws on network failure.
  async _save(word, language, context) {
    const q = new URL(this._url());
    q.searchParams.set('filterByFormula', `LOWER({Word}) = "${this._esc(word.toLowerCase())}"`);
    q.searchParams.set('maxRecords', '1');
    const found = await fetch(q.toString());
    if (!found.ok) throw new Error('lookup failed');
    const rec = (await found.json()).records?.[0];

    if (rec) {
      const count = (rec.fields['Times Reported'] || 0) + 1;
      const res = await fetch(this._url(`/${rec.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { 'Times Reported': count, 'Last Reported': this._today(), 'Status': 'Active' } }),
      });
      if (!res.ok) throw new Error('update failed');
      return { word: rec.fields['Word'], count, isNew: false };
    }

    const fields = {
      'Word': word, 'Language': language, 'Times Reported': 1, 'Times Drilled': 0,
      'Status': 'Active', 'Last Reported': this._today(),
    };
    if (context) fields['Context'] = context;
    const res = await fetch(this._url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error('create failed');
    return { word, count: 1, isNew: true };
  },

  // Public: save a word; queues it if offline. Never throws.
  async add(word, language, context = '') {
    word = (word || '').trim();
    if (!word) return null;
    language = language || this.guessLanguage(word);
    try {
      const r = await this._save(word, language, context);
      TOAST.success(r.isNew ? `Saved "${r.word}" to My Words` : `"${r.word}" reported ${r.count}x`);
      return r;
    } catch (e) {
      const q = STORE.get(this.QUEUE_KEY, []);
      q.push({ word, language, context });
      STORE.set(this.QUEUE_KEY, q);
      TOAST.info(`Saved "${word}" offline, will sync`);
      return null;
    }
  },

  async flush() {
    const q = STORE.get(this.QUEUE_KEY, []);
    if (!q.length || !navigator.onLine) return;
    const left = [];
    for (const item of q) {
      try { await this._save(item.word, item.language, item.context); }
      catch { left.push(item); }
    }
    STORE.set(this.QUEUE_KEY, left);
  },

  init() {
    if (document.getElementById('qwFab')) return;
    const wrap = document.createElement('div');
    wrap.className = 'qw-wrap';
    wrap.innerHTML = `
      <button class="qw-fab" id="qwFab" aria-label="Report a tricky word">+ Word</button>
      <div class="qw-backdrop" id="qwBackdrop" hidden>
        <div class="qw-sheet" role="dialog" aria-label="Report a tricky word">
          <div class="qw-title">Caught a tricky word?</div>
          <input class="input" id="qwWord" type="text" placeholder="Word or phrase, e.g. relationship, karta tha" autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="qw-row">
            <button class="chip active" data-lang="English">English</button>
            <button class="chip" data-lang="Hindi">Hindi</button>
          </div>
          <input class="input" id="qwCtx" type="text" placeholder="Where it happened (optional)" autocomplete="off">
          <div class="qw-row">
            <button class="btn btn-secondary" id="qwCancel">Cancel</button>
            <button class="btn btn-primary" id="qwSave">Save word</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const backdrop = wrap.querySelector('#qwBackdrop');
    const wordEl = wrap.querySelector('#qwWord');
    const ctxEl = wrap.querySelector('#qwCtx');
    let lang = 'English';
    let langTouched = false;

    const setLang = (l) => {
      lang = l;
      wrap.querySelectorAll('[data-lang]').forEach(c => c.classList.toggle('active', c.dataset.lang === l));
    };
    const close = () => { backdrop.hidden = true; wordEl.value = ''; ctxEl.value = ''; langTouched = false; setLang('English'); };

    wrap.querySelector('#qwFab').addEventListener('click', () => {
      backdrop.hidden = false;
      setTimeout(() => wordEl.focus(), 50);
    });
    wrap.querySelectorAll('[data-lang]').forEach(c =>
      c.addEventListener('click', () => { langTouched = true; setLang(c.dataset.lang); }));
    wordEl.addEventListener('input', () => { if (!langTouched) setLang(this.guessLanguage(wordEl.value)); });
    wrap.querySelector('#qwCancel').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    const save = async () => {
      const w = wordEl.value.trim();
      if (!w) { wordEl.focus(); return; }
      const c = ctxEl.value.trim();
      close();
      await this.add(w, lang, c);
    };
    wrap.querySelector('#qwSave').addEventListener('click', save);
    [wordEl, ctxEl].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') save(); }));

    this.flush();
  },
};

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  TOAST.init();
  QUICKWORD.init();
});

// Make everything globally available
window.NAV = NAV;
window.QUICKWORD = QUICKWORD;
window.TOAST = TOAST;
window.STORE = STORE;
window.WORKERS = WORKERS;
window.TIME = TIME;
window.MASTERY = MASTERY;
window.difficultyDots = difficultyDots;
window.buildTabBar = buildTabBar;
window.showLoading = showLoading;
window.showError = showError;
