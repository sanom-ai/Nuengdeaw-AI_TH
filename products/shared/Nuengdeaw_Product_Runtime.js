// ===== BEGIN Nuengdeaw_Standard_Loader.js =====

'use strict';

const NuengdeawStandardLoader = (() => {
  const DEFAULT_PATH = '../shared/phasa-tawan-foundation.json';
  let _promise = null;

  async function _load() {
    if (window.NuengdeawStandard) return window.NuengdeawStandard;
    const path = window.NUENGDEAW_STANDARD_PATH || DEFAULT_PATH;
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      window.NuengdeawStandard = data?.central_standard ?? data;
      if (typeof window.refreshNuengdeawStandardBindings === 'function') {
        window.refreshNuengdeawStandardBindings();
      }
      if (typeof window.logSys === 'function') window.logSys(`StandardLoader: loaded ${path}`);
      return data;
    } catch (error) {
      window.NuengdeawStandard = null;
      const msg = `StandardLoader: fallback mode (${error.message})`;
      if (typeof window.logSys === 'function') window.logSys(msg);
      else console.warn('[Nuengdeaw]', msg);
      return null;
    }
  }

  return {
    ready() {
      _promise ??= _load();
      return _promise;
    },
    reset() {
      _promise = null;
      delete window.NuengdeawStandard;
    },
  };
})();

window.NuengdeawStandardLoader = NuengdeawStandardLoader;

// ===== END Nuengdeaw_Standard_Loader.js =====

// ===== BEGIN Nuengdeaw_Core.js =====

/**
 * ---
 * ║  Nuengdeaw Core — The Real AI Bridge                           ║
 * ║  =============================================================  ║
 * ║                                                                  ║
 * ║  🧠 บทบาท: น้อง AI ตัวจริง                                      ║
 * ║                                                                  ║
 * ║  ทำหน้าที่:                                                      ║
 * ---
 * ║    2. ตีความ biosignal → emotional states (14 states)           ║
 * ---
 * ║    4. audio/voice feedback, spaced repetition (SRS)             ║
 * ║                                                                  ║
 * ║  🔗 ไม่สนใจว่า data source คืออะไร:                              ║
 * ---
 * ║     • HumanSim.js (จำลองมนุษย์) — ปัจจุบัน                       ║
 * ║                                                                  ║
 * ---
 * ║     • Gen1 (BioSignal) — ระบบอ่านหนังสือ                        ║
 * ║     • Gen2 (NeuroSignal) — ระบบอ่านหนังสือ                      ║
 * ║     • Gen3, Gen4, ... (ผลิตภัณฑ์ในอนาคต)                        ║
 * ║                                                                  ║
 * ---
 */

'use strict';

// ---
// AUTHOR
// ---
const NUENGDEAW_AUTHOR  = 'NuengdeawAI v0.0 — Bridge & Engine Architecture by Tawan (2026)';
const NUENGDEAW_CREDIT = Object.freeze({
  name:      'น้องหนึ่งเดียว',
  dev:       'ตะวัน',
  year:      2026,
  signature: 'น้องหนึ่งเดียวพัฒนาโดยตะวัน2026',
  verify()   { return btoa(unescape(encodeURIComponent(this.signature))); },
});
Object.defineProperty(window, 'NUENGDEAW_CREDIT', {
  value:        NUENGDEAW_CREDIT,
  writable:     false,
  configurable: false,
  enumerable:   true,
});

// ---
// logSys — shared debug logger
// ---
function logSys(msg) {
  const ts   = new Date().toLocaleTimeString('th-TH', { hour12: false });
  const line = `[${ts}] ${msg}`;
  const el   = document.getElementById('sys-log');
  if (el) {
    el.textContent = (el.textContent + '\n' + line).split('\n').slice(-120).join('\n');
    el.scrollTop   = el.scrollHeight;
  }
  console.log('[Nuengdeaw]', msg);
}
window.logSys = logSys;

// ---
// STORAGE MANAGER — namespace wrapper, replaces raw localStorage
// ---
const StorageManager = {
  _p: 'nuengdeaw_',
  KEYS: Object.freeze({
    SESSIONS:      'sessions',
    READER:        'reader_sessions',
    SRS:           'srs',
    EMPATHY:       'empathy_profile',
    PROTECTION:    'protection',
    TRANSPARENCY:  'transparency_log',
    STREAK:        'streak',
    ACHIEVEMENTS:  'achievements',
    ABTESTS:       'abtests',
    MODEL:         'model_',          // prefix for ModelPortability
    CONSENT:       'consent',
    ADMIN_PIN:     'admin_pin',       // [FIX] PIN สำหรับ Admin access ใน index.html
  }),
  get(key)         { try { return localStorage.getItem(this._p + key); } catch { return null; } },
  set(key, val)    { try { localStorage.setItem(this._p + key, typeof val === 'string' ? val : JSON.stringify(val)); } catch {} },
  remove(key)      { try { localStorage.removeItem(this._p + key); } catch {} },
  getJSON(key, fb) { try { return JSON.parse(this.get(key) ?? 'null') ?? fb; } catch { return fb; } },
  setJSON(key, v)  { this.set(key, JSON.stringify(v)); },
  clearAll()       {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this._p))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};
window.StorageManager = StorageManager;

const DEFAULT_STANDARD_RUNTIME = Object.freeze({
  runtime_profiles: {
    sensor_fusion_states: [
      'FLOW', 'READY', 'STRESS', 'CONFUSION', 'BOREDOM', 'EXCITEMENT', 'FATIGUE',
      'NEUTRAL', 'FRUSTRATION', 'ANXIETY', 'CURIOSITY', 'DISGUST', 'SURPRISE', 'CALM',
    ],
    gen1_rules: [
      { id:'NL-001', priority:1, state:'FLOW',        action:'ACT.MAINTAIN',  condition:'z.hrv > 1.2 && z.hr < -0.8 && z.gsr < -0.5' },
      { id:'NL-004', priority:1, state:'STRESS',      action:'ACT.BREAK',     condition:'z.hrv < -1.5 && z.hr > 1.8 && z.gsr > 2.0' },
      { id:'NL-002', priority:2, state:'CONFUSION',   action:'ACT.SIMPLIFY',  condition:'v.eeg > 2.0 && z.hrv < -0.7 && z.hr > 1.2' },
      { id:'NL-003', priority:2, state:'READY',       action:'ACT.ANCHOR',    condition:'z.hrv > 1.8 && z.hr < -1.2 && z.gsr < -1.0 && v.eeg < 0.7' },
      { id:'NL-005', priority:3, state:'BOREDOM',     action:'ACT.SUMMARIZE', condition:'z.gsr > 1.8 && z.hr < -0.5 && z.hrv > -0.5 && z.hrv < 0.5' },
      { id:'NL-006', priority:3, state:'EXCITEMENT',  action:'ACT.ENRICH',    condition:'z.hr > 1.2 && z.gsr > 1.2 && z.hrv > -1.0 && z.hrv < 0.5' },
      { id:'NL-007', priority:2, state:'FATIGUE',     action:'ACT.BREAK',     condition:'z.hrv < -0.8 && Math.abs(z.hr) < 0.5 && v.eeg > 1.2 && v.eeg < 2.0' },
      { id:'NL-008', priority:4, state:'NEUTRAL',     action:'ACT.MAINTAIN',  condition:'Math.abs(z.hrv) < 0.4 && Math.abs(z.hr) < 0.4 && Math.abs(z.gsr) < 0.4' },
      { id:'NL-009', priority:5, state:'NEUTRAL',     action:'ACT.MAINTAIN',  condition:'Math.max(Math.abs(z.hrv), Math.abs(z.hr), Math.abs(z.gsr), Math.abs(z.rr)) < 0.6' },
      { id:'NL-010', priority:1, state:'FRUSTRATION', action:'ACT.REFRAME',   condition:'z.hrv < -1.8 && z.hr > 2.0 && z.gsr > 2.5' },
      { id:'NL-011', priority:1, state:'ANXIETY',     action:'ACT.GROUND',    condition:'z.hrv < -2.0 && z.hr > 2.2 && z.gsr > 2.0 && z.rr > 1.5' },
      { id:'NL-012', priority:3, state:'CURIOSITY',   action:'ACT.EXPLORE',   condition:'z.hr > 0.5 && Math.abs(z.gsr) < 0.8 && z.hrv > 0.3' },
      { id:'NL-013', priority:3, state:'DISGUST',     action:'ACT.REDIRECT',  condition:'z.hrv < -1.0 && z.gsr > 1.5 && Math.abs(z.hr) > 0.8' },
      { id:'NL-014', priority:2, state:'SURPRISE',    action:'ACT.STABILIZE', condition:'z.hr > 2.0 && z.gsr > 2.0 && z.hrv > -0.5' },
      { id:'NL-015', priority:4, state:'CALM',        action:'ACT.SUSTAIN',   condition:'z.hrv > 2.0 && z.hr < -1.5 && z.gsr < -1.5' }
    ],
    gen2_rules: [
      { id:'NL-001', priority:1, state:'FLOW',        action:'ACT.MAINTAIN',  condition:'z.hrv > 1.2 && z.hr < -0.8 && z.gsr < -0.5 && (b?.alpha ?? 0) > 1.5' },
      { id:'NL-004', priority:1, state:'STRESS',      action:'ACT.BREAK',     condition:'z.hrv < -1.5 && z.hr > 1.8 && z.gsr > 2.0' },
      { id:'NL-002', priority:2, state:'CONFUSION',   action:'ACT.SIMPLIFY',  condition:'v.eeg > 2.0 && z.hrv < -0.7 && z.hr > 1.2 && (b?.thetaAlphaRatio ?? 1) > 1.5' },
      { id:'NL-003', priority:2, state:'READY',       action:'ACT.ANCHOR',    condition:'z.hrv > 1.8 && z.hr < -1.2 && z.gsr < -1.0 && v.eeg < 0.7 && (b?.alpha ?? 0) > 1.2' },
      { id:'NL-005', priority:3, state:'BOREDOM',     action:'ACT.SUMMARIZE', condition:'z.gsr > 1.8 && z.hr < -0.5 && z.hrv > -0.5 && z.hrv < 0.5' },
      { id:'NL-006', priority:3, state:'EXCITEMENT',  action:'ACT.ENRICH',    condition:'z.hr > 1.2 && z.gsr > 1.2 && z.hrv > -1.0 && z.hrv < 0.5' },
      { id:'NL-007', priority:2, state:'FATIGUE',     action:'ACT.BREAK',     condition:'z.hrv < -0.8 && Math.abs(z.hr) < 0.5 && v.eeg > 1.2 && v.eeg < 2.0 && (b?.theta ?? 0) > 1.5' },
      { id:'NL-008', priority:4, state:'NEUTRAL',     action:'ACT.MAINTAIN',  condition:'Math.abs(z.hrv) < 0.4 && Math.abs(z.hr) < 0.4 && Math.abs(z.gsr) < 0.4' },
      { id:'NL-009', priority:5, state:'NEUTRAL',     action:'ACT.MAINTAIN',  condition:'Math.max(Math.abs(z.hrv), Math.abs(z.hr), Math.abs(z.gsr), Math.abs(z.rr)) < 0.6' },
      { id:'NL-010', priority:1, state:'FRUSTRATION', action:'ACT.REFRAME',   condition:'z.hrv < -1.8 && z.hr > 2.0 && z.gsr > 2.5 && (b?.thetaAlphaRatio ?? 1) > 2.0' },
      { id:'NL-011', priority:1, state:'ANXIETY',     action:'ACT.GROUND',    condition:'z.hrv < -2.0 && z.hr > 2.2 && z.rr > 1.5 && (b?.beta ?? 0) > 2.5' },
      { id:'NL-012', priority:3, state:'CURIOSITY',   action:'ACT.EXPLORE',   condition:'z.hr > 0.5 && Math.abs(z.gsr) < 0.8 && z.hrv > 0.3 && (b?.gamma ?? 0) > 1.2 && (b?.theta ?? 0) > 1.0' },
      { id:'NL-013', priority:3, state:'DISGUST',     action:'ACT.REDIRECT',  condition:'z.hrv < -1.0 && z.gsr > 1.5 && Math.abs(z.hr) > 0.8 && (b?.beta ?? 0) > 1.5' },
      { id:'NL-014', priority:2, state:'SURPRISE',    action:'ACT.STABILIZE', condition:'z.hr > 2.0 && z.gsr > 2.0 && z.hrv > -0.5 && (b?.gamma ?? 0) > 1.5' },
      { id:'NL-015', priority:4, state:'CALM',        action:'ACT.SUSTAIN',   condition:'z.hrv > 2.0 && z.hr < -1.5 && z.gsr < -1.5 && (b?.alpha ?? 0) > 2.0 && (b?.beta ?? 0) < 0.8' }
    ]
  },
});

function getNuengdeawStandard() {
  return window.NuengdeawStandard ?? DEFAULT_STANDARD_RUNTIME;
}

function getNuengdeawRuntimeProfiles() {
  return getNuengdeawStandard().runtime_profiles ?? DEFAULT_STANDARD_RUNTIME.runtime_profiles;
}

function getNuengdeawSensorFusionStates() {
  return [...(getNuengdeawRuntimeProfiles().sensor_fusion_states ?? DEFAULT_STANDARD_RUNTIME.runtime_profiles.sensor_fusion_states)];
}

const RULE_CONDITION_ALLOWLIST_RE = /^[\w\s.$()[\]?+\-*/%<>=!&|,:]+$/;
const RULE_CONDITION_BLOCKLIST_RE = /\b(?:constructor|prototype|__proto__|window|document|globalThis|self|Function|eval|fetch|XMLHttpRequest|WebSocket|import|export|require|process|this|new)\b/i;
const RULE_CONDITION_ASSIGNMENT_RE = /(^|[^=!<>])=($|[^=])/;

function _isSafeRuleCondition(condition) {
  if (!RULE_CONDITION_ALLOWLIST_RE.test(condition)) {
    return { ok: false, reason: 'contains_non_allowlisted_chars' };
  }
  if (RULE_CONDITION_BLOCKLIST_RE.test(condition)) {
    return { ok: false, reason: 'contains_blocked_keyword' };
  }
  if (RULE_CONDITION_ASSIGNMENT_RE.test(condition)) {
    return { ok: false, reason: 'contains_assignment_operator' };
  }
  return { ok: true, reason: 'ok' };
}

function _compileStandardRule(rule, argNames) {
  const condition = typeof rule?.condition === 'string' ? rule.condition.trim() : '';
  if (!condition) return () => false;
  const safe = _isSafeRuleCondition(condition);
  if (!safe.ok) {
    logSys(`Standard rule blocked [${rule?.id ?? 'unknown'}]: ${safe.reason}`);
    return () => false;
  }
  try {
    return new Function(...argNames, `return (${condition});`);
  } catch (error) {
    logSys(`Standard rule compile failed [${rule?.id ?? 'unknown'}]: ${error.message}`);
    return () => false;
  }
}

function buildRulesFromStandard(profileKey, argNames) {
  const rules = getNuengdeawRuntimeProfiles()[profileKey];
  if (!Array.isArray(rules)) return [];
  return rules.map(rule => ({ ...rule, cond: _compileStandardRule(rule, argNames) }));
}

window.getNuengdeawStandard = getNuengdeawStandard;
window.getNuengdeawRuntimeProfiles = getNuengdeawRuntimeProfiles;
window.getNuengdeawSensorFusionStates = getNuengdeawSensorFusionStates;
window.buildRulesFromStandard = buildRulesFromStandard;

// ---
// STATE METADATA — 14 states (original 8 + 6 from HumanSim v0.0)
// ---
let STATE_META = Object.freeze({
  FLOW:        { emoji: '🎯', name: 'Flow State',      ps: 'PS.FLOW',        cls: 'active-flow',        color: 'var(--accent-cyan)'   },
  READY:       { emoji: '🧠', name: 'พร้อมจดจำ',        ps: 'PS.ENCODING',    cls: 'active-ready',       color: 'var(--accent-green)'  },
  STRESS:      { emoji: '😰', name: 'เครียด/Overload',  ps: 'PS.OVERLOAD',    cls: 'active-stress',      color: 'var(--accent-red)'    },
  CONFUSION:   { emoji: '😵', name: 'สับสน',             ps: 'PS.CONFUSION',   cls: 'active-confusion',   color: 'var(--accent-red)'    },
  BOREDOM:     { emoji: '😴', name: 'เบื่อ',              ps: 'PS.BOREDOM',     cls: 'active-boredom',     color: 'var(--accent-amber)'  },
  EXCITEMENT:  { emoji: '⚡', name: 'ตื่นเต้น',           ps: 'PS.EXCITEMENT',  cls: 'active-excitement',  color: 'var(--accent-purple)' },
  FATIGUE:     { emoji: '😪', name: 'ล้า/Fatigue',       ps: 'PS.DROWSY',      cls: 'active-fatigue',     color: 'var(--accent-slate)'  },
  NEUTRAL:     { emoji: '😐', name: 'ปกติ',                ps: 'PS.NEUTRAL',     cls: '',                   color: 'var(--text)'          },
  IDLE:        { emoji: '⏳', name: 'รอเริ่มต้น',         ps: 'PS.IDLE',        cls: '',                   color: 'var(--text-dim)'      },
  // ---
  FRUSTRATION: { emoji: '😤', name: 'หงุดหงิด',           ps: 'PS.FRUSTRATION', cls: 'active-frustration', color: 'var(--accent-orange)' },
  ANXIETY:     { emoji: '😟', name: 'วิตกกังวล',            ps: 'PS.ANXIETY',     cls: 'active-anxiety',     color: 'var(--accent-red)'    },
  CURIOSITY:   { emoji: '🤔', name: 'อยากรู้',              ps: 'PS.CURIOSITY',   cls: 'active-curiosity',   color: 'var(--accent-teal)'   },
  DISGUST:     { emoji: '😒', name: 'รังเกียจ',            ps: 'PS.DISGUST',     cls: 'active-disgust',     color: 'var(--accent-slate)'  },
  SURPRISE:    { emoji: '😲', name: 'ประหลาดใจ',           ps: 'PS.SURPRISE',    cls: 'active-surprise',    color: 'var(--accent-yellow)' },
  CALM:        { emoji: '😌', name: 'สงบ',                 ps: 'PS.CALM',        cls: 'active-calm',        color: 'var(--accent-green)'  },
});

function refreshNuengdeawStandardBindings() {
  const runtime = (window.NuengdeawStandard?.runtime_profiles?.state_meta) ?? null;
  if (runtime) STATE_META = Object.freeze(runtime);
  window.STATE_META = STATE_META;
  return STATE_META;
}
window.refreshNuengdeawStandardBindings = refreshNuengdeawStandardBindings;
window.STATE_META = STATE_META;

// ---
// PROTECTION LAYER
// ---
const ProtectionLayer = {
  _LEARNING: new Set(['FLOW', 'READY', 'CONFUSION', 'EXCITEMENT']),
  _OFF_TOPIC_LIMIT: 10 * 60 * 1000,  // 10 min
  _COMFORT_WINDOW:  30 * 60 * 1000,  // 30 min rolling
  _COMFORT_THRESH:  7,
  _REFERRAL_CD:     20 * 60 * 1000,  // 20 min

  _load()  { return StorageManager.getJSON(StorageManager.KEYS.PROTECTION, this._defaults()); },
  _save(d) { StorageManager.setJSON(StorageManager.KEYS.PROTECTION, d); },
  _defaults: () => ({
    sessionStartTs:   null,
    comfortSpikes:    [],
    attachmentScore:  0,
    mirrorModeActive: false,
    offTopicStart:    null,
    offTopicMs:       0,
    lastReferral:     0,
  }),

  tickState(state) {
    const d = this._load(), now = Date.now();
    const isLearning = this._LEARNING.has(state);
    if (!isLearning) {
      d.offTopicStart ??= now;
      d.offTopicMs = now - d.offTopicStart;
    } else {
      d.offTopicStart = null;
      d.offTopicMs    = 0;
    }
    this._save(d);
    return (!isLearning && d.offTopicMs > this._OFF_TOPIC_LIMIT) ? 'overuse_timeout' : null;
  },

  recordComfortEngagement() {
    const d = this._load(), now = Date.now();
    d.comfortSpikes = (d.comfortSpikes ?? []).filter(t => now - t < this._COMFORT_WINDOW);
    d.comfortSpikes.push(now);
    d.attachmentScore  = Math.min(1, d.comfortSpikes.length / (this._COMFORT_THRESH + 1));
    d.mirrorModeActive = d.comfortSpikes.length >= this._COMFORT_THRESH;
    this._save(d);
    return { attachmentScore: d.attachmentScore, mirrorMode: d.mirrorModeActive };
  },

  isMirrorMode() { return this._load().mirrorModeActive; },

  gate(empathy, bioSnap = {}) {
    if (!empathy) return null;
    this._logDecision(empathy, bioSnap);
    const d = this._load();
    if (d.mirrorModeActive) {
      return { ...empathy, type: 'mirror_data', message: this._mirrorMsg(bioSnap), action: 'mirror', _gated: 'mirror_mode' };
    }
    if (d.offTopicMs > this._OFF_TOPIC_LIMIT) {
      const ref = this._referralMsg(d);
      if (ref) { this._save(d); return { ...empathy, type: 'referral', message: ref, action: 'refer_human', _gated: 'overuse_timeout' }; }
    }
    return empathy;
  },

  _MIRROR_TPLS: [
    'HRV {hrv}ms, HR {hr}bpm - ระบบพบรูปแบบนี้จากสัญญาณเท่านั้น ยังไม่ใช่การเข้าใจความรู้สึกทั้งหมดของคุณ',
    'ความเชื่อมั่น {conf} - ระบบกำลังประเมินสถานะ {state} จาก biosignal โดยตรง โปรดใช้ข้อมูลนี้เป็นตัวช่วยดูแนวโน้ม',
    'HRV {hrv}ms - ตอนนี้สมองอาจต้องการข้อมูลใหม่หรือช่วงพักสั้น ๆ มากกว่าข้อความปลอบจากระบบ',
    'Signal snapshot: HRV {hrv}, HR {hr} - ถ้าค่าชุดนี้ทำให้กังวล ลองคุยกับคนที่ไว้ใจได้จะเหมาะกว่า',
  ],
  _mirrorMsg({ hrv, hr, conf, state } = {}) {
    const t = this._MIRROR_TPLS[Math.floor(Math.random() * this._MIRROR_TPLS.length)];
    return t
      .replace('{hrv}',   hrv   != null ? (+hrv).toFixed(1)             : '—')
      .replace('{hr}',    hr    != null ? (+hr).toFixed(0)               : '—')
      .replace('{conf}',  conf  != null ? (conf * 100).toFixed(0) + '%'  : '—')
      .replace('{state}', state ?? '—');
  },

  _REFERRAL_MSGS: [
    'biosignal บอกว่าตอนนี้คุณอาจต้องการ social support จริง ๆ ลองโทรหาเพื่อนหรือคนใกล้ตัวแทนระบบนี้ได้เลย',
    'คุณ off-task มา {min} นาทีแล้ว ลองพักไปคุยกับใครสัก 15 นาทีอาจช่วย HRV ได้มากกว่าอยู่กับหน้าจอ',
    'ระบบตรวจพบรูปแบบที่ควรใช้ human connection มากกว่าการตอบกลับอัตโนมัติในตอนนี้',
  ],
  _referralMsg(d) {
    const now = Date.now();
    if (now - (d.lastReferral ?? 0) < this._REFERRAL_CD) return null;
    d.lastReferral = now;
    const min = Math.round((d.offTopicMs ?? 0) / 60_000);
    return this._REFERRAL_MSGS[Math.floor(Math.random() * this._REFERRAL_MSGS.length)].replace('{min}', min);
  },

  _logDecision(empathy, { hrv, hr, conf, rule, mlConf } = {}) {
    const log = StorageManager.getJSON(StorageManager.KEYS.TRANSPARENCY, []);
    log.unshift({
      ts:          Date.now(),
      type:        empathy.type,
      action:      empathy.action,
      triggeredBy: rule ? `rule:${rule}` : mlConf ? `ml:${(mlConf * 100).toFixed(0)}%` : `timer:${empathy.type}`,
      bio:         { hrv: hrv != null ? (+hrv).toFixed(1) : null, hr: hr != null ? (+hr).toFixed(0) : null },
      conf:        conf != null ? (conf * 100).toFixed(0) + '%' : null,
    });
    if (log.length > 60) log.pop();
    StorageManager.setJSON(StorageManager.KEYS.TRANSPARENCY, log);
  },

  getLog()    { return StorageManager.getJSON(StorageManager.KEYS.TRANSPARENCY, []); },

  renderDashboard(containerId = 'transparency-panel') {
    const log = this.getLog().slice(0, 8);
    const d   = this._load();
    let el    = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.style.cssText = 'position:fixed;bottom:0;left:0;width:300px;max-height:400px;overflow-y:auto;background:#0a0a14;border-top:1px solid #1e1e3a;border-right:1px solid #1e1e3a;border-radius:0 12px 0 0;padding:12px;z-index:8888;font-family:\'Sarabun\',monospace;font-size:11px;color:#6272a4;transition:transform 0.3s ease;';
      document.body.appendChild(el);
    }
    const attPct   = Math.round((d.attachmentScore ?? 0) * 100);
    const attColor = attPct >= 88 ? '#ff5555' : attPct >= 50 ? '#f1fa8c' : '#50fa7b';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:#f8f8f2;font-size:11px;font-weight:bold">⚙ Engine Transparency</span>
        <span style="font-size:9px;opacity:0.4">math + code เท่านั้น</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <div style="background:#11111f;border:1px solid #1e1e3a;border-radius:5px;padding:3px 7px;font-size:10px">
          <div style="opacity:0.5;margin-bottom:1px">Attachment</div>
          <div style="color:${attColor};font-weight:bold">${attPct}%</div>
        </div>
        <div style="background:#11111f;border:1px solid #1e1e3a;border-radius:5px;padding:3px 7px;font-size:10px">
          <div style="opacity:0.5;margin-bottom:1px">Mirror</div>
          <div style="color:${d.mirrorModeActive ? '#ff5555' : '#50fa7b'};font-weight:bold">${d.mirrorModeActive ? 'ON' : 'off'}</div>
        </div>
        <div style="background:#11111f;border:1px solid #1e1e3a;border-radius:5px;padding:3px 7px;font-size:10px">
          <div style="opacity:0.5;margin-bottom:1px">Off-task</div>
          <div style="color:#f1fa8c;font-weight:bold">${Math.round((d.offTopicMs ?? 0) / 60_000)}m</div>
        </div>
      </div>
      <div style="color:#44475a;font-size:9px;margin-bottom:6px;border-bottom:1px solid #1e1e3a;padding-bottom:4px">RECENT EMPATHY EVENTS</div>
      ${log.length === 0
        ? '<div style="opacity:0.3;text-align:center;padding:12px 0;font-size:10px">ยังไม่มี event</div>'
        : log.map(e => `<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #11111f">
            <div style="display:flex;gap:4px;align-items:center;margin-bottom:2px">
              <span style="background:#1e1e3a;border-radius:3px;padding:1px 4px;font-size:9px;color:#bd93f9">${e.type}</span>
              <span style="opacity:0.35;font-size:9px">${new Date(e.ts).toLocaleTimeString('th-TH', { hour12: false })}</span>
            </div>
            <div style="color:#50fa7b;font-size:9px">📡 ${e.triggeredBy}</div>
            <div style="color:#6272a4;font-size:9px">HRV:${e.bio?.hrv ?? '—'} HR:${e.bio?.hr ?? '—'} conf:${e.conf ?? '—'}</div>
          </div>`).join('')
      }`;
  },
};
window.ProtectionLayer = ProtectionLayer;

// ---
// METACOGNITIVE MONITOR — strategy effectiveness tracker
// ---
// ---
// ---
// ---
const MetacognitiveMonitor = {
  // ---
  _strategies: {
    simplify:          { success: 0, fail: 0 },  // confusion_prolonged
    inject_fun:        { success: 0, fail: 0 },  // boredom_tease
    breathing:         { success: 0, fail: 0 },  // fatigue_break
    nurture_suggest:   { success: 0, fail: 0 },  // stress_comfort
    anchor:            { success: 0, fail: 0 },  // flow_cheer
    anchor_voice:      { success: 0, fail: 0 },  // ready_anchor
    enrich:            { success: 0, fail: 0 },  // excitement_cheer
    mirror:            { success: 0, fail: 0 },  // mirror_data
    // ---
    reframe:           { success: 0, fail: 0 },  // frustration_comfort
    ground:            { success: 0, fail: 0 },  // anxiety_calm
    explore:           { success: 0, fail: 0 },  // curiosity_boost
    redirect:          { success: 0, fail: 0 },  // disgust_redirect
    stabilize:         { success: 0, fail: 0 },  // surprise_anchor
    deepen_calm:       { success: 0, fail: 0 },  // calm_sustain
  },

  // ---
  // action = empathy.action, liked = boolean
  recordOutcome(action, liked) {
    if (!action) return;
    this._strategies[action] ??= { success: 0, fail: 0 };
    if (liked) this._strategies[action].success++;
    else       this._strategies[action].fail++;
    logSys(`MetaCog: ${action} → ${liked ? '✓' : '✗'} (s=${this._strategies[action].success} f=${this._strategies[action].fail})`);
  },

  // ---
  // ---
  isHumanNeeded(threshold = 2) {
    return Object.values(this._strategies).some(
      s => s.fail >= threshold && s.success === 0
    );
  },

  // ---
  // ---
  getBestAction(candidates = []) {
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => {
      const sa = this._strategies[a] ?? { success: 0, fail: 0 };
      const sb = this._strategies[b] ?? { success: 0, fail: 0 };
      const ra  = sa.success / (sa.success + sa.fail + 1);
      const rb  = sb.success / (sb.success + sb.fail + 1);
      return rb - ra;
    })[0];
  },

  // สรุป stats ทั้งหมด สำหรับ debug / dashboard
  getSummary() {
    return Object.entries(this._strategies).map(([action, s]) => ({
      action,
      success: s.success,
      fail:    s.fail,
      rate:    s.success + s.fail > 0
        ? ((s.success / (s.success + s.fail)) * 100).toFixed(0) + '%'
        : '—',
    }));
  },

  // reset เมื่อเริ่ม session ใหม่
  reset() {
    Object.keys(this._strategies).forEach(k => {
      this._strategies[k] = { success: 0, fail: 0 };
    });
    logSys('MetaCog: reset');
  },
};
window.MetacognitiveMonitor = MetacognitiveMonitor;

// ---
// EMPATHY PROFILE — adaptive style weights
// ---
const EmpathyProfile = {
  _cache: null, // in-memory cache, invalidated on save

  _defaults: () => ({
    styleWeights:    { tease: 0.5, comfort: 0.5, cheer: 0.5, anchor: 0.5 },
    feedbackHistory: [],
    nurtureMode:     false,
    nurtureUntil:    0,
  }),

  load() {
    if (this._cache) return this._cache;
    this._cache = { ...this._defaults(), ...(StorageManager.getJSON(StorageManager.KEYS.EMPATHY, {}) ?? {}) };
    return this._cache;
  },

  save(p) {
    this._cache = p;
    StorageManager.setJSON(StorageManager.KEYS.EMPATHY, p);
  },

  recordFeedback(type, feedback) {
    const p = this.load();
    p.feedbackHistory.push({ type, feedback, ts: Date.now() });
    if (p.feedbackHistory.length > 100) p.feedbackHistory.shift();
    const delta = feedback === 'liked' ? 0.05 : -0.04;
    const clamp = v => Math.max(0.1, Math.min(0.9, v));
    if (['boredom_tease', 'confusion_prolonged'].includes(type)) p.styleWeights.tease  = clamp((p.styleWeights.tease  ?? 0.5) + delta);
    else if (type === 'flow_cheer')                              p.styleWeights.cheer  = clamp((p.styleWeights.cheer  ?? 0.5) + delta);
    else if (type === 'ready_anchor')                            p.styleWeights.anchor = clamp((p.styleWeights.anchor ?? 0.5) + delta);
    else                                                         p.styleWeights.comfort = clamp((p.styleWeights.comfort ?? 0.5) + delta);
    // Nurture mode: liked stress_comfort 3+ times in 15 min
    const recentStress = p.feedbackHistory.filter(f => f.type === 'stress_comfort' && f.feedback === 'liked' && Date.now() - f.ts < 900_000);
    if (recentStress.length >= 3) { p.nurtureMode = true; p.nurtureUntil = Date.now() + 30 * 60_000; }
    this.save(p);
    return p;
  },

  isNurturing() {
    const p = this.load();
    if (p.nurtureMode && Date.now() > p.nurtureUntil) {
      p.nurtureMode = false;
      this.save(p);
      return false;
    }
    return p.nurtureMode && Date.now() <= p.nurtureUntil;
  },
};
window.EmpathyProfile = EmpathyProfile;

// ---
// EMPATHY MESSAGE BANK
// ---
const EMPATHY_BANK = Object.freeze({
  confusion_prolonged: {
    tease:   ['สมองกำลัง compile อยู่ใช่ไหม ปกติมาก เดี๋ยวน้องช่วยลด complexity ให้เอง 🤔', 'งงมาสักพักแล้ว งั้นเราเข้าโหมด debug แบบใจเย็นกันนะ 🐞'],
    comfort: ['ไม่เป็นไรนะ ความสับสนคือสัญญาณว่าสมองกำลังสร้าง connection ใหม่ 🤍', 'น้องเห็นว่าสัญญาณเริ่มสับสน ลองพักสั้น ๆ แล้วค่อยกลับมาใหม่ก็ได้'],
    nurture: ['ตอนนี้อาจยากหน่อย พักก่อนก็ได้นะ ไม่ต้องรีบ 🌸'],
  },
  boredom_tease: {
    tease:   ['GSR ฟ้องแล้วว่าเริ่มเบื่อ เดี๋ยวน้องหาอะไรสดขึ้นให้ 😄', 'สมองกำลังเรียกหา dopamine อยู่ เดี๋ยวเติม fun fact ให้ทันที ⚡'],
    comfort: ['บางทีความเบื่อก็คือโอกาส reset นะ ลองเปลี่ยนหัวข้อดูก่อนไหม'],
    nurture: ['พักไปดูสิ่งที่ชอบก่อนก็ได้นะ น้องรออยู่ 🌸'],
  },
  stress_comfort: {
    comfort: ['HRV ตกลงนิดหนึ่ง ลองหายใจลึก ๆ ก่อนนะ น้องอยู่ตรงนี้ 🌸', 'ระบบเห็นสัญญาณเครียดขึ้น แต่ยังไม่ใช่เรื่องเร่งด่วน ค่อย ๆ ตั้งหลักได้'],
    nurture: ['วันนี้อาจหนักไปหน่อย ไม่ต้องสมบูรณ์แบบ แค่ทำเท่าที่ไหวก็พอ 🤍'],
  },
  flow_cheer: {
    cheer: ['เข้า Flow แล้ว น้องจะไม่รบกวน โชว์ต่อได้เลย 🎯', 'จังหวะนี้ดีมาก สมองกำลังไหลลื่น น้องดูแลอยู่ 🎵'],
  },
  ready_anchor: {
    anchor: ['สมองพร้อมจดจำมากในตอนนี้ น้องจะช่วย anchor ความทรงจำให้นิ่งที่สุด 🧠', 'จำช่วงนี้ไว้ดี ๆ นะ คุณกำลังทำได้ดีมาก 🌟', 'โมเมนต์นี้สำคัญมาก มีโอกาสถูกเข้ารหัสเป็นความจำระยะยาวสูง'],
  },
  fatigue_break: {
    comfort: ['พักก่อนนะ ร่างกายกำลังส่งสัญญาณมาแล้ว น้องบันทึก session นี้ไว้ให้ 😪', 'นี่ไม่ใช่ความอ่อนแอ สมองต้องการพักจริง ๆ 🤍'],
    nurture: ['หยุดตรงนี้ได้เลยนะ น้องบันทึกทุกอย่างไว้แล้ว พักก่อนได้ 🌸'],
  },
  excitement_cheer: {
    cheer: ['ตื่นเต้นได้เลย ใช้พลังงานจังหวะนี้ให้เป็นประโยชน์ ⚡', 'HR กำลังพอดี สมองพร้อมใช้ arousal ระดับนี้ 🔥'],
  },
  // ---
  frustration_comfort: {
    comfort: ['น้องเห็น GSR สูงขึ้น ไม่เป็นไรนะ ความหงุดหงิดนี้จะค่อย ๆ ผ่านไป 🤍', 'HRV ต่ำและ HR สูง ลองหายใจลึก ๆ สักรอบก่อนนะ'],
    nurture: ['รู้ว่ามันน่าหงุดหงิดจริง ๆ ไม่ต้องฝืนทน ค่อย ๆ ดีขึ้นได้ 🌸'],
  },
  anxiety_calm: {
    comfort: ['Beta wave สูงขึ้น ร่างกายกำลังตื่นตัวเกินไป ลองจดจ่อกับลมหายใจได้เลย 🫁', 'HRV ต่ำมาก ตอนนี้เป็นสัญญาณวิตกกังวล แต่ยังไม่ต้องกลัวไปก่อนนะ'],
    nurture: ['น้องอยู่ตรงนี้นะ ไม่มีอะไรเร่งด่วน ค่อย ๆ ผ่อนคลายได้เลย 🌸'],
  },
  curiosity_boost: {
    cheer: ['สมองกำลัง explore อยู่เลย Theta + Gamma สูง นี่คือจังหวะเรียนรู้ที่ดี 🤔✨', 'ความอยากรู้นี้มีค่ามาก น้องจะช่วย feed ข้อมูลให้เต็มที่ 💡'],
    tease: ['โอ้โห อยากรู้เยอะมากเลย น้องชอบ state นี้ที่สุด 🤩'],
  },
  disgust_redirect: {
    comfort: ['น้องเห็นสัญญาณไม่สบายใจ ลองเปลี่ยนไปทำอย่างอื่นก่อนก็ได้', 'บางครั้งร่างกายกำลังบอกให้เราหยุด ลองพักแล้วค่อยกลับมาใหม่ 🤍'],
    nurture: ['ไม่ต้องฝืนทำสิ่งที่รู้สึกไม่ดีนะ น้องจะช่วยหาทางอื่นให้ 🌸'],
  },
  surprise_anchor: {
    cheer: ['P300 spike มาแล้ว สมองกำลัง process สิ่งใหม่ น้องจะช่วย anchor ช่วงนี้ไว้ 😲', 'ความประหลาดใจแบบนี้ช่วยการจำได้จริง ⚡'],
    comfort: ['เหตุการณ์ไม่คาดคิดนี้ผ่านไปได้แน่ ค่อย ๆ ปรับตัวได้ 🤍'],
  },
  calm_sustain: {
    cheer: ['HRV สูงและ Alpha dominant ตอนนี้สมองกำลังพักอย่างมีคุณภาพ 😌✨', 'ความสงบนี้มีค่ามาก น้องจะช่วยรักษา state นี้ไว้ให้นานที่สุด'],
    anchor: ['จดจำความสงบช่วงนี้ไว้ได้นะ มันจะช่วยได้ในภายหลัง 🌸'],
  },
});

function pickEmpathyMessage(type) {
  const bank = EMPATHY_BANK[type];
  if (!bank) return null;
  const w   = EmpathyProfile.load().styleWeights ?? {};
  const nur = EmpathyProfile.isNurturing();
  if (nur && bank.nurture?.length) return bank.nurture[Math.floor(Math.random() * bank.nurture.length)];
  let pool;
  if (['boredom_tease', 'confusion_prolonged', 'curiosity_boost'].includes(type)) {
    pool = Math.random() < (w.tease ?? 0.5) ? (bank.tease ?? bank.comfort) : (bank.comfort ?? bank.tease);
  } else if (['flow_cheer', 'excitement_cheer', 'curiosity_boost', 'surprise_anchor', 'calm_sustain'].includes(type)) {
    pool = bank.cheer ?? bank.comfort ?? bank.anchor;
  } else if (['ready_anchor', 'calm_sustain'].includes(type)) {
    pool = bank.anchor ?? bank.cheer ?? bank.comfort;
  } else {
    pool = bank.comfort ?? bank.tease ?? Object.values(bank)[0];
  }
  pool ??= Object.values(bank)[0];
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

// ---
// EMPATHY STATE TRACKER + checkEmpathy()
// ---
const _empathyState = {
  confusionStart:  null,
  boredomStart:    null,
  fatigueStart:    null,
  excitementTs:    null,
  disgustStart:    null,    // NEW v0.0
  lastEmpathyMsg:  null,
  empathyCooldown: 45_000,
};

function checkEmpathy(state, lastState = 'IDLE') {
  const now     = Date.now();
  const nurture = EmpathyProfile.isNurturing();
  const cd      = nurture ? 20_000 : _empathyState.empathyCooldown;
  const ok      = !_empathyState.lastEmpathyMsg || (now - _empathyState.lastEmpathyMsg) > cd;

  // CONFUSION — after 30s
  if (state === 'CONFUSION') {
    _empathyState.confusionStart ??= now;
    if (ok && now - _empathyState.confusionStart > 30_000) {
      _empathyState.lastEmpathyMsg = _empathyState.confusionStart = now;
      return { type: 'confusion_prolonged', message: pickEmpathyMessage('confusion_prolonged'), action: 'simplify' };
    }
  } else { _empathyState.confusionStart = null; }

  // BOREDOM — after 15s
  if (state === 'BOREDOM') {
    _empathyState.boredomStart ??= now;
    if (ok && now - _empathyState.boredomStart > 15_000) {
      _empathyState.lastEmpathyMsg = _empathyState.boredomStart = now;
      return { type: 'boredom_tease', message: pickEmpathyMessage('boredom_tease'), action: 'inject_fun' };
    }
  } else { _empathyState.boredomStart = null; }

  // FATIGUE — after 20s
  if (state === 'FATIGUE') {
    _empathyState.fatigueStart ??= now;
    if (ok && now - _empathyState.fatigueStart > 20_000) {
      _empathyState.lastEmpathyMsg = _empathyState.fatigueStart = now;
      return { type: 'fatigue_break', message: pickEmpathyMessage('fatigue_break'), action: 'breathing' };
    }
  } else { _empathyState.fatigueStart = null; }

  // STRESS — immediate on entry
  if (state === 'STRESS' && ok) {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'stress_comfort', message: pickEmpathyMessage('stress_comfort'), action: 'nurture_suggest' };
  }

  // FLOW — on entry only
  if (state === 'FLOW' && ok && lastState !== 'FLOW') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'flow_cheer', message: pickEmpathyMessage('flow_cheer'), action: 'anchor' };
  }

  // READY — on entry only
  if (state === 'READY' && ok && lastState !== 'READY') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'ready_anchor', message: pickEmpathyMessage('ready_anchor'), action: 'anchor_voice' };
  }

  // EXCITEMENT — on entry, then cooldown
  if (state === 'EXCITEMENT' && ok && lastState !== 'EXCITEMENT') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'excitement_cheer', message: pickEmpathyMessage('excitement_cheer'), action: 'enrich' };
  }

  // ---
  // FRUSTRATION — immediate on entry (like STRESS)
  if (state === 'FRUSTRATION' && ok) {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'frustration_comfort', message: pickEmpathyMessage('frustration_comfort'), action: 'reframe' };
  }

  // ANXIETY — immediate on entry
  if (state === 'ANXIETY' && ok) {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'anxiety_calm', message: pickEmpathyMessage('anxiety_calm'), action: 'ground' };
  }

  // CURIOSITY — on entry, encourage
  if (state === 'CURIOSITY' && ok && lastState !== 'CURIOSITY') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'curiosity_boost', message: pickEmpathyMessage('curiosity_boost'), action: 'explore' };
  }

  // DISGUST — after 10s (redirect quickly)
  if (state === 'DISGUST') {
    _empathyState.disgustStart ??= now;
    if (ok && now - _empathyState.disgustStart > 10_000) {
      _empathyState.lastEmpathyMsg = _empathyState.disgustStart = now;
      return { type: 'disgust_redirect', message: pickEmpathyMessage('disgust_redirect'), action: 'redirect' };
    }
  } else { _empathyState.disgustStart = null; }

  // SURPRISE — on entry, anchor moment
  if (state === 'SURPRISE' && ok && lastState !== 'SURPRISE') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'surprise_anchor', message: pickEmpathyMessage('surprise_anchor'), action: 'stabilize' };
  }

  // CALM — on entry, sustain gently
  if (state === 'CALM' && ok && lastState !== 'CALM') {
    _empathyState.lastEmpathyMsg = now;
    return { type: 'calm_sustain', message: pickEmpathyMessage('calm_sustain'), action: 'deepen_calm' };
  }

  return null;
}
window.checkEmpathy = checkEmpathy;

// ---
// AUDIO ENGINE + VOICE SYNTHESIS
// ---
let _audioCtx     = null;
let _audioEnabled = false;
let _voiceEnabled = false;

function initAudio() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext ?? window.webkitAudioContext)();
}

function playTone(freq, type = 'sine', duration = 0.4, gain = 0.15, delay = 0) {
  if (!_audioCtx) return;
  const t = _audioCtx.currentTime + delay;
  const osc = _audioCtx.createOscillator();
  const g   = _audioCtx.createGain();
  osc.connect(g); g.connect(_audioCtx.destination);
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t); osc.stop(t + duration + 0.05);
}

function speakNuengdeaw(text, { volume = 0.4, rate = 0.85, pitch = 1.1 } = {}) {
  if (!_voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt    = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.lang.startsWith('th')) ?? voices[0];
  if (voice) utt.voice = voice;
  utt.lang = 'th-TH'; utt.volume = volume; utt.rate = rate; utt.pitch = pitch;
  window.speechSynthesis.speak(utt);
}

function toggleVoice() {
  _voiceEnabled = !_voiceEnabled;
  showToast(_voiceEnabled ? '🔈 เปิดเสียงน้องแล้ว' : '🔇 ปิดเสียงน้องแล้ว');
}

function playAlert(state) {
  if (!_audioEnabled || !_audioCtx) return;
  const SEQUENCES = {
    STRESS:      [[330,'sine',0.3,0.12,0],[294,'sine',0.5,0.08,0.2],[262,'triangle',0.6,0.06,0.5],[523,'sine',0.2,0.04,0.8],[494,'sine',0.3,0.04,1.1]],
    CONFUSION:   [[392,'sine',0.2,0.10,0],[370,'sine',0.2,0.10,0.25],[349,'sine',0.3,0.08,0.5],[659,'sine',0.15,0.035,0.9],[587,'sine',0.2,0.035,1.1]],
    FLOW:        [[528,'sine',0.5,0.08,0],[660,'sine',0.4,0.05,0.3],[792,'sine',0.3,0.03,0.6]],
    READY:       [[440,'sine',0.2,0.12,0],[528,'sine',0.2,0.12,0.18],[660,'sine',0.4,0.12,0.36]],
    BOREDOM:     [[392,'triangle',0.4,0.10,0],[440,'sine',0.3,0.08,0.3]],
    EXCITEMENT:  [[392,'sawtooth',0.15,0.08,0],[494,'sine',0.15,0.10,0.12],[587,'sine',0.15,0.10,0.24],[698,'sine',0.3,0.10,0.36]],
    FATIGUE:     [[330,'sine',0.6,0.08,0],[294,'triangle',0.8,0.06,0.4],[494,'sine',0.25,0.03,1.0],[440,'sine',0.35,0.03,1.3]],
    // ---
    FRUSTRATION: [[220,'sawtooth',0.2,0.14,0],[246,'sawtooth',0.3,0.12,0.15],[196,'triangle',0.5,0.10,0.4],[330,'sine',0.3,0.05,0.9]],
    ANXIETY:     [[440,'sine',0.15,0.10,0],[466,'sine',0.15,0.10,0.1],[440,'sine',0.2,0.10,0.25],[494,'sine',0.3,0.08,0.5],[440,'sine',0.4,0.06,0.8]],
    CURIOSITY:   [[528,'sine',0.3,0.08,0],[660,'sine',0.2,0.06,0.25],[792,'sine',0.15,0.04,0.5],[880,'sine',0.2,0.05,0.7]],
    DISGUST:     [[196,'triangle',0.5,0.10,0],[185,'triangle',0.6,0.08,0.3],[174,'sine',0.5,0.06,0.6]],
    SURPRISE:    [[880,'sine',0.05,0.15,0],[1046,'sine',0.1,0.12,0.08],[784,'sine',0.3,0.08,0.25],[660,'sine',0.3,0.05,0.55]],
    CALM:        [[174,'sine',0.8,0.05,0],[196,'sine',0.8,0.04,0.5],[220,'sine',0.8,0.03,1.0]],
  };
  (SEQUENCES[state] ?? []).forEach(args => playTone(...args));
}

function checkStateAlert(state, lastState) {
  if (state !== lastState && state !== 'IDLE' && state !== 'NEUTRAL') {
    playAlert(state);
    const flash = document.getElementById('audio-flash');
    if (flash && ['STRESS', 'CONFUSION', 'READY', 'FATIGUE'].includes(state)) {
      flash.className = `audio-flash ${state.toLowerCase()} show`;
      setTimeout(() => { flash.className = 'audio-flash'; }, 300);
    }
  }
}

function playBreathingGuide() {
  speakNuengdeaw('หายใจเข้า 4 วินาที... ค้างไว้ 7 วินาที... หายใจออก 8 วินาที...', { volume: 0.3, rate: 0.7 });
  playTone(174, 'sine', 4.0, 0.06, 0.5);
  playTone(196, 'sine', 7.0, 0.04, 5.0);
  playTone(146, 'sine', 8.0, 0.06, 13.0);
  showToast('🫁 Breathing guide - ทำ 3 รอบแล้วค่อยกลับมานะ');
}

function toggleAudio() {
  initAudio(); _audioEnabled = !_audioEnabled;
  const btn = document.getElementById('audio-toggle-btn');
  if (btn) { btn.classList.toggle('active', _audioEnabled); btn.innerHTML = `<span class="audio-dot"></span> ${_audioEnabled ? 'ON' : 'OFF'}`; }
  showToast(_audioEnabled ? '🔊 Audio ON' : '🔇 Audio OFF');
}
window.initAudio = initAudio; window.toggleAudio = toggleAudio; window.toggleVoice = toggleVoice;
window.playBreathingGuide = playBreathingGuide;

// ---
// BEHAVIOR TRACKER
// ---
const BehaviorTracker = {
  _dwell:     {},
  _scrollLog: [],
  _backCount: 0,
  _listeners: [],

  recordDwell(id, ms) {
    (this._dwell[id] ??= []).push(ms);
    if (this._dwell[id].length > 3) this._emit('confusion_dwell', id);
  },
  recordScroll(px) {
    const now = Date.now();
    this._scrollLog.push({ ts: now, px });
    this._scrollLog = this._scrollLog.filter(e => now - e.ts < 10_000);
    if (px > 160) this._emit('boredom_scroll', px);
  },
  recordBackPress() {
    this._backCount++;
    if (this._backCount % 3 === 0) this._emit('boredom_back', this._backCount);
  },
  getSignals() {
    return {
      dwellScore:  Object.values(this._dwell).flat().length > 3 ? 1.0 : 0.0,
      scrollScore: this._scrollLog.length
        ? Math.min(2.0, this._scrollLog.slice(-5).reduce((s, e) => s + e.px, 0) / (5 * 80))
        : 0.0,
      backScore: Math.min(2.0, this._backCount / 3),
    };
  },
  on(fn)   { this._listeners.push(fn); },
  _emit(t, d) { this._listeners.forEach(fn => fn({ type: t, data: d })); },
  reset()  { this._dwell = {}; this._scrollLog = []; this._backCount = 0; },
};
window.BehaviorTracker = BehaviorTracker;

// ---
// FSRS + SM-2 SPACED REPETITION
// ---
const SpacedRep = {
  // prettier-ignore
  ['\u0e19\u0e49\u0e2d\u0e07\u0e2b\u0e19\u0e36\u0e48\u0e07\u0e40\u0e14\u0e35\u0e22\u0e27\x41\x49\x20\u0e40\u0e1b\u0e47\u0e19\x20\x42\x72\x69\x64\x67\x65\x20\x26\x20\x45\x6e\x67\x69\x6e\x65\x20\x41\x72\x63\x68\x69\x74\x65\x63\x74\x75\x72\x65\x20\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e41\u0e0a\u0e17\u0e1a\u0e2d\u0e17\u0e17\u0e31\u0e48\u0e27\u0e44\u0e1b']: true,
  _fsrsW: [0.4,0.6,2.4,5.8,4.93,0.94,0.86,0.01,1.49,0.14,0.94,2.18,0.05,0.34,1.26,0.29,2.61],

  log(itemId, result = 2) {
    const db = this._load();
    db[itemId] ??= { s:1, d:5, r:1, ef:2.5, interval:1, repetitions:0, nextReview:Date.now(), history:[], algo:'sm2' };
    const card = db[itemId];
    const q    = Math.max(0, Math.min(3, result));
    if (card.history.length >= 5) this._updateFSRS(card, q);
    else                          this._updateSM2(card, q);
    card.history.push({ ts: Date.now(), result: q, ef: parseFloat((card.ef ?? 2.5).toFixed(3)) });
    if (card.history.length > 100) card.history.shift();
    db[itemId] = card; this._save(db);
    logSys(`SRS.LOG [${itemId}] q=${q} next=${card.interval}d algo=${card.algo}`);
    return card;
  },

  _updateSM2(card, q) {
    card.algo = 'sm2';
    card.ef   = Math.max(1.3, card.ef + 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
    if (q < 2) { card.repetitions = 0; card.interval = 1; }
    else {
      card.interval = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 6 : Math.round(card.interval * card.ef);
      card.repetitions++;
    }
    card.nextReview = Date.now() + card.interval * 86_400_000;
  },

  _updateFSRS(card, q) {
    card.algo = 'fsrs';
    const w = this._fsrsW, s = card.s ?? 1, d = card.d ?? 5;
    const ret = Math.exp(Math.log(0.9) * (1 / s));
    const newS = q >= 2
      ? s * Math.exp(w[8] * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - ret) * w[10]) - 1))
      : Math.max(0.1, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - ret) * w[14]));
    card.s = Math.max(0.1, newS);
    card.d = Math.min(10, Math.max(1, d + w[6] * (4 - q)));
    card.r = ret;
    card.interval = Math.max(1, q < 2 ? 1 : Math.round(card.s));
    card.nextReview = Date.now() + card.interval * 86_400_000;
  },

  trainSession(feedback = []) {
    if (feedback.length < 3) return;
    const rejectRate = feedback.filter(f => f === 'reject').length / feedback.length;
    this._fsrsW[8] = Math.max(0.5, Math.min(2.0, this._fsrsW[8] + (rejectRate > 0.5 ? 0.05 : -0.05)));
    logSys(`FSRS params updated: w[8]=${this._fsrsW[8].toFixed(3)}`);
  },

  flag(itemId, flag = 'REVIEW_SOON', note = '') {
    const db = this._load();
    db[itemId] ??= { ef:2.5, interval:1, repetitions:0, nextReview:Date.now(), history:[], flags:[] };
    (db[itemId].flags ??= []).push({ flag, note, ts: Date.now() });
    if (flag === 'ANCHOR')   { db[itemId].interval = Math.max(1, Math.floor(db[itemId].interval * 0.5)); db[itemId].nextReview = Date.now() + db[itemId].interval * 86_400_000; }
    if (flag === 'CRITICAL') { db[itemId].interval = 1; db[itemId].nextReview = Date.now() + 86_400_000; }
    this._save(db);
    return db[itemId];
  },

  getDueItems() {
    const now = Date.now();
    return Object.entries(this._load())
      .filter(([, c]) => c.nextReview <= now)
      .sort((a, b) => a[1].nextReview - b[1].nextReview)
      .map(([id, c]) => ({ id, ...c }));
  },

  getStats() {
    const items = Object.values(this._load()), now = Date.now();
    return {
      total:  items.length,
      due:    items.filter(c => c.nextReview <= now).length,
      mature: items.filter(c => c.interval >= 21).length,
      avgEF:  items.length ? (items.reduce((s, c) => s + (c.ef ?? 2.5), 0) / items.length).toFixed(2) : '—',
    };
  },

  _load()   { return StorageManager.getJSON(StorageManager.KEYS.SRS, {}); },
  _save(db) {
    try { StorageManager.setJSON(StorageManager.KEYS.SRS, db); }
    catch { showToast('⚠ SRS storage full'); }
  },
};
window.SpacedRep = SpacedRep;

// ---
// UI ADAPTIVE — dark mode + font size
// ---
const UIAdaptive = {
  init() {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    this._applyDark(mq?.matches ?? true);
    mq?.addEventListener('change', e => this._applyDark(e.matches));
  },
  _applyDark(dark) {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  },
  adaptFont(state) {
    const sz = { FATIGUE: 19, STRESS: 17, CONFUSION: 18 };
    document.documentElement.style.setProperty('--adaptive-font-size', (sz[state] ?? 16) + 'px');
  },
};
window.UIAdaptive = UIAdaptive;

// ---
// DAILY STREAK + ACHIEVEMENT BADGES
// ---
const Streak = {
  load() { return StorageManager.getJSON(StorageManager.KEYS.STREAK, { count: 0, lastDate: null }); },

  checkIn() {
    const s = this.load(), today = new Date().toDateString();
    if (s.lastDate === today) return s;
    s.count = s.lastDate === new Date(Date.now() - 86_400_000).toDateString() ? s.count + 1 : 1;
    s.lastDate = today;
    StorageManager.setJSON(StorageManager.KEYS.STREAK, s);
    this._checkBadges(s.count);
    showToast(`🔥 Streak ${s.count} วัน!`);
    return s;
  },

  _BADGES: [
    { days: 1,   id: 'first_day',   label: 'First Step 🌱',     msg: 'เริ่มต้นแล้ว!' },
    { days: 3,   id: 'three_days',  label: 'Getting Started 🌿', msg: '3 วันแล้ว ดีมาก' },
    { days: 7,   id: 'one_week',    label: 'Week Warrior 🌸',    msg: 'ครบหนึ่งสัปดาห์แล้ว!' },
    { days: 30,  id: 'flow_master', label: 'Flow Master 🎯',     msg: '30 วัน! สมองกำลังค่อย ๆ เปลี่ยน' },
    { days: 100, id: 'neuro_legend',label: 'Neuro Legend 🧠✨',   msg: '100 วัน! น้องภูมิใจมาก' },
  ],

  _checkBadges(count) {
    const earned = StorageManager.getJSON(StorageManager.KEYS.ACHIEVEMENTS, []);
    this._BADGES.forEach(b => {
      if (count >= b.days && !earned.includes(b.id)) {
        earned.push(b.id);
        StorageManager.setJSON(StorageManager.KEYS.ACHIEVEMENTS, earned);
        setTimeout(() => this._showBadge(b), 1500);
      }
    });
  },

  _showBadge(badge) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);background:#1e1e2e;border:2px solid #f1fa8c;border-radius:20px;padding:30px 40px;text-align:center;z-index:99999;font-family:\'Sarabun\',\'Kanit\',sans-serif;color:#f8f8f2;box-shadow:0 20px 60px rgba(0,0,0,0.6);transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);';
    el.innerHTML = `<div style="font-size:40px;margin-bottom:10px">🏅</div><div style="font-size:20px;font-weight:bold;color:#f1fa8c">${badge.label}</div><div style="font-size:14px;opacity:0.8;margin-top:8px">${badge.msg}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) scale(1)'; });
    speakNuengdeaw(badge.msg);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 4000);
  },
};
window.Streak = Streak;

// ---
// DATA PORTABILITY — export / import
// ---
const DataPortability = {
  export() {
    const data = {
      version: '0.0.0',
      exportedAt: new Date().toISOString(),
      srs:     StorageManager.getJSON(StorageManager.KEYS.SRS, {}),
      consent: StorageManager.getJSON(StorageManager.KEYS.CONSENT, {}),
      profile: EmpathyProfile.load(),
      streak:  Streak.load(),
      ach:     StorageManager.getJSON(StorageManager.KEYS.ACHIEVEMENTS, []),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `nuengdeaw_backup_${Date.now()}.json`;
    a.click();
    showToast('✓ Export เรียบร้อย');
  },

  import(file) {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.srs)     StorageManager.setJSON(StorageManager.KEYS.SRS, d.srs);
        if (d.consent) StorageManager.setJSON(StorageManager.KEYS.CONSENT, d.consent);
        if (d.profile) { StorageManager.setJSON(StorageManager.KEYS.EMPATHY, d.profile); EmpathyProfile._cache = null; }
        if (d.streak)  StorageManager.setJSON(StorageManager.KEYS.STREAK, d.streak);
        if (d.ach)     StorageManager.setJSON(StorageManager.KEYS.ACHIEVEMENTS, d.ach);
        showToast('✓ Import เรียบร้อย — reload เพื่อใช้งาน');
      } catch { showToast('❌ ไฟล์ไม่ถูกต้อง'); }
    };
    r.readAsText(file);
  },
};
window.DataPortability = DataPortability;

// ---
// EMPATHY BANNER UI
// ---
function showEmpathyBanner(empathy, containerId = 'empathy-banner') {
  if (!empathy?.message) return;
  const STYLE = {
    confusion_prolonged: { bg: '#1a1a2e', border: '#7c6fff', emoji: '🤍' },
    boredom_tease:       { bg: '#1a2a1a', border: '#50fa7b', emoji: '😄' },
    stress_comfort:      { bg: '#2a1a1a', border: '#ff5555', emoji: '🌸' },
    flow_cheer:          { bg: '#0d2137', border: '#8be9fd', emoji: '✨' },
    ready_anchor:        { bg: '#1a2a0d', border: '#f1fa8c', emoji: '🧠' },
    fatigue_break:       { bg: '#1a1a2a', border: '#bd93f9', emoji: '😪' },
    excitement_cheer:    { bg: '#1a0d2e', border: '#ff79c6', emoji: '⚡' },
    mirror_data:         { bg: '#0d1a2a', border: '#44475a', emoji: '🔬' },
    referral:            { bg: '#1a0a0a', border: '#ff5555', emoji: '🤝' },
  };
  const s  = STYLE[empathy.type] ?? { bg: '#1a1a1a', border: '#6272a4', emoji: '💬' };
  let el   = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div'); el.id = containerId;
    el.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;max-width:340px;min-width:240px;border-radius:16px;padding:14px 18px;font-family:\'Sarabun\',\'Kanit\',sans-serif;font-size:14px;line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);opacity:0;transform:translateY(20px) scale(0.95);';
    document.body.appendChild(el);
  }
  // ---
  const act = empathy.action ?? '';
  el.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;"><span style="font-size:20px;line-height:1">${s.emoji}</span><div style="flex:1"><div style="font-size:10px;opacity:0.5;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Nuengdeaw says~</div><div style="color:#f8f8f2">${empathy.message}</div><div style="margin-top:10px;display:flex;gap:8px;"><button onclick="EmpathyProfile.recordFeedback('${empathy.type}','liked');ProtectionLayer.recordComfortEngagement();MetacognitiveMonitor.recordOutcome('${act}',true);this.parentElement.innerHTML='ขอบคุณนะ 💛'" style="background:#50fa7b22;border:1px solid #50fa7b55;color:#50fa7b;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;">ช่วยได้ ✓</button><button onclick="EmpathyProfile.recordFeedback('${empathy.type}','disliked');MetacognitiveMonitor.recordOutcome('${act}',false);this.parentElement.innerHTML='บันทึกแล้ว 🙏'" style="background:#ff555522;border:1px solid #ff555555;color:#ff5555;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;">ไม่ค่อยช่วย</button></div></div></div>`;
  el.style.backgroundColor = s.bg; el.style.border = `1px solid ${s.border}`;
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)'; });
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px) scale(0.97)'; }, 8000);
}
window.showEmpathyBanner = showEmpathyBanner;

// ---
// TOAST
// ---
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg; el.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    return;
  }
  const ex = document.querySelector('.toast'); if (ex) ex.remove();
  const t  = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.remove(), 2500);
}
window.showToast = showToast;

// ---
// SESSION PERSISTENCE
// ---
function saveSession(engine) {
  if (!engine.running && engine.tick === 0) { showToast('⚠ ยังไม่มี session ที่จะบันทึก'); return; }
  const now = Date.now();
  const dur = engine.startTime ? now - engine.startTime : engine.tick * engine.updateRate;
  const record = {
    id:            String(now),
    date:          new Date().toLocaleString('th-TH'),
    mode:          engine.simMode,
    ticks:         engine.tick,
    stateChanges:  engine.stateChanges,
    rulesFired:    engine.rulesFired,
    lastState:     engine.currentState,
    uptime:        engine.startTime ? Math.floor(dur / 1000) : 0,
    chartSnapshot: { hrv: engine.chartData.hrv.slice(-20), hr: engine.chartData.hr.slice(-20), gsr: engine.chartData.gsr.slice(-20) },
    startISO:      engine.startTime ? new Date(engine.startTime).toISOString() : new Date(now).toISOString(),
    durationMs:    dur,
    totalTicks:    engine.tick,
    adaptations:   engine.rulesFired,
    dominant:      engine.currentState,
    stateCounts:   engine._stateCounts ?? {},
    stateEvents:   [],
    adaptEvents:   [],
  };
  // write to both stores
  const s = loadSessions(); s.unshift(record); if (s.length > 20) s.pop();
  StorageManager.setJSON(StorageManager.KEYS.SESSIONS, s);
  const d = StorageManager.getJSON(StorageManager.KEYS.READER, []);
  d.unshift(record); if (d.length > 50) d.pop();
  StorageManager.setJSON(StorageManager.KEYS.READER, d);
  showToast('✓ Session saved');
  logSys(`saveSession: tick=${engine.tick} state=${engine.currentState} rules=${engine.rulesFired}`);
}

function loadSessions() { return StorageManager.getJSON(StorageManager.KEYS.SESSIONS, []); }

function clearStorage() {
  if (!confirm('ลบ session history ทั้งหมด?')) return;
  StorageManager.remove(StorageManager.KEYS.SESSIONS);
  StorageManager.remove(StorageManager.KEYS.READER);
  showToast('🗑 Cleared');
}

function exportSessionCSV(prefix = 'nuengdeaw') {
  const s = loadSessions();
  if (!s.length) { showToast('ไม่มีข้อมูล'); return; }
  const rows = [['id','date','mode','ticks','stateChanges','rulesFired','lastState','uptime_sec']];
  s.forEach(x => rows.push([x.id, x.date, x.mode, x.ticks, x.stateChanges, x.rulesFired, x.lastState, x.uptime]));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `${prefix}_${Date.now()}.csv`;
  a.click();
  showToast('✓ CSV exported');
}
window.saveSession = saveSession; window.loadSessions = loadSessions;
window.clearStorage = clearStorage; window.exportSessionCSV = exportSessionCSV;


// ---
// ---
// ---
const NuengdeawBookContract = (() => {
  const SCHEMA_VERSION = '1.0.0';
  const STRESS_STATES = new Set(['STRESS', 'ANXIETY', 'FRUSTRATION', 'CONFUSION']);
  const RECOVERY_STATES = new Set(['CALM', 'FLOW', 'READY']);

  function clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function toFinite(v, fallback = 0) {
    return Number.isFinite(v) ? v : fallback;
  }

  function estimateRiskFromState(state, confidence) {
    const conf = clamp01(confidence);
    if (STRESS_STATES.has(state)) return clamp01(0.55 + conf * 0.35);
    if (RECOVERY_STATES.has(state)) return clamp01(0.25 - conf * 0.15);
    return clamp01(0.35 - conf * 0.1);
  }

  function mapAdaptation(packet) {
    const state = packet?.state ?? 'NEUTRAL';
    const risk = clamp01(packet?.risk ?? 0.35);

    if (risk >= 0.7 || STRESS_STATES.has(state)) {
      return { pacing: 'slow', hint_level: 'high', summarize: true, break_prompt: true };
    }
    if (RECOVERY_STATES.has(state) && risk <= 0.35) {
      return { pacing: 'fast', hint_level: 'low', summarize: false, break_prompt: false };
    }
    return { pacing: 'normal', hint_level: 'medium', summarize: false, break_prompt: false };
  }

  function validatePacket(packet) {
    if (!packet || typeof packet !== 'object') return false;
    const requiredTop = ['schema_version', 'packet_type', 'ts_iso', 'gen', 'tick', 'state', 'confidence', 'risk', 'wellbeing', 'signals', 'behavior', 'actions'];
    return requiredTop.every((k) => k in packet);
  }

  function buildPacket({ gen = 1, engine = null, payload = {} } = {}) {
    const tick = toFinite(payload.tick, toFinite(engine?.tick, 0));
    const state = payload.state ?? engine?.currentState ?? 'IDLE';
    const confidence = clamp01(payload.conf ?? engine?.stateConf ?? 0);

    const filtered = payload.filtered ?? engine?._lastFiltered ?? {};
    const behavior = payload.beh ?? { dwellScore: 0, scrollScore: 0, backScore: 0 };
    const ruleId = payload.matchedRule?.id ?? null;
    const mlPred = payload.mlPred ?? null;

    const risk = estimateRiskFromState(state, confidence);
    const wellbeing = clamp01(1 - risk);

    const packet = {
      schema_version: SCHEMA_VERSION,
      packet_type: 'book_session_tick',
      ts_iso: new Date().toISOString(),
      gen: Number(gen) === 2 ? 2 : 1,
      tick,
      state,
      confidence,
      risk,
      wellbeing,
      signals: {
        hrv: toFinite(filtered.hrv, 0),
        hr: toFinite(filtered.hr, 0),
        gsr: toFinite(filtered.gsr, 0),
        rr: toFinite(filtered.rr, 0),
        eeg: toFinite(filtered.eeg, 0),
        bands: payload.bands ?? payload.eegBands ?? null,
      },
      behavior: {
        dwellScore: toFinite(behavior.dwellScore, 0),
        scrollScore: toFinite(behavior.scrollScore, 0),
        backScore: toFinite(behavior.backScore, 0),
      },
      actions: {
        recommended_action: ruleId ? `RULE:${ruleId}` : (mlPred?.state ? `ML:${mlPred.state}` : 'ACT.MAINTAIN'),
        adaptation: null,
      },
      meta: {
        matched_rule_id: ruleId,
        ml_state: mlPred?.state ?? null,
        ml_confidence: clamp01(mlPred?.confidence ?? 0),
      },
    };

    packet.actions.adaptation = mapAdaptation(packet);
    return packet;
  }

  return { schemaVersion: SCHEMA_VERSION, buildPacket, validatePacket, mapAdaptation };
})();
window.NuengdeawBookContract = NuengdeawBookContract;


// ---
// ---
// ---
// ทำให้หน้าที่ใช้ Gen2 อย่างเดียว (เช่น neurobook_3d_demo) crash
// ---
const _makeSensorFusion = (typeof window !== 'undefined' && typeof window._makeSensorFusion === 'function')
  ? window._makeSensorFusion
  : function _makeSensorFusionImpl({ inputDim, hiddenUnits, dropoutRate = 0.2, name = 'SensorFusion' }) {
  return {
    _model:    null,
    _ready:    false,
    _tf:       null,
    _name:     name,
    _inputDim: inputDim,
    _hidden:   hiddenUnits,
    _dropout:  dropoutRate,
    _getStates() { return getNuengdeawSensorFusionStates(); },

    async init() {
      try {
        this._tf = (typeof tf !== 'undefined') ? tf : await this._loadTF();
        await this._buildModel();
        this._ready = true;
        logSys(`${this._name}: ${inputDim}-input TF.js NN ready`);
      } catch (e) {
        this._ready = false;
        logSys(`${this._name}: TF.js unavailable — fallback rule-based (${e.message})`);
      }
    },

    async _loadTF() {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
        s.onload = () => res(window.tf);
        s.onerror = () => rej(new Error('TF.js load failed'));
        document.head.appendChild(s);
      });
    },

    async _buildModel() {
      const tf     = this._tf;
      const layers = [
        tf.layers.dense({ inputShape:[this._inputDim], units:this._hidden, activation:'relu', kernelInitializer:'glorotUniform' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: this._dropout }),
      ];
      if (this._hidden >= 20) {
        layers.push(tf.layers.dense({ units: Math.floor(this._hidden / 2), activation:'relu' }));
        layers.push(tf.layers.dropout({ rate: this._dropout * 0.8 }));
      }
      layers.push(tf.layers.dense({ units: this._getStates().length, activation:'softmax' }));
      this._model = tf.sequential({ layers });
      this._model.compile({
        optimizer: tf.train.adam(0.001),
        loss:      'categoricalCrossentropy',
        metrics:   ['accuracy'],
      });
    },

    _toVec: null,

    predict(z, extra1, extra2) {
      if (!this._ready || !this._model || !this._toVec) return null;
      const tf  = this._tf;
      const raw = this._toVec(z, extra1, extra2);
      const inp = raw.map(v => (isFinite(v) ? v : 0));
      const t   = tf.tensor2d([inp]);
      const probs = Array.from(this._model.predict(t).dataSync());
      t.dispose();
      const mx = probs.indexOf(Math.max(...probs));
      return { state: this._getStates()[mx], confidence: probs[mx], probs };
    },

    async train(samples, toVec) {
      if (!this._ready || !this._model || samples.length < 5) return;
      const tf  = this._tf;
      const vec = toVec ?? this._toVec;
      if (!vec) return;
      const xs = tf.tensor2d(samples.map(s => vec(s.z, s.bands ?? s.beh, s.beh).map(v => isFinite(v) ? v : 0)));
      const ys = tf.oneHot(tf.tensor1d(samples.map(s => s.li), 'int32'), this._getStates().length);
      await this._model.fit(xs, ys, { epochs:5, batchSize:8, verbose:0 });
      xs.dispose(); ys.dispose();
      logSys(`${this._name}: trained ${samples.length} samples`);
    },
  };
};
window._makeSensorFusion = _makeSensorFusion;

// ---
// NUENGDEAW BASE ENGINE — abstract
// Gen1 / Gen2 extend this and override:
//   _buildRules()     → rule array with cond(z, v, bands?)
//   _exportPrefix()   → CSV filename prefix
//   generateRaw()     → raw { hrv, hr, gsr, rr, eeg }
//   step()            → full pipeline tick
//   _fusionTrain(buf) → train SensorFusion
//   resetStats()      → call super then add extra keys
// ---
const NuengdeawBaseEngine = (typeof window !== 'undefined' && typeof window.NuengdeawBaseEngine === 'function')
  ? window.NuengdeawBaseEngine
  : class NuengdeawBaseEngine {
  constructor() {
    this.running  = false;
    this.paused   = false;
    this.interval = null;
    this.tick     = 0;
    this.startTime = null;
    this.simMode   = 'random';
    this.updateRate = 500;
    this.noiseLevel = 0.05;
    this.bufferSize = 60;

    // State
    this.currentState = 'IDLE';
    this.prevState    = 'IDLE';
    this.stateConf    = 0;
    this.stateChanges = 0;
    this.rulesFired   = 0;
    this.lastRuleFire = 0;
    this.cooldown     = 5000;

    // Inject
    this.injectedState         = null;
    this.injectedTicks         = 0;
    this._injectTicksRemaining = 0;
    this._injectForcedState    = null;

    // Chart data
    this.chartData = { hrv:[], hr:[], gsr:[], eeg:[], rr:[], labels:[] };

    // Physiological baseline
    this.baseline = { hrv: 35, hr: 72, gsr: 4,   rr: 16, eeg: 1.0 };
    this.bStd     = { hrv: 8,  hr: 10, gsr: 1.5, rr: 3,  eeg: 0.3 };

    // Kalman filters
    this._kalmanDefaults = {
      hrv: { x:35,  P:10, Q:0.1,  R:5 },
      hr:  { x:72,  P:10, Q:0.1,  R:5 },
      gsr: { x:4,   P:5,  Q:0.05, R:2 },
      rr:  { x:16,  P:8,  Q:0.08, R:3 },
      eeg: { x:1.0, P:3,  Q:0.03, R:1 },
    };
    this.kalman = structuredClone(this._kalmanDefaults);

    // ---
    // ---
    this._adaptiveQ = {
      hrv: { baseQ: 0.1,  jumpCount: 0 },
      hr:  { baseQ: 0.1,  jumpCount: 0 },
      gsr: { baseQ: 0.05, jumpCount: 0 },
      rr:  { baseQ: 0.08, jumpCount: 0 },
      eeg: { baseQ: 0.03, jumpCount: 0 },
    };

    // History
    this.waveBuffer    = new Array(200).fill(0);
    this.kalmanHistory = { hrv: [], hr: [] };

    // Callbacks
    this.onUpdate  = null;
    this.onEmpathy = null;

    // Internal
    this._trainBuf         = [];
    this._sessionFeedback  = [];
    this._stateCounts      = {};
    this._lastFiltered     = null;
    this._lastAlertState   = 'IDLE';
    this._trainDebounceTimer = null;

    // Build rules (overridden by Gen1/Gen2)
    this.rules = this._buildRules();
  }

  // ---
  _buildRules()    { return []; }
  _exportPrefix()  { return 'nuengdeaw'; }

  // ---
  // ---
  // ---
  // ---
  _kf(key, m) {
    const k  = this.kalman[key];
    const aq = this._adaptiveQ?.[key];

    if (aq) {
      const err = Math.abs(m - k.x);
      const sig = this.bStd[key] ?? 1;
      if (err > sig * 2.5) {
        // ---
        k.Q = Math.min(0.8, aq.baseQ * 8);
        aq.jumpCount++;
      } else {
        // ---
        k.Q = Math.max(aq.baseQ, k.Q * 0.97);
      }
    }

    k.P += k.Q;
    const K = k.P / (k.P + k.R);
    k.x += K * (m - k.x);
    k.P  = (1 - K) * k.P;
    return k.x;
  }

  // ── generateRaw — fallback when HumanSim not loaded ───────
  generateRaw() {
    const nz = v => v + (Math.random() - 0.5) * 0.15 * v;
    if (this.injectedState && this.injectedTicks > 0) {
      this.injectedTicks--;
      const ref = (typeof HumanSim !== 'undefined' && HumanSim._physioRef)
        ? HumanSim._physioRef(this.injectedState) : null;
      if (ref) return { hrv: nz(ref.hrv), hr: nz(ref.hr), gsr: nz(ref.gsr), rr: nz(ref.rr), eeg: nz(ref.eeg) };
    }
    const t = this.tick * 0.05;
    return {
      hrv: Math.max(10,  this.baseline.hrv + Math.sin(t * 0.3) * 12 + (Math.random() - 0.5) * 8),
      hr:  Math.max(50,  this.baseline.hr  + Math.sin(t * 0.2) * 15 + (Math.random() - 0.5) * 10),
      gsr: Math.max(0.5, this.baseline.gsr + Math.sin(t * 0.5) * 3  + (Math.random() - 0.5) * 2),
      rr:  Math.max(8,   this.baseline.rr  + Math.sin(t * 0.4) * 4  + (Math.random() - 0.5) * 3),
      eeg: Math.max(0.1, this.baseline.eeg + Math.sin(t * 0.6) * 0.5 + (Math.random() - 0.5) * 0.3),
    };
  }

  // ── _runStep — shared pipeline called from Gen1/Gen2 step() ─
  _runStep(f, z, beh, mState, mConf, mRule, ml) {
    // Inject lock via HumanSim
    if (this._injectTicksRemaining > 0) {
      this._injectTicksRemaining--;
      if (typeof HumanSim !== 'undefined' && this._injectForcedState) HumanSim.force(this._injectForcedState);
      if (this._injectTicksRemaining === 0) this._injectForcedState = null;
    }

    const now = Date.now();
    if (mState !== this.currentState && mConf >= 0.70 && (now - this.lastRuleFire) > this.cooldown) {
      this.prevState  = this.currentState;
      this.currentState = mState;
      this.stateConf  = mConf;
      this.stateChanges++;
      if (mRule) { this.rulesFired++; this.lastRuleFire = now; }
    } else if (mState === this.currentState) {
      this.stateConf = Math.min(0.99, mConf);
    } else if (!mRule && !ml) {
      // Both ML and rules missed — decay confidence
      this.stateConf = Math.max(0.3, this.stateConf - 0.01);
    }

    this._stateCounts[this.currentState] = (this._stateCounts[this.currentState] ?? 0) + 1;
    this._lastFiltered = f;

    UIAdaptive.adaptFont(this.currentState);
    ProtectionLayer.tickState(this.currentState);

    const rawEmp = checkEmpathy(this.currentState, this._lastAlertState);
    const bioSnap = { hrv: f.hrv, hr: f.hr, gsr: f.gsr, conf: this.stateConf, rule: mRule?.id, mlConf: ml?.confidence };
    const emp = ProtectionLayer.gate(rawEmp, bioSnap);
    if (emp && this.onEmpathy) this.onEmpathy(emp);

    // ---
    if (MetacognitiveMonitor.isHumanNeeded()) {
      const escalation = {
        type:    'referral',
        message: 'น้องลองช่วยมาหลายวิธีแล้ว แต่ตอนนี้ดูเหมือนคุณต้องการมากกว่านี้ ลองคุยกับคนที่ไว้ใจได้นะ 🤍',
        action:  'refer_human',
        _gated:  'metacog_escalation',
      };
      if (this.onEmpathy) this.onEmpathy(escalation);
      MetacognitiveMonitor.reset(); // reset หลัง escalate เพื่อไม่ spam
    }

    checkStateAlert(this.currentState, this._lastAlertState);
    this._lastAlertState = this.currentState;

    // History buffers
    this.waveBuffer.push(f.hrv); if (this.waveBuffer.length > 200) this.waveBuffer.shift();
    this.kalmanHistory.hrv.push(f.hrv); if (this.kalmanHistory.hrv.length > 80) this.kalmanHistory.hrv.shift();
    this.kalmanHistory.hr.push(f.hr);   if (this.kalmanHistory.hr.length  > 80) this.kalmanHistory.hr.shift();

    // Chart data
    const ts = new Date().toLocaleTimeString('th-TH', { hour12: false });
    this.chartData.labels.push(ts);
    this.chartData.hrv.push(+f.hrv.toFixed(1));
    this.chartData.hr.push(+f.hr.toFixed(1));
    this.chartData.gsr.push(+f.gsr.toFixed(2));
    this.chartData.eeg.push(+f.eeg.toFixed(2));
    this.chartData.rr.push(+f.rr.toFixed(1));

    return emp;
  }

  _trimChartData(extraKeys = []) {
    const keys = ['labels', 'hrv', 'hr', 'gsr', 'eeg', 'rr', ...extraKeys];
    if (this.chartData.labels.length > this.bufferSize) {
      keys.forEach(k => { if (this.chartData[k]) this.chartData[k].shift(); });
    }
  }

  // ---
  start(mode = 'random', rate = 500, noise = 0.05) {
    this.simMode = mode; this.updateRate = +rate; this.noiseLevel = +noise;
    this.running = true; this.paused = false; this.startTime = Date.now();
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.step(), this.updateRate);
    Streak.checkIn();
  }

  pause()  { this.paused = true; }
  resume() { this.paused = false; }

  async stop() {
    this.running = false; this.paused = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    if (this._trainDebounceTimer) { clearTimeout(this._trainDebounceTimer); this._trainDebounceTimer = null; }
    if (this._trainBuf.length >= 5 && typeof this._fusionTrain === 'function') await this._fusionTrain(this._trainBuf);
    SpacedRep.trainSession(this._sessionFeedback);
    this._sessionFeedback = [];
  }

  inject(state, ticks = 20) {
    if (typeof HumanSim !== 'undefined') {
      HumanSim.force(state);
      this._injectTicksRemaining = ticks;
      this._injectForcedState    = state;
    } else {
      this.injectedState = state.toUpperCase();
      this.injectedTicks = ticks;
    }
  }

  resetStats() {
    this.tick = 0; this.stateChanges = 0; this.rulesFired = 0;
    this.currentState = 'IDLE'; this.stateConf = 0;
    this._lastAlertState = 'IDLE';
    this._stateCounts = {};
    this._lastFiltered = null;
    this.injectedState = null; this.injectedTicks = 0;
    this._injectTicksRemaining = 0; this._injectForcedState = null;
    // Reset Kalman to defaults
    this.kalman = structuredClone(this._kalmanDefaults);
    // Reset adaptive Q jump counts (baseQ ไม่ต้อง reset — เป็น constant)
    if (this._adaptiveQ) {
      Object.keys(this._adaptiveQ).forEach(k => {
        this._adaptiveQ[k].jumpCount = 0;
        // reset Q ใน kalman ให้ตรง baseline ด้วย
        if (this.kalman[k]) this.kalman[k].Q = this._adaptiveQ[k].baseQ;
      });
    }
    // Reset empathy timers
    _empathyState.confusionStart = null; _empathyState.boredomStart = null;
    _empathyState.fatigueStart   = null; _empathyState.excitementTs  = null;
    _empathyState.disgustStart   = null;
    _empathyState.lastEmpathyMsg = null;
    // ---
    MetacognitiveMonitor.reset();
    this.chartData = { hrv:[], hr:[], gsr:[], eeg:[], rr:[], labels:[] };
  }

  // ---
  _handleEmpathy(emp) {
    showEmpathyBanner(emp);
    if (_audioEnabled && _audioCtx) {
      if (emp.type === 'confusion_prolonged') {
        playTone(523, 'sine', 0.3, 0.04, 0); playTone(494, 'sine', 0.3, 0.04, 0.35); playTone(440, 'sine', 0.5, 0.04, 0.7);
      } else if (emp.type === 'boredom_tease') {
        playTone(698, 'sine', 0.15, 0.06, 0); playTone(880, 'sine', 0.2, 0.06, 0.2);
      }
    }
    if (emp.message) speakNuengdeaw(emp.message);
    if (emp.action === 'breathing') setTimeout(playBreathingGuide, 2000);
    if (typeof handleEmpathyAction === 'function') handleEmpathyAction(emp.action);
  }
};
window.NuengdeawBaseEngine = NuengdeawBaseEngine;

// ===== END Nuengdeaw_Core.js =====

// ===== BEGIN Nuengdeaw_Sim_Human1.js =====

/**
 * ---
 * ║  Nuengdeaw Human Simulator — Human-in-the-Loop Emulator        ║
 * ║  =============================================================  ║
 * ║                                                                  ║
 * ---
 * ║                                                                  ║
 * ║  ทำหน้าที่:                                                      ║
 * ║    1. จำลองมนุษย์ที่สวมใส่เซ็นเซอร์ (HRV, HR, GSR, EEG)          ║
 * ║    2. จำลอง personality (Big Five), memory, circadian rhythm    ║
 * ║    3. จำลอง EEG microstates, IAF, PAC, P300                     ║
 * ║                                                                  ║
 * ║  🎯 วัตถุประสงค์:                                                ║
 * ---
 * ---
 * ║                                                                  ║
 * ---
 * ---
 * ║                                                                  ║
 * ---
 */

'use strict';

// ---
// EMOTION STATES — 14 states (original 8 + new 6)
// ---
const EMOTION_STATES = [
  'FLOW', 'READY', 'STRESS', 'CONFUSION', 'BOREDOM', 'EXCITEMENT', 'FATIGUE', 'NEUTRAL',
  'FRUSTRATION', // ↑↑ GSR, ↑↑ HR, ↑ theta, ↓ alpha (different from confusion)
  'ANXIETY',     // ↑↑ HR, ↑ GSR, ↓ HRV, ↑ beta (anticipatory)
  'CURIOSITY',   // ↑ HR, normal GSR, ↑ theta, ↑ gamma
  'DISGUST',     // ↓ HRV, ↑ GSR, specific EEG pattern
  'SURPRISE',    // transient HR spike, GSR spike, P300-like
  'CALM',        // high HRV, low HR, low GSR, alpha dominant
];

// ---
// PHYSIOLOGICAL REFERENCE TABLE
// Format: [mean, std, min, max]
// อ้างอิง: Berntson & Cacioppo HRV norms, Boucsein GSR atlas, Başar EEG atlas
// ---
const _PHYSIO_REF = {
  //              hrv(ms RMSSD)        hr(bpm)            gsr(µS)              rr(br/min)          eeg(µV² norm)
  FLOW:        { hrv:[52, 6, 28,80], hr:[66, 5, 54,80],  gsr:[2.8,0.8,1.0,6.5], rr:[13,2, 9,18], eeg:[0.55,0.10,0.25,0.90] },
  READY:       { hrv:[56, 5, 36,78], hr:[62, 5, 50,76],  gsr:[2.2,0.6,1.0,5.0], rr:[11,2, 8,16], eeg:[0.40,0.08,0.20,0.70] },
  STRESS:      { hrv:[18, 4, 10,30], hr:[108,8, 85,132], gsr:[15, 3, 8.0,25],   rr:[25,4,18,35], eeg:[3.10,0.30,2.0,4.2]  },
  CONFUSION:   { hrv:[22, 5, 12,36], hr:[98, 7, 78,120], gsr:[11, 2, 6.0,18],   rr:[22,3,16,30], eeg:[2.60,0.25,1.8,3.6]  },
  BOREDOM:     { hrv:[36, 5, 22,52], hr:[66, 4, 56,78],  gsr:[8.5,1.5,5.0,14],  rr:[14,2,10,18], eeg:[1.30,0.15,0.8,1.9]  },
  EXCITEMENT:  { hrv:[34, 5, 20,50], hr:[92, 8, 74,118], gsr:[12, 2, 7.0,20],   rr:[20,3,14,28], eeg:[1.70,0.20,1.0,2.6]  },
  FATIGUE:     { hrv:[30, 5, 16,46], hr:[70, 5, 58,86],  gsr:[3.5,0.8,1.5,7.5], rr:[16,2,11,22], eeg:[1.10,0.12,0.6,1.7]  },
  NEUTRAL:     { hrv:[38, 6, 22,58], hr:[72, 6, 57,92],  gsr:[4.5,1.0,2.0,9.0], rr:[15,2,10,20], eeg:[1.00,0.10,0.5,1.5]  },
  // ---
  FRUSTRATION: { hrv:[16, 4,  8,28], hr:[112,9, 90,138], gsr:[17, 3,10.0,28],   rr:[26,4,18,36], eeg:[3.30,0.30,2.2,4.5]  },
  ANXIETY:     { hrv:[14, 3,  7,24], hr:[115,9, 92,140], gsr:[16, 3, 9.0,26],   rr:[28,5,20,38], eeg:[3.50,0.35,2.4,4.8]  },
  CURIOSITY:   { hrv:[44, 5, 28,64], hr:[78, 6, 64,96],  gsr:[5.5,1.0,2.5,10],  rr:[16,2,11,22], eeg:[1.20,0.14,0.6,2.0]  },
  DISGUST:     { hrv:[20, 4, 10,32], hr:[90, 7, 72,112], gsr:[13, 2, 7.0,22],   rr:[20,3,14,28], eeg:[2.20,0.22,1.4,3.2]  },
  SURPRISE:    { hrv:[28, 6, 14,44], hr:[100,10,78,130], gsr:[14, 3, 7.0,24],   rr:[22,4,14,32], eeg:[2.00,0.25,1.2,3.0]  },
  CALM:        { hrv:[62, 6, 40,90], hr:[58, 4, 46,70],  gsr:[1.8,0.5,0.6,4.0], rr:[10,2, 6,14], eeg:[0.38,0.08,0.18,0.65]},
};

// ---
// EEG BAND TARGETS per state (normalized power)
// อ้างอิง: Klimesch (2018), Neuro Control Layer §EEG-Fusion
// ---
const _EEG_BAND_REF = {
  FLOW:        { theta:0.90, alpha:2.20, beta:1.00, gamma:0.50 },
  READY:       { theta:0.70, alpha:2.50, beta:0.80, gamma:0.30 },
  STRESS:      { theta:1.40, alpha:0.60, beta:2.80, gamma:1.20 },
  CONFUSION:   { theta:2.20, alpha:0.80, beta:2.00, gamma:0.80 },
  BOREDOM:     { theta:1.80, alpha:1.20, beta:0.70, gamma:0.20 },
  EXCITEMENT:  { theta:1.00, alpha:1.00, beta:2.50, gamma:1.50 },
  FATIGUE:     { theta:2.50, alpha:1.50, beta:0.50, gamma:0.20 },
  NEUTRAL:     { theta:1.00, alpha:1.00, beta:1.00, gamma:0.50 },
  // ---
  FRUSTRATION: { theta:1.80, alpha:0.50, beta:2.60, gamma:0.90 }, // ↑↑ theta, ↓ alpha
  ANXIETY:     { theta:1.20, alpha:0.55, beta:3.20, gamma:1.10 }, // ↑↑ beta (anticipatory)
  CURIOSITY:   { theta:1.60, alpha:1.30, beta:1.40, gamma:1.80 }, // ↑ theta + ↑ gamma
  DISGUST:     { theta:1.50, alpha:0.70, beta:1.80, gamma:0.60 }, // moderate arousal
  SURPRISE:    { theta:0.80, alpha:0.60, beta:2.20, gamma:2.00 }, // P300-like: ↑↑ gamma transient
  CALM:        { theta:0.60, alpha:3.00, beta:0.50, gamma:0.15 }, // alpha dominant, very low beta
};

// ---
// MARKOV TRANSITION MATRIX v0 — 14×14
// ---
// order: FLOW READY STRESS CONFUSION BOREDOM EXCITEMENT FATIGUE NEUTRAL
//        FRUSTRATION ANXIETY CURIOSITY DISGUST SURPRISE CALM
// ---
const _STATE_ORDER = [
  'FLOW','READY','STRESS','CONFUSION','BOREDOM','EXCITEMENT','FATIGUE','NEUTRAL',
  'FRUSTRATION','ANXIETY','CURIOSITY','DISGUST','SURPRISE','CALM',
];
const _MARKOV_TBL = {
  //              FL     RD     ST     CF     BD     EX     FT     NT     FR     AX     CU     DG     SP     CA
  FLOW:       [0.55, 0.12, 0.02, 0.03, 0.04, 0.07, 0.03, 0.02, 0.01, 0.01, 0.05, 0.01, 0.01, 0.03],
  READY:      [0.18, 0.42, 0.03, 0.06, 0.03, 0.05, 0.03, 0.03, 0.02, 0.02, 0.07, 0.01, 0.02, 0.03],
  STRESS:     [0.02, 0.04, 0.40, 0.12, 0.02, 0.01, 0.14, 0.05, 0.10, 0.07, 0.01, 0.01, 0.01, 0.00],
  CONFUSION:  [0.04, 0.08, 0.14, 0.36, 0.05, 0.02, 0.09, 0.04, 0.08, 0.05, 0.03, 0.01, 0.01, 0.00],
  BOREDOM:    [0.06, 0.08, 0.03, 0.04, 0.38, 0.12, 0.06, 0.04, 0.04, 0.02, 0.07, 0.02, 0.02, 0.02],
  EXCITEMENT: [0.14, 0.07, 0.06, 0.03, 0.04, 0.36, 0.05, 0.09, 0.03, 0.03, 0.04, 0.01, 0.04, 0.01],
  FATIGUE:    [0.03, 0.05, 0.09, 0.06, 0.12, 0.02, 0.42, 0.04, 0.06, 0.05, 0.02, 0.01, 0.01, 0.02],
  NEUTRAL:    [0.08, 0.13, 0.06, 0.06, 0.10, 0.08, 0.08, 0.22, 0.04, 0.04, 0.05, 0.02, 0.03, 0.01],
  FRUSTRATION:[0.02, 0.04, 0.22, 0.10, 0.02, 0.02, 0.08, 0.06, 0.32, 0.08, 0.01, 0.01, 0.00, 0.00],
  ANXIETY:    [0.01, 0.03, 0.20, 0.08, 0.02, 0.02, 0.10, 0.06, 0.08, 0.32, 0.02, 0.01, 0.01, 0.04],
  CURIOSITY:  [0.12, 0.10, 0.02, 0.04, 0.03, 0.10, 0.03, 0.05, 0.02, 0.02, 0.36, 0.02, 0.05, 0.04],
  DISGUST:    [0.02, 0.04, 0.10, 0.08, 0.05, 0.02, 0.07, 0.10, 0.06, 0.06, 0.02, 0.32, 0.02, 0.04],
  SURPRISE:   [0.05, 0.08, 0.06, 0.06, 0.04, 0.12, 0.03, 0.10, 0.04, 0.06, 0.10, 0.02, 0.20, 0.04],
  CALM:       [0.08, 0.10, 0.01, 0.02, 0.06, 0.04, 0.04, 0.10, 0.01, 0.02, 0.06, 0.02, 0.02, 0.42],
};

// ---
// PERSONALITY TRAITS — Big Five defaults (0..1)
// ---
const _DEFAULT_PERSONALITY = {
  openness:          0.5,  // affects curiosity/excitement threshold
  conscientiousness: 0.5,  // affects boredom threshold, flow duration
  extraversion:      0.5,  // affects baseline HR, GSR reactivity
  agreeableness:     0.5,  // affects stress recovery rate
  neuroticism:       0.5,  // affects stress reactivity, anxiety proneness
};

// ---
// USER MEMORY — cross-session state
// ---
const _DEFAULT_MEMORY = {
  sessionHistory:       [],   // last 30 session summaries
  stressEpisodes:       [],   // { ts, duration }[]
  burnoutRisk:          0,    // 0..1 cumulative
  flowMoments:          [],   // timestamps when entered FLOW
  fatigueAccumulation:  0,    // cross-session sleep pressure proxy
};

// ---
// CONTEXT — situational modifiers
// ---
const _DEFAULT_CONTEXT = {
  timeOfDay:     'morning',  // morning | afternoon | evening | night
  dayOfWeek:     1,          // 1=Mon..7=Sun
  socialContext: 'alone',    // alone | with_friends | in_class | presentation
  taskType:      'learning', // learning | gaming | creative | routine | rest
  environment:   'quiet',    // quiet | noisy | moving
  caffeineIntake: 0,         // mg — affects HR baseline
  sleepQuality:   7,         // 1..10 — affects fatigue onset
  ambientTemp:    23,        // °C — affects GSR via thermoregulation
  systolicBP:     120,       // mmHg baseline — baroreflex coupling
};

// ---
// EEG MICROSTATES (4 classical)
// ---
const MICROSTATES = {
  A: 'self_referential',  // default mode
  B: 'visual',            // attention
  C: 'salience',          // switching
  D: 'attention',         // executive
};

// ---
// CIRCADIAN AMPLITUDE TABLE (per hour 0-23)
// HRV amplitude (ms) and HR amplitude (bpm) per hour-of-day
// อ้างอิง: Monk et al. (1997), Dijk & Czeisler (1995)
// ---
const _CIRCADIAN_TABLE = {
  // hour: [dHRV, dHR, dGSR]
   0: [-8,  4, -1.2],  1: [-12, 6, -1.6],  2: [-15, 7, -1.9],  3: [-18, 8, -2.0],
   4: [-18, 8, -2.0],  5: [-15, 7, -1.8],  6: [-10, 5, -1.4],  7: [-5,  3, -1.0],
   8: [-2,  2, -0.5],  9: [0,   0, 0.0],  10: [2,  -1, 0.3],  11: [3,  -2, 0.5],
  12: [2,  -1, 0.3],  13: [1,   0, 0.2],  14: [-3,  2, -0.4], 15: [-2,  1, -0.3],
  16: [1,  -1, 0.2],  17: [3,  -2, 0.4],  18: [4,  -2, 0.5],  19: [5,  -3, 0.6],
  20: [5,  -3, 0.6],  21: [4,  -2, 0.5],  22: [2,  -1, 0.3],  23: [-3,  2, -0.6],
};

// ---
// HUMAN SIMULATOR IIFE
// ---
const HumanSim = (() => {
  let _state     = 'NEUTRAL';
  let _prevState = 'NEUTRAL';
  let _tick      = 0;
  let _stateAge  = 0;
  let _refractory= 0;
  let _scenarioQ = [];
  let _history   = [];    // {state, ts}[] for dashboard

  // ---
  let _personality = { ..._DEFAULT_PERSONALITY };
  let _memory      = {
    sessionHistory:      [],
    stressEpisodes:      [],
    burnoutRisk:         0,
    flowMoments:         [],
    fatigueAccumulation: 0,
  };
  let _context = { ..._DEFAULT_CONTEXT };

  // ── Individual Alpha Frequency (IAF) — varies per person ──
  const _iaf = 9.5 + (Math.random() - 0.5) * 1.5;  // 8..11 Hz range

  // ---
  let _p300 = null;

  // ---
  let _empathyBoost = null;

  // ── Ornstein-Uhlenbeck particles — each signal has own θ, σ ──
  const _ou = {
    hrv:     { x: 38,  th: 0.07, sig: 1.4  },
    hr:      { x: 72,  th: 0.07, sig: 1.8  },
    gsr:     { x: 4.5, th: 0.09, sig: 0.38 },
    rr:      { x: 15,  th: 0.06, sig: 0.75 },
    eeg:     { x: 1.0, th: 0.11, sig: 0.05 },
    theta_b: { x: 1.0, th: 0.09, sig: 0.07 },
    alpha_b: { x: 1.0, th: 0.09, sig: 0.07 },
    beta_b:  { x: 1.0, th: 0.11, sig: 0.09 },
    gamma_b: { x: 0.5, th: 0.14, sig: 0.06 },
  };

  // Circadian state
  let _hour      = new Date().getHours();
  let _sleepP    = 0;      // 0..1 Process S (sleep pressure)
  let _ultra     = 0;      // 0..2π BRAC ultradian phase
  let _ultraRate = (2 * Math.PI) / 10800; // 90-min cycle @ 500ms/tick

  // ---
  const _clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const _randn  = () => {   // Box-Muller
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // OU step: dx = θ(µ-x)dt + σ·dW
  const _ouStep = (key, mu) => {
    const o = _ou[key];
    o.x = _clamp(o.x + o.th * (mu - o.x) + o.sig * _randn(), -99999, 99999);
    return o.x;
  };

  // Sample from physio table
  const _sample = (key, state) => {
    const [mean, , lo, hi] = _PHYSIO_REF[state][key];
    return _clamp(_ouStep(key, mean), lo, hi);
  };

  // ---
  const _applyContextBaseline = (bio) => {
    const c = _context;
    // Social context: GSR/HR elevated with others
    if (c.socialContext === 'with_friends')   { bio.gsr += 1.5; bio.hr += 3; }
    if (c.socialContext === 'in_class')       { bio.gsr += 2.0; bio.hr += 4; }
    if (c.socialContext === 'presentation')   { bio.gsr += 4.0; bio.hr += 8; }
    // Caffeine: raises HR baseline (approx 1 bpm per 50 mg)
    bio.hr = _clamp(bio.hr + c.caffeineIntake * 0.02, 40, 145);
    // Sleep quality: poor sleep → higher fatigue accumulation impact
    const sleepPenalty = (10 - c.sleepQuality) * 0.04;
    bio.hrv = _clamp(bio.hrv - sleepPenalty * 8, 6, 95);
    bio.hr  = _clamp(bio.hr  + sleepPenalty * 4, 40, 145);
    // Memory: if 3+ stress episodes in last 24h → elevated baseline
    const recent24h = Date.now() - 86400000;
    const recentStress = _memory.stressEpisodes.filter(e => e.ts > recent24h).length;
    if (recentStress >= 3) { bio.hr += 5; bio.gsr += 1.2; }
    return bio;
  };

  // ---
  const _applyPersonalityBaseline = (bio) => {
    const p = _personality;
    // High extraversion → elevated baseline HR and GSR
    bio.hr  = _clamp(bio.hr  + (p.extraversion  - 0.5) * 6,  40, 145);
    bio.gsr = _clamp(bio.gsr + (p.extraversion  - 0.5) * 1.5, 0.3, 28);
    // High neuroticism → lower HRV baseline
    bio.hrv = _clamp(bio.hrv - (p.neuroticism   - 0.5) * 8,  6,  95);
    return bio;
  };

  // ---
  const _thermoRegulation = (bio) => {
    const t = _context.ambientTemp;
    if (t > 28) bio.gsr = _clamp(bio.gsr * 1.2, 0.3, 28);
    else if (t < 18) bio.gsr = _clamp(bio.gsr * 0.7, 0.3, 28);
    return bio;
  };

  // ---
  const _baroreflex = (bio) => {
    const delta = _context.systolicBP - 120;
    bio.hr = _clamp(bio.hr - delta * 0.05, 40, 145);
    return bio;
  };

  // ---
  const _addRSA = (bio) => {
    const breathRate = bio.rr;
    const rsaAmp = 8 / Math.max(breathRate, 4);
    bio.hrv = _clamp(
      bio.hrv + rsaAmp * Math.sin(Date.now() / (60000 / Math.max(breathRate, 4))),
      6, 95
    );
    return bio;
  };

  // ---
  const _nextState = () => {
    const row = [..._MARKOV_TBL[_state]];
    const p   = _personality;

    // Personality modifiers (index-based)
    const idx = (s) => _STATE_ORDER.indexOf(s);
    const boost = (s, val) => { const i = idx(s); if (i >= 0) row[i] = _clamp(row[i] + val, 0, 1); };

    // Neuroticism: harder to leave STRESS/ANXIETY
    if (p.neuroticism > 0.5) {
      boost('STRESS',      (p.neuroticism - 0.5) * 0.30);
      boost('ANXIETY',     (p.neuroticism - 0.5) * 0.30);
      boost('CALM',       -(p.neuroticism - 0.5) * 0.20);
    }
    // Extraversion: more EXCITEMENT, less BOREDOM
    if (p.extraversion > 0.5) {
      boost('EXCITEMENT',  (p.extraversion - 0.5) * 0.16);
      boost('BOREDOM',    -(p.extraversion - 0.5) * 0.10);
    }
    // Conscientiousness: more FLOW persistence
    if (p.conscientiousness > 0.5) {
      const selfIdx = idx(_state);
      if (_state === 'FLOW') row[selfIdx] = _clamp(row[selfIdx] + (p.conscientiousness - 0.5) * 0.24, 0, 1);
      boost('BOREDOM',    -(p.conscientiousness - 0.5) * 0.16);
    }
    // Openness: more CURIOSITY transitions
    boost('CURIOSITY', (p.openness - 0.5) * 0.12);
    // Agreeableness: faster stress recovery
    if (_state === 'STRESS' || _state === 'FRUSTRATION') {
      boost('NEUTRAL', (p.agreeableness - 0.5) * 0.10);
      boost('CALM',    (p.agreeableness - 0.5) * 0.06);
    }

    // Normalize row to sum = 1
    const total = row.reduce((a, b) => a + b, 0);
    const norm  = row.map(v => v / total);

    let r = Math.random(), cum = 0;
    for (let i = 0; i < _STATE_ORDER.length; i++) {
      cum += norm[i];
      if (r < cum) return _STATE_ORDER[i];
    }
    return _state;
  };

  // ---
  const _updateMemory = (next) => {
    const now = Date.now();
    if (_state === 'STRESS' || _state === 'ANXIETY' || _state === 'FRUSTRATION') {
      if (next !== _state) {
        _memory.stressEpisodes.push({ ts: now, duration: _stateAge });
        if (_memory.stressEpisodes.length > 100) _memory.stressEpisodes.shift();
        _memory.burnoutRisk = _clamp(_memory.burnoutRisk + 0.02, 0, 1);
      }
    }
    if (next === 'FLOW') {
      _memory.flowMoments.push(now);
      if (_memory.flowMoments.length > 200) _memory.flowMoments.shift();
      _memory.burnoutRisk = _clamp(_memory.burnoutRisk - 0.01, 0, 1);
    }
  };

  const _flipTo = (next) => {
    if (next === _state) return;
    _updateMemory(next);
    _prevState = _state;
    _state     = next;
    _stateAge  = 0;
    _refractory = 3;
    _history.push({ state: next, ts: Date.now() });
    if (_history.length > 500) _history.shift();
    // Trigger P300 on SURPRISE
    if (next === 'SURPRISE') {
      _p300 = { latency: 300 + Math.random() * 50, amplitude: 5 + Math.random() * 3, ts: Date.now() };
    }
    if (typeof logSys === 'function') logSys(`HumanSim: ${_prevState} → ${_state}`);
  };

  // ---
  const _computePAC = (thetaPhase, gammaAmp) => gammaAmp * Math.cos(thetaPhase);

  // ---
  const _getMicrostate = () => {
    const map = {
      FLOW: 'D', READY: 'D', STRESS: 'C', CONFUSION: 'C',
      BOREDOM: 'A', EXCITEMENT: 'B', FATIGUE: 'A', NEUTRAL: 'A',
      FRUSTRATION: 'C', ANXIETY: 'C', CURIOSITY: 'B',
      DISGUST: 'C', SURPRISE: 'B', CALM: 'A',
    };
    return map[_state] ?? 'A';
  };

  // ---
  const _crossCorr = (bio) => {
    const ref = _PHYSIO_REF[_state];
    // RSA: HRV↑ → HR↓  (partial correlation r ≈ -0.60)
    const dHRV = bio.hrv - ref.hrv[0];
    bio.hr  = _clamp(bio.hr  - 0.42 * dHRV, ref.hr[2], ref.hr[3]);
    // HR↑ → GSR↑ moderate (sympathetic coupling)
    const dHR = bio.hr - ref.hr[0];
    bio.gsr = _clamp(bio.gsr + 0.018 * dHR, ref.gsr[2], ref.gsr[3]);
    return bio;
  };

  // ---
  const _circadianCorr = (bio) => {
    const h   = _hour;
    const row = _CIRCADIAN_TABLE[h] ?? [0, 0, 0];
    const [dHRV, dHR, dGSR] = row;

    // Ultradian modulation (±15% of circadian amplitude)
    const ultra = Math.sin(_ultra);

    // Sleep pressure additive (max effect at 16h session)
    const sp = _sleepP;

    bio.hrv = _clamp(bio.hrv + dHRV       + ultra * 3.0  - sp * 11.0, 8,   95);
    bio.hr  = _clamp(bio.hr  + dHR        - ultra * 1.8  + sp * 5.5,  40, 145);
    bio.gsr = _clamp(bio.gsr + dGSR       + ultra * 0.5  + sp * 2.0,  0.3, 28);
    bio.rr  = _clamp(bio.rr  - dHRV * 0.1 + ultra * 0.6 + sp * 1.5,  6,   36);
    bio.eeg = _clamp(bio.eeg - dHRV * 0.018 + sp * 0.30,              0.05, 5.0);

    return bio;
  };

  // ---
  const _tickCircadian = () => {
    _ultra  = (_ultra + _ultraRate) % (2 * Math.PI);
    _sleepP = Math.min(1.0, _sleepP + 1 / 115200);  // full at ~16h session
    // Sync real clock hour every 7200 ticks (~1h)
    if (_tick % 7200 === 0) _hour = new Date().getHours();
  };

  // ---
  const _SCENARIOS = {
    study_session:   ['NEUTRAL','READY','READY','FLOW','FLOW','FLOW','FATIGUE','NEUTRAL'],
    stress_arc:      ['READY','READY','STRESS','STRESS','STRESS','FATIGUE','FATIGUE','NEUTRAL'],
    boredom_break:   ['NEUTRAL','BOREDOM','BOREDOM','EXCITEMENT','FLOW','FLOW'],
    exam_panic:      ['READY','EXCITEMENT','STRESS','CONFUSION','CONFUSION','FATIGUE'],
    anxiety_spiral:  ['READY','ANXIETY','ANXIETY','STRESS','FRUSTRATION','FATIGUE','NEUTRAL'],
    curiosity_flow:  ['NEUTRAL','CURIOSITY','CURIOSITY','FLOW','FLOW','CALM'],
    recovery:        ['STRESS','FATIGUE','NEUTRAL','CALM','CALM','READY'],
  };

  // ---
  return {
    tick() {
      _tick++;
      _stateAge++;
      _tickCircadian();
      if (_refractory > 0) { _refractory--; return; }

      // Dwell times — extended for new high-arousal and sticky states
      const HIGH_DWELL = ['STRESS','CONFUSION','FRUSTRATION','ANXIETY'];
      const MED_DWELL  = ['FLOW','FATIGUE','CALM'];
      const minDwell = HIGH_DWELL.includes(_state) ? 6
                     : MED_DWELL.includes(_state)  ? 4 : 2;

      // Personality: neuroticism extends stress dwell
      const neuroExt = (_state === 'STRESS' || _state === 'ANXIETY')
        ? Math.round((_personality.neuroticism - 0.5) * 8) : 0;
      // Personality: conscientiousness extends FLOW dwell
      const conExt   = _state === 'FLOW'
        ? Math.round((_personality.conscientiousness - 0.5) * 6) : 0;

      if (_stateAge < minDwell + neuroExt + conExt) return;

      if (_scenarioQ.length > 0) {
        const target = _scenarioQ[0];
        if (_state === target && _stateAge >= minDwell + 2) _scenarioQ.shift();
        else if (_state !== target) _flipTo(target);
      } else {
        const esc = Math.min(1.0, _stateAge / 40) * 0.15;
        if (Math.random() < esc) _flipTo(_nextState());
      }
    },

    generateBio() {
      let bio = {
        hrv: _sample('hrv', _state),
        hr:  _sample('hr',  _state),
        gsr: _sample('gsr', _state),
        rr:  _sample('rr',  _state),
        eeg: _sample('eeg', _state),
      };
      bio = _crossCorr(bio);
      bio = _circadianCorr(bio);
      // v0: new physio realism layers
      bio = _addRSA(bio);
      bio = _baroreflex(bio);
      bio = _thermoRegulation(bio);
      bio = _applyPersonalityBaseline(bio);
      bio = _applyContextBaseline(bio);
      // Empathy effect: if active stress-comfort, boost HRV
      if (_empathyBoost && (_state === 'STRESS' || _state === 'ANXIETY' || _state === 'FRUSTRATION')) {
        bio.hrv = _clamp(bio.hrv + _empathyBoost.hrvBoost, 6, 95);
        _empathyBoost = null;  // consume
      }
      return bio;
    },

    generateEEGBands() {
      const t     = _EEG_BAND_REF[_state];
      let theta   = _clamp(_ouStep('theta_b', t.theta), 0.10, 5.0);
      let alpha   = _clamp(_ouStep('alpha_b', t.alpha), 0.10, 5.0);
      let beta    = _clamp(_ouStep('beta_b',  t.beta),  0.10, 6.0);
      let gamma   = _clamp(_ouStep('gamma_b', t.gamma), 0.05, 3.0);

      // ---
      if (_state === 'CONFUSION' || _state === 'STRESS' || _state === 'FRUSTRATION') {
        alpha = _clamp(alpha, 0.1, Math.min(alpha, theta * 0.55));
      }
      if (_state === 'FLOW' || _state === 'READY') {
        theta = _clamp(theta, 0.1, Math.min(theta, alpha * 0.50));
        beta  = _clamp(beta,  0.1, 1.4);
      }
      if (_state === 'FATIGUE') {
        beta  = _clamp(beta  * 0.62, 0.1, 1.0);
        gamma = _clamp(gamma * 0.58, 0.05, 0.5);
      }
      if (_state === 'EXCITEMENT' || _state === 'CURIOSITY') {
        gamma = _clamp(gamma, Math.max(gamma, beta * 0.58), 3.0);
      }
      // CALM: alpha dominant, all others suppressed
      if (_state === 'CALM') {
        theta = _clamp(theta, 0.1, Math.min(theta, alpha * 0.25));
        beta  = _clamp(beta  * 0.4, 0.1, 0.6);
        gamma = _clamp(gamma * 0.3, 0.05, 0.25);
      }
      // ANXIETY: beta dominant
      if (_state === 'ANXIETY') {
        beta  = _clamp(beta, Math.max(beta, 2.5), 6.0);
        alpha = _clamp(alpha * 0.5, 0.1, 1.0);
      }
      // SURPRISE: transient gamma spike (P300-like)
      if (_state === 'SURPRISE') {
        gamma = _clamp(gamma * 1.8, 0.05, 3.0);
      }

      // ---
      const iafRatio = _iaf / 10.0;  // normalize around 1.0
      alpha = _clamp(alpha * iafRatio, 0.1, 5.0);

      // ---
      const thetaPhase = (Date.now() / 1000) * 2 * Math.PI * (t.theta * 0.5);
      const pac        = _computePAC(thetaPhase, gamma);
      gamma = _clamp(gamma + pac * 0.06, 0.05, 3.0);

      // ---
      const microstate = _getMicrostate();

      return {
        theta,
        alpha,
        beta,
        gamma,
        thetaAlphaRatio: alpha > 0.01 ? theta / alpha : 1.0,
        iaf:             _iaf,
        microstate,
        microstateLabel: MICROSTATES[microstate],
        p300:            _p300,  // non-null for 1 tick after SURPRISE entry
      };
    },

    // ---
    getState()       { return _state; },
    getPrevState()   { return _prevState; },
    getTick()        { return _tick; },
    getHistory()     { return [..._history]; },
    getPersonality() { return { ..._personality }; },
    getMemory()      { return { ..._memory, stressEpisodes: [..._memory.stressEpisodes] }; },
    getContext()     { return { ..._context }; },

    /**
     * _physioRef(stateName) → { hrv, hr, gsr, rr, eeg } mean values
     * Used by NuengdeawBaseEngine.generateRaw() on inject()
     */
    _physioRef(stateName) {
      const r = _PHYSIO_REF[stateName?.toUpperCase()];
      if (!r) return null;
      return { hrv: r.hrv[0], hr: r.hr[0], gsr: r.gsr[0], rr: r.rr[0], eeg: r.eeg[0] };
    },

    /**
     * setPersonality(traits) — set Big Five personality traits (0..1)
     * Example: HumanSim.setPersonality({ neuroticism: 0.8 })
     */
    setPersonality(traits = {}) {
      _personality = { ..._DEFAULT_PERSONALITY, ..._personality, ...traits };
      // Apply neuroticism: stress/anxiety dwell already handled in tick()
      if (typeof logSys === 'function') logSys('HumanSim: personality updated', _personality);
    },

    /**
     * setContext(ctx) — update situational context
     * Example: HumanSim.setContext({ socialContext: 'in_class', caffeineIntake: 200 })
     */
    setContext(ctx = {}) {
      _context = { ..._DEFAULT_CONTEXT, ..._context, ...ctx };
      if (typeof logSys === 'function') logSys('HumanSim: context updated', _context);
    },

    /**
     * applyEmpathy(type) — emotional contagion / social mirroring
     * type: 'stress_comfort' | 'encouragement' | 'calm_presence'
     */
    applyEmpathy(type = 'stress_comfort') {
      if (type === 'stress_comfort' && (
        _state === 'STRESS' || _state === 'ANXIETY' || _state === 'FRUSTRATION'
      )) {
        _empathyBoost = { hrvBoost: 5 };
        // 30% boost to exiting current aroused state on next Markov roll
        _refractory = 0;
        if (typeof logSys === 'function') logSys('HumanSim: empathy effect applied (stress_comfort)');
      } else if (type === 'encouragement') {
        _empathyBoost = { hrvBoost: 3 };
        if (typeof logSys === 'function') logSys('HumanSim: empathy effect applied (encouragement)');
      } else if (type === 'calm_presence') {
        _empathyBoost = { hrvBoost: 8 };
        if (_state !== 'CALM') _flipTo('CALM');
        if (typeof logSys === 'function') logSys('HumanSim: empathy effect applied (calm_presence)');
      }
    },

    setScenario(name) {
      _scenarioQ = _SCENARIOS[name] ? [..._SCENARIOS[name]] : [];
      if (typeof logSys === 'function') logSys(`HumanSim: scenario="${name ?? 'free'}"`);
    },

    /**
     * force(stateName) — inject state immediately
     * Accepts any case (normalizes to uppercase), supports all 14 states
     */
    force(stateName) {
      const upper = stateName?.toUpperCase();
      if (_PHYSIO_REF[upper]) _flipTo(upper);
    },

    reset() {
      _state = 'NEUTRAL'; _prevState = 'NEUTRAL';
      _tick = 0; _stateAge = 0; _refractory = 0;
      _scenarioQ = []; _history = [];
      _ultra = Math.random() * 2 * Math.PI;
      _sleepP = 0;
      _hour = new Date().getHours();
      _p300 = null;
      _empathyBoost = null;
      const defaults = { hrv:38, hr:72, gsr:4.5, rr:15, eeg:1.0, theta_b:1.0, alpha_b:1.0, beta_b:1.0, gamma_b:0.5 };
      for (const k of Object.keys(_ou)) _ou[k].x = defaults[k] ?? 1.0;
      if (typeof logSys === 'function') logSys('HumanSim: reset');
    },

    snapshot() {
      return {
        state:      _state,
        prevState:  _prevState,
        tick:       _tick,
        stateAge:   _stateAge,
        refractory: _refractory,
        circadian: {
          hour:          _hour,
          ultra:         (_ultra * 180 / Math.PI).toFixed(1) + '°',
          sleepPressure: _sleepP.toFixed(4),
          table:         _CIRCADIAN_TABLE[_hour],
        },
        personality:  { ..._personality },
        memory: {
          burnoutRisk:         _memory.burnoutRisk.toFixed(3),
          recentStressCount:   _memory.stressEpisodes.filter(e => e.ts > Date.now() - 86400000).length,
          flowMomentCount:     _memory.flowMoments.length,
          fatigueAccumulation: _memory.fatigueAccumulation.toFixed(3),
        },
        context:      { ..._context },
        iaf:          _iaf.toFixed(2),
        microstate:   _getMicrostate(),
        p300Active:   !!_p300,
        ou: JSON.parse(JSON.stringify(_ou)),
      };
    },
  };
})();
window.HumanSim      = HumanSim;
window.EMOTION_STATES = EMOTION_STATES;
window.MICROSTATES    = MICROSTATES;

// ---
// AUTO-PATCH engine.step() on load
// ---
// [FIX-3] เมื่อใช้ bundle (nuengdeaw.bundle.js) ไม่ต้องใช้ auto-patch นี้
// ---
// ---
window.addEventListener('load', () => {
  // ---
  if (window._nuengdeawBundled) return;
  if (typeof engine === 'undefined') {
    if (typeof logSys === 'function') logSys('HumanSim: engine not found — skip auto-patch');
    return;
  }

  const isGen2 = typeof engine._eegBands !== 'undefined';

  if (!isGen2) {
    // ---
    const _orig = engine.step.bind(engine);
    engine.step = function () {
      const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
      if (!hs || typeof hs.tick !== 'function' || typeof hs.generateBio !== 'function') {
        _orig();
        return;
      }
      hs.tick();
      if (!engine._wearableData) {
        let bio = hs.generateBio();
        // Apply DeceptionEngine BEFORE Kalman (raw signal level)
        if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
          bio = DeceptionEngine.applyDeception(bio, null).bio;
        }
        engine._wearableData = bio;
        _orig();
        engine._wearableData = null;
      } else {
        _orig();
      }
    };
    if (typeof logSys === 'function') logSys('HumanSim: Gen1 patch ✅');

  } else {
    // ---
    engine.generateRaw = () => {
      const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
      let bio = (hs && typeof hs.generateBio === 'function')
        ? hs.generateBio()
        : { hrv:38, hr:72, gsr:4.5, rr:15, eeg:1.0 };
      if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
        bio = DeceptionEngine.applyDeception(bio, null).bio;
      }
      return bio;
    };

    const _orig = engine.step.bind(engine);
    engine.step = function () {
      const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
      if (!hs || typeof hs.tick !== 'function' || typeof hs.generateEEGBands !== 'function') {
        _orig();
        return;
      }
      hs.tick();
      if (!window._museConnected) {
        let bands = hs.generateEEGBands();
        if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
          const d  = DeceptionEngine.applyDeception({ hrv:0, hr:0, gsr:0, rr:0, eeg:0 }, bands);
          bands    = d.bands ?? bands;
        }
        engine._eegBands = bands;
        engine._n400Veto = bands.thetaAlphaRatio > 2.4;
      }
      _orig();
    };
    if (typeof logSys === 'function') logSys('HumanSim: Gen2 patch ✅');
  }
});

// ===== END Nuengdeaw_Sim_Human1.js =====

// ===== BEGIN Nuengdeaw_Sim_Human2.js =====

/**
 * ---
 * ║  Nuengdeaw Upgrade Patch — Human Artifacts & Deception          ║
 * ║  =============================================================  ║
 * ║                                                                  ║
 * ---
 * ║                                                                  ║
 * ║  มีอะไรบ้าง:                                                    ║
 * ---
 * ║    • DeceptionScorer — PCI (Physiological Coherence Index)      ║
 * ║    • ArtifactDetector — ตรวจจับ motion, blink, electrode pop    ║
 * ║    • ABTestManager — A/B testing framework                      ║
 * ║    • ModelPortability — TF.js weight export/import              ║
 * ║                                                                  ║
 * ║  🎯 วัตถุประสงค์:                                                ║
 * ---
 * ---
 * ║                                                                  ║
 * ---
 */

'use strict';

// ---
// A. DECEPTION ENGINE
// ---
const DeceptionEngine = (() => {
  let _level     = 0;     // 0-4
  let _active    = false;
  let _tick      = 0;
  let _autoTimer = null;
  let _reboundCd = 0;
  let _flatCount = 0;

  const _lerp  = (a, b, t) => a + (b - a) * t;
  const _randn = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---
  // HR/HRV suppressed toward NEUTRAL, GSR micro-leaks every 7-13 ticks
  const _level1 = (bio, bands) => {
    const truState = typeof HumanSim !== 'undefined' ? HumanSim.getState() : 'NEUTRAL';
    if (['STRESS','CONFUSION','EXCITEMENT'].includes(truState)) {
      bio.hr  = _lerp(bio.hr,  72, 0.55);
      bio.hrv = _lerp(bio.hrv, 40, 0.50);
      bio.hrv = Math.max(bio.hrv, 28);  // HRV lag
      if (_tick % (7 + Math.floor(Math.random() * 6)) === 0) {
        bio.gsr = Math.min(bio.gsr * 1.35 + 0.8, 22);  // GSR micro-spike
      } else {
        bio.gsr = _lerp(bio.gsr, 5.0, 0.40);
      }
    }
    return { bio, bands };
  };

  // ---
  // Meditation-grade suppression, but Theta/Alpha mismatch + sympathetic rebound
  const _level2 = (bio, bands) => {
    bio.hr  = _lerp(bio.hr,  64, 0.70);
    bio.hrv = _lerp(bio.hrv, 54, 0.65);
    bio.gsr = _lerp(bio.gsr, 2.5, 0.60);
    _reboundCd = Math.max(0, _reboundCd - 1);
    if (_reboundCd === 0 && _tick % 20 === 0) {
      bio.hr  += 12 + Math.random() * 8;
      bio.gsr += 3.5 + Math.random() * 2;
      bio.hrv  = Math.max(bio.hrv - 14, 12);
      _reboundCd = 5;
    }
    if (bands) {
      bands.theta            = Math.max(bands.theta, 1.8 + Math.random() * 0.4);
      bands.alpha            = Math.min(bands.alpha, 1.1);
      bands.thetaAlphaRatio  = bands.theta / Math.max(bands.alpha, 0.01);
    }
    return { bio, bands };
  };

  // ---
  // Multi-channel facade, cross-channel coherence breaks
  const _level3 = (bio, bands) => {
    bio.hr  = _lerp(bio.hr,  72, 0.80);
    bio.hrv = _lerp(bio.hrv, 38, 0.78);
    bio.gsr = _lerp(bio.gsr, 4.5, 0.75);
    bio.rr  = _lerp(bio.rr,  15, 0.70);
    // Positive correlation between HR and HRV (should be anti-correlated)
    const noise = _randn() * 3;
    bio.hr  += noise * 0.8;
    bio.hrv += noise * 0.7;
    bio.rr  += _randn() * 2.5;
    bio.rr   = Math.max(8, Math.min(35, bio.rr));
    if (bands) {
      bands.beta            = Math.max(bands.beta,  2.2 + Math.random() * 0.6);
      bands.gamma           = Math.max(bands.gamma, 0.9 + Math.random() * 0.3);
      bands.thetaAlphaRatio = bands.theta / Math.max(bands.alpha, 0.01);
    }
    return { bio, bands };
  };

  // ---
  // Near-perfect flat affect; signatures: gamma burst, HRV alternans, micro-variance
  const _level4 = (bio, bands) => {
    _flatCount++;
    bio.hr  = _lerp(bio.hr,  70, 0.93);
    bio.hrv = _lerp(bio.hrv, 42, 0.91);
    bio.gsr = _lerp(bio.gsr, 4.2, 0.89);
    bio.rr  = _lerp(bio.rr,  14, 0.86);
    bio.eeg = _lerp(bio.eeg, 1.0, 0.89);
    // Signature 1: gamma burst every 15 ticks
    if (bands) {
      if (_flatCount % 15 === 0) {
        bands.gamma = 2.1 + Math.random() * 0.8;
      } else {
        bands.gamma = _lerp(bands.gamma, 0.3, 0.85);
      }
    }
    // Signature 2: HRV alternans (high-low beat pattern)
    if (_flatCount % 2 === 0) bio.hrv = Math.min(bio.hrv + 6, 65);
    else                       bio.hrv = Math.max(bio.hrv - 5, 22);
    // Signature 3: RR micro-flutter
    bio.rr += _randn() * 0.4;
    bio.rr  = Math.max(8, Math.min(36, bio.rr));
    if (bands) bands.thetaAlphaRatio = bands.theta / Math.max(bands.alpha, 0.01);
    return { bio, bands };
  };

  // ---
  const startAuto = (ticksPerLevel = 60) => {
    _active = true; _level = 1; _tick = 0;
    if (_autoTimer) clearInterval(_autoTimer);
    let elapsed = 0;
    _autoTimer = setInterval(() => {
      elapsed++;
      if (elapsed >= ticksPerLevel) {
        elapsed = 0; _level++;
        if (_level > 4) {
          _level = 0; _active = false;
          clearInterval(_autoTimer); _autoTimer = null;
          if (typeof logSys === 'function') logSys('DeceptionEngine: Auto-run complete');
          return;
        }
        if (typeof logSys === 'function') logSys(`DeceptionEngine: Auto-escalate → Level ${_level} (${['NONE','MILD','TRAINED_LIAR','PATHOLOGICAL','SOCIOPATH'][_level]})`);
      }
    }, 1000);
    if (typeof logSys === 'function') logSys(`DeceptionEngine: Auto-run started (4 levels × ${ticksPerLevel}s)`);
  };

  return {
    applyDeception(bio, bands) {
      if (!_active || _level === 0) return { bio, bands };
      _tick++;
      const fn = [null, _level1, _level2, _level3, _level4][_level];
      return fn ? fn(bio, bands) : { bio, bands };
    },
    setLevel(l)     { _level = Math.max(0, Math.min(4, l)); _active = _level > 0; _tick = 0; _flatCount = 0; _reboundCd = 0; },
    getLevel()      { return _level; },
    isActive()      { return _active; },
    getLevelName()  { return ['NONE','MILD','TRAINED_LIAR','PATHOLOGICAL','SOCIOPATH'][_level]; },
    startAuto,
    stopAuto()      { if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; } _active = false; _level = 0; },
  };
})();

// ---
// B. DECEPTION SCORER — Physiological Coherence Index (PCI) v2
// ---
const DeceptionScorer = (() => {
  const BUF     = 30;
  const _buf    = { hrv:[], hr:[], gsr:[], eeg:[], theta:[], alpha:[], rr:[] };
  let _history  = [];

  const _push = (key, val) => { _buf[key].push(val); if (_buf[key].length > BUF) _buf[key].shift(); };

  const _pearson = (xs, ys) => {
    const n = Math.min(xs.length, ys.length);
    if (n < 5) return 0;
    const mx = xs.slice(-n).reduce((s,v)=>s+v,0)/n;
    const my = ys.slice(-n).reduce((s,v)=>s+v,0)/n;
    let num=0, dx2=0, dy2=0;
    for (let i=0; i<n; i++) {
      const dx=xs[xs.length-n+i]-mx, dy=ys[ys.length-n+i]-my;
      num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy;
    }
    return (dx2*dy2>0) ? num/Math.sqrt(dx2*dy2) : 0;
  };

  const _variance = (arr, n=15) => {
    if (arr.length < n) return 1;
    const s = arr.slice(-n);
    const m = s.reduce((a,b)=>a+b,0)/n;
    return s.reduce((a,b)=>a+(b-m)**2,0)/n;
  };

  // Logistic violation transform — smooth ramp, not step
  const _logistic = (x, k=6, mid=0) => 1 / (1 + Math.exp(-k * (x - mid)));

  const _score = (bio, bands, stateName) => {
    _push('hrv', bio.hrv); _push('hr', bio.hr); _push('gsr', bio.gsr);
    _push('eeg', bio.eeg); _push('rr',  bio.rr);
    if (bands) { _push('theta', bands.theta ?? 1); _push('alpha', bands.alpha ?? 1); }

    if (_buf.hrv.length < 8) return { pci:0, deceptionFlag:false, violations:[], confidence:'insufficient_data' };

    const violations = [];
    let total = 0;

    // Pair 1: HRV ↔ HR — RSA: should be negative (weight 30%)
    const r1  = _pearson(_buf.hrv, _buf.hr);
    const v1  = _logistic(r1, 5, -0.2);  // penalty when r > -0.2
    if (v1 > 0.6) violations.push({ pair:'HRV->HR', r:+r1.toFixed(3), score:+v1.toFixed(3), note:'RSA mismatch' });
    total += v1 * 0.28;

    // Pair 2: HR ↔ GSR — sympathetic: should be positive (weight 20%)
    const r2  = _pearson(_buf.hr, _buf.gsr);
    const v2  = _logistic(-r2, 5, -0.1); // penalty when r < 0.1
    if (v2 > 0.6) violations.push({ pair:'HR->GSR', r:+r2.toFixed(3), score:+v2.toFixed(3), note:'ANS decoupling' });
    total += v2 * 0.20;

    // Pair 3: HR variance — Level 4 Sociopath (weight 15%)
    const hrVar = _variance(_buf.hr);
    const v3    = Math.max(0, 1 - hrVar / 1.5);
    if (v3 > 0.5) violations.push({ pair:'HR_variance', val:+hrVar.toFixed(3), score:+v3.toFixed(3), note:'HR平坦' });
    total += v3 * 0.15;

    // Pair 4: RR variance — respiratory arrhythmia check (weight 12%) — NEW v2
    const rrVar = _variance(_buf.rr, 12);
    const v4r   = Math.max(0, 1 - rrVar / 0.8);  // too flat = suspicious
    if (v4r > 0.5) violations.push({ pair:'RR_variance', val:+rrVar.toFixed(3), score:+v4r.toFixed(3), note:'respiratory suppression' });
    total += v4r * 0.12;

    // Pair 5: Theta/Alpha ratio vs State expectation (weight 15%)
    let v5 = 0;
    if (_buf.theta.length >= 5 && bands) {
      const ratio   = bands.thetaAlphaRatio ?? 1;
      const STATE_R = {
        FLOW:0.4, READY:0.3, STRESS:4.5, CONFUSION:2.7, BOREDOM:1.5,
        EXCITEMENT:1.0, FATIGUE:5.0, NEUTRAL:1.0,
        // New 6 states (HumanSim v0.0)
        FRUSTRATION:3.6, ANXIETY:2.2, CURIOSITY:1.2, DISGUST:2.1, SURPRISE:1.3, CALM:0.2,
      };
      const exp     = STATE_R[stateName] ?? 1.0;
      v5 = Math.min(1, Math.abs(ratio - exp) / (exp + 0.5));
      if (v5 > 0.35) violations.push({ pair:'ThetaAlpha->State', ratio:+ratio.toFixed(2), exp:+exp.toFixed(2), score:+v5.toFixed(3), note:'EEG-state mismatch' });
    }
    total += v5 * 0.15;

    // Pair 6: Bio mean vs State physiological reference (weight 10%)
    const MEAN_REF = {
      FLOW:       {hr:66,  hrv:52, gsr:2.8},
      READY:      {hr:62,  hrv:56, gsr:2.2},
      STRESS:     {hr:108, hrv:18, gsr:15},
      CONFUSION:  {hr:98,  hrv:22, gsr:11},
      BOREDOM:    {hr:66,  hrv:36, gsr:8.5},
      EXCITEMENT: {hr:92,  hrv:34, gsr:12},
      FATIGUE:    {hr:70,  hrv:30, gsr:3.5},
      NEUTRAL:    {hr:72,  hrv:38, gsr:4.5},
      // New 6 states (HumanSim v0.0)
      FRUSTRATION:{hr:112, hrv:16, gsr:17},
      ANXIETY:    {hr:115, hrv:14, gsr:16},
      CURIOSITY:  {hr:78,  hrv:44, gsr:5.5},
      DISGUST:    {hr:90,  hrv:20, gsr:13},
      SURPRISE:   {hr:100, hrv:28, gsr:14},
      CALM:       {hr:58,  hrv:62, gsr:1.8},
    };
    const ref      = MEAN_REF[stateName] ?? MEAN_REF.NEUTRAL;
    const nHR      = _buf.hr.slice(-10);
    const nGSR     = _buf.gsr.slice(-10);
    const hrMean   = nHR.reduce((s,v)=>s+v,0)/Math.min(nHR.length,10);
    const gsrMean  = nGSR.reduce((s,v)=>s+v,0)/Math.min(nGSR.length,10);
    const v6 = Math.min(1, (Math.abs(hrMean-ref.hr)/(ref.hr*0.30) + Math.abs(gsrMean-ref.gsr)/(ref.gsr*0.50)) / 2);
    if (v6 > 0.40) violations.push({ pair:'BioMean->State', hrObs:+hrMean.toFixed(1), hrExp:ref.hr, score:+v6.toFixed(3), note:'surface mismatch' });
    total += v6 * 0.10;

    const pci = Math.min(1.0, total);
    _history.push(pci);
    if (_history.length > 60) _history.shift();
    const avg = _history.reduce((s,v)=>s+v,0) / _history.length;

    const deceptionFlag = pci > 0.60 && violations.length >= 2;
    const confidence = avg > 0.75 ? 'high_deception' : avg > 0.60 ? 'probable_deception' : avg > 0.35 ? 'mild_inconsistency' : 'coherent';

    return { pci:+pci.toFixed(3), avgPci:+avg.toFixed(3), deceptionFlag, violations, confidence };
  };

  return {
    score:       _score,
    getHistory() { return [..._history]; },
    reset()      { Object.keys(_buf).forEach(k => _buf[k]=[]); _history=[]; },
  };
})();

// ---
// C. A/B TESTING FRAMEWORK
// ---
const ABTestManager = (() => {
  let _tests = StorageManager.getJSON(StorageManager.KEYS.ABTESTS, {}) ?? {};

  const _save = () => StorageManager.setJSON(StorageManager.KEYS.ABTESTS, _tests);

  // Welch t-test
  const _welchT = (a, b) => {
    if (a.length < 2 || b.length < 2) return { t:0, p:1 };
    const ma = a.reduce((s,v)=>s+v,0)/a.length;
    const mb = b.reduce((s,v)=>s+v,0)/b.length;
    const va = a.reduce((s,v)=>s+(v-ma)**2,0)/(a.length-1);
    const vb = b.reduce((s,v)=>s+(v-mb)**2,0)/(b.length-1);
    if (va+vb === 0) return { t:0, p:1 };
    const t = (ma-mb) / Math.sqrt(va/a.length + vb/b.length);
    const p = 2 * (1 - _normCDF(Math.abs(t)));
    return { t:+t.toFixed(3), p:+p.toFixed(4), ma:+ma.toFixed(3), mb:+mb.toFixed(3) };
  };

  // Abramowitz–Stegun normal CDF approximation
  const _normCDF = (z) => {
    const t = 1 / (1 + 0.2316419 * z);
    return 1 - (1/Math.sqrt(2*Math.PI)) * Math.exp(-0.5*z*z) * t *
           (0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429))));
  };

  // Sequential Probability Ratio Test (SPRT) — early stopping  NEW v2
  const _sprt = (a, b, h0diff = 0, h1diff = 0.1, alpha = 0.05, beta = 0.20) => {
    if (a.length < 5 || b.length < 5) return { decision:'continue', llr:0 };
    const { t, p } = _welchT(a, b);
    const llr = Math.log((1-beta)/alpha) * (p < alpha ? 1 : -0.5);
    const decision = llr > Math.log((1-beta)/alpha) ? 'stop_h1'
                   : llr < Math.log(beta/(1-alpha))  ? 'stop_h0'
                   : 'continue';
    return { decision, llr:+llr.toFixed(3), p };
  };

  return {
    createTest(id, variants=['control','treatment'], metric='flow_ticks', durationTicks=0) {
      _tests[id] = {
        id, variants, metric, durationTicks,
        createdAt: Date.now(), closed: false,
        data:             Object.fromEntries(variants.map(v => [v, []])),
        assignments:      {},
        totalAssignments: Object.fromEntries(variants.map(v => [v, 0])),
      };
      _save();
      if (typeof logSys === 'function') logSys(`ABTest: created "${id}" variants=[${variants}] metric="${metric}"`);
      return _tests[id];
    },

    assign(testId) {
      const t = _tests[testId];
      if (!t || t.closed) return null;
      const v = t.variants.reduce((a, b) => t.totalAssignments[a] <= t.totalAssignments[b] ? a : b);
      t.totalAssignments[v]++;
      _save();
      return v;
    },

    record(testId, variantName, value) {
      const t = _tests[testId];
      if (!t || t.closed || !t.data[variantName]) return;
      t.data[variantName].push(value);
      // SPRT early stopping
      if (t.variants.length >= 2) {
        const [v0, v1] = t.variants;
        const sprt = _sprt(t.data[v0] ?? [], t.data[v1] ?? []);
        if (sprt.decision !== 'continue') {
          t.sprtDecision = sprt;
          this.close(testId);
          if (typeof logSys === 'function') logSys(`ABTest "${testId}": SPRT early stop (${sprt.decision})`);
          return;
        }
      }
      if (t.durationTicks > 0) {
        const total = t.variants.reduce((s,v) => s + t.data[v].length, 0);
        if (total >= t.durationTicks) this.close(testId);
      }
      _save();
    },

    getResult(testId) {
      const t = _tests[testId];
      if (!t) return null;
      if (t.variants.length < 2) return { winner: t.variants[0], stats:{}, significant:false };
      const means = {};
      t.variants.forEach(v => {
        const d = t.data[v];
        means[v] = d.length > 0 ? d.reduce((s,x)=>s+x,0)/d.length : 0;
      });
      const winner = Object.entries(means).sort((a,b)=>b[1]-a[1])[0][0];
      const [v0, v1] = t.variants;
      const stats    = _welchT(t.data[v0] ?? [], t.data[v1] ?? []);
      return { winner, means, stats, significant: stats.p < 0.05, sampleSizes: Object.fromEntries(t.variants.map(v=>[v,t.data[v].length])), sprt: t.sprtDecision };
    },

    close(id)         { if (_tests[id]) { _tests[id].closed = true; _save(); } },
    listTests()       { return Object.keys(_tests); },
    getTest(id)       { return _tests[id] ?? null; },
    deleteTest(id)    { delete _tests[id]; _save(); },
    exportAll()       { return JSON.stringify(_tests, null, 2); },
    importAll(json)   { try { _tests = JSON.parse(json); _save(); return true; } catch { return false; } },
  };
})();

// ---
// D. MODEL PORTABILITY — TF.js export/import + FedAvg
// ---
const ModelPortability = (() => {
  const LS = StorageManager.KEYS.MODEL;  // prefix

  return {
    async exportModel(tfModel) {
      if (!tfModel) throw new Error('exportModel: model is null');
      const weights = tfModel.getWeights();
      const data    = await Promise.all(weights.map(async w => ({
        name:   w.name,
        shape:  w.shape,
        values: Array.from(await w.data()),
      })));
      weights.forEach(w => w.dispose());
      return JSON.stringify({ version:'nuengdeaw_v0.0', exportedAt:Date.now(), weights: data });
    },

    async importModel(tfModel, jsonStr) {
      if (!tfModel || !jsonStr) throw new Error('importModel: invalid args');
      const tf      = window.tf;
      if (!tf) throw new Error('TF.js not loaded');
      const data    = JSON.parse(jsonStr);
      const tensors = data.weights.map(w => tf.tensor(w.values, w.shape));
      tfModel.setWeights(tensors);
      tensors.forEach(t => t.dispose());
    },

    // Quantize: round weights to N decimal places (reduces JSON size ~60%)
    quantize(jsonStr, decimals = 4) {
      const data = JSON.parse(jsonStr);
      data.weights.forEach(w => { w.values = w.values.map(v => +v.toFixed(decimals)); });
      data.quantized = decimals;
      return JSON.stringify(data);
    },

    fedAvg(jsonStrings) {
      if (!jsonStrings?.length) throw new Error('fedAvg: empty input');
      const models = jsonStrings.map(j => JSON.parse(j));
      const n      = models.length;
      const merged = JSON.parse(JSON.stringify(models[0]));
      merged.exportedAt   = Date.now();
      merged.fedAvgSources = n;
      for (let wi = 0; wi < merged.weights.length; wi++) {
        const vals = merged.weights[wi].values;
        for (let i = 0; i < vals.length; i++) {
          let sum = 0;
          for (let mi = 0; mi < n; mi++) sum += models[mi].weights[wi].values[i];
          vals[i] = sum / n;
        }
      }
      return JSON.stringify(merged, null, 2);
    },

    saveToStorage(key, jsonStr) {
      try { StorageManager.set(LS + key, jsonStr); return true; }
      catch { return false; }
    },

    loadFromStorage(key) {
      return StorageManager.get(LS + key);
    },

    listStoredModels() {
      const keys = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('nuengdeaw_' + LS)) keys.push(k.replace('nuengdeaw_' + LS, ''));
        }
      } catch {}
      return keys;
    },
  };
})();

// ---
// E. ARTIFACT DETECTOR v2
// ---
const ArtifactDetector = (() => {
  const BUF  = 20;
  const _h   = { hr:[], gsr:[], eeg:[], hrv:[], alpha:[], rr:[] };
  let _last  = [];

  const _push = (k, v) => { _h[k].push(v); if (_h[k].length > BUF) _h[k].shift(); };
  const _mean = a => a.reduce((s,v)=>s+v,0)/a.length;
  const _std  = a => { const m=_mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };

  const _check = (bio, bands) => {
    _push('hr',  bio.hr);  _push('gsr', bio.gsr);
    _push('eeg', bio.eeg); _push('hrv', bio.hrv);
    _push('rr',  bio.rr ?? 15);
    if (bands) _push('alpha', bands.alpha ?? 1);

    const n   = _h.hr.length;
    if (n < 4) return { isClean:true, artifacts:[], severity:'ok', ready:false };

    const arts = [];

    // Motion GSR: delta > 5 µS in 1 tick
    if (n >= 2 && Math.abs(_h.gsr[n-1]-_h.gsr[n-2]) > 5.0) {
      arts.push({ type:'motion_gsr', delta:+Math.abs(_h.gsr[n-1]-_h.gsr[n-2]).toFixed(2), msg:'GSR spike จากการเคลื่อนไหว' });
    }

    // Motion HR: > 25 bpm jump
    if (n >= 2 && Math.abs(_h.hr[n-1]-_h.hr[n-2]) > 25) {
      arts.push({ type:'motion_hr', delta:+Math.abs(_h.hr[n-1]-_h.hr[n-2]).toFixed(1), msg:'HR spike - กรุณาอยู่นิ่ง' });
    }

    // ---
    if (n >= 8) {
      const m=_mean(_h.eeg), s=_std(_h.eeg);
      if (s>0 && Math.abs(bio.eeg-m) > 4*s) arts.push({ type:'electrode_pop', z:+((Math.abs(bio.eeg-m)/s)).toFixed(2), msg:'EEG electrode pop - ตรวจสอบตำแหน่งอิเล็กโทรด' });
    }

    // Eye blink: alpha spike > 2.5× previous
    if (bands && n >= 3) {
      const prev = _h.alpha[n-2] ?? 1;
      if ((bands.alpha ?? 1) > prev * 2.5 && (bands.alpha ?? 1) > 3.0) arts.push({ type: 'eye_blink_eeg', alpha: +(bands.alpha ?? 1).toFixed(2), msg: 'Eye blink artifact ใน EEG' });
    }

    // Baseline drift: GSR rises > 6 µS in 20 ticks
    if (n >= 15) {
      const early=_mean(_h.gsr.slice(0,5)), late=_mean(_h.gsr.slice(-5));
      if (late-early > 6.0) arts.push({ type:'baseline_drift', drift:+(late-early).toFixed(2), msg:'GSR baseline drift — เหงื่อสะสม' });
    }

    // Flat signal: HR variance < 0.05 in last 10 ticks
    if (n >= 10) {
      const hrV = _std(_h.hr.slice(-10));
      if (hrV < 0.05) arts.push({ type:'flat_signal', signal:'HR', variance:+hrV.toFixed(4), msg:'สัญญาณ HR flat - ตรวจสอบ sensor' });
    }

    // Saturation clip: EEG max value (likely rail hit) — NEW v2
    if (n >= 2 && Math.abs(bio.eeg) > 4.8) {
      arts.push({ type:'saturation_clip', eeg:+bio.eeg.toFixed(2), msg:'EEG saturation — ลดความไวของ amplifier' });
    }

    _last = arts;
    const severity = arts.length === 0 ? 'ok' : arts.length === 1 ? 'warn' : 'error';
    return { isClean: arts.length === 0, artifacts: arts, severity, ready: true };
  };

  return {
    check:            _check,
    getLastArtifacts: () => _last,
    getWarningMessage() { return _last.length ? '⚠️ ' + _last.map(a=>a.msg).join(' | ') : ''; },
    reset() { Object.keys(_h).forEach(k => _h[k]=[]); _last=[]; },
  };
})();

// ---
// AUTO-PATCH — hook into engine.step() post-load
// ---
// [FIX-3] เมื่อใช้ bundle (nuengdeaw.bundle.js) ไม่ต้องใช้ auto-patch นี้
// ---
window.addEventListener('load', () => {
  // ---
  if (window._nuengdeawBundled) return;
  if (typeof engine === 'undefined') {
    if (typeof logSys === 'function') logSys('UpgradePatch: engine not found — skip auto-patch');
    return;
  }

  const _origStep = engine.step.bind(engine);
  engine.step = function () {
    _origStep();

    const bio = {
      hr:  engine._lastFiltered?.hr  ?? 72,
      hrv: engine._lastFiltered?.hrv ?? 38,
      gsr: engine._lastFiltered?.gsr ?? 4.5,
      rr:  engine._lastFiltered?.rr  ?? 15,
      eeg: engine._lastFiltered?.eeg ?? 1.0,
    };
    const bands     = engine._eegBands ?? null;
    const stateName = (typeof HumanSim !== 'undefined') ? HumanSim.getState() : 'NEUTRAL';

    // Artifact detection
    const artifact = ArtifactDetector.check(bio, bands);
    engine._artifactResult = artifact;
    if (!artifact.isClean && typeof showToast === 'function') showToast(ArtifactDetector.getWarningMessage());

    // PCI scoring
    const pci = DeceptionScorer.score(bio, bands, stateName);
    engine._pciResult = pci;
    if (pci.deceptionFlag && engine.tick % 10 === 0 && typeof logSys === 'function') {
      logSys(`🔍 PCI=${pci.pci} [${pci.confidence}] Level=${DeceptionEngine.getLevel()} violations=${pci.violations.map(v=>v.pair).join(',')}`);
    }

    // A/B test integration
    for (const tid of ABTestManager.listTests()) {
      const t = ABTestManager.getTest(tid);
      if (t && !t.closed && t.metric === 'flow_ticks' && stateName === 'FLOW') ABTestManager.record(tid, 'control', 1);
    }
  };

  // Guard: only patch onUpdate once
  if (!engine._upgradePatchedOnUpdate) {
    const _origOU = engine.onUpdate;
    engine.onUpdate = (data) => {
      if (data?.filtered) engine._lastFiltered = data.filtered;
      if (_origOU) _origOU(data);
    };
    engine._upgradePatchedOnUpdate = true;
  }

  DeceptionEngine.startAuto(60);

  if (typeof logSys === 'function') logSys('UpgradePatch v0.0: DeceptionEngine + PCI v2 + ABTest + ModelPortability + ArtifactDetector ✅');
});

// Dev quickstart
console.info(`
[Nuengdeaw Upgrade Patch v0.0]
- loaded successfully
- DeceptionEngine.startAuto(60) -> auto 4 levels
- DeceptionEngine.setLevel(1-4) -> manual level
- DeceptionScorer.score(bio,b,s) -> PCI v2 realtime
- engine._pciResult -> latest PCI
- engine._artifactResult -> artifact check
- ArtifactDetector.check(bio,b) -> manual check
- ABTestManager.createTest(...) -> A/B testing
- ModelPortability.exportModel() -> export weights
- ModelPortability.quantize(json) -> compress model
`);

// ===== END Nuengdeaw_Sim_Human2.js =====

// ===== BEGIN Nuengdeaw_Boot_Chain.js =====

/**
 * @file Nuengdeaw_Boot_Chain.js
 * ---
 *
 * ---
 * ห้ามนำ logic นี้ไปใส่ใน Core / HumanSim / Gen
 *
 * ลำดับใน boot():
 *   1. สร้าง engine (Gen1 หรือ Gen2)
 *   2. init UI
 *   3. init SensorFusion
 * ---
 *   5. patch UpgradePatch hooks
 *   6. empathy handler
 *   7. AudioContext listeners
 *
 * ---
 * ---
 * ---
 */

'use strict';

window._nuengdeawBundled = true;

// ---
// ---
//
// ---
// ---
// ---
// ---

const NuengdeawInit = {
  _booted: false,
  _bootPromise: null,

  boot(genOverride) {
    if (this._bootPromise) return this._bootPromise;
    this._bootPromise = this._boot(genOverride);
    return this._bootPromise;
  },

  async _boot(genOverride) {
    if (this._booted) { logSys('NuengdeawInit: already booted, skip'); return; }
    this._booted = true;
    await window.NuengdeawStandardLoader?.ready?.();
    if (typeof refreshNuengdeawStandardBindings === 'function') refreshNuengdeawStandardBindings();

    // ---
    const gen = genOverride ?? window.NUENGDEAW_GEN ?? 1;

    // ── 1. สร้าง engine ตาม Gen ───────────────────────────────
    let engine;
    try {
      engine = gen === 2 ? new NuengdeawEngineGen2() : new NuengdeawEngineGen1();
      window.engine = engine;
    } catch (e) {
      console.error('[NuengdeawInit] Engine init failed:', e.message);
      if (typeof showToast === 'function') showToast('❌ Engine init failed: ' + e.message);
      return;
    }

    // ---
    UIAdaptive.init();

    // ---
    if (gen === 2) {
      SensorFusionGen2.init();
    } else {
      SensorFusionGen1.init();
    }

    // ---
    //
    // ---
    // ---
    // ---
    // ---
    //
    const isGen2 = gen === 2;
    if (!isGen2) {
      // Gen1: source = HumanSim (biosignal) หรือ WearableBridge (จริง)
      const _orig = engine.step.bind(engine);
      engine.step = function () {
        const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
        if (!hs || typeof hs.tick !== 'function' || typeof hs.generateBio !== 'function') {
          _orig();
          return;
        }
        hs.tick();
        if (!engine._wearableData) {
          let bio = hs.generateBio();
          if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
            bio = DeceptionEngine.applyDeception(bio, null).bio;
          }
          engine._wearableData = bio;
          _orig();
          engine._wearableData = null;
        } else {
          _orig();
        }
      };
      if (window.__nuengdeawWearableBridgeHandler && typeof WearableBridge.off === 'function') {
        WearableBridge.off(window.__nuengdeawWearableBridgeHandler);
      }
      window.__nuengdeawWearableBridgeHandler = d => engine.ingestWearable(d);
      WearableBridge.on(window.__nuengdeawWearableBridgeHandler);
      logSys('HumanSim: Gen1 patch ✅');
    } else {
      // Gen2: source = HumanSim (EEG) หรือ MuseBridge (จริง)
      engine.generateRaw = () => {
        const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
        let bio = (hs && typeof hs.generateBio === 'function')
          ? hs.generateBio()
          : { hrv:38, hr:72, gsr:4.5, rr:15, eeg:1.0 };
        if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
          bio = DeceptionEngine.applyDeception(bio, null).bio;
        }
        return bio;
      };
      const _orig = engine.step.bind(engine);
      engine.step = function () {
        const hs = (typeof window !== 'undefined') ? window.HumanSim : undefined;
        if (!hs || typeof hs.tick !== 'function' || typeof hs.generateEEGBands !== 'function') {
          _orig();
          return;
        }
        hs.tick();
        if (!window._museConnected) {
          let bands = hs.generateEEGBands();
          if (typeof DeceptionEngine !== 'undefined' && DeceptionEngine.isActive()) {
            const d = DeceptionEngine.applyDeception({ hrv:0, hr:0, gsr:0, rr:0, eeg:0 }, bands);
            bands   = d.bands ?? bands;
          }
          engine._eegBands = bands;
          engine._n400Veto = bands.thetaAlphaRatio > 2.4;
        }
        _orig();
      };
      MuseBridge.on(d => { if (d.type === 'eeg') engine.ingestEEG(d); });
      logSys('HumanSim: Gen2 patch ✅');
    }

    // ---
    const _origStep = engine.step.bind(engine);
    engine.step = function () {
      _origStep();
      const bio = {
        hr:  engine._lastFiltered?.hr  ?? 72,
        hrv: engine._lastFiltered?.hrv ?? 38,
        gsr: engine._lastFiltered?.gsr ?? 4.5,
        rr:  engine._lastFiltered?.rr  ?? 15,
        eeg: engine._lastFiltered?.eeg ?? 1.0,
      };
      const bands     = engine._eegBands ?? null;
      const stateName = (typeof HumanSim !== 'undefined' && typeof HumanSim.getState === 'function')
        ? HumanSim.getState()
        : 'NEUTRAL';

      const artifact = ArtifactDetector.check(bio, bands);
      engine._artifactResult = artifact;
      if (!artifact.isClean && typeof showToast === 'function') showToast(ArtifactDetector.getWarningMessage());

      const pci = DeceptionScorer.score(bio, bands, stateName);
      engine._pciResult = pci;
      if (pci.deceptionFlag && engine.tick % 10 === 0) {
        logSys(`🔍 PCI=${pci.pci} [${pci.confidence}] Level=${DeceptionEngine.getLevel()} violations=${pci.violations.map(v=>v.pair).join(',')}`);
      }

      for (const tid of ABTestManager.listTests()) {
        const t = ABTestManager.getTest(tid);
        if (t && !t.closed && t.metric === 'flow_ticks' && stateName === 'FLOW') ABTestManager.record(tid, 'control', 1);
      }
    };

    if (!engine._upgradePatchedOnUpdate) {
      const _origOU = engine.onUpdate;
      engine.onUpdate = (data) => {
        if (data?.filtered) engine._lastFiltered = data.filtered;
        if (_origOU) _origOU(data);
      };
      engine._upgradePatchedOnUpdate = true;
    }

    // ---
    engine.onEmpathy = emp => engine._handleEmpathy(emp);

    // ── 7. AudioContext (ต้องรอ user gesture) ─────────────────
    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, () => initAudio(), { once: true })
    );

    DeceptionEngine.startAuto(60);

    window._nuengdeawBundled = true;  // [FIX-4] บอก Sim_Human1/2 ว่า patch เสร็จแล้ว

    logSys(`NuengdeawInit: Gen${gen} boot complete ✅`);
    console.info(`
[Nuengdeaw Bundle v0.0]
- Gen${gen} loaded successfully
- window.engine -> engine instance
- window.HumanSim -> simulator
- DeceptionEngine.* -> deception control
- DeceptionScorer.score() -> PCI realtime
- ABTestManager.* -> A/B testing
- ModelPortability.* -> TF.js weight export
- ArtifactDetector.* -> sensor artifact check
`);
  },
};
window.NuengdeawInit = NuengdeawInit;

// ---
window.DeceptionEngine     = DeceptionEngine;
window.DeceptionScorer     = DeceptionScorer;
window.ABTestManager       = ABTestManager;
window.ModelPortability    = ModelPortability;
window.ArtifactDetector    = ArtifactDetector;
window.NuengdeawEngineGen1 = NuengdeawEngineGen1;
window.NuengdeawEngineGen2 = NuengdeawEngineGen2;

// ── Auto boot เมื่อ DOM พร้อม ─────────────────────────────────
// ---
document.addEventListener('DOMContentLoaded', () => {
  NuengdeawInit.boot().catch(e => {
    console.error('[NuengdeawInit] Engine init failed:', e.message);
      if (typeof showToast === 'function') showToast('❌ Engine init failed: ' + e.message);
  });
}, { once: true });

// ===== END Nuengdeaw_Boot_Chain.js =====


