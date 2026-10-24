/* ============================================
   FLUENCY LAB — AIRTABLE API MODULE
   All database operations in one place
   ============================================ */

const AIRTABLE = {
  BASE_ID: 'YOUR_BASE_ID_HERE',       // e.g. appske9dqtgzRHbYe
  API_KEY: 'YOUR_API_KEY_HERE',        // e.g. patXXXXXXXXXXXXXX
  BASE_URL: 'https://api.airtable.com/v0',

  // Table names — must match exactly in Airtable
  TABLES: {
    CHARACTERS:     'Characters',
    PHRASES:        'Phrases',
    SITUATIONS:     'Situations',
    SESSIONS:       'Practice Sessions',
    CONVERSATIONS:  'Real Conversations',
    MISSIONS:       'Daily Missions',
  },

  // ─── CORE FETCH ───────────────────────────
  async fetch(table, params = {}) {
    const url = new URL(`${this.BASE_URL}/${this.BASE_ID}/${encodeURIComponent(table)}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) throw new Error(`Airtable error: ${res.status} ${res.statusText}`);
    return res.json();
  },

  async create(table, fields) {
    const res = await fetch(`${this.BASE_URL}/${this.BASE_ID}/${encodeURIComponent(table)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`Airtable create error: ${res.status}`);
    return res.json();
  },

  async update(table, id, fields) {
    const res = await fetch(`${this.BASE_URL}/${this.BASE_ID}/${encodeURIComponent(table)}/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`Airtable update error: ${res.status}`);
    return res.json();
  },

  async getById(table, id) {
    const res = await fetch(`${this.BASE_URL}/${this.BASE_ID}/${encodeURIComponent(table)}/${id}`, {
      headers: { 'Authorization': `Bearer ${this.API_KEY}` }
    });
    if (!res.ok) throw new Error(`Airtable getById error: ${res.status}`);
    return res.json();
  },

  // ─── CHARACTERS ───────────────────────────
  async getCharacters(options = {}) {
    const params = {
      'sort[0][field]': 'Week Assigned',
      'sort[0][direction]': 'asc',
    };
    if (options.status) {
      params['filterByFormula'] = `{Mastery Status} = "${options.status}"`;
    }
    const data = await this.fetch(this.TABLES.CHARACTERS, params);
    return data.records;
  },

  async getCharacterById(id) {
    return this.getById(this.TABLES.CHARACTERS, id);
  },

  async updateCharacterMastery(id, status) {
    return this.update(this.TABLES.CHARACTERS, id, { 'Mastery Status': status });
  },

  // ─── PHRASES ──────────────────────────────
  async getPhrases(options = {}) {
    const params = {
      'sort[0][field]': 'Priority Score',
      'sort[0][direction]': 'desc',
    };
    if (options.characterId) {
      params['filterByFormula'] = `FIND("${options.characterId}", ARRAYJOIN({Character}))`;
    }
    if (options.activeOnly) {
      params['filterByFormula'] = `{In Active Rotation} = 1`;
    }
    if (options.category) {
      params['filterByFormula'] = `{Category} = "${options.category}"`;
    }
    const data = await this.fetch(this.TABLES.PHRASES, params);
    return data.records;
  },

  async getPhraseById(id) {
    return this.getById(this.TABLES.PHRASES, id);
  },

  async getTodayPhrases() {
    const data = await this.fetch(this.TABLES.PHRASES, {
      'filterByFormula': `{In Active Rotation} = 1`,
      'maxRecords': 3,
    });
    return data.records;
  },

  async incrementPhraseCount(id, field = 'Practice Count') {
    // First get current count
    const record = await this.getById(this.TABLES.PHRASES, id);
    const current = record.fields[field] || 0;
    return this.update(this.TABLES.PHRASES, id, { [field]: current + 1 });
  },

  async updatePhraseMastery(id, level) {
    return this.update(this.TABLES.PHRASES, id, { 'Mastery Level': level });
  },

  async updatePhraseNotes(id, notes) {
    return this.update(this.TABLES.PHRASES, id, { 'Personal Notes': notes });
  },

  // ─── SITUATIONS ───────────────────────────
  async getSituations(options = {}) {
    const params = {};
    if (options.difficulty) {
      params['filterByFormula'] = `{Difficulty Level} = "${options.difficulty}"`;
    }
    const data = await this.fetch(this.TABLES.SITUATIONS, params);
    return data.records;
  },

  async getSituationById(id) {
    return this.getById(this.TABLES.SITUATIONS, id);
  },

  // ─── DAILY MISSIONS ───────────────────────
  async getTodayMission() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const data = await this.fetch(this.TABLES.MISSIONS, {
      'filterByFormula': `IS_SAME({Date}, "${today}", "day")`,
      'maxRecords': 1,
    });
    return data.records[0] || null;
  },

  async createMission(fields) {
    return this.create(this.TABLES.MISSIONS, fields);
  },

  async completeMission(id) {
    return this.update(this.TABLES.MISSIONS, id, {
      'Morning Protocol Done?': true,
    });
  },

  // ─── PRACTICE SESSIONS ────────────────────
  async createSession(fields) {
    return this.create(this.TABLES.SESSIONS, {
      'Date': new Date().toISOString().split('T')[0],
      'Time of Day': this.getTimeOfDay(),
      ...fields,
    });
  },

  async updateSession(id, fields) {
    return this.update(this.TABLES.SESSIONS, id, fields);
  },

  async getRecentSessions(limit = 30) {
    const data = await this.fetch(this.TABLES.SESSIONS, {
      'sort[0][field]': 'Date',
      'sort[0][direction]': 'desc',
      'maxRecords': limit,
    });
    return data.records;
  },

  // ─── REAL CONVERSATIONS ───────────────────
  async logConversation(fields) {
    return this.create(this.TABLES.CONVERSATIONS, {
      'Date & Time': new Date().toISOString(),
      ...fields,
    });
  },

  async getConversations(limit = 20) {
    const data = await this.fetch(this.TABLES.CONVERSATIONS, {
      'sort[0][field]': 'Date & Time',
      'sort[0][direction]': 'desc',
      'maxRecords': limit,
    });
    return data.records;
  },

  // ─── PROGRESS DATA ────────────────────────
  async getProgressData() {
    const [sessions, characters, phrases] = await Promise.all([
      this.getRecentSessions(30),
      this.getCharacters(),
      this.getPhrases(),
    ]);

    return {
      sessions,
      characters,
      phrases,
      stats: this.calculateStats(sessions, characters, phrases),
    };
  },

  calculateStats(sessions, characters, phrases) {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const thisWeekSessions = sessions.filter(s =>
      new Date(s.fields['Date']) >= weekAgo
    );

    const masteredPhrases = phrases.filter(p =>
      ['Muscle Memory', 'Signature Move'].includes(p.fields['Mastery Level'])
    );

    const totalDeployments = phrases.reduce((sum, p) =>
      sum + (p.fields['Real World Deployments'] || 0), 0
    );

    const tongueTieScores = sessions
      .filter(s => s.fields['Tongue Tie Score (Before)'])
      .map(s => s.fields['Tongue Tie Score (Before)']);

    const avgTongueTie = tongueTieScores.length
      ? (tongueTieScores.reduce((a, b) => a + b, 0) / tongueTieScores.length).toFixed(1)
      : null;

    return {
      weeklyConsistency: `${thisWeekSessions.length}/7`,
      phrasesAtMuscleMemory: masteredPhrases.length,
      totalRealDeployments: totalDeployments,
      avgTongueTieScore: avgTongueTie,
      totalSessions: sessions.length,
      charactersMastered: characters.filter(c =>
        c.fields['Mastery Status'] === 'Mastered'
      ).length,
    };
  },

  // ─── UTILITIES ────────────────────────────
  getTimeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Midday';
    return 'Evening';
  },

  // Upload audio file to Airtable attachment field
  async uploadAudio(table, recordId, field, blob, filename) {
    // Airtable doesn't support direct binary upload via REST
    // Use Cloudflare Worker to handle upload → get URL → patch Airtable
    const formData = new FormData();
    formData.append('audio', blob, filename);
    formData.append('recordId', recordId);
    formData.append('table', table);
    formData.append('field', field);

    const res = await fetch('/workers/upload-audio', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Audio upload failed');
    return res.json();
  },
};

// Make globally available
window.AIRTABLE = AIRTABLE;
