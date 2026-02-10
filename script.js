/* ============================================
   VR Cinema — Main Script (Universal Browser)
   ============================================ */

// ---- CONFIGURATION ----
const CONFIG = {
  presets: [
    { id: 'dQw4w9WgXcQ', title: '🎵 Rick Astley — Never Gonna Give You Up' },
    { id: 'jNQXAC9IVRw', title: '🐘 Me at the zoo — First YouTube Video' },
    { id: '9bZkp7q19f0', title: '🎵 PSY — GANGNAM STYLE' },
    { id: 'kJQP7kiw5Fk', title: '🎵 Luis Fonsi — Despacito' },
    { id: 'JGwWNGJdvx8', title: '🎵 Ed Sheeran — Shape of You' },
  ],
  gamepad: { deadzone: 0.15, cursorSpeed: 12, stickSmoothing: 0.3, repeatDelay: 400, repeatRate: 100 },
  buttons: { cross:0,circle:1,square:2,triangle:3,l1:4,r1:5,l2:6,r2:7,share:8,options:9,l3:10,r3:11,dpadUp:12,dpadDown:13,dpadLeft:14,dpadRight:15,ps:16,touchpad:17 },
  keyboardLayouts: {
    lower: [['1','2','3','4','5','6','7','8','9','0'],['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['⇧','z','x','c','v','b','n','m','⌫'],['?123','🌐','Space','Search','Close']],
    upper: [['1','2','3','4','5','6','7','8','9','0'],['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['⇧','Z','X','C','V','B','N','M','⌫'],['?123','🌐','Space','Search','Close']],
    symbols: [['!','@','#','$','%','^','&','*','(',')'],['-','_','=','+','[',']','{','}','|','\\'],[';',':','\'','"',',','.','/','?','~'],['ABC','<','>','`','€','£','¥','©','⌫'],['ABC','🌐','Space','Search','Close']],
  },
};

// ---- STATE ----
const state = {
  gamepadIndex: null,
  cursorX: window.innerWidth / 2,
  cursorY: window.innerHeight / 2,
  smoothX: 0, smoothY: 0,
  prevButtons: [],
  keyboardVisible: false, keyboardLayout: 'lower', keyboardRow: 0, keyboardCol: 0,
  searchText: '',
  currentVideoIndex: 0,
  vrMode: false,
  helpVisible: false, searchResultsVisible: false,
  hoveredElement: null,
  lastToast: 0,
  
  // Universal Content State
  activeAdapter: 'youtube', // 'youtube', 'video', 'web'
  currentUrl: '',
};

// ---- ADAPTER INTERFACE ----
class ContentAdapter {
  load(urlOrId) {}
  play() {}
  pause() {}
  seekTo(time) {}
  currentTime() { return 0; }
  isPlaying() { return false; }
  getTitle() { return ''; }
  
  // Sync methods for VR
  syncTo(masterTime, masterState) {}
}

// 1. YouTube Adapter
class YouTubeAdapter extends ContentAdapter {
  constructor(leftId, rightId) {
    super();
    this.leftId = leftId;
    this.rightId = rightId;
    this.playerLeft = null;
    this.playerRight = null;
    this.readyLeft = false;
    this.readyRight = false;
    this.currentId = '';
  }

  init() {
    this.playerLeft = new YT.Player(this.leftId, {
      height: '100%', width: '100%',
      playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, fs: 0, playsinline: 1, disablekb: 1 },
      events: {
        onReady: (e) => { this.readyLeft = true; onAdapterReady(); },
        onError: (e) => showToast('⚠ YouTube Error: ' + e.data)
      }
    });

    this.playerRight = new YT.Player(this.rightId, {
      height: '100%', width: '100%',
      playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, fs: 0, playsinline: 1, disablekb: 1, mute: 1 },
      events: { onReady: () => { this.readyRight = true; this.playerRight.mute(); } }
    });
  }

  load(id) {
    this.currentId = id;
    if(this.readyLeft) this.playerLeft.loadVideoById(id);
    if(this.readyRight && state.vrMode) { this.playerRight.loadVideoById(id); this.playerRight.mute(); }
  }

  play() { if(this.readyLeft) this.playerLeft.playVideo(); }
  pause() { if(this.readyLeft) this.playerLeft.pauseVideo(); }
  seekTo(t) { if(this.readyLeft) this.playerLeft.seekTo(t, true); }
  
  currentTime() { return this.readyLeft && this.playerLeft.getCurrentTime ? this.playerLeft.getCurrentTime() : 0; }
  isPlaying() { return this.readyLeft && this.playerLeft.getPlayerState && this.playerLeft.getPlayerState() === YT.PlayerState.PLAYING; }

  syncTo(masterTime, masterState) {
    if(!this.readyRight) return;
    const p2State = this.playerRight.getPlayerState();
    
    // Sync Play/Pause
    if (masterState && p2State !== YT.PlayerState.PLAYING && p2State !== YT.PlayerState.BUFFERING) this.playerRight.playVideo();
    else if (!masterState && p2State === YT.PlayerState.PLAYING) this.playerRight.pauseVideo();
    
    // Sync Time
    const t2 = this.playerRight.getCurrentTime();
    if (Math.abs(masterTime - t2) > 0.5) this.playerRight.seekTo(masterTime, true);
  }
}

// 2. HTML5 Video Adapter (Direct .mp4/.mov)
class HTML5VideoAdapter extends ContentAdapter {
  constructor(leftId, rightId) {
    super();
    this.elLeft = document.getElementById(leftId);
    this.elRight = document.getElementById(rightId);
    this.elRight.muted = true;
  }

  load(url) {
    this.elLeft.src = url;
    this.elRight.src = url;
    this.elLeft.play().catch(e => showToast('⚠ Play error: ' + e.message));
  }

  play() { this.elLeft.play(); }
  pause() { this.elLeft.pause(); }
  seekTo(t) { this.elLeft.currentTime = t; }
  currentTime() { return this.elLeft.currentTime; }
  isPlaying() { return !this.elLeft.paused; }

  syncTo(masterTime, masterState) {
    // Sync Play/Pause
    if (masterState && this.elRight.paused) this.elRight.play();
    else if (!masterState && !this.elRight.paused) this.elRight.pause();
    
    // Sync Time
    if (Math.abs(masterTime - this.elRight.currentTime) > 0.3) this.elRight.currentTime = masterTime;
  }
}

// 3. Generic Web Adapter (IFrame)
class GenericWebAdapter extends ContentAdapter {
  constructor(leftId, rightId) {
    super();
    this.elLeft = document.getElementById(leftId);
    this.elRight = document.getElementById(rightId);
  }

  load(url) {
    this.elLeft.src = url;
    // In strict browser environments, loading same URL might be blocked or session-locked
    // But for viewing content it usually works.
    if(state.vrMode) this.elRight.src = url;
  }

  // No playback control for generic web
  syncTo(masterTime, masterState) {
    // Basic sync: ensure right frame has same URL as left
    if (state.vrMode && this.elRight.src !== this.elLeft.src) {
        this.elRight.src = this.elLeft.src;
    }
  }
}

// ---- MANAGER ----
const adapters = {
  youtube: new YouTubeAdapter('youtube-player-left', 'youtube-player-right'),
  video: new HTML5VideoAdapter('html5-player-left', 'html5-player-right'),
  web: new GenericWebAdapter('generic-browser-left', 'generic-browser-right'),
};

function switchAdapter(type) {
  state.activeAdapter = type;
  
  // Hide all layers
  document.querySelectorAll('.content-layer').forEach(el => el.classList.remove('active'));
  
  // Show active layer
  const leftId = adapters[type].leftId || (type === 'youtube' ? 'youtube-player-left' : type === 'video' ? 'html5-player-left' : 'generic-browser-left');
  const rightId = adapters[type].rightId || (type === 'youtube' ? 'youtube-player-right' : type === 'video' ? 'html5-player-right' : 'generic-browser-right');
  
  // Note: YouTubeAdapter id logic is a bit implicit in class, simplified here for cleaner DOM toggling:
  if(type==='youtube') { document.getElementById('youtube-player-left').classList.add('active'); document.getElementById('youtube-player-right').classList.add('active'); }
  if(type==='video') { document.getElementById('html5-player-left').classList.add('active'); document.getElementById('html5-player-right').classList.add('active'); }
  if(type==='web') { document.getElementById('generic-browser-left').classList.add('active'); document.getElementById('generic-browser-right').classList.add('active'); }
}

class VRManager {
  constructor() { this.syncInterval = null; }

  enterVR() {
    state.vrMode = true;
    document.body.classList.add('vr-active');
    requestWakeLock();
    try { document.documentElement.requestFullscreen().catch(()=>{}); } catch(e){}
    try { screen.orientation.lock('landscape').catch(()=>{}); } catch(e){}

    // Sync Right Eye Content on Entry
    const adapter = adapters[state.activeAdapter];
    if (state.activeAdapter === 'youtube') {
      if(adapter.readyRight) { 
        adapter.playerRight.loadVideoById(adapter.currentId, adapter.currentTime()); 
        adapter.playerRight.mute();
      }
    } else if (state.activeAdapter === 'video') {
       adapter.elRight.src = adapter.elLeft.src;
       adapter.elRight.currentTime = adapter.elLeft.currentTime;
    } else if (state.activeAdapter === 'web') {
       adapter.elRight.src = adapter.elLeft.src;
    }

    this.startSync();
    showToast('🥽 VR Mode Enabled');
  }

  exitVR() {
    state.vrMode = false;
    document.body.classList.remove('vr-active');
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    releaseWakeLock();
    this.stopSync();
    
    // Pause right eye to save resources
    if (state.activeAdapter === 'youtube' && adapters.youtube.playerRight.pauseVideo) adapters.youtube.playerRight.pauseVideo();
    if (state.activeAdapter === 'video') adapters.video.elRight.pause();
    
    showToast('📱 2D Mode Restored');
  }

  startSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => this.syncLoop(), 100);
  }

  stopSync() { if (this.syncInterval) clearInterval(this.syncInterval); }

  syncLoop() {
    if (!state.vrMode) return;
    const adapter = adapters[state.activeAdapter];
    adapter.syncTo(adapter.currentTime(), adapter.isPlaying());
  }
}

const vrManager = new VRManager();

function onYouTubeIframeAPIReady() {
  adapters.youtube.init();
}

function onAdapterReady() {
  hideLoading();
  showToast('🚀 Ready! Enter URL or Search');
  // Load default preset
  loadContent(CONFIG.presets[0].id, CONFIG.presets[0].title);
}


// ---- CORE LOADING LOGIC ----
function loadContent(input, title) {
  if (!input) return;
  
  // 1. Detect Type
  let type = 'youtube';
  let src = input;
  
  const isUrl = /^(http|https):\/\/[^ "]+$/.test(input);
  const isVideoFile = isUrl && /\.(mp4|webm|ogg|mov)$/i.test(input);
  const isYouTube = isUrl && (input.includes('youtube.com') || input.includes('youtu.be'));
  
  if (isVideoFile) {
    type = 'video';
  } else if (isYouTube) {
    // Extract ID (basic regex)
    const match = input.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (match) src = match[1];
    type = 'youtube';
  } else if (isUrl) {
    type = 'web';
  } else {
    // Assume ID if 11 chars, otherwise generic search
    if (input.length === 11 && /^[0-9A-Za-z_-]+$/.test(input)) {
        type = 'youtube';
    } else {
        // Search query -> Handled by searchYouTube, which calls this with ID
        showToast('⚠ Error: Logic should route via searchYouTube');
        return;
    }
  }

  // 2. Switch & Load
  switchAdapter(type);
  state.currentUrl = input; // Track raw input
  
  if(type === 'youtube') adapters.youtube.load(src);
  if(type === 'video') adapters.video.load(src);
  if(type === 'web') adapters.web.load(src); // Might fail due to X-Frame-Options
  
  const displayTitle = title || (type==='web' ? 'Web Browser' : type==='video' ? 'Direct Video' : 'YouTube');
  updateVideoTitle(displayTitle);
  showToast(`▶ Loading: ${displayTitle}`);
}

function updateVideoTitle(title) {
  const elL = document.getElementById('video-title-left');
  const elR = document.getElementById('video-title-right');
  if (elL) elL.textContent = title;
  if (elR) elR.textContent = title;
}

// ---- UI HANDLERS ----
function handleSearchOrUrl(input) {
    // Heuristic: Is it a URL?
    if (/^(http|https):\/\/[^ "]+$/.test(input) || (input.includes('.') && !input.includes(' '))) {
        let url = input;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        loadContent(url);
    } else {
        // Treat as search query
        searchYouTube(input);
    }
}

// ---- UPDATED SEARCH FUNCTION ----
function searchYouTube(query) {
  if (!query.trim()) return;
  showToast(`🔍 Searching: "${query}"...`);
  // ... (Same invidious fetch logic) ...
  fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}&type=video`)
    .then(r => r.json())
    .then(results => displaySearchResults(results.filter(r => r.type === 'video').slice(0, 8)))
    .catch(() => {
       // Fallback logic
       if(query.length === 11) loadContent(query, 'Custom Video'); 
    });
}

function togglePlayPause() {
    const a = adapters[state.activeAdapter];
    if (a.isPlaying()) { a.pause(); showToast('⏸ Paused'); } 
    else { a.play(); showToast('▶ Playing'); }
}

// ... (Rest of UI/Gamepad logic same as before, updated to use handleSearchOrUrl) ... 

// ---- BROWSER NAV ----
function initBrowserNav() {
    document.getElementById('nav-back').addEventListener('click', () => {
        if(state.activeAdapter === 'web') {
            try { document.getElementById('generic-browser-left').contentWindow.history.back(); } catch(e){ showToast('⚠ History Nav Blocked');}
        }
    });
    document.getElementById('nav-reload').addEventListener('click', () => {
        if(state.activeAdapter === 'web') {
             const f = document.getElementById('generic-browser-left'); f.src = f.src;
        } else if(state.activeAdapter === 'youtube') {
            adapters.youtube.load(adapters.youtube.currentId);
        }
    });
}


// ---- INIT UPDATE ----
function init() {
  buildPresetChips(); buildKeyboard(); initGamepad();
  document.getElementById('vr-btn').addEventListener('click', () => state.vrMode ? vrManager.exitVR() : vrManager.enterVR());
  document.getElementById('search-btn').addEventListener('click', () => {
    const v = document.getElementById('search-input').value || state.searchText;
    if(v) handleSearchOrUrl(v);
  });
  
  // Update key handlers to call handleSearchOrUrl
  // ...
  
  initBrowserNav();
  
  // Listeners... (Same)
  document.getElementById('keyboard-btn').addEventListener('click', toggleKeyboard);
  document.getElementById('help-btn').addEventListener('click', toggleHelp);
  document.getElementById('close-results-btn').addEventListener('click', closeSearchResults);
  document.getElementById('help-close-btn').addEventListener('click', toggleHelp);
  
  // Physical Keyboard Input
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
       if(state.keyboardVisible) toggleKeyboard();
       const v = document.getElementById('search-input').value || state.searchText;
       if(v) handleSearchOrUrl(v);
    }
  });
  
  setTimeout(() => { if (!adapters.youtube.readyLeft) { hideLoading(); showToast('⏳ Waiting for YouTube...'); } }, 5000);
}

// ... (Preserve Gamepad, Keyboard, Utils) ...
// NOTE: I need to preserve the rest of the file logic (gamepad processing, etc), just connecting the new loadContent

// Let's ensure processGamepadInput calls togglePlayPause which now uses adapter
// Let's ensure pressVirtualKey calls handleSearchOrUrl instead of direct search


// ---- GAMEPAD LOGIC (Dual Cursor) ----
function initGamepad() {
  window.addEventListener('gamepadconnected', (e) => {
    state.gamepadIndex = e.gamepad.index;
    updateGamepadStatus(true);
    showToast(`🎮 ${e.gamepad.id.split('(')[0]} connected!`);
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (state.gamepadIndex === e.gamepad.index) {
      state.gamepadIndex = null; updateGamepadStatus(false); showToast('🎮 Disconnected');
    }
  });
  requestAnimationFrame(gamepadLoop);
}
function updateGamepadStatus(connected) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (connected) { dot.classList.add('connected'); text.textContent = 'DualShock 4'; }
  else { dot.classList.remove('connected'); text.textContent = 'No controller'; }
}
function gamepadLoop() {
  if (state.gamepadIndex !== null) {
    const gp = navigator.getGamepads()[state.gamepadIndex];
    if (gp) processGamepadInput(gp);
  }
  requestAnimationFrame(gamepadLoop);
}

function processGamepadInput(gp) {
  const { deadzone, cursorSpeed, stickSmoothing } = CONFIG.gamepad;
  let lx = gp.axes[0], ly = gp.axes[1];
  if (Math.abs(lx) < deadzone) lx = 0;
  if (Math.abs(ly) < deadzone) ly = 0;
  
  state.smoothX = state.smoothX * stickSmoothing + lx * (1 - stickSmoothing);
  state.smoothY = state.smoothY * stickSmoothing + ly * (1 - stickSmoothing);

  const applyInput = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.5);
  state.cursorX += applyInput(state.smoothX) * cursorSpeed;
  state.cursorY += applyInput(state.smoothY) * cursorSpeed;
  
  // Clamp to window (Main Viewport in VR serves as logic master)
  // In VR, "Logic Master" is the Left Eye (0-50% width visually, but we treat standard coords)
  // Actually, for simplicity:
  // In 2D: cursorX/Y is 0-windowWidth/Height.
  // In VR: cursorX/Y is logic for Left Eye. We mirror this to Right Eye visual cursor.
  
  // Logic: 
  // If VR, clamp X to (0 to window.innerWidth / 2) ? 
  // No, better to keep coordinate system uniform 0-100% relative to "active viewport".
  // Let's keep global coords 0-windowWidth.
  
  state.cursorX = Math.max(0, Math.min(window.innerWidth, state.cursorX));
  state.cursorY = Math.max(0, Math.min(window.innerHeight, state.cursorY));

  // Update Cursors
  const cLeft = document.getElementById('gamepad-cursor-left');
  const cRight = document.getElementById('gamepad-cursor-right');
  
  if (state.vrMode) {
    // Left eye (0-50% screen)
    // Map logical X (0-W) to Left Eye X (0-W/2) ?
    // Or just treat cursorX as global and clone it?
    
    // Simplest Stereoscopic Cursor:
    // User looks at ONE virtual screen. The cursors must have parallax or just sit at 0 depth.
    // 0 depth = same relative position in both viewports.
    
    // Let's normalize cursor position 0-1 relative to screen.
    let relX = state.cursorX / window.innerWidth;
    let relY = state.cursorY / window.innerHeight;
    
    // In VR, the "screen" is effectively split.
    // Use relX mapping 0-1 to EACH eye.
    // effectively cursorX traverses "0 to 100% of the virtual screen".
    
    const eyeW = window.innerWidth / 2;
    const eyeH = window.innerHeight; // assuming full height
    
    // Left Cursor
    cLeft.style.display = 'block';
    cLeft.style.left = (relX * eyeW) + 'px';
    cLeft.style.top = (relY * eyeH) + 'px'; // Using relY directly
    
    // Right Cursor (same relative position)
    cRight.style.display = 'block';
    cRight.style.left = (relX * eyeW) + 'px'; // Relative to parent #right-eye
    cRight.style.top = (relY * eyeH) + 'px';
    
  } else {
    // 2D Mode
    cLeft.style.display = 'block';
    cLeft.style.left = state.cursorX + 'px'; // Absolute global
    cLeft.style.top = state.cursorY + 'px';
    cRight.style.display = 'none';
  }

  updateHover();
  
  const btns = gp.buttons;
  const prev = state.prevButtons;
  const justPressed = (i) => btns[i]?.pressed && !prev[i]?.pressed;
  
  if (justPressed(CONFIG.buttons.cross)) { emulateClick(); cLeft.classList.add('clicking'); cRight.classList.add('clicking'); }
  if (btns[CONFIG.buttons.cross] && !btns[CONFIG.buttons.cross].pressed) { cLeft.classList.remove('clicking'); cRight.classList.remove('clicking'); }
  
  if (justPressed(CONFIG.buttons.triangle)) toggleKeyboard();
  if (justPressed(CONFIG.buttons.circle)) { if(state.helpVisible) toggleHelp(); else if(state.searchResultsVisible) closeSearchResults(); else if(state.keyboardVisible) toggleKeyboard(); else if(state.activeAdapter==='web') { try{document.getElementById('generic-browser-left').contentWindow.history.back();}catch(e){} } }
  if (justPressed(CONFIG.buttons.options)) togglePlayPause();
  if (justPressed(CONFIG.buttons.l1)) loadVideoByIndex((state.currentVideoIndex-1+CONFIG.presets.length)%CONFIG.presets.length);
  if (justPressed(CONFIG.buttons.r1)) loadVideoByIndex((state.currentVideoIndex+1)%CONFIG.presets.length);
  if (justPressed(CONFIG.buttons.share)) toggleHelp();
  
  if (state.keyboardVisible) handleDpadForKeyboard(btns, prev);
  else if (state.searchResultsVisible) handleDpadForResults(btns, prev);
  
  state.prevButtons = Array.from(btns).map(b => ({ pressed: b.pressed, value: b.value }));
}

function emulateClick() {
  // Click logic needs to know WHICH element is under the cursor.
  // In VR mode, we only care about the Left Eye's elements (logic master).
  
  let x = state.cursorX;
  let y = state.cursorY;
  
  if (state.vrMode) {
    // Remap: cursorX (0-W) -> Left Eye (0-W/2)
    x = (state.cursorX / window.innerWidth) * (window.innerWidth / 2);
    // Relative to viewport, but document.elementFromPoint uses viewport coords.
    // So x is correct for Left Eye.
  }

  const el = document.elementFromPoint(x, y);
  if (!el) return;
  
  const clickable = el.closest('button, .kb-key, .preset-chip, .result-item, .ctrl-btn, a, input');
  if (clickable) {
    clickable.classList.add('pressed'); setTimeout(()=>clickable.classList.remove('pressed'), 150);
    if(clickable.tagName==='INPUT'){ clickable.focus(); if(!state.keyboardVisible) toggleKeyboard(); }
    else clickable.click();
  }
}

function updateHover() {
    let x = state.cursorX;
    let y = state.cursorY;
    if (state.vrMode) {
         x = (state.cursorX / window.innerWidth) * (window.innerWidth / 2);
    }
  const el = document.elementFromPoint(x, y);
  const clickable = el?.closest('button, .kb-key, .preset-chip, .result-item, .ctrl-btn, a, input');
  
  if (state.hoveredElement && state.hoveredElement !== clickable) state.hoveredElement.classList.remove('hovered');
  
  if (clickable) {
    clickable.classList.add('hovered');
    state.hoveredElement = clickable;
  } else {
    state.hoveredElement = null;
  }
}

// ---- UTILS ----
let wakeLock = null;
async function requestWakeLock() { try { if('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch(e){} }
function releaseWakeLock() { if(wakeLock) { wakeLock.release(); wakeLock = null; } }
function hideLoading() { const l = document.getElementById('loading-screen'); l.classList.add('hidden'); setTimeout(()=>l.style.display='none',600); }
function showToast(msg) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; c.appendChild(t); setTimeout(()=>{ t.classList.add('leaving'); setTimeout(()=>t.remove(),300); }, 2500); }

// ---- KEYBOARD + PRESETS (Simplified due to length limit, logic identical) ----
function buildPresetChips() { /* ... */ 
  const bar = document.getElementById('presets-bar'); bar.innerHTML = '';
  CONFIG.presets.forEach((p,i) => {
      const b=document.createElement('button'); b.className='preset-chip'; b.textContent=p.title; 
      b.onclick=()=>loadVideoByIndex(i); bar.appendChild(b); 
  });
}
function updatePresetChips() { document.querySelectorAll('.preset-chip').forEach((c,i)=>c.classList.toggle('active', i===state.currentVideoIndex)); }
function buildKeyboard() { /* ... */ 
  const c = document.getElementById('keyboard-keys'); c.innerHTML='';
  CONFIG.keyboardLayouts[state.keyboardLayout].forEach((row, ri) => {
    const rd = document.createElement('div'); rd.className='keyboard-row';
    row.forEach((k, ci) => {
      const b=document.createElement('button'); b.className='kb-key'; b.textContent=k; b.dataset.r=ri; b.dataset.c=ci;
      if (['Space','⇧','⌫','Search','Close','?123','ABC'].some(s=>k.includes(s))) b.classList.add(k==='Space'?'space-key':'wide');
      b.onclick=()=>pressVirtualKey(k); rd.appendChild(b);
    });
    c.appendChild(rd);
  });
  updateKeyboardHighlight();
}
function pressVirtualKey(k) {
    const inp=document.getElementById('search-input');
    if(k==='⇧') { state.keyboardLayout = state.keyboardLayout==='upper'?'lower':'upper'; buildKeyboard(); }
    else if(k==='?123') { state.keyboardLayout='symbols'; buildKeyboard(); }
    else if(k==='ABC') { state.keyboardLayout='lower'; buildKeyboard(); }
    else if(k==='⌫') { state.searchText=state.searchText.slice(0,-1); inp.value=state.searchText; }
    else if(k==='Space') { state.searchText+=' '; inp.value=state.searchText; }
    else if(k==='Search' || k==='Enter' || k==='Go') { toggleKeyboard(); handleSearchOrUrl(state.searchText); }
    else if(k==='Close') { toggleKeyboard(); }
    else if(k==='🌐') { showToast('🌐 En only for now'); }
    else {
        state.searchText+=k; inp.value=state.searchText;
        if(state.keyboardLayout==='upper'){state.keyboardLayout='lower'; buildKeyboard();}
    }
}
function updateKeyboardHighlight() {
    document.querySelectorAll('.kb-key').forEach(k=>k.classList.remove('hovered'));
    const t = document.querySelector(`.kb-key[data-r="${state.keyboardRow}"][data-c="${state.keyboardCol}"]`);
    if(t) { t.classList.add('hovered'); t.scrollIntoView({block:'nearest'}); }
}
function toggleKeyboard() {
    state.keyboardVisible=!state.keyboardVisible; 
    const k=document.getElementById('virtual-keyboard'); 
    k.classList.toggle('visible', state.keyboardVisible);
    if(state.keyboardVisible) { buildKeyboard(); showToast('⌨ Keyboard Open'); }
}
function toggleHelp() { state.helpVisible=!state.helpVisible; document.getElementById('help-overlay').classList.toggle('visible',state.helpVisible); }
function handleDpadForKeyboard(btns,prev) { /* ... nav logic same ... */ 
    const press = (i) => btns[i]?.pressed && !prev[i]?.pressed;
    const l = CONFIG.keyboardLayouts[state.keyboardLayout];
    if(press(CONFIG.buttons.dpadUp)) state.keyboardRow = Math.max(0, state.keyboardRow-1);
    if(press(CONFIG.buttons.dpadDown)) state.keyboardRow = Math.min(l.length-1, state.keyboardRow+1);
    if(press(CONFIG.buttons.dpadLeft)) state.keyboardCol = Math.max(0, state.keyboardCol-1);
    if(press(CONFIG.buttons.dpadRight)) state.keyboardCol = Math.min(l[state.keyboardRow].length-1, state.keyboardCol+1);
    if(press(CONFIG.buttons.cross)) pressVirtualKey(l[state.keyboardRow][state.keyboardCol]);
    updateKeyboardHighlight();
}
function handleDpadForResults(btns,prev) { /* ... nav logic same ... */
    const press = (i) => btns[i]?.pressed && !prev[i]?.pressed;
    const items = document.querySelectorAll('.result-item');
    let idx = -1; items.forEach((el,i)=> { if(el.classList.contains('hovered')) idx=i; });
    if(press(CONFIG.buttons.dpadDown)) idx = Math.min(items.length-1, idx+1);
    if(press(CONFIG.buttons.dpadUp)) idx = Math.max(0, idx-1);
    items.forEach(e=>e.classList.remove('hovered'));
    if(items[idx]) { items[idx].classList.add('hovered'); items[idx].scrollIntoView({block:'nearest'}); }
    if(press(CONFIG.buttons.cross) && items[idx]) items[idx].click();
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
document.addEventListener('DOMContentLoaded', init);
