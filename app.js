// ============================================================
// Gemini AI Studio Toolkit — app.js v3.0
// ALL API calls go through backend proxy — no CORS errors!
// ============================================================

const PROXY = 'https://api.base44.com/api/apps/6a3df1561e6b5178cc327275/functions/geminiProxy';

// ---- STATE ----
let chatHistory = [];
let attachedFile = null;
let attachedFileB64 = null;
let attachedFileMime = null;

// ---- INIT ----
window.addEventListener('DOMContentLoaded', function() {
  renderApiList();
});

// ============================================================
// HELPERS
// ============================================================
function getKey(name) { return localStorage.getItem(name) || ''; }

function setOutput(id, text, cls) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = text;
  el.className = 'output-box' + (cls ? ' ' + cls : '');
}

function copyOutput(id) {
  var el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(function() { showToast('✅ Copied!'); });
}

function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', right:'24px',
    background:'#1a3a5c', color:'#8ab4f8',
    padding:'10px 18px', borderRadius:'8px',
    border:'1px solid #8ab4f8', fontSize:'14px',
    zIndex:'9999', transition:'opacity 0.3s'
  });
  document.body.appendChild(t);
  setTimeout(function() { t.style.opacity='0'; setTimeout(function(){ t.remove(); }, 400); }, 2500);
}

function showFileName(input, targetId) {
  var el = document.getElementById(targetId);
  if (el && input.files[0]) el.textContent = '✅ ' + input.files[0].name;
}

function previewImage(input, previewId) {
  var prev = document.getElementById(previewId);
  if (prev && input.files[0]) {
    prev.src = URL.createObjectURL(input.files[0]);
    prev.style.display = 'block';
  }
}

function fileToBase64(file) {
  return new Promise(function(res, rej) {
    var r = new FileReader();
    r.onload = function() { res(r.result.split(',')[1]); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ============================================================
// PROXY CALL — single function for ALL API requests
// ============================================================
async function proxyCall(action, extraPayload) {
  var body = {
    action: action,
    gemini_key: getKey('gemini_key'),
    groq_key: getKey('groq_key'),
    payload: extraPayload || {}
  };

  var res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  var data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// Gemini text extraction helper
function extractGeminiText(data) {
  var parts = data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts;
  return (parts || []).map(function(p) { return p.text; }).filter(Boolean).join('\n') || 'কোনো উত্তর পাওয়া যায়নি।';
}

// ============================================================
// NAVIGATION
// ============================================================
var SECTION_META = {
  'chat':          { title: '🤖 AI Assistant',    model: 'gemini-2.0-flash' },
  'audio':         { title: '🎙️ Audio Transcribe', model: 'gemini-2.0-flash' },
  'video':         { title: '📹 Video Analyze',    model: 'gemini-2.5-pro' },
  'fast':          { title: '⚡ Fast Response',    model: 'gemini-flash-lite' },
  'image-analyze': { title: '🔍 Image Analyze',    model: 'gemini-2.5-pro' },
  'image-gen':     { title: '🖼️ Image Generate',   model: 'imagen-4.0' },
  'tts':           { title: '🔊 Text to Speech',   model: 'gemini-tts' },
  'search':        { title: '🔍 Google Search',    model: 'gemini+search' },
  'huggingface':   { title: '🤗 Hugging Face',     model: 'hf-inference' },
  'groq':          { title: '⚡ Groq AI',           model: 'llama3-70b' },
  'api-settings':  { title: '⚙️ API Settings',     model: 'config' }
};

function showSection(name) {
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
  var sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf("'" + name + "'") !== -1)
      btn.classList.add('active');
  });
  var meta = SECTION_META[name] || {};
  document.getElementById('section-title').textContent = meta.title || name;
  document.getElementById('model-badge').textContent = meta.model || '';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ============================================================
// CHAT
// ============================================================
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleAttach(input) {
  var file = input.files[0];
  if (!file) return;
  attachedFile = file;
  attachedFileMime = file.type;
  var preview = document.getElementById('attach-preview');
  var img = document.getElementById('attach-img');
  if (file.type.startsWith('image/')) {
    img.src = URL.createObjectURL(file);
    preview.style.display = 'flex';
  }
  fileToBase64(file).then(function(b64) { attachedFileB64 = b64; });
}

function clearAttachment() {
  attachedFile = null; attachedFileB64 = null; attachedFileMime = null;
  document.getElementById('attach-preview').style.display = 'none';
  document.getElementById('chat-file').value = '';
}

function addChatBubble(role, text, imgSrc) {
  var wrap = document.getElementById('chat-messages');
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + role;
  if (role === 'bot') {
    bubble.innerHTML = '<div class="bot-icon">✦</div><div class="bubble-text">' + text + '</div>';
  } else {
    bubble.innerHTML = '<div class="bubble-text">' + text +
      (imgSrc ? '<br/><img src="' + imgSrc + '" class="bubble-img"/>' : '') + '</div>';
  }
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  var wrap = document.getElementById('chat-messages');
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot';
  bubble.id = 'typing-indicator';
  bubble.innerHTML = '<div class="bot-icon">✦</div><div class="bubble-text"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
}

function removeTypingIndicator() {
  var el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendChat() {
  var input = document.getElementById('chat-input');
  var msg = input.value.trim();
  if (!msg && !attachedFile) return;

  var displayMsg = msg || '📎 ফাইল পাঠানো হয়েছে';
  var imgPreview = (attachedFile && attachedFile.type.startsWith('image/')) ? URL.createObjectURL(attachedFile) : null;
  addChatBubble('user', displayMsg, imgPreview);
  input.value = '';
  input.style.height = 'auto';

  // API add command
  var apiMatch = msg.match(/(.+?)\s*api\s*(?:add|যোগ|দাও|key)\s*(?:করো|:)?\s*[:：]?\s*([a-zA-Z0-9_\-\.]+)/i);
  if (apiMatch) {
    var apiName = apiMatch[1].trim();
    var apiKey = apiMatch[2].trim();
    saveApiKey(apiName, apiKey);
    clearAttachment();
    addChatBubble('bot', '✅ <b>' + apiName + '</b> API key সেভ হয়েছে!<br/><code>' + apiKey.slice(0,10) + '...</code>');
    return;
  }

  if (!getKey('gemini_key')) {
    addChatBubble('bot', '⚠️ Gemini API Key নেই!<br/><br/>⚙️ <b>API Settings</b> এ গিয়ে Gemini key দিন।<br/>Free key: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--primary)">aistudio.google.com</a>');
    return;
  }

  addTypingIndicator();

  try {
    var parts = [{ text: msg || 'এই ফাইলটা analyze করো।' }];
    if (attachedFileB64) {
      parts.unshift({ inline_data: { mime_type: attachedFileMime, data: attachedFileB64 } });
    }
    chatHistory.push({ role: 'user', parts: parts });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    var data = await proxyCall('gemini', { model: 'gemini-2.0-flash', contents: chatHistory });
    var result = extractGeminiText(data);
    chatHistory.push({ role: 'model', parts: [{ text: result }] });
    removeTypingIndicator();
    addChatBubble('bot', result.replace(/\n/g, '<br/>'));
  } catch(e) {
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
  var file = document.getElementById('audio-file').files[0];
  var prompt = document.getElementById('audio-prompt').value || 'Transcribe this audio accurately.';
  if (!file) { showToast('⚠️ অডিও ফাইল বেছে নিন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('audio-output', '⏳ Transcribing...', 'loading');
  try {
    var b64 = await fileToBase64(file);
    var data = await proxyCall('gemini', {
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }] }]
    });
    setOutput('audio-output', extractGeminiText(data));
  } catch(e) { setOutput('audio-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// VIDEO ANALYZE
// ============================================================
async function runVideoAnalyze() {
  var file = document.getElementById('video-file').files[0];
  var prompt = document.getElementById('video-prompt').value || 'Analyze this video and provide a detailed summary.';
  if (!file) { showToast('⚠️ ভিডিও ফাইল বেছে নিন'); return; }
  if (file.size > 20*1024*1024) { showToast('⚠️ ভিডিও ২০MB এর কম হতে হবে'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('video-output', '⏳ ভিডিও বিশ্লেষণ হচ্ছে...', 'loading');
  try {
    var b64 = await fileToBase64(file);
    var data = await proxyCall('gemini', {
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }] }]
    });
    setOutput('video-output', extractGeminiText(data));
  } catch(e) { setOutput('video-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// FAST RESPONSE
// ============================================================
async function runFast() {
  var prompt = document.getElementById('fast-prompt').value.trim();
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('fast-output', '⚡ উত্তর আনছি...', 'loading');
  try {
    var data = await proxyCall('gemini', {
      model: 'gemini-2.0-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    setOutput('fast-output', extractGeminiText(data));
  } catch(e) { setOutput('fast-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// IMAGE ANALYZE
// ============================================================
async function runImageAnalyze() {
  var file = document.getElementById('img-analyze-file').files[0];
  var prompt = document.getElementById('img-analyze-prompt').value || 'Describe this image in detail.';
  if (!file) { showToast('⚠️ ছবি বেছে নিন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('img-analyze-output', '🔍 ছবি বিশ্লেষণ হচ্ছে...', 'loading');
  try {
    var b64 = await fileToBase64(file);
    var data = await proxyCall('gemini', {
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: file.type, data: b64 } }, { text: prompt }] }]
    });
    setOutput('img-analyze-output', extractGeminiText(data));
  } catch(e) { setOutput('img-analyze-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// IMAGE GENERATE
// ============================================================
async function runImageGen() {
  var prompt = document.getElementById('img-gen-prompt').value.trim();
  var ratio = document.getElementById('img-ratio').value;
  var count = parseInt(document.getElementById('img-count').value);
  var modelChoice = document.getElementById('img-gen-model') ? document.getElementById('img-gen-model').value : 'gemini-flash';
  if (!prompt) { showToast('⚠️ ছবির বিবরণ লিখুন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  var grid = document.getElementById('img-gen-output');
  grid.innerHTML = '<p style="color:var(--primary);padding:12px">⏳ ছবি তৈরি হচ্ছে...</p>';

  try {
    if (modelChoice === 'imagen4') {
      var data = await proxyCall('imagen', { prompt: prompt, sampleCount: count, aspectRatio: ratio });
      grid.innerHTML = '';
      (data.predictions || []).forEach(function(pred) {
        if (pred.bytesBase64Encoded) {
          var img = document.createElement('img');
          img.src = 'data:image/png;base64,' + pred.bytesBase64Encoded;
          img.onclick = function() { window.open(img.src); };
          grid.appendChild(img);
        }
      });
    } else {
      // Gemini Flash image generation
      var data2 = await proxyCall('gemini', {
        model: 'gemini-2.0-flash-exp',
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      });
      grid.innerHTML = '';
      var parts = data2.candidates && data2.candidates[0] && data2.candidates[0].content && data2.candidates[0].content.parts || [];
      parts.forEach(function(part) {
        if (part.inlineData && part.inlineData.data) {
          var img = document.createElement('img');
          img.src = 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data;
          img.onclick = function() { window.open(img.src); };
          grid.appendChild(img);
        }
      });
    }
    if (!grid.children.length) grid.innerHTML = '<p style="color:var(--error)">কোনো ছবি পাওয়া যায়নি। অন্য model চেষ্টা করুন।</p>';
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--error)">❌ ' + e.message + '</p>';
  }
}

// ============================================================
// TEXT TO SPEECH
// ============================================================
async function runTTS() {
  var text = document.getElementById('tts-text').value.trim();
  var voice = document.getElementById('tts-voice').value;
  if (!text) { showToast('⚠️ টেক্সট লিখুন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('tts-output', '🔊 ভয়েস তৈরি হচ্ছে...', 'loading');
  try {
    var data = await proxyCall('gemini', {
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    });

    var c = data.candidates;
    var audioB64 = c && c[0] && c[0].content && c[0].content.parts && c[0].content.parts[0] && c[0].content.parts[0].inlineData && c[0].content.parts[0].inlineData.data;
    if (!audioB64) throw new Error('Audio data পাওয়া যায়নি');

    var blob = new Blob([Uint8Array.from(atob(audioB64), function(c2){ return c2.charCodeAt(0); })], { type: 'audio/wav' });
    var audioUrl = URL.createObjectURL(blob);
    document.getElementById('tts-output').innerHTML =
      '<audio controls style="width:100%;margin-bottom:8px"><source src="' + audioUrl + '" type="audio/wav"/></audio>' +
      '<a href="' + audioUrl + '" download="tts.wav" style="color:var(--primary);font-size:13px">⬇️ Download</a>';
  } catch(e) { setOutput('tts-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// GOOGLE SEARCH
// ============================================================
async function runSearch() {
  var prompt = document.getElementById('search-prompt').value.trim();
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }
  if (!getKey('gemini_key')) { showToast('⚠️ Gemini key নেই! API Settings এ দিন।'); return; }

  setOutput('search-output', '🔍 Google Search করছি...', 'loading');
  try {
    var data = await proxyCall('gemini', {
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {},
      tools: [{ google_search: {} }]
    });
    setOutput('search-output', extractGeminiText(data));
  } catch(e) { setOutput('search-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// HUGGING FACE
// ============================================================
async function runHuggingFace() {
  var model = document.getElementById('hf-model').value.trim();
  var inputs = document.getElementById('hf-input').value.trim();
  var task = document.getElementById('hf-task').value;
  if (!inputs) { showToast('⚠️ Input দিন'); return; }

  var hfKey = getKey('huggingface_key');
  if (!hfKey) {
    setOutput('hf-output', '❌ Hugging Face API Key নেই!\n\nAPI Settings এ key দিন।\nFree: https://huggingface.co/settings/tokens', 'error');
    return;
  }

  setOutput('hf-output', '🤗 Model চলছে...', 'loading');
  try {
    var data = await proxyCall('huggingface', { hf_key: hfKey, model: model, inputs: inputs, task: task });
    var result = data.result;
    var output = '';
    if (Array.isArray(result)) {
      output = result.map(function(d) {
        return d.generated_text || d.summary_text || d.translation_text || d.label || JSON.stringify(d);
      }).join('\n\n');
    } else if (result && result.generated_text) {
      output = result.generated_text;
    } else {
      output = JSON.stringify(result, null, 2);
    }
    setOutput('hf-output', output);
  } catch(e) { setOutput('hf-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// GROQ AI
// ============================================================
async function runGroq() {
  var prompt = document.getElementById('groq-prompt').value.trim();
  var model = document.getElementById('groq-model').value;
  if (!prompt) { showToast('⚠️ প্রশ্ন লিখুন'); return; }

  var groqKey = getKey('groq_key');
  if (!groqKey) {
    setOutput('groq-output',
      '❌ Groq API Key নেই!\n\nAPI Settings এ key দিন।\nFree key: https://console.groq.com/keys', 'error');
    return;
  }

  setOutput('groq-output', '⚡ Groq [' + model + '] চলছে...', 'loading');
  try {
    var data = await proxyCall('groq', { prompt: prompt, model: model });
    setOutput('groq-output', '✅ [' + model + ']\n\n' + data.result);
  } catch(e) { setOutput('groq-output', '❌ ' + e.message, 'error'); }
}

// ============================================================
// API SETTINGS
// ============================================================
var DEFAULT_APIS = [
  { name: 'Gemini (Google)', key: 'gemini_key', placeholder: 'AIza...' },
  { name: 'Groq',            key: 'groq_key',        placeholder: 'gsk_...' },
  { name: 'Hugging Face',    key: 'huggingface_key', placeholder: 'hf_...' },
  { name: 'OpenAI',          key: 'openai_key',      placeholder: 'sk-...' },
  { name: 'Anthropic',       key: 'anthropic_key',   placeholder: 'sk-ant-...' },
  { name: 'Stability AI',    key: 'stability_key',   placeholder: 'sk-...' },
];

function saveApiKey(name, keyValue) {
  var lower = name.toLowerCase();
  var storageKey = lower.replace(/\s+/g,'_') + '_key';
  if (lower.includes('gemini') || lower.includes('google')) storageKey = 'gemini_key';
  else if (lower.includes('groq')) storageKey = 'groq_key';
  else if (lower.includes('hugging') || lower === 'hf') storageKey = 'huggingface_key';
  else if (lower.includes('openai')) storageKey = 'openai_key';
  else if (lower.includes('anthropic') || lower.includes('claude')) storageKey = 'anthropic_key';
  else if (lower.includes('stability')) storageKey = 'stability_key';

  localStorage.setItem(storageKey, keyValue);
  var customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  var existing = customs.findIndex(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
  if (existing >= 0) customs[existing] = { name: name, key: storageKey };
  else customs.push({ name: name, key: storageKey });
  localStorage.setItem('custom_apis', JSON.stringify(customs));
  renderApiList();
}

function renderApiList() {
  var list = document.getElementById('api-list');
  if (!list) return;
  list.innerHTML = '';

  var allApis = DEFAULT_APIS.slice();
  var customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  customs.forEach(function(c) {
    if (!allApis.find(function(a){ return a.key===c.key; }))
      allApis.push({ name: c.name, key: c.key, placeholder: 'key...' });
  });

  allApis.forEach(function(api) {
    var val = localStorage.getItem(api.key) || '';
    var entry = document.createElement('div');
    entry.className = 'api-entry';
    entry.innerHTML =
      '<span class="api-entry-name">' + api.name + '</span>' +
      '<input type="password" ' +
        'style="flex:2;background:#0d1117;border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;font-family:monospace" ' +
        'placeholder="' + (api.placeholder||'key...') + '" ' +
        'value="' + val + '" ' +
        'onchange="localStorage.setItem(\'' + api.key + '\',this.value);showToast(\'✅ ' + api.name + ' সেভ!\')" />' +
      '<button class="api-entry-del" onclick="deleteApi(\'' + api.key + '\',\'' + api.name + '\')" title="Delete">' +
        '<span class="material-icons" style="font-size:18px">delete</span>' +
      '</button>';
    list.appendChild(entry);
  });
}

function deleteApi(key, name) {
  if (!confirm(name + ' API key মুছে দেবেন?')) return;
  localStorage.removeItem(key);
  var customs = JSON.parse(localStorage.getItem('custom_apis') || '[]');
  localStorage.setItem('custom_apis', JSON.stringify(customs.filter(function(c){ return c.key!==key; })));
  renderApiList();
  showToast('🗑️ ' + name + ' মুছে গেছে');
}

function addNewApi() {
  var name = document.getElementById('new-api-name').value.trim();
  var key = document.getElementById('new-api-key').value.trim();
  if (!name || !key) { showToast('⚠️ নাম ও key দুটোই দিন'); return; }
  saveApiKey(name, key);
  document.getElementById('new-api-name').value = '';
  document.getElementById('new-api-key').value = '';
  var msg = document.getElementById('api-save-msg');
  msg.textContent = '✅ ' + name + ' API সেভ হয়েছে!';
  msg.style.display = 'block';
  setTimeout(function(){ msg.style.display='none'; }, 3000);
}
