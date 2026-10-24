# Fluency Lab 🎭
### Personal Voice Transformation System

A GitHub Pages PWA for character-based speaking practice.

---

## SETUP (30 minutes)

### Step 1: Create GitHub Repo
1. New repo: `fluency-lab` (public)
2. Upload all these files
3. Settings → Pages → Deploy from `main` branch

Your app will be live at: `https://YOUR_USERNAME.github.io/fluency-lab`

---

### Step 2: Configure Airtable
1. Create new Airtable base: "Personal Fluency Lab"
2. Build tables using the spec in your session notes
3. Get your Base ID from the URL: `airtable.com/YOUR_BASE_ID/...`
4. Get your API key from: airtable.com/create/tokens

Update in `js/airtable.js`:
```javascript
BASE_ID: 'appXXXXXXXXXXXXXX',
API_KEY: 'patXXXXXXXXXXXXXX',
```

---

### Step 3: Deploy Cloudflare Worker
1. Go to dash.cloudflare.com → Workers & Pages
2. Create Worker → paste `workers/claude-worker.js`
3. Add environment variables:
   - `ANTHROPIC_API_KEY` = your Claude API key
   - `OPENAI_API_KEY` = your OpenAI key (for Whisper)
4. Deploy → copy the worker URL

Update in `js/app.js`:
```javascript
BASE_URL: 'https://fluency-lab.YOUR_SUBDOMAIN.workers.dev',
```

---

### Step 4: Install as PWA on Phone
1. Open your GitHub Pages URL in Safari (iPhone) or Chrome (Android)
2. iPhone: Share → Add to Home Screen
3. Android: Menu → Add to Home Screen
4. App installs with full-screen mode, no browser bar

---

## FILE STRUCTURE

```
fluency-lab/
├── index.html          ← Home / Today's Mission
├── warmup.html         ← Morning Warm-Up (4 steps)
├── practice.html       ← 15-min Practice Session
├── characters.html     ← Character Library
├── character.html      ← Character Detail
├── phrases.html        ← Phrase Vault
├── phrase.html         ← Phrase Detail + Practice
├── log.html            ← Real Conversation Logger
├── progress.html       ← Progress Dashboard
├── manifest.json       ← PWA manifest
├── service-worker.js   ← Offline caching
├── css/
│   └── design-system.css  ← Complete design tokens + components
├── js/
│   ├── app.js          ← Navigation, toast, storage, utilities
│   ├── airtable.js     ← All Airtable API calls
│   └── audio.js        ← Recording, playback, transcription
├── workers/
│   └── claude-worker.js   ← Cloudflare Worker (Claude + Whisper)
└── assets/
    ├── characters/     ← Character thumbnails
    ├── audio/          ← Character phrase clips
    └── icons/          ← PWA icons (192px + 512px required)
```

---

## WHAT'S BUILT (Phase 1)

- [x] Complete design system (dark theme, teal accent)
- [x] Home screen with today's mission
- [x] Morning warm-up (4-step flow)
- [x] Airtable integration module
- [x] Audio recording module
- [x] Cloudflare Worker (Claude + Whisper)
- [x] PWA manifest + service worker
- [x] Navigation system with params
- [x] Toast notifications
- [x] Local storage state

## STILL TO BUILD (next sessions)

- [ ] practice.html (15-min session)
- [ ] characters.html + character.html
- [ ] phrases.html + phrase.html
- [ ] log.html (conversation logger)
- [ ] progress.html (dashboard)
- [ ] PWA icons (192 + 512px)
- [ ] Airtable tables 3-6

---

## DESIGN SYSTEM

| Token | Value |
|-------|-------|
| Background | `#0A0E1A` |
| Surface | `#111827` |
| Accent Teal | `#00E5C3` |
| Accent Amber | `#F5A623` |
| Accent Rose | `#FF4D6D` |
| Font Display | Syne |
| Font Body | DM Sans |
| Font Mono | DM Mono |

---

## COST

| Tool | Cost |
|------|------|
| GitHub Pages | ₹0 |
| Cloudflare Workers | ₹0 |
| Airtable Plus | ₹1,640/month |
| Claude API | ~₹40/month |
| Whisper API | ~₹80/month |
| Make.com | ₹740/month |
| **Total** | **~₹2,500/month** |
