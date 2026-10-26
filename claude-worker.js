/* ============================================
   FLUENCY LAB — CLOUDFLARE WORKER
   Proxies: Claude API + Whisper API + Airtable API
   Deploy at: https://dash.cloudflare.com

   Routes:
   POST /claude           → Claude analysis
   POST /transcribe       → Whisper transcription
   GET  /airtable/:table  → Airtable list/query
   POST /airtable/:table  → Airtable create record
   PATCH /airtable/:table/:id → Airtable update record
   GET  /airtable/:table/:id  → Airtable get by ID

   Environment Variables (set in Cloudflare dashboard):
   ANTHROPIC_API_KEY  — Claude API key
   OPENAI_API_KEY     — OpenAI / Whisper key
   AIRTABLE_PAT       — Airtable Personal Access Token
   AIRTABLE_BASE_ID   — apprLWVXZQQUhip5o
   ============================================ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── CLAUDE ───────────────────────────
      if (path === '/claude' && request.method === 'POST') {
        return await handleClaude(request, env);
      }

      // ─── WHISPER ──────────────────────────
      if (path === '/transcribe' && request.method === 'POST') {
        return await handleWhisper(request, env);
      }

      // ─── AIRTABLE PROXY ───────────────────
      // GET  /airtable/:table
      // POST /airtable/:table
      // GET  /airtable/:table/:id
      // PATCH /airtable/:table/:id
      if (path.startsWith('/airtable')) {
        return await handleAirtable(request, env, url);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: err.message }, 500);
    }
  }
};

// ─── HELPERS ────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── AIRTABLE HANDLER ───────────────────────
async function handleAirtable(request, env, url) {
  // Parse: /airtable/:table  or  /airtable/:table/:id
  const parts = url.pathname.replace('/airtable/', '').split('/');
  const table = decodeURIComponent(parts[0]);
  const recordId = parts[1] || null;

  if (!table) return json({ error: 'Table name required' }, 400);

  const baseId = env.AIRTABLE_BASE_ID;
  const pat = env.AIRTABLE_PAT;

  if (!baseId || !pat) {
    return json({ error: 'Airtable env vars not configured' }, 500);
  }

  const atHeaders = {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json',
  };

  // Build Airtable URL
  let atUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  if (recordId) atUrl += `/${recordId}`;

  // Forward query params (filterByFormula, sort, maxRecords, etc.)
  if (request.method === 'GET') {
    const qp = url.searchParams.toString();
    if (qp) atUrl += `?${qp}`;
  }

  // Build proxied request
  let atInit = { method: request.method, headers: atHeaders };

  if (request.method === 'POST' || request.method === 'PATCH') {
    const body = await request.json();
    atInit.body = JSON.stringify(body);
  }

  const atRes = await fetch(atUrl, atInit);
  const data = await atRes.json();

  if (!atRes.ok) {
    return json({ error: 'Airtable error', detail: data }, atRes.status);
  }

  return json(data);
}

// ─── CLAUDE HANDLER ─────────────────────────
async function handleClaude(request, env) {
  const { prompt, systemPrompt } = await request.json();

  if (!prompt) return json({ error: 'No prompt provided' }, 400);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt || 'You are a speaking coach. Be concise and direct.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  let parsed = null;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { text };
  }

  return json(parsed);
}

// ─── WHISPER HANDLER ────────────────────────
async function handleWhisper(request, env) {
  const formData = await request.formData();
  const audioFile = formData.get('audio');

  if (!audioFile) return json({ error: 'No audio file provided' }, 400);

  const whisperForm = new FormData();
  whisperForm.append('file', audioFile, 'recording.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'en');
  whisperForm.append('response_format', 'json');

  // Optional prompt: used by the Stage to keep um/uh/like in the transcript.
  const hint = formData.get('prompt');
  if (hint && typeof hint === 'string') whisperForm.append('prompt', hint.slice(0, 400));

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
    body: whisperForm,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return json({ text: data.text || '' });
}

/* ─── DEPLOYMENT INSTRUCTIONS ──────────────────

1. Go to: https://dash.cloudflare.com
2. Workers & Pages → Create Application → Create Worker
3. Name it: fluency-lab
4. Paste this entire file → Save & Deploy

5. Add Environment Variables (Settings → Variables & Secrets):
   ANTHROPIC_API_KEY  = your Claude API key
   OPENAI_API_KEY     = your OpenAI key (for Whisper)
   AIRTABLE_PAT       = your Airtable Personal Access Token
   AIRTABLE_BASE_ID   = apprLWVXZQQUhip5o

6. Copy your worker URL (e.g. fluency-lab.yourname.workers.dev)
7. Update WORKERS.BASE_URL in app.js with that URL

────────────────────────────────────────────── */
