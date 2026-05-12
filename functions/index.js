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
    const { messages = [], webSearch = false } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages required' });
    }

    const safeMessages = messages.slice(-12).map(m => ({
      role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
      content: clean(m.content, 14000)
    })).filter(m => m.content);

    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY.value()}`,
      'Content-Type': 'application/json'
    };
    const body = webSearch ? {
      model: MODEL,
      input: safeMessages,
      tools: [{ type: 'web_search_preview' }],
      reasoning: { effort: 'low' },
      max_output_tokens: 1800
    } : {
      model: MODEL,
      messages: safeMessages,
      reasoning_effort: 'low',
      max_completion_tokens: 1600
    };
    const endpoint = webSearch ? `${BASE_URL}/responses` : `${BASE_URL}/chat/completions`;
    const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 800) });
    const data = JSON.parse(text);
    const answer = webSearch
      ? (data.output_text || (data.output || []).flatMap(o => o.content || []).map(c => c.text || '').join('\n'))
      : (data.choices?.[0]?.message?.content || '');
    return res.json({ answer, model: data.model || MODEL, webSearch: !!webSearch });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});
