const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const MODEL = 'gpt-5-nano';
const BASE_URL = 'https://api.openai.com/v1';

function cors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}
function clean(v, max = 12000) {
  return String(v || '').replace(/\s+$/g, '').slice(0, max);
}

exports.aiTutor = onRequest({
  region: 'us-central1',
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 60,
  memory: '512MiB',
  invoker: 'public'
}, async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { messages = [] } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages required' });
    }

    const safeMessages = messages.slice(-12).map(m => ({
      role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
      content: clean(m.content, 14000)
    })).filter(m => m.content);

    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY.value()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: safeMessages,
        reasoning_effort: 'low',
        max_completion_tokens: 1600
      })
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 800) });
    const data = JSON.parse(text);
    return res.json({
      answer: data.choices?.[0]?.message?.content || '',
      model: data.model || MODEL
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});
