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
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  TOAST.init();
});

// Make everything globally available
window.NAV = NAV;
window.TOAST = TOAST;
window.STORE = STORE;
window.WORKERS = WORKERS;
window.TIME = TIME;
window.MASTERY = MASTERY;
window.difficultyDots = difficultyDots;
window.buildTabBar = buildTabBar;
window.showLoading = showLoading;
window.showError = showError;
