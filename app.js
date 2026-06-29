// ============================================================
// Gemini AI Studio Toolkit — app.js
// Fully fixed & enhanced | Author: Md Ridy
// ============================================================

// ---- STATE ----
let chatHistory = [];
let attachedFile = null;
let attachedFileB64 = null;
let attachedFileMime = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// ---- INIT ----
window.addEventListener('DOMContentLoaded', () => {
  loadApiSettings();
  renderApiList();
});

// ============================================================
// HELPERS
// ============================================================
function getKey(name = 'gemini_key') {
  return localStorage.getItem(name) || '';
}

function setOutput(id, text, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = text;
  el.className = 'output-box' + (cls ? ' ' + cls : '');
}

function copyOutput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => showToast('✅ Copied!'));
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', right:'24px',
    background:'#1a3a5c', color:'#8ab4f8',
    padding:'10px 18px', borderRadius:'8px',
    border:'1px solid #8ab4f8', fontSize:'14px',
    zIndex:9999, transition:'opacity 0.3s'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2000);
}

function showFileName(input, targetId) {
  const el = document.getElementById(targetId);
  if (el && input.files[0]) el.textContent = '✅ ' + input.files[0].name;
}

function previewImage(input, previewId) {
  const prev = document.getElementById(previewId);
  if (prev && input.files[0]) {
    prev.src = URL.createObjectURL(input.files[0]);
    prev.style.display = 'block';
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ============================================================
// GEMINI API CALL
// ============================================================
async function callGemini(model, contents, extra = {}) {
  const key = getKey('gemini_key');
  if (!key) { showSection('api-settings'); throw new Error('Gemini API Key নেই! API Settings এ দিন।'); }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, ...extra }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API Error');
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || 'কোনো উত্তর পাওয়া যায়নি।';
}

// ============================================================
// NAVIGATION
// ============================================================
const SECTION_META = {
  chat: { title: '🤖 AI Assistant', model: 'gemini-2.0-flash' },
  audio: { title: '🎙️ Audio Transcribe', model: 'gemini-2.0-flash' },
  video: { title: '📹 Video Analyze', model: 'gemini-2.5-pro' },
  fast: { title: '⚡ Fast Response', model: 'gemini-2.0-flash-lite' },
  'image-analyze': { title: '🔍 Image Analyze', model: 'gemini-2.5-pro' },
  'image-gen': { title: '🖼️ Image Generate', model: 'imagen-3.0' },
  tts: { title: '🔊 Text to Speech', model: 'gemini-tts' },
  search: { title: '🔍 Google Search', model: 'gemini + search' },
  huggingface: { title: '🤗 Hugging Face', model: 'hf-inference' },
  'api-settings': { title: '⚙️ API Settings', model: 'config' }
};

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${name}'`)) btn.classList.add('active');
  });

  const meta = SECTION_META[name] || {};
  document.getElementById('section-title').textContent = meta.title || name;
  document.getElementById('model-badge').textContent = meta.model || '';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ============================================================
// CHAT — AI ASSISTANT (smart command handler)
// ============================================================
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleAttach(input) {
  const file = input.files[0];
  if (!file) return;
  attachedFile = file;
  attachedFileMime = file.type;
  const preview = document.getElementById('attach-preview');
  const img = document.getElementById('attach-img');
  if (file.type.startsWith('image/')) {
    img.src = URL.createObjectURL(file);
    preview.style.display = 'flex';
  }
  fileToBase64(file).then(b64 => attachedFileB64 = b64);
}

function clearAttachment() {
  attachedFile = null; attachedFileB64 = null; attachedFileMime = null;
  document.getElementById('attach-preview').style.display = 'none';
  document.getElementById('chat-file').value = '';
}

function addChatBubble(role, text, imgSrc = null) {
  const wrap = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + role;

  if (role === 'bot') {
    bubble.innerHTML = `<div class="bot-icon">✦</div><div class="bubble-text">${text}</div>`;
  } else {
    bubble.innerHTML = `<div class="bubble-text">${text}${imgSrc ? `<br/><img src="${imgSrc}" class="bubble-img"/>` : ''}</div>`;
  }
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const wrap = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  bubble.id = 'typing-indicator';
  bubble.innerHTML = `<div class="bot-icon">✦</div><div class="bubble-text"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg && !attachedFile) return;

  const displayMsg = msg || '📎 ফাইল পাঠানো হয়েছে';
  const imgPreview = attachedFile?.type.startsWith('image/') ? URL.createObjectURL(attachedFile) : null;
  addChatBubble('user', displayMsg, imgPreview);
  input.value = '';
  input.style.height = 'auto';

  // Check for API add command
  const apiMatch = msg.match(/(.+?)\s*api\s*(?:add|যোগ|দাও|key)\s*(?:করো|:)?\s*[:：]?\s*([a-zA-Z0-9_\-\.]+)/i);
  if (apiMatch) {
    const apiName = apiMatch[1].trim();
    const apiKey = apiMatch[2].trim();
    saveApiKey(apiName, apiKey);
    clearAttachment();
    addChatBubble('bot', `✅ <b>${apiName}</b> API key সেভ হয়েছে!\n\nKey: <code>${apiKey.slice(0,8)}...</code>\n\nAPI Settings এ গিয়ে সব keys দেখতে পাবে।`);
    return;
  }

  addTypingIndicator();

  try {
    const parts = [{ text: msg || 'এই ফাইলটা analyze করো।' }];
    if (attachedFileB64) {
      parts.unshift({ inline_data: { mime_type: attachedFileMime, data: attachedFileB64 } });
    }

    chatHistory.push({ role: 'user', parts });
    // Keep last 10 turns
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    const result = await callGemini('gemini-2.0-flash', chatHistory);
    chatHistory.push({ role: 'model', parts: [{ text: result }] });

    removeTypingIndicator();
    addChatBubble('bot', result.replace(/\n/g, '<br/>'));
  } catch (e) {
    removeTypingIndicator();
    addChatBubble('bot', '❌ ' + e.message);
    chatHistory.pop();
  }

  clearAttachment();
}

// ============================================================
// AUDIO TRANSCRIBE
// ============================================================
async function runAudioTranscribe() {
  const file = document.getElementById('audio-file').files[0];
  const prompt = document.getElementById('audio-prompt').value || 'Transcribe this audio accurately.';
  if (!file) { showToast('⚠️ অডিও ফাইল বেছে নিন'); return; }

  setOutput('audio-output', '⏳ Transcribing...', 'loading');
  try {
    const b64 = await fileToBase64(file);
    const result = await callGemini('gemini-2.0-flash', [{
      role: 'user',
      parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }]
    }]);
    setOutput('audio-output', result);
  } catch (e) {
    setOutput('audio-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// VIDEO ANALYZE
// ============================================================
async function runVideoAnalyze() {
  const file = document.getElementById('video-file').files[0];
  const prompt = document.getElementById('video-prompt').value || 'Analyze this video and provide a detailed summary.';
  if (!file) { showToast('⚠️ ভিডিও ফাইল বেছে নিন'); return; }
  if (file.size > 20 * 1024 * 1024) { showToast('⚠️ ভিডিও ২০MB এর কম হতে হবে'); return; }

  setOutput('video-output', '⏳ ভিডিও বিশ্লেষণ হচ্ছে...', 'loading');
  try {
    const b64 = await fileToBase64(file);
    const result = await callGemini('gemini-2.5-pro', [{
      role: 'user',
      parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }]
    }]);
    setOutput('video-output', result);
  } catch (e) {
    setOutput('video-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// FAST RESPONSE
// ============================================================
async function runFast() {
  const prompt = document.getElementById('fast-prompt').value.trim();
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }

  setOutput('fast-output', '⚡ উত্তর আনছি...', 'loading');
  try {
    const result = await callGemini('gemini-2.0-flash-lite', [{ role: 'user', parts: [{ text: prompt }] }]);
    setOutput('fast-output', result);
  } catch (e) {
    setOutput('fast-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// IMAGE ANALYZE
// ============================================================
async function runImageAnalyze() {
  const file = document.getElementById('img-analyze-file').files[0];
  const prompt = document.getElementById('img-analyze-prompt').value || 'Describe this image in detail.';
  if (!file) { showToast('⚠️ ছবি বেছে নিন'); return; }

  setOutput('img-analyze-output', '🔍 ছবি বিশ্লেষণ হচ্ছে...', 'loading');
  try {
    const b64 = await fileToBase64(file);
    const result = await callGemini('gemini-2.5-pro', [{
      role: 'user',
      parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }]
    }]);
    setOutput('img-analyze-output', result);
  } catch (e) {
    setOutput('img-analyze-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// IMAGE GENERATE (Imagen 3)
// ============================================================
async function runImageGen() {
  const prompt = document.getElementById('img-gen-prompt').value.trim();
  const ratio = document.getElementById('img-ratio').value;
  const count = parseInt(document.getElementById('img-count').value);
  if (!prompt) { showToast('⚠️ ছবির বিবরণ লিখুন'); return; }

  const key = getKey('gemini_key');
  if (!key) { showSection('api-settings'); return; }

  const grid = document.getElementById('img-gen-output');
  grid.innerHTML = '<p style="color:var(--primary);padding:12px">⏳ ছবি তৈরি হচ্ছে...</p>';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: count, aspectRatio: ratio, safetyFilterLevel: 'BLOCK_ONLY_HIGH' }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Imagen API Error');

    grid.innerHTML = '';
    (data.predictions || []).forEach(pred => {
      if (pred.bytesBase64Encoded) {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${pred.bytesBase64Encoded}`;
        img.onclick = () => window.open(img.src);
        grid.appendChild(img);
      }
    });
    if (!grid.children.length) grid.innerHTML = '<p style="color:var(--error)">কোনো ছবি পাওয়া যায়নি।</p>';
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--error)">❌ ${e.message}</p>`;
  }
}

// ============================================================
// TEXT TO SPEECH
// ============================================================
async function runTTS() {
  const text = document.getElementById('tts-text').value.trim();
  const voice = document.getElementById('tts-voice').value;
  if (!text) { showToast('⚠️ টেক্সট লিখুন'); return; }

  const key = getKey('gemini_key');
  if (!key) { showSection('api-settings'); return; }

  setOutput('tts-output', '🔊 ভয়েস তৈরি হচ্ছে...', 'loading');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
        }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'TTS API Error');

    const audioB64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioB64) throw new Error('Audio data পাওয়া যায়নি');

    const blob = new Blob([Uint8Array.from(atob(audioB64), c => c.charCodeAt(0))], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);
    document.getElementById('tts-output').innerHTML = `
      <audio controls style="width:100%;margin-bottom:8px"><source src="${audioUrl}" type="audio/wav"/></audio>
      <a href="${audioUrl}" download="tts-output.wav" style="color:var(--primary);font-size:13px">⬇️ Download করুন</a>
    `;
  } catch (e) {
    setOutput('tts-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// GOOGLE SEARCH
// ============================================================
async function runSearch() {
  const prompt = document.getElementById('search-prompt').value.trim();
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }

  const key = getKey('gemini_key');
  if (!key) { showSection('api-settings'); return; }

  setOutput('search-output', '🔍 Google Search করছি...', 'loading');

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Search API Error');
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || 'ফলাফল পাওয়া যায়নি।';
    setOutput('search-output', text);
  } catch (e) {
    setOutput('search-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// HUGGING FACE
// ============================================================
async function runHuggingFace() {
  const model = document.getElementById('hf-model').value.trim();
  const input = document.getElementById('hf-input').value.trim();
  const task = document.getElementById('hf-task').value;
  if (!input) { showToast('⚠️ Input দিন'); return; }

  const hfKey = getKey('huggingface_key');
  if (!hfKey) {
    showToast('⚠️ Hugging Face API Key নেই! API Settings এ দিন।');
    showSection('api-settings');
    return;
  }

  setOutput('hf-output', '🤗 Model চলছে...', 'loading');

  try {
    let body;
    if (task === 'question-answering') {
      body = { inputs: { question: input, context: input } };
    } else {
      body = { inputs: input };
    }

    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Hugging Face API Error');

    let output = '';
    if (Array.isArray(data)) {
      output = data.map(d => d.generated_text || d.summary_text || d.translation_text || d.label || JSON.stringify(d)).join('\n\n');
    } else if (data.generated_text) {
      output = data.generated_text;
    } else {
      output = JSON.stringify(data, null, 2);
    }
    setOutput('hf-output', output);
  } catch (e) {
    setOutput('hf-output', '❌ ' + e.message, 'error');
  }
}

// ============================================================
// API SETTINGS MANAGEMENT
// ============================================================
const DEFAULT_APIS = [
  { name: 'Gemini (Google)', key: 'gemini_key', placeholder: 'AIza...' },
  { name: 'Hugging Face', key: 'huggingface_key', placeholder: 'hf_...' },
  { name: 'OpenAI', key: 'openai_key', placeholder: 'sk-...' },
  { name: 'Anthropic', key: 'anthropic_key', placeholder: 'sk-ant-...' },
  { name: 'Stability AI', key: 'stability_key', placeholder: 'sk-...' },
];

function loadApiSettings() {
  DEFAULT_APIS.forEach(api => {
    const saved = localStorage.getItem(api.key);
    const inp = document.getElementById('api-' + api.key);
    if (inp && saved) inp.value = saved;
  });
}

function saveApiKey(name, keyValue) {
  // Try to match known APIs
  const lower = name.toLowerCase();
  let storageKey = lower.replace(/\s+/g, '_') + '_key';
  if (lower.includes('gemini') || lower.includes('google')) storageKey = 'gemini_key';
  else if (lower.includes('hugging') || lower.includes('hf')) storageKey = 'huggingface_key';
  else if (lower.includes('openai')) storageKey = 'openai_key';
  else if (lower.includes('anthropic')) storageKey = 'anthropic_key';
  else if (lower.includes('stability')) storageKey = 'stability_key';

  localStorage.setItem(storageKey, keyValue);
  // Also save with custom name
  const customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  const existing = customs.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0) customs[existing] = { name, key: storageKey, value: keyValue };
  else customs.push({ name, key: storageKey, value: keyValue });
  localStorage.setItem('custom_apis', JSON.stringify(customs));
  renderApiList();
}

function renderApiList() {
  const list = document.getElementById('api-list');
  if (!list) return;
  list.innerHTML = '';

  const allApis = [...DEFAULT_APIS];
  const customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  customs.forEach(c => {
    if (!allApis.find(a => a.key === c.key)) allApis.push({ name: c.name, key: c.key });
  });

  allApis.forEach(api => {
    const val = localStorage.getItem(api.key) || '';
    const entry = document.createElement('div');
    entry.className = 'api-entry';
    entry.innerHTML = `
      <span class="api-entry-name">${api.name}</span>
      <input type="password" style="flex:2;background:#0d1117;border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;font-family:monospace"
        placeholder="${api.placeholder || 'API key...'}"
        value="${val}"
        onchange="localStorage.setItem('${api.key}', this.value); showToast('✅ ${api.name} সেভ হয়েছে!')"
      />
      <button class="api-entry-del" onclick="deleteApi('${api.key}','${api.name}')" title="Delete">
        <span class="material-icons" style="font-size:18px">delete</span>
      </button>
    `;
    list.appendChild(entry);
  });
}

function deleteApi(key, name) {
  if (!confirm(`${name} API key মুছে দেবেন?`)) return;
  localStorage.removeItem(key);
  const customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  localStorage.setItem('custom_apis', JSON.stringify(customs.filter(c => c.key !== key)));
  renderApiList();
  showToast(`🗑️ ${name} মুছে গেছে`);
}

function addNewApi() {
  const name = document.getElementById('new-api-name').value.trim();
  const key = document.getElementById('new-api-key').value.trim();
  if (!name || !key) { showToast('⚠️ নাম ও key দুটোই দিন'); return; }

  saveApiKey(name, key);
  document.getElementById('new-api-name').value = '';
  document.getElementById('new-api-key').value = '';

  const msg = document.getElementById('api-save-msg');
  msg.textContent = `✅ ${name} API সেভ হয়েছে!`;
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 3000);
}

// ============================================================
// GROQ API — Fast LLM (llama, mixtral, gemma)
// ============================================================
async function callGroq(prompt, model = 'llama3-8b-8192') {
  const key = getKey('groq_key');
  if (!key) {
    showToast('⚠️ Groq API Key নেই! API Settings এ দিন।');
    showSection('api-settings');
    throw new Error('Groq API Key missing');
  }

  // Groq has CORS issues from browser — use a CORS proxy
  const url = 'https://cors-anywhere.herokuapp.com/https://api.groq.com/openai/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq API Error');
  return data.choices?.[0]?.message?.content || 'কোনো উত্তর পাওয়া যায়নি।';
}

// ============================================================
// GROQ RUN — with Gemini fallback explanation
// ============================================================
async function runGroq() {
  const prompt = document.getElementById('groq-prompt').value.trim();
  const model = document.getElementById('groq-model').value;
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }

  const key = getKey('groq_key');
  if (!key) {
    setOutput('groq-output', '❌ Groq API Key পাওয়া যায়নি!\n\nAPI Settings এ গিয়ে Groq key দিন।\nGroq free key পেতে: https://console.groq.com', 'error');
    return;
  }

  setOutput('groq-output', '⚡ Groq চলছে...', 'loading');

  try {
    // Direct Groq call with proper headers
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (res.status === 0 || !res.ok) {
      // CORS fallback — use Gemini to explain
      const fallback = await callGemini('gemini-2.0-flash', [{
        role: 'user',
        parts: [{ text: `[Groq ${model} দিয়ে উত্তর দাও]: ${prompt}` }]
      }]);
      setOutput('groq-output', `⚠️ Groq CORS সমস্যা (browser limitation)। Gemini দিয়ে উত্তর:\n\n${fallback}`);
      return;
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const result = data.choices?.[0]?.message?.content || 'কোনো উত্তর পাওয়া যায়নি।';
    setOutput('groq-output', `✅ [${model}]\n\n${result}`);
  } catch (e) {
    // If CORS error, use Gemini as fallback
    if (e.message.includes('fetch') || e.message.includes('CORS') || e.message.includes('network')) {
      try {
        setOutput('groq-output', '⚠️ Groq browser CORS block। Gemini দিয়ে চেষ্টা করছি...', 'loading');
        const fallback = await callGemini('gemini-2.0-flash', [{
          role: 'user',
          parts: [{ text: prompt }]
        }]);
        setOutput('groq-output', `⚠️ Groq CORS blocked (browser limitation)\nGemini fallback:\n\n${fallback}`);
      } catch (e2) {
        setOutput('groq-output', '❌ ' + e.message, 'error');
      }
    } else {
      setOutput('groq-output', '❌ ' + e.message, 'error');
    }
  }
}

// Update SECTION_META for Groq
SECTION_META['groq'] = { title: '⚡ Groq AI', model: 'llama3-70b-8192' };
