/* ============================================
   FLUENCY LAB — CLOUDFLARE WORKER
   Handles Claude API + Whisper API calls
   Deploy at: https://dash.cloudflare.com

   Routes:
   POST /claude      → Claude analysis
   POST /transcribe  → Whisper transcription
   ============================================ */

export default {
  async fetch(request, env, ctx) {
    // CORS headers — update origin in production
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // ─── CLAUDE ROUTE ─────────────────────
      if (url.pathname === '/claude' && request.method === 'POST') {
        return handleClaude(request, env, corsHeaders);
      }

      // ─── WHISPER ROUTE ────────────────────
      if (url.pathname === '/transcribe' && request.method === 'POST') {
        return handleWhisper(request, env, corsHeaders);
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};

// ─── CLAUDE HANDLER ───────────────────────────
async function handleClaude(request, env, corsHeaders) {
  const { prompt, systemPrompt } = await request.json();

  if (!prompt) {
    return new Response(
      JSON.stringify({ error: 'No prompt provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // Fastest + cheapest for session analysis
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

  // Try to parse JSON response (for structured analysis)
  let parsed = null;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Return as plain text if not JSON
    parsed = { text };
  }

  return new Response(
    JSON.stringify(parsed),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─── WHISPER HANDLER ──────────────────────────
async function handleWhisper(request, env, corsHeaders) {
  const formData = await request.formData();
  const audioFile = formData.get('audio');

  if (!audioFile) {
    return new Response(
      JSON.stringify({ error: 'No audio file provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build multipart form for OpenAI
  const whisperForm = new FormData();
  whisperForm.append('file', audioFile, 'recording.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'en');
  whisperForm.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: whisperForm,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return new Response(
    JSON.stringify({ text: data.text || '' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/* ─── DEPLOYMENT INSTRUCTIONS ──────────────────

1. Go to: https://dash.cloudflare.com
2. Workers & Pages → Create Application → Create Worker
3. Name it: fluency-lab
4. Paste this entire file
5. Save & Deploy

6. Add Environment Variables (Settings → Variables):
   ANTHROPIC_API_KEY = your_claude_api_key
   OPENAI_API_KEY = your_openai_api_key

7. Copy your worker URL (e.g. fluency-lab.yourname.workers.dev)
8. Update WORKERS.BASE_URL in js/app.js

That's it. Same pattern as your existing Virorah workers.

────────────────────────────────────────────── */
