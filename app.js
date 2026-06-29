// =============================================
// Gemini AI Studio Toolkit — app.js
// Author: Md Ridy | GitHub: gemini-ai-studio-toolkit
// =============================================

// --- CONFIG (loaded from localStorage) ---
let config = {
  geminiKey: localStorage.getItem('gemini_key') || '',
  firebaseKey: localStorage.getItem('firebase_key') || '',
  lyriaEndpoint: localStorage.getItem('lyria_endpoint') || '',
  veoProject: localStorage.getItem('veo_project') || ''
};

// Chat history for multi-turn conversation
let chatHistory = [];

// Recording state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// =============================================
// NAVIGATION
// =============================================
const sectionTitles = {
  'audio': '🎙️ Audio Transcription',
  'video': '📹 Video Analysis',
  'fast': '⚡ Fast Response',
  'image-analyze': '🔍 Image Analysis',
  'image-gen': '🖼️ Image Generation',
  'video-gen': '🎬 Video Generation',
  'chatbot': '🤖 AI Chatbot',
  'search': '🔍 Google Search',
  'tts': '🔊 Text to Speech',
  'music': '🎵 AI Music',
  'api-settings': '⚙️ API Settings'
};

const sectionModels = {
  'audio': 'gemini-2.0-flash',
  'video': 'gemini-2.5-pro',
  'fast': 'gemini-2.0-flash-lite',
  'image-analyze': 'gemini-2.5-pro',
  'image-gen': 'imagen-3.0',
  'video-gen': 'veo-3',
  'chatbot': 'gemini-2.0-flash',
  'search': 'gemini-2.0-flash + Search',
  'tts': 'gemini-tts',
  'music': 'lyria-2',
  'api-settings': 'config'
};

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');

  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${name}'`)) {
      btn.classList.add('active');
    }
  });

  document.getElementById('section-title').textContent = sectionTitles[name] || name;
  document.getElementById('model-badge').textContent = sectionModels[name] || '';
}

// =============================================
// API HELPERS
// =============================================
function getKey() {
  const key = config.geminiKey || localStorage.getItem('gemini_key');
  if (!key) {
    alert('⚠️ আগে API Settings এ আপনার Gemini API Key সেট করুন!');
    showSection('api-settings');
    return null;
  }
  return key;
}

function setOutput(id, text, isLoading = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'output-area' + (isLoading ? ' loading' : '');
}

async function callGemini(model, contents, config_params = {}) {
  const key = getKey();
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      ...config_params
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'API Error');
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'কোনো উত্তর পাওয়া যায়নি।';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =============================================
// 1. AUDIO TRANSCRIBE
// =============================================
async function runAudioTranscribe() {
  const file = document.getElementById('audio-file').files[0];
  const prompt = document.getElementById('audio-prompt').value || 'Please transcribe this audio accurately.';

  if (!file) { alert('অডিও ফাইল বেছে নিন।'); return; }
  setOutput('audio-output', '⏳ Transcribing...', true);

  try {
    const b64 = await fileToBase64(file);
    const contents = [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: file.type, data: b64 } },
        { text: prompt }
      ]
    }];
    const result = await callGemini('gemini-2.0-flash', contents);
    setOutput('audio-output', result);
  } catch (e) {
    setOutput('audio-output', '❌ Error: ' + e.message);
  }
}

function toggleRecording() {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' });

      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('audio-file').files = dt.files;
      setOutput('audio-output', '✅ রেকর্ডিং সম্পন্ন। Transcribe করতে বোতাম চাপুন।');
    };
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('record-btn').innerHTML = '<span class="material-icons">stop</span> রেকর্ড বন্ধ করুন';
    document.getElementById('record-btn').style.borderColor = '#f28b82';
    document.getElementById('record-btn').style.color = '#f28b82';
  } catch (e) {
    alert('মাইক্রোফোন access দিন: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  isRecording = false;
  document.getElementById('record-btn').innerHTML = '<span class="material-icons">fiber_manual_record</span> লাইভ রেকর্ড শুরু করুন';
  document.getElementById('record-btn').style.borderColor = '#8ab4f8';
  document.getElementById('record-btn').style.color = '#8ab4f8';
}

// =============================================
// 2. VIDEO ANALYZE
// =============================================
async function runVideoAnalyze() {
  const file = document.getElementById('video-file').files[0];
  const prompt = document.getElementById('video-prompt').value || 'Analyze this video and provide a detailed summary.';

  if (!file) { alert('ভিডিও ফাইল বেছে নিন।'); return; }
  if (file.size > 20 * 1024 * 1024) { alert('ভিডিও ২০MB এর কম হতে হবে।'); return; }

  setOutput('video-output', '⏳ ভিডিও বিশ্লেষণ করছি...', true);

  try {
    const b64 = await fileToBase64(file);
    const contents = [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: file.type, data: b64 } },
        { text: prompt }
      ]
    }];
    const result = await callGemini('gemini-2.5-pro', contents);
    setOutput('video-output', result);
  } catch (e) {
    setOutput('video-output', '❌ Error: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const vf = document.getElementById('video-file');
  if (vf) vf.addEventListener('change', e => {
    const fn = document.getElementById('video-filename');
    if (fn && e.target.files[0]) fn.textContent = '✅ ' + e.target.files[0].name;
  });
});

// =============================================
// 3. FAST RESPONSE
// =============================================
async function runFastResponse() {
  const prompt = document.getElementById('fast-prompt').value.trim();
  if (!prompt) { alert('প্রশ্ন লিখুন।'); return; }

  setOutput('fast-output', '⚡ দ্রুত উত্তর আনছি...', true);

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const result = await callGemini('gemini-2.0-flash-lite', contents);
    setOutput('fast-output', result);
  } catch (e) {
    setOutput('fast-output', '❌ Error: ' + e.message);
  }
}

// =============================================
// 4. IMAGE ANALYZE
// =============================================
async function runImageAnalyze() {
  const file = document.getElementById('image-file').files[0];
  const prompt = document.getElementById('image-prompt').value || 'Describe this image in detail.';

  if (!file) { alert('ছবি বেছে নিন।'); return; }
  setOutput('image-analyze-output', '🔍 ছবি বিশ্লেষণ করছি...', true);

  try {
    const b64 = await fileToBase64(file);
    const contents = [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: file.type, data: b64 } },
        { text: prompt }
      ]
    }];
    const result = await callGemini('gemini-2.5-pro', contents);
    setOutput('image-analyze-output', result);
  } catch (e) {
    setOutput('image-analyze-output', '❌ Error: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const imgFile = document.getElementById('image-file');
  if (imgFile) imgFile.addEventListener('change', e => {
    const preview = document.getElementById('image-preview');
    if (e.target.files[0]) {
      preview.src = URL.createObjectURL(e.target.files[0]);
      preview.style.display = 'block';
    }
  });
});

// =============================================
// 5. IMAGE GENERATE (Imagen 3)
// =============================================
async function runImageGen() {
  const prompt = document.getElementById('image-gen-prompt').value.trim();
  const aspectRatio = document.getElementById('aspect-ratio').value;
  const count = parseInt(document.getElementById('image-count').value);

  if (!prompt) { alert('ছবির বিবরণ লিখুন।'); return; }
  const key = getKey();
  if (!key) return;

  const output = document.getElementById('image-gen-output');
  output.innerHTML = '<p style="color:#8ab4f8;padding:16px">⏳ ছবি তৈরি হচ্ছে...</p>';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: count,
        aspectRatio,
        safetyFilterLevel: 'BLOCK_ONLY_HIGH',
        personGeneration: 'ALLOW_ADULT'
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'API Error');
    const data = await res.json();

    output.innerHTML = '';
    data.predictions?.forEach(pred => {
      if (pred.bytesBase64Encoded) {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${pred.bytesBase64Encoded}`;
        img.alt = 'Generated Image';
        output.appendChild(img);
      }
    });

    if (!output.children.length) output.innerHTML = '<p style="color:#f28b82">কোনো ছবি পাওয়া যায়নি।</p>';
  } catch (e) {
    output.innerHTML = `<p style="color:#f28b82">❌ Error: ${e.message}</p>`;
  }
}

// =============================================
// 6. VIDEO GENERATE (Veo 3 — async polling)
// =============================================
async function runVideoGen() {
  const prompt = document.getElementById('video-gen-prompt').value.trim();
  const duration = document.getElementById('video-duration').value;
  const ratio = document.getElementById('video-ratio').value;

  if (!prompt) { alert('ভিডিওর বিবরণ লিখুন।'); return; }
  const key = getKey();
  if (!key) return;

  setOutput('video-gen-output', '⏳ Veo 3 ভিডিও তৈরি করছে (এটি ২-৩ মিনিট সময় নিতে পারে)...', true);

  try {
    // Start video generation
    const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning?key=${key}`;
    const body = {
      instances: [{
        prompt,
        video: { durationSeconds: parseInt(duration), aspectRatio: ratio }
      }],
      parameters: { sampleCount: 1 }
    };

    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!startRes.ok) throw new Error((await startRes.json()).error?.message || 'API Error');
    const op = await startRes.json();
    const opName = op.name;

    // Poll for completion
    setOutput('video-gen-output', '⏳ ভিডিও render হচ্ছে... (polling)', true);

    let attempts = 0;
    const poll = async () => {
      const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${key}`;
      const pollRes = await fetch(pollUrl);
      const pollData = await pollRes.json();

      if (pollData.done) {
        const videoBytes = pollData.response?.predictions?.[0]?.bytesBase64Encoded;
        if (videoBytes) {
          const blob = new Blob([Uint8Array.from(atob(videoBytes), c => c.charCodeAt(0))], { type: 'video/mp4' });
          const videoUrl = URL.createObjectURL(blob);
          const output = document.getElementById('video-gen-output');
          output.innerHTML = `
            <video controls style="width:100%;border-radius:8px;margin-top:8px">
              <source src="${videoUrl}" type="video/mp4"/>
            </video>
            <a href="${videoUrl}" download="gemini-video.mp4" style="display:block;margin-top:8px;color:#8ab4f8">⬇️ ডাউনলোড করুন</a>
          `;
        } else {
          setOutput('video-gen-output', '❌ ' + JSON.stringify(pollData.error || 'Unknown error'));
        }
      } else if (attempts < 30) {
        attempts++;
        setTimeout(poll, 6000);
      } else {
        setOutput('video-gen-output', '❌ Timeout — ভিডিও generation সম্পন্ন হয়নি।');
      }
    };
    setTimeout(poll, 8000);

  } catch (e) {
    setOutput('video-gen-output', '❌ Error: ' + e.message);
  }
}

// =============================================
// 7. AI CHATBOT (multi-turn)
// =============================================
async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  const messagesEl = document.getElementById('chat-messages');

  // Add user bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = msg;
  messagesEl.appendChild(userBubble);
  input.value = '';

  // Add bot loading bubble
  const botBubble = document.createElement('div');
  botBubble.className = 'chat-bubble bot';
  botBubble.textContent = '⏳ চিন্তা করছি...';
  messagesEl.appendChild(botBubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Add to history
  chatHistory.push({ role: 'user', parts: [{ text: msg }] });

  try {
    const result = await callGemini('gemini-2.0-flash', chatHistory);
    chatHistory.push({ role: 'model', parts: [{ text: result }] });
    botBubble.textContent = result;
  } catch (e) {
    botBubble.textContent = '❌ Error: ' + e.message;
    chatHistory.pop();
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// =============================================
// 8. GOOGLE SEARCH GROUNDING
// =============================================
async function runGoogleSearch() {
  const prompt = document.getElementById('search-prompt').value.trim();
  if (!prompt) { alert('প্রশ্ন লিখুন।'); return; }
  const key = getKey();
  if (!key) return;

  setOutput('search-output', '🔍 Google Search করছি...', true);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'API Error');
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || 'কোনো ফলাফল পাওয়া যায়নি।';
    setOutput('search-output', text);
  } catch (e) {
    setOutput('search-output', '❌ Error: ' + e.message);
  }
}

// =============================================
// 9. TEXT TO SPEECH (Gemini TTS)
// =============================================
async function runTTS() {
  const text = document.getElementById('tts-text').value.trim();
  const voice = document.getElementById('tts-voice').value;

  if (!text) { alert('টেক্সট লিখুন।'); return; }
  const key = getKey();
  if (!key) return;

  setOutput('tts-output', '🔊 ভয়েস তৈরি হচ্ছে...', true);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`;
    const body = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error((await res.json()).error?.message || 'API Error');
    const data = await res.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (audioData) {
      const audioBlob = new Blob([Uint8Array.from(atob(audioData), c => c.charCodeAt(0))], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const output = document.getElementById('tts-output');
      output.innerHTML = `
        <audio controls style="width:100%">
          <source src="${audioUrl}" type="audio/wav"/>
        </audio>
        <a href="${audioUrl}" download="tts-output.wav" style="display:block;margin-top:8px;color:#8ab4f8">⬇️ ডাউনলোড করুন</a>
      `;
    } else {
      setOutput('tts-output', '❌ Audio data পাওয়া যায়নি।');
    }
  } catch (e) {
    setOutput('tts-output', '❌ Error: ' + e.message);
  }
}

// =============================================
// 10. AI MUSIC (Lyria — placeholder)
// =============================================
async function runMusicGen() {
  const prompt = document.getElementById('music-prompt').value.trim();
  const genre = document.getElementById('music-genre').value;
  const duration = document.getElementById('music-duration').value;

  if (!prompt) { alert('মিউজিকের বিবরণ লিখুন।'); return; }

  setOutput('music-output', '🎵 AI মিউজিক তৈরি হচ্ছে...\n\n⚠️ দ্রষ্টব্য: Lyria API এখনো private preview তে আছে। আপনার Google Cloud Lyria endpoint API Settings এ সেট করুন।');
}

// =============================================
// API KEY SETTINGS
// =============================================
function saveApiKeys() {
  const geminiKey = document.getElementById('gemini-key').value.trim();
  const firebaseKey = document.getElementById('firebase-key').value.trim();
  const lyriaEndpoint = document.getElementById('lyria-endpoint').value.trim();
  const veoProject = document.getElementById('veo-project').value.trim();

  if (geminiKey) localStorage.setItem('gemini_key', geminiKey);
  if (firebaseKey) localStorage.setItem('firebase_key', firebaseKey);
  if (lyriaEndpoint) localStorage.setItem('lyria_endpoint', lyriaEndpoint);
  if (veoProject) localStorage.setItem('veo_project', veoProject);

  config = { geminiKey, firebaseKey, lyriaEndpoint, veoProject };

  const msg = document.getElementById('api-save-msg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 3000);
}

// Load saved keys on page load
window.addEventListener('DOMContentLoaded', () => {
  const gk = localStorage.getItem('gemini_key');
  const fk = localStorage.getItem('firebase_key');
  const le = localStorage.getItem('lyria_endpoint');
  const vp = localStorage.getItem('veo_project');

  if (gk) document.getElementById('gemini-key').value = gk;
  if (fk) document.getElementById('firebase-key').value = fk;
  if (le) document.getElementById('lyria-endpoint').value = le;
  if (vp) document.getElementById('veo-project').value = vp;
});
