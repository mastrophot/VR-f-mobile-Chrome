/* ============================================
   VR Cinema — Main Script (Dual-Player Sync)
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
  gamepad: {
    deadzone: 0.15,
    cursorSpeed: 12, // Faster for split screen
    stickSmoothing: 0.3,
    repeatDelay: 400,
    repeatRate: 100,
  },
  buttons: {
    cross: 0,circle: 1,square: 2,triangle: 3,l1: 4,r1: 5,l2: 6,r2: 7,share: 8,options: 9,l3: 10,r3: 11,dpadUp: 12,dpadDown: 13,dpadLeft: 14,dpadRight: 15,ps: 16,touchpad: 17,
  },
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
  smoothX: 0,
  smoothY: 0,
  prevButtons: [],
  keyboardVisible: false,
  keyboardLayout: 'lower',
  keyboardRow: 0,
  keyboardCol: 0,
  searchText: '',
  currentVideoIndex: 0,
  playerReadyLeft: false,
  playerReadyRight: false,
  vrMode: false,
  helpVisible: false,
  searchResultsVisible: false,
  hoveredElement: null,
  dpadRepeatTimers: {},
  lastToast: 0,
};

// ---- DUAL PLAYER SYSTEM ----
let playerLeft = null;
let playerRight = null;
let vrManager = null;

class VRManager {
  constructor() {
    this.syncInterval = null;
    this.syncRate = 100; // 10Hz sync check
    this.tolerance = 0.5; // Seconds tolerance
  }

  enterVR() {
    state.vrMode = true;
    document.body.classList.add('vr-active');
    
    // Request Wake Lock & Fullscreen
    requestWakeLock();
    try { document.documentElement.requestFullscreen().catch(()=>{}); } catch(e){}
    try { screen.orientation.lock('landscape').catch(()=>{}); } catch(e){}

    // Setup Right Video
    if (playerRight && state.playerReadyRight) {
      const currentVideoId = CONFIG.presets[state.currentVideoIndex].id; // Or currently playing ID
      // If we differ from preset, use playerLeft's video data if possible (requires extra logic, stick to preset for now or sync ID)
      
      // Sync State
      const currentTime = playerLeft.getCurrentTime();
      const playerState = playerLeft.getPlayerState();
      
      // Load and Sync
      // Note: playerLeft might be playing a custom video, we should track current ID
      // For now, re-load current preset or tracked ID
      
      playerRight.loadVideoById(getCurrentVideoId(), currentTime);
      playerRight.mute(); // ALways mute right eye
      
      if (playerState !== YT.PlayerState.PLAYING) {
        playerRight.pauseVideo();
      }
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
    
    if (playerRight) {
      playerRight.pauseVideo();
    }
    showToast('📱 2D Mode Restored');
  }

  startSync() {
    this.stopSync();
    this.syncInterval = setInterval(() => this.syncLoop(), this.syncRate);
  }

  stopSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = null;
  }

  syncLoop() {
    if (!state.vrMode || !playerLeft || !playerRight) return;
    
    // 1. Sync State (Play/Pause)
    const p1State = playerLeft.getPlayerState();
    const p2State = playerRight.getPlayerState();
    
    if (p1State === YT.PlayerState.PLAYING && p2State !== YT.PlayerState.PLAYING && p2State !== YT.PlayerState.BUFFERING) {
      playerRight.playVideo();
    } else if (p1State !== YT.PlayerState.PLAYING && p2State === YT.PlayerState.PLAYING) {
      playerRight.pauseVideo();
    }

    // 2. Sync Time
    const t1 = playerLeft.getCurrentTime();
    const t2 = playerRight.getCurrentTime();
    
    if (Math.abs(t1 - t2) > this.tolerance) {
      // Seek Right to Left
      playerRight.seekTo(t1, true);
    }
  }
}

// Track current video ID separately from index
let currentVideoIdGlobal = CONFIG.presets[0].id;
function getCurrentVideoId() { return currentVideoIdGlobal; }

function onYouTubeIframeAPIReady() {
  // Init Left (Main)
  playerLeft = new YT.Player('youtube-player-left', {
    height: '100%', width: '100%', videoId: CONFIG.presets[0].id,
    playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, fs: 0, playsinline: 1, disablekb: 1 },
    events: {
      onReady: (e) => { state.playerReadyLeft = true; onPlayerReady(e); },
      onStateChange: onPlayerStateChange
    },
  });

  // Init Right (Synced)
  playerRight = new YT.Player('youtube-player-right', {
    height: '100%', width: '100%', videoId: CONFIG.presets[0].id,
    playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, fs: 0, playsinline: 1, disablekb: 1, mute: 1 },
    events: {
      onReady: () => { state.playerReadyRight = true; playerRight.mute(); }
    },
  });
  
  vrManager = new VRManager();
}

function onPlayerReady(event) {
  hideLoading();
  showToast('🎬 Ready! Connect DualShock 4');
  updateVideoTitle(CONFIG.presets[0].title);
}

function onPlayerStateChange(event) {
  // Sync logic handled by interval, but we can trigger immediate syncs here if needed
}

function loadVideo(videoId, title) {
  currentVideoIdGlobal = videoId;
  
  if (playerLeft && state.playerReadyLeft) {
    playerLeft.loadVideoById(videoId);
    updateVideoTitle(title || 'Loading...');
  }
  
  if (playerRight && state.playerReadyRight && state.vrMode) {
    playerRight.loadVideoById(videoId);
    playerRight.mute();
  }
  
  showToast(`▶ Playing: ${title || videoId}`);
}

function loadVideoByIndex(index) {
  if (index >= 0 && index < CONFIG.presets.length) {
    state.currentVideoIndex = index;
    const video = CONFIG.presets[index];
    loadVideo(video.id, video.title);
    updatePresetChips();
  }
}

function togglePlayPause() {
  if (!playerLeft || !state.playerReadyLeft) return;
  const s = playerLeft.getPlayerState();
  if (s === YT.PlayerState.PLAYING) {
    playerLeft.pauseVideo();
    showToast('⏸ Paused');
  } else {
    playerLeft.playVideo();
    showToast('▶ Playing');
  }
}

function updateVideoTitle(title) {
  // Update both titles
  const elL = document.getElementById('video-title-left');
  const elR = document.getElementById('video-title-right');
  if (elL) elL.textContent = title;
  if (elR) elR.textContent = title;
}

// ---- SEARCH & UI Logic (Keeping mostly same) ----
function searchYouTube(query) { /* ... same implementation ... */ 
  if (!query.trim()) return;
  showToast(`🔍 Searching: "${query}"...`);
  // Using simplified mock/invidious fetch (same as before)
  fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}&type=video`)
    .then(r => r.json())
    .then(results => displaySearchResults(results.filter(r => r.type === 'video').slice(0, 8)))
    .catch(() => {
      // Fallback
      if (query.length === 11) loadVideo(query, 'Custom Video');
      else showToast('⚠ Search unavailable');
    });
}
function displaySearchResults(results) { /* ... same ... */ 
  const container = document.getElementById('search-results');
  const list = document.getElementById('results-list');
  list.innerHTML = '';
  if (results.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">No results</p>';
    container.classList.add('visible'); state.searchResultsVisible = true; return;
  }
  results.forEach((video, idx) => {
    const item = document.createElement('div');
    item.className = 'result-item'; item.dataset.index = idx;
    item.innerHTML = `<img class="result-thumb" src="https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg"><div class="result-info"><h4>${escapeHtml(video.title)}</h4><p>${formatDuration(video.lengthSeconds)}</p></div>`;
    item.addEventListener('click', () => { loadVideo(video.videoId, video.title); closeSearchResults(); });
    list.appendChild(item);
  });
  container.classList.add('visible'); state.searchResultsVisible = true;
}
function closeSearchResults() { document.getElementById('search-results').classList.remove('visible'); state.searchResultsVisible = false; }
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
function formatDuration(s) { if(!s) return ''; const m = Math.floor(s/60); const sec = s%60; return `${m}:${sec.toString().padStart(2,'0')}`; }

// ---- LISTENERS ----
function init() {
  buildPresetChips();
  buildKeyboard();
  initGamepad();
  
  document.getElementById('vr-btn').addEventListener('click', () => {
    if (state.vrMode) vrManager.exitVR();
    else vrManager.enterVR();
  });

  // Search/Input listeners
  document.getElementById('search-btn').addEventListener('click', () => {
    const v = document.getElementById('search-input').value || state.searchText;
    if(v) searchYouTube(v);
  });
  document.getElementById('keyboard-btn').addEventListener('click', toggleKeyboard);
  document.getElementById('help-btn').addEventListener('click', toggleHelp);
  document.getElementById('close-results-btn').addEventListener('click', closeSearchResults);
  document.getElementById('help-close-btn').addEventListener('click', toggleHelp);

  // Fallback loading check
  setTimeout(() => { if (!state.playerReadyLeft) { hideLoading(); showToast('⏳ Waiting for YouTube...'); } }, 5000);
}

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
  if (justPressed(CONFIG.buttons.circle)) { if(state.helpVisible) toggleHelp(); else if(state.searchResultsVisible) closeSearchResults(); else if(state.keyboardVisible) toggleKeyboard(); }
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
    else if(k==='Search') { searchYouTube(state.searchText); toggleKeyboard(); }
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
