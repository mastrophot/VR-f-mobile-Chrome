/* ============================================
   VR Cinema — Main Script
   Gamepad API + YouTube Player + Virtual Keyboard
   ============================================ */

// ---- CONFIGURATION ----
const CONFIG = {
  // Preset YouTube videos
  presets: [
    { id: "dQw4w9WgXcQ", title: "🎵 Rick Astley — Never Gonna Give You Up" },
    { id: "jNQXAC9IVRw", title: "🐘 Me at the zoo — First YouTube Video" },
    { id: "9bZkp7q19f0", title: "🎶 PSY — GANGNAM STYLE" },
    { id: "kJQP7kiw5Fk", title: "🎵 Luis Fonsi — Despacito" },
    { id: "JGwWNGJdvx8", title: "🎵 Ed Sheeran — Shape of You" },
  ],
  // Gamepad settings
  gamepad: {
    deadzone: 0.15,
    cursorSpeed: 8,
    stickSmoothing: 0.3,
    repeatDelay: 400, // ms before key repeat starts
    repeatRate: 100, // ms between repeated keys
  },
  // DualShock 4 button mapping (standard layout)
  buttons: {
    cross: 0, // X — click
    circle: 1, // ○ — back / close
    square: 2, // □ — fullscreen
    triangle: 3, // △ — toggle keyboard
    l1: 4, // L1 — prev video
    r1: 5, // R1 — next video
    l2: 6, // L2
    r2: 7, // R2
    share: 8, // Share
    options: 9, // Options — play/pause
    l3: 10, // L3 (stick press)
    r3: 11, // R3 (stick press)
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15,
    ps: 16, // PS button
    touchpad: 17, // Touchpad
  },
  // Virtual keyboard layouts
  keyboardLayouts: {
    lower: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
      ["?123", "🌐", "Space", "Search", "Close"],
    ],
    upper: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["⇧", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
      ["?123", "🌐", "Space", "Search", "Close"],
    ],
    symbols: [
      ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
      ["-", "_", "=", "+", "[", "]", "{", "}", "|", "\\"],
      [";", ":", "'", '"', ",", ".", "/", "?", "~"],
      ["ABC", "<", ">", "`", "€", "£", "¥", "©", "⌫"],
      ["ABC", "🌐", "Space", "Search", "Close"],
    ],
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
  keyboardLayout: "lower",
  keyboardRow: 0,
  keyboardCol: 0,
  searchText: "",
  currentVideoIndex: 0,
  playerReady: false,
  vrMode: false,
  helpVisible: false,
  searchResultsVisible: false,
  hoveredElement: null,
  dpadRepeatTimers: {},
  lastToast: 0,
};

// ---- YouTube Player ----
let player = null;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    videoId: CONFIG.presets[0].id,
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      fs: 1,
      playsinline: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  state.playerReady = true;
  hideLoading();
  showToast("🎬 Player ready! Connect DualShock 4 via Bluetooth");
  updateVideoTitle(CONFIG.presets[0].title);
}

function onPlayerStateChange(event) {
  // Could track play/pause state here
}

function loadVideo(videoId, title) {
  if (player && state.playerReady) {
    player.loadVideoById(videoId);
    updateVideoTitle(title || "Loading...");
    showToast(`▶ Playing: ${title || videoId}`);
  }
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
  if (!player || !state.playerReady) return;
  const s = player.getPlayerState();
  if (s === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    showToast("⏸ Paused");
  } else {
    player.playVideo();
    showToast("▶ Playing");
  }
}

function updateVideoTitle(title) {
  const el = document.getElementById("video-title");
  if (el) el.textContent = title;
}

// ---- SEARCH ----
function searchYouTube(query) {
  if (!query.trim()) return;
  // Use YouTube's search via a new embed — search through invidious API
  // For simplicity, we'll use a lightweight approach using invidious public API
  showToast(`🔍 Searching: "${query}"...`);

  fetch(
    `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`,
  )
    .then((r) => r.json())
    .then((results) => {
      displaySearchResults(
        results.filter((r) => r.type === "video").slice(0, 8),
      );
    })
    .catch(() => {
      // Fallback: try another invidious instance
      fetch(
        `https://invidious.snopyta.org/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`,
      )
        .then((r) => r.json())
        .then((results) => {
          displaySearchResults(
            results.filter((r) => r.type === "video").slice(0, 8),
          );
        })
        .catch(() => {
          // Final fallback: direct play assuming query is a video ID
          showToast(
            "⚠ Search unavailable. Try entering a YouTube video ID directly.",
          );
          if (query.length === 11) {
            loadVideo(query, "Custom Video");
          }
        });
    });
}

function displaySearchResults(results) {
  const container = document.getElementById("search-results");
  const list = document.getElementById("results-list");
  list.innerHTML = "";

  if (results.length === 0) {
    list.innerHTML =
      '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No results found</p>';
    container.classList.add("visible");
    state.searchResultsVisible = true;
    return;
  }

  results.forEach((video, idx) => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.dataset.index = idx;
    item.dataset.videoId = video.videoId;
    item.innerHTML = `
      <img class="result-thumb" src="https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg" alt="" loading="lazy">
      <div class="result-info">
        <h4>${escapeHtml(video.title)}</h4>
        <p>${escapeHtml(video.author || "")} · ${formatDuration(video.lengthSeconds)}</p>
      </div>
    `;
    item.addEventListener("click", () => {
      loadVideo(video.videoId, video.title);
      closeSearchResults();
    });
    list.appendChild(item);
  });

  container.classList.add("visible");
  state.searchResultsVisible = true;
}

function closeSearchResults() {
  document.getElementById("search-results").classList.remove("visible");
  state.searchResultsVisible = false;
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---- GAMEPAD ----
function initGamepad() {
  window.addEventListener("gamepadconnected", (e) => {
    state.gamepadIndex = e.gamepad.index;
    document.getElementById("gamepad-cursor").style.display = "block";
    updateGamepadStatus(true, e.gamepad.id);
    showToast(`🎮 ${e.gamepad.id.split("(")[0].trim()} connected!`);
  });

  window.addEventListener("gamepaddisconnected", (e) => {
    if (state.gamepadIndex === e.gamepad.index) {
      state.gamepadIndex = null;
      document.getElementById("gamepad-cursor").style.display = "none";
      updateGamepadStatus(false);
      showToast("🎮 Controller disconnected");
    }
  });

  // Start polling loop
  requestAnimationFrame(gamepadLoop);
}

function updateGamepadStatus(connected, name) {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  if (connected) {
    dot.classList.add("connected");
    text.textContent = "DualShock 4";
  } else {
    dot.classList.remove("connected");
    text.textContent = "No controller";
  }
}

function gamepadLoop() {
  if (state.gamepadIndex !== null) {
    const gamepad = navigator.getGamepads()[state.gamepadIndex];
    if (gamepad) {
      processGamepadInput(gamepad);
    }
  }
  requestAnimationFrame(gamepadLoop);
}

function processGamepadInput(gamepad) {
  const { deadzone, cursorSpeed, stickSmoothing } = CONFIG.gamepad;

  // ---- LEFT STICK → CURSOR MOVEMENT ----
  let lx = gamepad.axes[0];
  let ly = gamepad.axes[1];

  // Apply deadzone
  if (Math.abs(lx) < deadzone) lx = 0;
  if (Math.abs(ly) < deadzone) ly = 0;

  // Smooth
  state.smoothX = state.smoothX * stickSmoothing + lx * (1 - stickSmoothing);
  state.smoothY = state.smoothY * stickSmoothing + ly * (1 - stickSmoothing);

  // Apply non-linear curve for precision
  const applyInput = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.5);

  state.cursorX += applyInput(state.smoothX) * cursorSpeed;
  state.cursorY += applyInput(state.smoothY) * cursorSpeed;

  // Clamp
  state.cursorX = Math.max(0, Math.min(window.innerWidth, state.cursorX));
  state.cursorY = Math.max(0, Math.min(window.innerHeight, state.cursorY));

  // Update cursor element
  const cursor = document.getElementById("gamepad-cursor");
  cursor.style.left = state.cursorX + "px";
  cursor.style.top = state.cursorY + "px";

  // Hover detection
  updateHover();

  // ---- BUTTONS ----
  const btns = gamepad.buttons;
  const prev = state.prevButtons;

  const justPressed = (idx) =>
    btns[idx] && btns[idx].pressed && (!prev[idx] || !prev[idx].pressed);
  const justReleased = (idx) =>
    prev[idx] && prev[idx].pressed && btns[idx] && !btns[idx].pressed;

  // X (Cross) — Click
  if (justPressed(CONFIG.buttons.cross)) {
    emulateClick();
    cursor.classList.add("clicking");
  }
  if (justReleased(CONFIG.buttons.cross)) {
    cursor.classList.remove("clicking");
  }

  // ○ (Circle) — Back / Close
  if (justPressed(CONFIG.buttons.circle)) {
    if (state.helpVisible) {
      toggleHelp();
    } else if (state.searchResultsVisible) {
      closeSearchResults();
    } else if (state.keyboardVisible) {
      toggleKeyboard();
    }
  }

  // △ (Triangle) — Toggle keyboard
  if (justPressed(CONFIG.buttons.triangle)) {
    toggleKeyboard();
  }

  // □ (Square) — Fullscreen
  if (justPressed(CONFIG.buttons.square)) {
    toggleFullscreen();
  }

  // Options — Play/Pause
  if (justPressed(CONFIG.buttons.options)) {
    togglePlayPause();
  }

  // L1 — Previous video
  if (justPressed(CONFIG.buttons.l1)) {
    const idx =
      (state.currentVideoIndex - 1 + CONFIG.presets.length) %
      CONFIG.presets.length;
    loadVideoByIndex(idx);
  }

  // R1 — Next video
  if (justPressed(CONFIG.buttons.r1)) {
    const idx = (state.currentVideoIndex + 1) % CONFIG.presets.length;
    loadVideoByIndex(idx);
  }

  // Share — Help overlay
  if (justPressed(CONFIG.buttons.share)) {
    toggleHelp();
  }

  // D-pad — keyboard navigation
  if (state.keyboardVisible) {
    handleDpadForKeyboard(btns, prev);
  } else if (state.searchResultsVisible) {
    handleDpadForResults(btns, prev);
  }

  // Store previous state (deep copy pressed state)
  state.prevButtons = Array.from(btns).map((b) => ({
    pressed: b.pressed,
    value: b.value,
  }));
}

function handleDpadForKeyboard(btns, prev) {
  const justPressed = (idx) =>
    btns[idx] && btns[idx].pressed && (!prev[idx] || !prev[idx].pressed);

  const layout = CONFIG.keyboardLayouts[state.keyboardLayout];

  if (justPressed(CONFIG.buttons.dpadUp)) {
    state.keyboardRow = Math.max(0, state.keyboardRow - 1);
    state.keyboardCol = Math.min(
      state.keyboardCol,
      layout[state.keyboardRow].length - 1,
    );
    updateKeyboardHighlight();
  }
  if (justPressed(CONFIG.buttons.dpadDown)) {
    state.keyboardRow = Math.min(layout.length - 1, state.keyboardRow + 1);
    state.keyboardCol = Math.min(
      state.keyboardCol,
      layout[state.keyboardRow].length - 1,
    );
    updateKeyboardHighlight();
  }
  if (justPressed(CONFIG.buttons.dpadLeft)) {
    state.keyboardCol = Math.max(0, state.keyboardCol - 1);
    updateKeyboardHighlight();
  }
  if (justPressed(CONFIG.buttons.dpadRight)) {
    const maxCol = layout[state.keyboardRow].length - 1;
    state.keyboardCol = Math.min(maxCol, state.keyboardCol + 1);
    updateKeyboardHighlight();
  }

  // Cross on keyboard = press highlighted key
  if (justPressed(CONFIG.buttons.cross)) {
    const key = layout[state.keyboardRow][state.keyboardCol];
    pressVirtualKey(key);
  }
}

function handleDpadForResults(btns, prev) {
  const justPressed = (idx) =>
    btns[idx] && btns[idx].pressed && (!prev[idx] || !prev[idx].pressed);

  const items = document.querySelectorAll(".result-item");
  if (!items.length) return;

  let currentIdx = -1;
  items.forEach((item, i) => {
    if (item.classList.contains("hovered")) currentIdx = i;
  });

  if (justPressed(CONFIG.buttons.dpadDown)) {
    currentIdx = Math.min(items.length - 1, currentIdx + 1);
  }
  if (justPressed(CONFIG.buttons.dpadUp)) {
    currentIdx = Math.max(0, currentIdx - 1);
  }

  items.forEach((item) => item.classList.remove("hovered"));
  if (currentIdx >= 0 && items[currentIdx]) {
    items[currentIdx].classList.add("hovered");
    items[currentIdx].scrollIntoView({ block: "nearest" });
  }

  if (
    justPressed(CONFIG.buttons.cross) &&
    currentIdx >= 0 &&
    items[currentIdx]
  ) {
    items[currentIdx].click();
  }
}

// ---- HOVER / CLICK EMULATION ----
function updateHover() {
  const elements = document.elementsFromPoint(state.cursorX, state.cursorY);
  const interactive = elements.find((el) =>
    el.matches(
      "button, .kb-key, .preset-chip, .result-item, .ctrl-btn, a, input, [data-clickable]",
    ),
  );

  // Remove old hover
  if (state.hoveredElement && state.hoveredElement !== interactive) {
    state.hoveredElement.classList.remove("hovered");
  }

  if (interactive) {
    interactive.classList.add("hovered");
    state.hoveredElement = interactive;
  } else {
    state.hoveredElement = null;
  }
}

function emulateClick() {
  const elements = document.elementsFromPoint(state.cursorX, state.cursorY);
  const clickable = elements.find((el) =>
    el.matches(
      "button, .kb-key, .preset-chip, .result-item, .ctrl-btn, a, input, [data-clickable]",
    ),
  );

  if (clickable) {
    // Trigger visual feedback
    clickable.classList.add("pressed");
    setTimeout(() => clickable.classList.remove("pressed"), 150);

    // If it's an input, focus it
    if (clickable.tagName === "INPUT") {
      clickable.focus();
      if (!state.keyboardVisible) toggleKeyboard();
      return;
    }

    clickable.click();
  }
}

// ---- VIRTUAL KEYBOARD ----
function buildKeyboard() {
  const container = document.getElementById("keyboard-keys");
  container.innerHTML = "";

  const layout = CONFIG.keyboardLayouts[state.keyboardLayout];

  layout.forEach((row, rowIdx) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    row.forEach((key, colIdx) => {
      const keyEl = document.createElement("button");
      keyEl.className = "kb-key";
      keyEl.textContent = key;
      keyEl.dataset.row = rowIdx;
      keyEl.dataset.col = colIdx;

      // Wide keys
      if (["⇧", "⌫", "ABC", "?123"].includes(key)) {
        keyEl.classList.add("wide");
      }
      if (["Space"].includes(key)) {
        keyEl.classList.add("space-key");
      }
      if (["Search", "Close"].includes(key)) {
        keyEl.classList.add("wide");
      }

      keyEl.addEventListener("click", (e) => {
        e.preventDefault();
        pressVirtualKey(key);
      });

      rowEl.appendChild(keyEl);
    });

    container.appendChild(rowEl);
  });

  updateKeyboardHighlight();
}

function pressVirtualKey(key) {
  const input = document.getElementById("search-input");

  switch (key) {
    case "⇧":
      state.keyboardLayout =
        state.keyboardLayout === "upper" ? "lower" : "upper";
      buildKeyboard();
      break;
    case "⌫":
      state.searchText = state.searchText.slice(0, -1);
      input.value = state.searchText;
      break;
    case "Space":
      state.searchText += " ";
      input.value = state.searchText;
      break;
    case "Search":
      searchYouTube(state.searchText);
      toggleKeyboard();
      break;
    case "Close":
      toggleKeyboard();
      break;
    case "?123":
      state.keyboardLayout = "symbols";
      buildKeyboard();
      break;
    case "ABC":
      state.keyboardLayout = "lower";
      buildKeyboard();
      break;
    case "🌐":
      // Could cycle language layouts in the future
      showToast("🌐 Language switch coming soon");
      break;
    default:
      state.searchText += key;
      input.value = state.searchText;
      // Auto-switch back to lowercase after one uppercase letter
      if (state.keyboardLayout === "upper") {
        state.keyboardLayout = "lower";
        buildKeyboard();
      }
      break;
  }
}

function updateKeyboardHighlight() {
  const keys = document.querySelectorAll(".kb-key");
  keys.forEach((k) => k.classList.remove("hovered"));

  const target = document.querySelector(
    `.kb-key[data-row="${state.keyboardRow}"][data-col="${state.keyboardCol}"]`,
  );
  if (target) {
    target.classList.add("hovered");
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function toggleKeyboard() {
  state.keyboardVisible = !state.keyboardVisible;
  const kb = document.getElementById("virtual-keyboard");

  if (state.keyboardVisible) {
    kb.classList.add("visible");
    buildKeyboard();
    state.keyboardRow = 0;
    state.keyboardCol = 0;
    showToast("⌨ Keyboard opened — D-pad to navigate, X to type");
  } else {
    kb.classList.remove("visible");
  }
}

// ---- VR MODE ----
function initVR() {
  const vrBtn = document.getElementById("vr-btn");

  vrBtn.addEventListener("click", () => {
    if (state.vrMode) {
      exitVRMode();
    } else {
      enterVRMode();
    }
  });
}

function enterVRMode() {
  state.vrMode = true;
  document.getElementById("vr-btn").textContent = "✕ Exit VR";
  document.getElementById("vr-btn").classList.add("active");

  // Try fullscreen first
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  // Lock to landscape
  try {
    screen.orientation.lock("landscape").catch(() => {});
  } catch (e) {}

  // Wake lock to prevent screen dimming
  requestWakeLock();

  // Apply stereoscopic CSS split
  document.body.classList.add("vr-stereo-mode");

  // Create stereoscopic view
  createStereoView();

  showToast("🥽 VR Mode — Stereoscopic Split Enabled");
}

function exitVRMode() {
  state.vrMode = false;
  document.getElementById("vr-btn").textContent = "🥽 VR";
  document.getElementById("vr-btn").classList.remove("active");

  document.body.classList.remove("vr-stereo-mode");

  // Restore normal view
  destroyStereoView();

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  releaseWakeLock();
  showToast("📱 2D Mode Restored");
}

function createStereoView() {
  const app = document.getElementById("app-container");
  const originalContent = app.innerHTML;

  // Hide original top/bottom bars for VR
  document.getElementById("top-bar").style.display = "none";
  document.getElementById("bottom-controls").style.display = "none";
  document.getElementById("presets-bar").style.display = "none";

  // Create left eye
  const leftEye = document.createElement("div");
  leftEye.className = "vr-eye vr-eye-left";
  leftEye.id = "vr-eye-left";

  // Create right eye
  const rightEye = document.createElement("div");
  rightEye.className = "vr-eye vr-eye-right";
  rightEye.id = "vr-eye-right";

  // Clone video area for both eyes
  const videoArea = document.getElementById("video-area");

  // Move original to left eye
  leftEye.appendChild(videoArea);

  // Create mirrored iframe for right eye
  const rightPlayer = document.createElement("div");
  rightPlayer.id = "right-eye-video";
  rightPlayer.style.cssText =
    "width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;";
  rightPlayer.innerHTML = `<iframe 
    src="https://www.youtube.com/embed/${CONFIG.presets[state.currentVideoIndex].id}?autoplay=1&controls=0&modestbranding=1&playsinline=1" 
    style="width:100%;height:100%;border:none;" 
    allow="autoplay; encrypted-media" 
    allowfullscreen></iframe>`;
  rightEye.appendChild(rightPlayer);

  app.appendChild(leftEye);
  app.appendChild(rightEye);
}

function destroyStereoView() {
  const app = document.getElementById("app-container");
  const videoArea = document.getElementById("video-area");
  const leftEye = document.getElementById("vr-eye-left");
  const rightEye = document.getElementById("vr-eye-right");

  if (leftEye && videoArea) {
    app.insertBefore(videoArea, leftEye);
  }

  if (leftEye) leftEye.remove();
  if (rightEye) rightEye.remove();

  // Restore UI elements
  document.getElementById("top-bar").style.display = "";
  document.getElementById("bottom-controls").style.display = "";
  document.getElementById("presets-bar").style.display = "";
}

// ---- WAKE LOCK ----
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    // Wake lock not available
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// ---- FULLSCREEN ----
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    showToast("📺 Fullscreen");
  } else {
    document.exitFullscreen().catch(() => {});
    showToast("📱 Windowed");
  }
}

// ---- HELP ----
function toggleHelp() {
  state.helpVisible = !state.helpVisible;
  const overlay = document.getElementById("help-overlay");
  if (state.helpVisible) {
    overlay.classList.add("visible");
  } else {
    overlay.classList.remove("visible");
  }
}

// ---- TOASTS ----
function showToast(message) {
  const now = Date.now();
  if (now - state.lastToast < 300) return; // Throttle
  state.lastToast = now;

  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ---- PRESET CHIPS ----
function buildPresetChips() {
  const bar = document.getElementById("presets-bar");
  bar.innerHTML = "";

  CONFIG.presets.forEach((preset, idx) => {
    const chip = document.createElement("button");
    chip.className =
      "preset-chip" + (idx === state.currentVideoIndex ? " active" : "");
    chip.textContent = preset.title;
    chip.addEventListener("click", () => loadVideoByIndex(idx));
    bar.appendChild(chip);
  });
}

function updatePresetChips() {
  const chips = document.querySelectorAll(".preset-chip");
  chips.forEach((chip, idx) => {
    chip.classList.toggle("active", idx === state.currentVideoIndex);
  });
}

// ---- LOADING ----
function hideLoading() {
  const loading = document.getElementById("loading-screen");
  loading.classList.add("hidden");
  setTimeout(() => (loading.style.display = "none"), 600);
}

// ---- INIT ----
function init() {
  // Build presets
  buildPresetChips();

  // Build keyboard
  buildKeyboard();

  // Init gamepad
  initGamepad();

  // Init VR button
  initVR();

  // Search button
  document.getElementById("search-btn").addEventListener("click", () => {
    const query =
      document.getElementById("search-input").value || state.searchText;
    if (query) searchYouTube(query);
  });

  // Search input sync
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.searchText = e.target.value;
  });

  // Search on Enter
  document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = e.target.value || state.searchText;
      if (query) searchYouTube(query);
    }
  });

  // Close search results button
  document
    .getElementById("close-results-btn")
    .addEventListener("click", closeSearchResults);

  // Help close
  document
    .getElementById("help-close-btn")
    .addEventListener("click", toggleHelp);

  // Keyboard toggle button
  document
    .getElementById("keyboard-btn")
    .addEventListener("click", toggleKeyboard);

  // Help button
  document.getElementById("help-btn").addEventListener("click", toggleHelp);

  // Lock landscape
  try {
    screen.orientation.lock("landscape").catch(() => {});
  } catch (e) {}

  // Fallback if YouTube API is slow
  setTimeout(() => {
    if (!state.playerReady) {
      hideLoading();
      showToast("⏳ YouTube player is loading...");
    }
  }, 5000);
}

// Start when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Expose for YouTube API callback
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
