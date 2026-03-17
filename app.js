/* BUILD_ID: CRYOTEST_APP_JS_2026-03-17_UI_STAGE_B_FIX_03 */

const SCENES_URL = "./scenes.json";
const GAME_STATE_KEY = "cryotest_game_state_v1";

// ===== DOM (UI stage layout) =====
const sceneTextWrap = document.getElementById("sceneTextWrap");
const sceneText = document.getElementById("sceneText");
const fallbackTextWrap = document.getElementById("fallbackTextWrap");
const fallbackText = document.getElementById("fallbackText");

const sceneImageWrap = document.getElementById("sceneImageWrap");
const sceneImageEl = document.getElementById("sceneImage");

const choiceDock = document.getElementById("choiceDock");
const choiceGrid = document.getElementById("choiceGrid");

const fallbackDock = document.getElementById("fallbackDock");
const fallbackGrid = document.getElementById("fallbackGrid");

const audioModal = document.getElementById("audioModal");
const audioYes = document.getElementById("audioYes");
const audioNo = document.getElementById("audioNo");

const gameWrap = document.getElementById("gameWrap");

const soundBtn = document.getElementById("soundBtn");
const soundBtnFallback = document.getElementById("soundBtnFallback");
const overlayEl = document.getElementById("overlay");
const buildEl = document.getElementById("buildId");
const sceneLoadingEl = document.getElementById("sceneLoading");
const sceneLoadingBarFill = document.getElementById("sceneLoadingBarFill");
const sceneLoadingLabel = document.getElementById("sceneLoadingLabel");

if (buildEl) buildEl.textContent = "BUILD_ID: CRYOTEST_APP_JS_2026-03-16_UI_STAGE_B_FIX_03";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const TEXT_REVEAL_MS = 5000;
const IMAGE_REVEAL_MS = 10000;
const CHOICE_REVEAL_MS = 5000;

function safeShow(el, display="block"){
  if(!el) return;
  el.style.display = display;
}
function safeHide(el){
  if(!el) return;
  el.style.display = "none";
}
function safeSetText(el, txt){
  if(!el) return;
  el.textContent = txt;
}

function animateTypewriter(el, text, duration){
  if(!el){
    return Promise.resolve();
  }

  const fullText = String(text || "");
  const chars = [...fullText];
  if(!chars.length){
    el.textContent = "";
    return Promise.resolve();
  }

  el.textContent = "";

  return new Promise((resolve) => {
    const startedAt = performance.now();

    function tick(nowTs){
      const progress = Math.min((nowTs - startedAt) / duration, 1);
      const visibleChars = Math.max(1, Math.floor(chars.length * progress));
      el.textContent = chars.slice(0, visibleChars).join("");

      if(progress < 1){
        requestAnimationFrame(tick);
        return;
      }

      el.textContent = fullText;
      resolve();
    }

    requestAnimationFrame(tick);
  });
}

// ===== Cold fade (overlay) =====
async function coldFadeTo(opacity, ms){
  if(!overlayEl) return;
  overlayEl.style.transitionDuration = ms + "ms";
  overlayEl.style.opacity = String(opacity);
  await sleep(ms);
}
async function coldFadeIn(ms=180){ await coldFadeTo(1, ms); }
async function coldFadeOut(ms=240){ await coldFadeTo(0, ms); }

const SOUND_KEY = "cryotest_sound_on";

// ===== AUDIO (WebAudio) =====
let audioCtx = null;
let master = null;

let gameAmbGain = null;
let gameSource = null;

let sceneLoopGain = null;
let sceneLoopSource = null;
let currentLoopFile = "";
let loopChangeToken = 0;

let clickBuffer = null;
let textRevealBuffer = null;
let onceGain = null;

let activeSceneId = null;

const VOL = {
  master: 0.95,
  gameAmb: 0.18,
  loop: 0.26,
  once: 0.55,
  click: 0.22,
};

let sceneData = null;
let scenesById = new Map();
let rules = {};
let entrySceneId = "";
let gameState = null;
const imagePreloadCache = new Map();

function defaultStats(){
  return { fear: 0, control: 0, logic: 0, trust: 0 };
}

function defaultGameState(){
  return {
    cycle: 1,
    stats: defaultStats(),
    current_scene_id: "",
    ended: false,
    last_scene_id: null,
  };
}

async function loadSceneData(){
  if(sceneData) return sceneData;

  const response = await fetch(SCENES_URL, { cache: "force-cache" });
  if(!response.ok){
    throw new Error(`Failed to load scenes: ${response.status}`);
  }

  sceneData = await response.json();
  rules = sceneData.rules || {};
  entrySceneId = sceneData.entry || "";
  scenesById = new Map((sceneData.scenes || []).map((scene) => [scene.id, scene]));
  return sceneData;
}

function getSceneImageSrc(scene){
  const img = (scene?.image || "").trim();
  if(!img) return "";
  return img.includes("/") ? img : `./assets/scenes/${img}`;
}

function preloadImage(src){
  if(!src) return Promise.resolve();
  if(imagePreloadCache.has(src)) return imagePreloadCache.get(src);

  const pending = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(src);
    img.onerror = () => resolve("");
    img.src = src;
  });

  imagePreloadCache.set(src, pending);
  return pending;
}

function preloadSceneImage(scene){
  return preloadImage(getSceneImageSrc(scene));
}

function preloadUpcomingImages(scene){
  preloadSceneImage(scene);

  (scene?.choices || []).forEach((choice) => {
    const nextId = choice?.next;
    if(!nextId || nextId.startsWith("system_")) return;
    const nextScene = scenesById.get(nextId);
    if(nextScene){
      preloadSceneImage(nextScene);
    }
  });
}

function warmImageCacheDeferred(){
  const preloadRest = () => {
    (sceneData?.scenes || []).forEach((scene) => preloadSceneImage(scene));
  };

  if("requestIdleCallback" in window){
    window.requestIdleCallback(preloadRest, { timeout: 1800 });
  }else{
    setTimeout(preloadRest, 1200);
  }
}

function saveGameState(){
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
}

function loadSavedGameState(){
  try{
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== "object") return null;
    return {
      cycle: Number.isInteger(parsed.cycle) ? parsed.cycle : 1,
      stats: {
        fear: Number(parsed?.stats?.fear || 0),
        control: Number(parsed?.stats?.control || 0),
        logic: Number(parsed?.stats?.logic || 0),
        trust: Number(parsed?.stats?.trust || 0),
      },
      current_scene_id: String(parsed.current_scene_id || ""),
      ended: Boolean(parsed.ended),
      last_scene_id: parsed.last_scene_id ? String(parsed.last_scene_id) : null,
    };
  }catch(e){
    return null;
  }
}

function getSceneById(sceneId){
  const scene = scenesById.get(sceneId);
  if(!scene){
    throw new Error(`Scene not found: ${sceneId}`);
  }
  return scene;
}

function dominanceCheck(stats){
  const dominance = rules.dominance || {};
  const threshold = Number.isFinite(Number(dominance.threshold)) ? Number(dominance.threshold) : 6;
  const leadBy = Number.isFinite(Number(dominance.leadBy)) ? Number(dominance.leadBy) : 2;
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const [topName, topValue] = sorted[0];
  const secondValue = sorted[1] ? sorted[1][1] : -1e9;

  if(topValue >= threshold && (topValue - secondValue) >= leadBy){
    return { done: true, dominant: topName };
  }
  return { done: false, dominant: null };
}

function maxCycles(){
  return Number.isFinite(Number(rules.maxCycles)) ? Number(rules.maxCycles) : 5;
}

function pickCycleEntry(cycle){
  if(cycle === 1 && entrySceneId){
    return entrySceneId;
  }
  if(cycle === 2 && scenesById.has("c2_capsule_wake_v2")){
    return "c2_capsule_wake_v2";
  }
  return entrySceneId || "c1_capsule_wake";
}

function maybeInjectAnomaly(cycle){
  if(cycle <= 1 || cycle >= 5){
    return null;
  }

  const chanceMap = { 2: 0.08, 3: 0.12, 4: 0.10 };
  const chance = chanceMap[cycle] || 0;
  if(Math.random() > chance){
    return null;
  }

  const anomalies = [...scenesById.values()]
    .filter((scene) => scene.type === "anomaly")
    .map((scene) => scene.id);

  if(!anomalies.length) return null;
  return anomalies[Math.floor(Math.random() * anomalies.length)];
}

function resetGame(full = true){
  if(full || !gameState){
    gameState = defaultGameState();
  }
  gameState.cycle = full ? 1 : gameState.cycle;
  gameState.ended = false;
  gameState.last_scene_id = null;
  gameState.current_scene_id = pickCycleEntry(gameState.cycle);
  saveGameState();
}

function applyDelta(delta){
  Object.entries(delta || {}).forEach(([key, value]) => {
    if(!(key in gameState.stats)) return;
    gameState.stats[key] += Number(value) || 0;
  });
}

function roleFromDom(dom){
  const mapping = {
    fear: "Sentinel / Threat Monitor",
    control: "Protocol Officer",
    logic: "Systems Analyst",
    trust: "Crew Liaison",
  };
  return mapping[dom] || "Undeclared";
}

function endCycle(){
  const result = dominanceCheck(gameState.stats);
  if(result.done){
    gameState.ended = true;
    gameState.current_scene_id = `system_final_${result.dominant}`;
    saveGameState();
    return;
  }

  gameState.cycle += 1;
  if(gameState.cycle > maxCycles()){
    const dominant = Object.entries(gameState.stats).sort((a, b) => b[1] - a[1])[0][0];
    gameState.ended = true;
    gameState.current_scene_id = `system_final_${dominant}`;
    saveGameState();
    return;
  }

  gameState.current_scene_id = pickCycleEntry(gameState.cycle);
  saveGameState();
}

function getRenderScene(){
  const sceneId = gameState.current_scene_id;

  if(sceneId.startsWith("system_final_")){
    const dominant = sceneId.replace("system_final_", "");
    return {
      id: sceneId,
      cycle: gameState.cycle,
      text: `ТЕСТ ЗАВЕРШЁН.\nОбъект: Клон №47.\nНазначение: ${roleFromDom(dominant)}`,
      effects: ["sterile_silence", "light_white"],
      choices: [
        { text: "Завершить", next: "system_restart", delta: {} }
      ],
      meta: { ended: true, dominant, stats: gameState.stats },
    };
  }

  if(sceneId === "system_restart"){
    return {
      id: "system_restart",
      cycle: gameState.cycle,
      text: "Следующий.",
      effects: ["flash_subtle"],
      choices: [
        { text: "Начать заново", next: "system_reset_full", delta: {} }
      ],
      meta: { ended: true, stats: gameState.stats },
    };
  }

  const scene = getSceneById(sceneId);
  return {
    ...scene,
    meta: {
      ...(scene.meta || {}),
      cycle: gameState.cycle,
      stats: gameState.stats,
      ended: gameState.ended,
    },
  };
}

function chooseScene(choiceIndex){
  const sceneId = gameState.current_scene_id;

  if(sceneId.startsWith("system_final_")){
    gameState.current_scene_id = "system_restart";
    saveGameState();
    return getRenderScene();
  }

  if(sceneId === "system_restart"){
    gameState.current_scene_id = "system_reset_full";
    saveGameState();
    return getRenderScene();
  }

  if(sceneId === "system_reset_full"){
    resetGame(true);
    return getRenderScene();
  }

  const scene = getSceneById(sceneId);
  const choices = Array.isArray(scene.choices) ? scene.choices : [];

  if(!choices.length){
    endCycle();
    return getRenderScene();
  }

  if(choiceIndex < 0 || choiceIndex >= choices.length){
    throw new Error("Invalid choice index");
  }

  const choice = choices[choiceIndex];
  applyDelta(choice.delta || {});

  gameState.last_scene_id = sceneId;
  const nextId = choice.next;

  if(nextId === "system_cycle_end"){
    const anomaly = maybeInjectAnomaly(gameState.cycle);
    if(anomaly){
      gameState.current_scene_id = anomaly;
      saveGameState();
      return getRenderScene();
    }

    endCycle();
    return getRenderScene();
  }

  if(!nextId){
    endCycle();
    return getRenderScene();
  }

  gameState.current_scene_id = nextId;
  saveGameState();
  return getRenderScene();
}

function isSoundEnabled(){
  return localStorage.getItem(SOUND_KEY) === "1";
}
function setSoundEnabled(v){
  localStorage.setItem(SOUND_KEY, v ? "1" : "0");
}
function now(){
  return audioCtx.currentTime;
}
function fade(gainNode, to, ms){
  if(!gainNode) return;
  const t = now();
  try{
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
    gainNode.gain.linearRampToValueAtTime(to, t + ms/1000);
  }catch(e){}
}
function stopSource(src){
  if(!src) return;
  try{ src.stop(0); }catch(e){}
  try{ src.disconnect(); }catch(e){}
}
async function fetchArrayBuffer(url){
  const r = await fetch(url, { cache: "force-cache" });
  return await r.arrayBuffer();
}
async function decodeAudio(url){
  const arr = await fetchArrayBuffer(url);
  return await audioCtx.decodeAudioData(arr);
}

async function initAudio(){
  if(audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0; // стартуем с 0, поднимем если звук включен
  master.connect(audioCtx.destination);

  gameAmbGain = audioCtx.createGain();
  gameAmbGain.gain.value = 0;
  gameAmbGain.connect(master);

  sceneLoopGain = audioCtx.createGain();
  sceneLoopGain.gain.value = 0;
  sceneLoopGain.connect(master);

  onceGain = audioCtx.createGain();
  onceGain.gain.value = 1;
  onceGain.connect(master);

  try{
    clickBuffer = await decodeAudio("./assets/ui_click.mp3");
  }catch(e){
    // ok
  }

  try{
    textRevealBuffer = await decodeAudio("./assets/text_reveal_glitch.mp3");
  }catch(e){
    // optional
  }
}

// гарантированный глобальный mute/unmute
function hardMute(on){
  if(!master) return;
  if(on) fade(master, 0.0, 140);
  else fade(master, VOL.master, 240);
}

// ===== GAME AMBIENCE =====
async function startGameAmbience(){
  if(!isSoundEnabled()) return;
  await initAudio();
  if(gameSource) return;

  let buf = null;
  try{
    buf = await decodeAudio("./assets/game_ambience.mp3");
  }catch(e){
    return;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gameAmbGain);

  gameSource = src;
  src.start(0);

  fade(gameAmbGain, VOL.gameAmb, 420);
}

function stopGameAmbience(){
  if(!gameAmbGain) return;

  const old = gameSource;
  fade(gameAmbGain, 0.0, 350);
  gameSource = null;

  setTimeout(()=> stopSource(old), 380);
}

// ===== DUCKING =====
function setDucking(on){
  if(!gameAmbGain) return;
  const target = on ? (VOL.gameAmb * 0.55) : VOL.gameAmb;
  fade(gameAmbGain, target, 220);
}

// ===== SCENE LOOP =====
async function setSceneLoop(loopFile){
  await initAudio();
  loopFile = (loopFile || "").trim();
  const token = ++loopChangeToken;

  if(loopFile && loopFile === currentLoopFile && sceneLoopSource){
    return;
  }

  if(sceneLoopSource){
    fade(sceneLoopGain, 0.0, 320);
    const old = sceneLoopSource;
    sceneLoopSource = null;
    currentLoopFile = "";

    setTimeout(()=> setDucking(false), 140);
    setTimeout(()=> stopSource(old), 360);
    await sleep(220);
  }

  if(!loopFile){
    currentLoopFile = "";
    return;
  }

  if(!isSoundEnabled()){
    currentLoopFile = loopFile;
    return;
  }

  let buf = null;
  try{
    const url = loopFile.includes("/") ? loopFile : ("./assets/" + loopFile);
    buf = await decodeAudio(url);
  }catch(e){
    return;
  }

  if(token !== loopChangeToken) return;

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(sceneLoopGain);

  sceneLoopSource = src;
  currentLoopFile = loopFile;

  setDucking(true);
  src.start(0);
  fade(sceneLoopGain, VOL.loop, 420);
}

// ===== ONE-SHOT =====
async function playOnce(file, vol=VOL.once){
  if(!isSoundEnabled()) return;
  await initAudio();

  let buf = null;
  try{
    const url = file.includes("/") ? file : ("./assets/" + file);
    buf = await decodeAudio(url);
  }catch(e){
    return;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const g = audioCtx.createGain();
  g.gain.value = vol;

  src.connect(g);
  g.connect(onceGain);

  src.start(0);
  setTimeout(()=> stopSource(src), 5000);
}

let lastClickAt = 0;
async function playClick(){
  if(!isSoundEnabled()) return;
  await initAudio();
  if(!clickBuffer) return;

  const t = Date.now();
  if(t - lastClickAt < 60) return;
  lastClickAt = t;

  const src = audioCtx.createBufferSource();
  src.buffer = clickBuffer;

  const g = audioCtx.createGain();
  g.gain.value = VOL.click;

  src.connect(g);
  g.connect(master);

  src.start(0);
  setTimeout(()=> stopSource(src), 500);
}

async function playTextReveal(){
  if(!isSoundEnabled()) return;
  await initAudio();
  if(!textRevealBuffer) return;

  const src = audioCtx.createBufferSource();
  src.buffer = textRevealBuffer;

  const g = audioCtx.createGain();
  g.gain.value = 0.18;

  src.connect(g);
  g.connect(master);

  src.start(0);
  setTimeout(()=> stopSource(src), 1800);
}

// ===== SOUND TOGGLE (HUD) =====
function syncSoundButtonUI(){
  [soundBtn, soundBtnFallback].forEach((btn)=>{
    if(!btn) return;
    if(isSoundEnabled()) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

async function toggleSound(){
  const enabled = isSoundEnabled();

  if(enabled){
    setSoundEnabled(false);
    syncSoundButtonUI();

    hardMute(true);
    stopGameAmbience();
    await setSceneLoop("");
    currentLoopFile = "";

  } else {
    setSoundEnabled(true);
    syncSoundButtonUI();

    await initAudio();
    hardMute(false);

    await startGameAmbience();

    if(window.__lastSceneAudio && window.__lastSceneAudio.sceneLoop){
      await setSceneLoop(window.__lastSceneAudio.sceneLoop);
    }
  }
}

function bindSoundButton(btn){
  if(!btn) return;
  btn.onclick = async ()=>{
    await playClick();
    await toggleSound();
  };
}

bindSoundButton(soundBtn);
bindSoundButton(soundBtnFallback);

// ===== DATA =====
async function fetchScene(){
  await loadSceneData();
  if(!gameState){
    gameState = loadSavedGameState();
  }
  if(!gameState || !gameState.current_scene_id){
    resetGame(true);
  }
  return getRenderScene();
}
async function choose(index){
  await loadSceneData();
  if(!gameState){
    gameState = loadSavedGameState();
  }
  if(!gameState || !gameState.current_scene_id){
    resetGame(true);
  }
  return chooseScene(index);
}

// ===== UI helpers =====
function setSceneText(text, mode="image"){
  const t = (text || "").trim();

  if(sceneTextWrap) sceneTextWrap.style.display = "none";
  if(fallbackTextWrap) fallbackTextWrap.style.display = "none";
  if(sceneText) sceneText.textContent = "";
  if(fallbackText) fallbackText.textContent = "";

  if(!t) return;

  if(mode === "fallback"){
    if(fallbackText) fallbackText.textContent = t;
    if(fallbackTextWrap) fallbackTextWrap.style.display = "block";
    return;
  }

  if(sceneText) sceneText.textContent = t;
  if(sceneTextWrap) sceneTextWrap.style.display = "block";
}

function resetScenePresentation(){
  if(choiceDock){
    choiceDock.classList.remove("is-visible");
  }

  [sceneTextWrap, fallbackTextWrap].forEach((el) => {
    if(!el) return;
    el.classList.remove("is-visible");
  });

  [sceneText, fallbackText].forEach((el) => {
    if(!el) return;
    el.classList.remove("is-visible", "is-revealing", "is-glitching");
    el.style.animation = "none";
    el.textContent = "";
  });

  if(sceneImageWrap){
    sceneImageWrap.classList.remove("is-visible");
  }

  if(fallbackGrid){
    fallbackGrid.style.opacity = "";
    fallbackGrid.style.transform = "";
    fallbackGrid.style.transition = "";
  }
}

function setImageVisible(on){
  if(!sceneImageWrap) return;
  sceneImageWrap.style.display = on ? "block" : "none";
}

function setChoiceMode(mode){
  // mode: "image" | "fallback"
  const inImage = (mode === "image");

  if(choiceDock) choiceDock.style.display = inImage ? "flex" : "none";
  if(fallbackDock) fallbackDock.style.display = inImage ? "none" : "block";
}

function clearChoices(){
  if(choiceGrid) choiceGrid.innerHTML = "";
  if(fallbackGrid) fallbackGrid.innerHTML = "";
}

function makeChoiceButton(c, idx){
  const btn = document.createElement("button");
  btn.className = "choiceBtn";
  btn.textContent = c.text;

  btn.onclick = async () => {
    await playClick();

    // если overlay отсутствует — просто без фейда
    if(overlayEl) await coldFadeIn(170);

    const next = await choose(idx);
    await renderScene(next);

    if(overlayEl) await coldFadeOut(240);
  };

  return btn;
}

function mountChoiceButtons(choices, targetGrid){
  if(!targetGrid) return;
  (choices || []).forEach((c, idx) => {
    targetGrid.appendChild(makeChoiceButton(c, idx));
  });
}

// ===== IMAGE drift fallback =====
function forceImageFloat(){
  if(!sceneImageEl) return;
  sceneImageEl.style.animation = "sceneFloat 24s ease-in-out infinite";
  sceneImageEl.style.willChange = "transform";
}

function setImageOrientationClass(width, height){
  if(!sceneImageEl) return;
  sceneImageEl.classList.remove("is-portrait", "is-landscape");
  if(!width || !height) return;
  if(height > width){
    sceneImageEl.classList.add("is-portrait");
  }else{
    sceneImageEl.classList.add("is-landscape");
  }
}

// ===== RENDER =====
async function renderSceneImage(scene){
  const img = (scene.image || "").trim();
  if(img && sceneImageEl){
    const src = getSceneImageSrc(scene);
    await preloadImage(src);
    sceneImageEl.classList.remove("is-portrait", "is-landscape");
    sceneImageEl.onload = () => {
      setImageOrientationClass(sceneImageEl.naturalWidth, sceneImageEl.naturalHeight);
      forceImageFloat();
    };
    sceneImageEl.src = src;
    setImageVisible(true);

    if(sceneImageEl.complete){
      setImageOrientationClass(sceneImageEl.naturalWidth, sceneImageEl.naturalHeight);
      forceImageFloat();
    }
    return true;
  }
  setImageVisible(false);
  return false;
}

async function animateScenePresentation(hasImage){
  const activeTextWrap = hasImage ? sceneTextWrap : fallbackTextWrap;
  const activeText = hasImage ? sceneText : fallbackText;
  const imageAnimation = (async () => {
    if(hasImage && sceneImageWrap){
      void sceneImageWrap.offsetWidth;
      sceneImageWrap.classList.add("is-visible");
      await sleep(IMAGE_REVEAL_MS);
    }
  })();

  if(activeText){
    if(activeTextWrap){
      activeTextWrap.classList.remove("is-visible");
      void activeTextWrap.offsetWidth;
      activeTextWrap.classList.add("is-visible");
    }

    const fullText = activeText.textContent || "";
    activeText.classList.remove("is-visible", "is-revealing", "is-glitching");
    activeText.style.animation = "none";
    void activeText.offsetWidth;
    activeText.classList.add("is-visible", "is-glitching");
    activeText.style.animation = "";
    playTextReveal();

    await animateTypewriter(activeText, fullText, TEXT_REVEAL_MS);
    activeText.classList.remove("is-glitching");
  } else {
    await sleep(TEXT_REVEAL_MS);
  }

  if(choiceDock && hasImage){
    void choiceDock.offsetWidth;
    choiceDock.classList.add("is-visible");
    await sleep(CHOICE_REVEAL_MS);
  }

  if(!hasImage && fallbackGrid){
    fallbackGrid.style.opacity = "0";
    fallbackGrid.style.transform = "translate3d(0,18px,0)";
    fallbackGrid.style.transition = `opacity ${CHOICE_REVEAL_MS}ms ease, transform ${CHOICE_REVEAL_MS}ms ease`;
    void fallbackGrid.offsetWidth;
    fallbackGrid.style.opacity = "1";
    fallbackGrid.style.transform = "translate3d(0,0,0)";
    await sleep(CHOICE_REVEAL_MS);
  }

  await imageAnimation;
}

function showLoadingScreen(on){
  if(!sceneLoadingEl) return;
  if(sceneLoadingLabel){
    sceneLoadingLabel.textContent = "Калибровка матрицы сознания";
  }
  if(sceneLoadingBarFill){
    sceneLoadingBarFill.style.animationPlayState = on ? "running" : "paused";
  }
  sceneLoadingEl.classList.toggle("is-hidden", !on);
}

async function applySceneAudio(scene){
  const audio = scene.audio || {};
  const sceneLoop = (audio.sceneLoop || "").trim();
  const sceneOnce = (audio.sceneOnce || "").trim();

  window.__lastSceneAudio = { sceneLoop, sceneOnce };

  await setSceneLoop(sceneLoop);

  if(scene.id && scene.id !== activeSceneId){
    if(sceneOnce){
      await playOnce(sceneOnce, VOL.once);
    }
    activeSceneId = scene.id;
  }
}

async function renderScene(scene){
  resetScenePresentation();

  // 1) image
  const hasImage = await renderSceneImage(scene);
  preloadUpcomingImages(scene);

  // 2) text
  setSceneText(scene.text || "", hasImage ? "image" : "fallback");

  // 3) choices
  clearChoices();

  // если вдруг нет обоих контейнеров — не ломаемся, просто не покажем кнопки
  if(hasImage){
    setChoiceMode("image");
    mountChoiceButtons(scene.choices || [], choiceGrid || fallbackGrid);
  }else{
    setChoiceMode("fallback");
    mountChoiceButtons(scene.choices || [], fallbackGrid || choiceGrid);
  }

  // 4) effects (если controller не загрузился — просто пропустим)
  const effects = scene.effects || [];
  if(window.effectController && typeof window.effectController.run === "function"){
    await window.effectController.run(effects);
  }

  // 5) audio
  await applySceneAudio(scene);

  // 6) cinematic reveal
  await animateScenePresentation(hasImage);
}

// ===== START =====
async function startGame(){
  showLoadingScreen(true);
  try{
    const scene = await fetchScene();
    warmImageCacheDeferred();
    if(gameWrap) gameWrap.style.visibility = "visible";
    showLoadingScreen(false);
    await renderScene(scene);
  }catch(e){
    if(gameWrap) gameWrap.style.visibility = "visible";
    showLoadingScreen(false);
    setImageVisible(false);
    setChoiceMode("fallback");
    clearChoices();
    setSceneText("Не удалось загрузить данные игры.", "fallback");
    await animateScenePresentation(false);
  }

  const fromMenu = sessionStorage.getItem("cryotest_transition") === "1";
  if(fromMenu){
    sessionStorage.removeItem("cryotest_transition");
    if(overlayEl) await coldFadeOut(260);
  }else{
    if(overlayEl) overlayEl.style.opacity = "0";
  }
}

async function handleAudioChoice(enable){
  setSoundEnabled(enable);
  if(audioModal) audioModal.style.display = "none";

  await initAudio();
  if(enable){
    hardMute(false);
    await startGameAmbience();
  }else{
    hardMute(true);
  }

  syncSoundButtonUI();
  await startGame();
}

async function init(){
  const saved = localStorage.getItem(SOUND_KEY);

  const fromMenu = sessionStorage.getItem("cryotest_transition") === "1";
  if(fromMenu && overlayEl){
    overlayEl.style.transitionDuration = "0ms";
    overlayEl.style.opacity = "1";
  }

  syncSoundButtonUI();

  if(saved === null){
    if(audioModal) audioModal.style.display = "flex";
  }else{
    await initAudio();
    if(saved === "1"){
      hardMute(false);
      await startGameAmbience();
    }else{
      hardMute(true);
    }
    await startGame();
  }
}

if(audioYes) audioYes.onclick = () => handleAudioChoice(true);
if(audioNo)  audioNo.onclick  = () => handleAudioChoice(false);

init();
