// Auto-configured by Ai Ridoy Agent
// Keys are loaded from browser localStorage — set them in API Settings
(function() {
  // Pre-load Gemini key if not already set
  var geminiKey = window.__GEMINI_KEY__ || '';
  var groqKey = window.__GROQ_KEY__ || '';
  if (geminiKey && !localStorage.getItem('gemini_key')) {
    localStorage.setItem('gemini_key', geminiKey);
  }
  if (groqKey) {
    localStorage.setItem('groq_key', groqKey);
    console.log('✅ Groq key loaded!');
  }
})();
