/* BUILD_ID: CRYOTEST_APP_JS_2026-03-18_UI_MODULE_01 */

const SCENES_URL = "./scenes.json";
const GAME_STATE_KEY = "cryotest_game_state_v1";

// ===== DOM (UI stage layout) =====
const sceneTextWrap = document.getElementById("sceneTextWrap");
const sceneText = document.getElementById("sceneText");

const sceneModule = document.getElementById("sceneModule");
const sceneImageWrap = document.getElementById("sceneImageWrap");
const sceneImageEl = document.getElementById("sceneImage");

const choiceDock = document.getElementById("choiceDock");
const choiceGrid = document.getElementById("choiceGrid");

const fallbackDock = document.getElementById("fallbackDock");
const fallbackGrid = document.getElementById("fallbackGrid");

const audioModal = document.getElementById("audioModal");
const audioTitle = document.querySelector(".audioTitle");
const audioTextEl = document.querySelector(".audioText");
const audioYes = document.getElementById("audioYes");
const audioNo = document.getElementById("audioNo");

const gameWrap = document.getElementById("gameWrap");

const soundBtn = document.getElementById("soundBtn");
const soundBtnLabel = soundBtn ? soundBtn.querySelector("span:last-child") : null;
const menuLink = document.querySelector(".hudLink");
const hudSystemLabel = document.getElementById("hudSystemLabel");
const hudSystemValue = document.getElementById("hudSystemValue");
const overlayEl = document.getElementById("overlay");
const buildEl = document.getElementById("buildId");
const sceneLoadingEl = document.getElementById("sceneLoading");
const sceneLoadingBarFill = document.getElementById("sceneLoadingBarFill");
const sceneLoadingLabel = document.getElementById("sceneLoadingLabel");

if (buildEl) buildEl.textContent = "BUILD_ID: CRYOTEST_APP_JS_2026-03-18_UI_MODULE_01";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const TEXT_REVEAL_MS = 5000;
const IMAGE_REVEAL_MS = 10000;
const CHOICE_REVEAL_MS = 5000;
let currentSceneLayout = "landscape";

if(soundBtnLabel) soundBtnLabel.textContent = "Звук";
if(menuLink) menuLink.textContent = "Меню";
if(audioTitle) audioTitle.textContent = "AUDIO CHANNEL";
if(audioTextEl) audioTextEl.textContent = "Включить атмосферу?";
if(audioYes) audioYes.textContent = "Вкл";
if(audioNo) audioNo.textContent = "Выкл";

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

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max);
}

function normalizeUiString(value){
  return typeof value === "string" ? value.trim() : "";
}

function getSceneUiConfig(scene){
  const meta = scene?.meta || {};
  const ui = meta.ui || {};
  return { meta, ui };
}

function resolveSceneLayout(scene, width = 0, height = 0){
  const { meta, ui } = getSceneUiConfig(scene);
  const rawLayout = normalizeUiString(
    ui.layout || meta.layout || scene?.layout || scene?.orientation
  ).toLowerCase();

  if(["portrait", "vertical"].includes(rawLayout)){
    return "portrait";
  }
  if(["landscape", "horizontal"].includes(rawLayout)){
    return "landscape";
  }

  if(width > 0 && height > 0){
    return height > width ? "portrait" : "landscape";
  }

  return "landscape";
}

function applySceneLayout(layout){
  currentSceneLayout = layout === "portrait" ? "portrait" : "landscape";
  if(!sceneModule) return;
  sceneModule.classList.toggle("layout-portrait", currentSceneLayout === "portrait");
  sceneModule.classList.toggle("layout-landscape", currentSceneLayout === "landscape");
}

function updateSceneHud(scene){
  const { meta, ui } = getSceneUiConfig(scene);
  const hud = ui.hud || meta.hud || {};
  const cycle = gameState?.cycle || meta.cycle || scene?.cycle || 1;
  const defaultValue = meta.ended ? "SESSION END" : `CYCLE ${cycle}`;

  safeSetText(hudSystemLabel, normalizeUiString(hud.label) || "AURIGA-8");
  safeSetText(hudSystemValue, normalizeUiString(hud.value) || defaultValue);
}

function sanitizeChoiceVariant(variant){
  return normalizeUiString(variant).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function getChoiceUiConfig(choice){
  const ui = choice?.ui || choice?.button || choice?.appearance || {};
  const position = ui.position || {};

  const x = Number(position.x ?? ui.x);
  const y = Number(position.y ?? ui.y);
  const order = Number(ui.order);
  const align = normalizeUiString(position.align || ui.align).toLowerCase();

  return {
    variant: sanitizeChoiceVariant(ui.variant),
    icon: normalizeUiString(ui.icon),
    borderColor: normalizeUiString(ui.borderColor || ui.color),
    background: normalizeUiString(ui.background),
    textColor: normalizeUiString(ui.textColor || ui.foreground),
    order: Number.isFinite(order) ? order : null,
    align: ["start", "center", "end"].includes(align) ? align : "",
    x: Number.isFinite(x) ? clamp(x, 0, 100) : null,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : null,
  };
}

function resetChoiceGridPresentation(grid){
  if(!grid) return;
  grid.classList.remove("choiceGrid--freeform");
  grid.style.minHeight = "";
  delete grid.dataset.layout;
}

function applyChoiceButtonPresentation(btn, choiceUi){
  if(!btn) return;

  if(choiceUi.variant){
    btn.classList.add(`choiceBtn--${choiceUi.variant}`);
  }

  if(choiceUi.order !== null){
    btn.style.order = String(choiceUi.order);
  }

  if(choiceUi.borderColor){
    btn.style.setProperty("--choice-border", choiceUi.borderColor);
    btn.style.setProperty("--choice-shadow", choiceUi.borderColor);
  }

  if(choiceUi.background){
    btn.style.setProperty("--choice-bg", choiceUi.background);
  }

  if(choiceUi.textColor){
    btn.style.setProperty("--choice-fg", choiceUi.textColor);
  }

  if(choiceUi.x !== null || choiceUi.y !== null){
    btn.classList.add("is-floating");
    btn.style.setProperty("--choice-x", `${choiceUi.x ?? 50}%`);
    btn.style.setProperty("--choice-y", `${choiceUi.y ?? 50}%`);
    if(choiceUi.align){
      btn.dataset.choiceAlign = choiceUi.align;
    }
  }
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
      text: `\u0422\u0415\u0421\u0422 \u0417\u0410\u0412\u0415\u0420\u0428\u0401\u041d.\n\u041e\u0431\u044a\u0435\u043a\u0442: \u041a\u043b\u043e\u043d \u211647.\n\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435: ${roleFromDom(dominant)}`,
      effects: ["sterile_silence", "light_white"],
      choices: [
        { text: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c", next: "system_restart", delta: {} }
      ],
      meta: { ended: true, dominant, stats: gameState.stats },
    };
  }

  if(sceneId === "system_restart"){
    return {
      id: "system_restart",
      cycle: gameState.cycle,
      text: "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439.",
      effects: ["flash_subtle"],
      choices: [
        { text: "\u041d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e", next: "system_reset_full", delta: {} }
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
  master.gain.value = 0; // СЃС‚Р°СЂС‚СѓРµРј СЃ 0, РїРѕРґРЅРёРјРµРј РµСЃР»Рё Р·РІСѓРє РІРєР»СЋС‡РµРЅ
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

// РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅС‹Р№ РіР»РѕР±Р°Р»СЊРЅС‹Р№ mute/unmute
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
  [soundBtn].forEach((btn)=>{
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
function setSceneText(text){
  const t = (text || "").trim();

  safeHide(sceneTextWrap);
  safeSetText(sceneText, "");

  if(!t) return;

  safeSetText(sceneText, t);
  safeShow(sceneTextWrap, "block");
}

function resetScenePresentation(){
  if(choiceDock){
    choiceDock.classList.remove("is-visible");
  }

  [sceneTextWrap].forEach((el) => {
    if(!el) return;
    el.classList.remove("is-visible");
  });

  [sceneText].forEach((el) => {
    if(!el) return;
    el.classList.remove("is-visible", "is-revealing", "is-glitching");
    el.style.animation = "none";
    el.textContent = "";
  });

  if(sceneImageWrap){
    sceneImageWrap.classList.remove("is-visible");
  }

  [choiceGrid, fallbackGrid].forEach(resetChoiceGridPresentation);

  if(fallbackGrid){
    fallbackGrid.style.opacity = "";
    fallbackGrid.style.transform = "";
    fallbackGrid.style.transition = "";
  }
}

function setImageVisible(on){
  if(!sceneImageWrap) return;
  sceneImageWrap.style.display = on ? "flex" : "none";
}

function setChoiceMode(mode){
  const inImage = (mode === "image");

  if(choiceDock) choiceDock.style.display = inImage ? "flex" : "none";
  if(fallbackDock) fallbackDock.style.display = inImage ? "none" : "flex";
}

function clearChoices(){
  [choiceGrid, fallbackGrid].forEach((grid) => {
    if(!grid) return;
    grid.innerHTML = "";
    resetChoiceGridPresentation(grid);
  });
}

function makeChoiceButton(c, idx){
  const choiceUi = getChoiceUiConfig(c);
  const btn = document.createElement("button");
  btn.className = "choiceBtn";
  btn.type = "button";

  if(choiceUi.icon){
    const icon = document.createElement("span");
    icon.className = "choiceBtn__icon";
    icon.textContent = choiceUi.icon;
    btn.appendChild(icon);
  }

  const label = document.createElement("span");
  label.className = "choiceBtn__label";
  label.textContent = c.text;
  btn.appendChild(label);

  applyChoiceButtonPresentation(btn, choiceUi);

  btn.onclick = async () => {
    await playClick();

    // РµСЃР»Рё overlay РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ вЂ” РїСЂРѕСЃС‚Рѕ Р±РµР· С„РµР№РґР°
    if(overlayEl) await coldFadeIn(170);

    const next = await choose(idx);
    await renderScene(next);

    if(overlayEl) await coldFadeOut(240);
  };

  return btn;
}

function mountChoiceButtons(choices, targetGrid){
  if(!targetGrid) return;
  const resolvedChoices = Array.isArray(choices) ? choices : [];
  const hasFloatingButtons = resolvedChoices.some((choice) => {
    const choiceUi = getChoiceUiConfig(choice);
    return choiceUi.x !== null || choiceUi.y !== null;
  });

  targetGrid.dataset.layout = currentSceneLayout;
  targetGrid.classList.toggle("choiceGrid--freeform", hasFloatingButtons);

  resolvedChoices.forEach((c, idx) => {
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
  const defaultLayout = resolveSceneLayout(scene);
  if(img && sceneImageEl){
    const src = getSceneImageSrc(scene);
    await preloadImage(src);
    sceneImageEl.classList.remove("is-portrait", "is-landscape");
    sceneImageEl.onload = () => {
      setImageOrientationClass(sceneImageEl.naturalWidth, sceneImageEl.naturalHeight);
      applySceneLayout(resolveSceneLayout(scene, sceneImageEl.naturalWidth, sceneImageEl.naturalHeight));
      forceImageFloat();
    };
    sceneImageEl.src = src;
    setImageVisible(true);
    applySceneLayout(defaultLayout);

    if(sceneImageEl.complete){
      setImageOrientationClass(sceneImageEl.naturalWidth, sceneImageEl.naturalHeight);
      applySceneLayout(resolveSceneLayout(scene, sceneImageEl.naturalWidth, sceneImageEl.naturalHeight));
      forceImageFloat();
    }
    return true;
  }
  applySceneLayout(defaultLayout);
  setImageVisible(false);
  return false;
}

async function animateScenePresentation(hasImage){
  const activeTextWrap = sceneTextWrap;
  const activeText = sceneText;
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
    sceneLoadingLabel.textContent = "COGNITIVE MATRIX CALIBRATION";
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
  updateSceneHud(scene);

  // 1) image
  const hasImage = await renderSceneImage(scene);
  preloadUpcomingImages(scene);

  // 2) text
  setSceneText(scene.text || "");

  // 3) choices
  clearChoices();

  // РµСЃР»Рё РІРґСЂСѓРі РЅРµС‚ РѕР±РѕРёС… РєРѕРЅС‚РµР№РЅРµСЂРѕРІ вЂ” РЅРµ Р»РѕРјР°РµРјСЃСЏ, РїСЂРѕСЃС‚Рѕ РЅРµ РїРѕРєР°Р¶РµРј РєРЅРѕРїРєРё
  if(hasImage){
    setChoiceMode("image");
    mountChoiceButtons(scene.choices || [], choiceGrid || fallbackGrid);
  }else{
    setChoiceMode("fallback");
    mountChoiceButtons(scene.choices || [], fallbackGrid || choiceGrid);
  }

  // 4) effects (РµСЃР»Рё controller РЅРµ Р·Р°РіСЂСѓР·РёР»СЃСЏ вЂ” РїСЂРѕСЃС‚Рѕ РїСЂРѕРїСѓСЃС‚РёРј)
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
    updateSceneHud({ meta: { hud: { value: "SYSTEM ERROR" } } });
    setSceneText("Failed to load game data.");
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

