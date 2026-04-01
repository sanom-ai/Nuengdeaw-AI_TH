/**
 * [comment normalized for UTF-8 readability]
 * Nuengdeaw Gen 1 - BioSignal Product
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 * [comment normalized for UTF-8 readability]
 */

'use strict';

// Guard: requires shared engine runtime from Nuengdeaw_Product_Runtime.js
if (typeof NuengdeawBaseEngine === 'undefined') {
  throw new Error('[Gen1] Nuengdeaw_Product_Runtime.js is missing - check <script> load order');
}
if (typeof _makeSensorFusion === 'undefined') {
  throw new Error('[Gen1] _makeSensorFusion is missing - Nuengdeaw_Product_Runtime.js not ready');
}
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
const WearableBridge = (() => {
  let _connected = null;
  let _callbacks = [];
  let _polling   = null;
  let _pollingBusy = false;

  const _emit = d => _callbacks.forEach(fn => fn(d));

  const _rmssd = (rr) => {
    if (!rr || rr.length < 2) return null;
    let s = 0;
    for (let i = 1; i < rr.length; i++) s += (rr[i] - rr[i - 1]) ** 2;
    return Math.sqrt(s / (rr.length - 1));
  };

  const BT_ERRORS = {
    NotFoundError:     'Polar H10 not found - make sure Bluetooth is on',
    SecurityError:     'Bluetooth permission denied - please allow access',
    NetworkError:      'Connection dropped - please retry',
    NotSupportedError: 'Device does not support required GATT service',
  };

  const _connectPolar = async (attempt = 0) => {
    if (!navigator.bluetooth) { showToast('[WARN] Browser does not support Web Bluetooth'); return false; }
    try {
      const dev    = await navigator.bluetooth.requestDevice({ filters:[{ namePrefix:'Polar' }], optionalServices:['heart_rate'] });
      const server = await dev.gatt.connect();
      const svc    = await server.getPrimaryService('heart_rate');
      const char   = await svc.getCharacteristic('heart_rate_measurement');
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', e => {
        const val = e.target.value;
        const hr  = val.getUint8(1);
        const rr  = [];
        for (let i = 2; i < val.byteLength; i += 2) rr.push(val.getUint16(i, true) / 1024 * 1000);
        _emit({ hr, hrv: _rmssd(rr), source: 'polar' });
      });
      showToast('[OK] Polar H10 connected');
      return true;
    } catch (e) {
      const msg = BT_ERRORS[e.name] ?? e.message ?? 'Unable to connect';
      if (attempt < 2) {
        const delay = 1000 * 2 ** attempt;  // exponential backoff: 1s, 2s, 4s
        showToast(`[WARN] ${msg} - retry in ${delay/1000}s (${attempt+1}/3)`);
        await new Promise(r => setTimeout(r, delay));
        return _connectPolar(attempt + 1);
      }
      showToast('[ERR] ' + msg);
      logSys(`WearableBridge: Polar connect failed after 3 attempts - ${e.name}`);
      return false;
    }
  };
const _connectEmpatica = async (url = 'http://localhost:8080') => {
    try {
      const r = await fetch(url + '/status');
      if (!r.ok) throw new Error('E4 server not ok');
      if (_polling) {
        clearInterval(_polling);
        _polling = null;
      }
      _pollingBusy = false;
      _polling = setInterval(async () => {
        if (_pollingBusy) return;
        _pollingBusy = true;
        try {
          const [gsr, hr] = await Promise.all([
            fetch(url + '/data/gsr').then(r => r.json()),
            fetch(url + '/data/hr').then(r => r.json()),
          ]);
          _emit({ gsr: gsr.value, hr: hr.value, hrv: hr.rmssd ?? null, source: 'empatica' });
        } catch {}
        finally { _pollingBusy = false; }
      }, 500);
      showToast('[OK] Empatica E4 connected');
      return true;
    } catch {
      showToast('[WARN] E4 server not found - fallback to simulation');
      _connected = 'sim';
      return false;
    }
  };

  return {
    async connect(device = 'sim') {
      _connected = device;
      if (device === 'polar')    return _connectPolar();
      if (device === 'empatica') return _connectEmpatica();
      showToast('[INFO] Simulation mode');
      return true;
    },
    on(fn)       { _callbacks.push(fn); },
    off(fn)      { _callbacks = _callbacks.filter(f => f !== fn); },
    disconnect() {
      if (_polling) { clearInterval(_polling); _polling = null; }
      _pollingBusy = false;
      _connected = null;
      showToast('[INFO] Disconnected');
    },
    isConnected() { return _connected !== null && _connected !== 'sim'; },
  };
})();
window.WearableBridge = WearableBridge;

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [FIX-5] keep SensorFusion factory in shared runtime only (avoid duplicate definitions).
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// HRV, HR, GSR, RR, EEG, Dwell, Scroll, Back
// [comment normalized for UTF-8 readability]
const SensorFusionGen1 = _makeSensorFusion({ inputDim:8, hiddenUnits:16, dropoutRate:0.2, name:'SensorFusionGen1' });
SensorFusionGen1._toVec = (z, _bands, beh = {}) => [
  z.hrv  ?? 0, z.hr  ?? 0, z.gsr ?? 0, z.rr ?? 0, z.eeg ?? 0,
  beh.dwellScore ?? 0, beh.scrollScore ?? 0, beh.backScore ?? 0,
];
window.SensorFusionGen1 = SensorFusionGen1;

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
class NuengdeawEngineGen1 extends NuengdeawBaseEngine {
  constructor() {
    super();
    this._wearableData = null;
  }

// [comment normalized for UTF-8 readability]
  _buildRules() {
    return buildRulesFromStandard('gen1_rules', ['z', 'v', 'beh']);
  }

  _exportPrefix() { return 'nuengdeaw_gen1'; }

// [comment normalized for UTF-8 readability]
  generateRaw() {
    if (this._wearableData) {
      const d = this._wearableData;
      return {
        hrv: d.hrv ?? this.baseline.hrv,
        hr:  d.hr  ?? this.baseline.hr,
        gsr: d.gsr ?? this.baseline.gsr,
        rr:  this.baseline.rr,
        eeg: this.baseline.eeg,
      };
    }
    return super.generateRaw();
  }

  ingestWearable(d) { this._wearableData = d; }

// [comment normalized for UTF-8 readability]
  step() {
    if (this.paused) return;
    this.tick++;

    const raw = this.generateRaw();
    const f   = {
      hrv: this._kf('hrv', raw.hrv),
      hr:  this._kf('hr',  raw.hr),
      gsr: this._kf('gsr', raw.gsr),
      rr:  this._kf('rr',  raw.rr),
      eeg: this._kf('eeg', raw.eeg),
    };
    const safe = v => isFinite(v) && v !== 0 ? v : 1;
    const z = {
      hrv: (f.hrv - this.baseline.hrv) / safe(this.bStd.hrv),
      hr:  (f.hr  - this.baseline.hr)  / safe(this.bStd.hr),
      gsr: (f.gsr - this.baseline.gsr) / safe(this.bStd.gsr),
      rr:  (f.rr  - this.baseline.rr)  / safe(this.bStd.rr),
      eeg: (f.eeg - this.baseline.eeg) / safe(this.bStd.eeg),
    };
    const beh = BehaviorTracker.getSignals();

    let mState = this.currentState, mConf = this.stateConf, mRule = null;

    // ML path (require at least 10 training samples)
    const ml = this._trainBuf.length >= 10 ? SensorFusionGen1.predict(z, null, beh) : null;
    if (ml && ml.confidence > 0.72) {
      mState = ml.state; mConf = ml.confidence;
    } else {
      const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);
      for (const r of sorted) {
        if (r.cond(z, f, beh)) {
          mRule  = r; mState = r.state;
          mConf  = Math.min(0.99, 0.60 + (Math.abs(z.hrv) + Math.abs(z.hr) + Math.abs(z.gsr)) * 0.05);
          break;
        }
      }
    }

    // Training buffer: push on state change
    if (mState !== this.currentState) {
      const li = SensorFusionGen1._getStates().indexOf(mState);
      if (li >= 0) {
        this._trainBuf.push({ z, beh, li });
        if (this._trainBuf.length > 200) this._trainBuf.shift();
      }
    }

    const emp = this._runStep(f, z, beh, mState, mConf, mRule, ml);
    this._trimChartData();
    const bookPacket = window.NuengdeawBookContract?.buildPacket?.({
      gen: 1,
      engine: this,
      payload: { tick: this.tick, raw, filtered: f, z, beh, state: this.currentState, conf: this.stateConf, matchedRule: mRule, mlPred: ml },
    }) ?? null;
    const bookAdaptation = window.NuengdeawBookContract?.mapAdaptation?.(bookPacket) ?? null;

    if (this.onUpdate) {
      this.onUpdate({
        tick: this.tick, raw, filtered: f, z, beh,
        state: this.currentState, conf: this.stateConf,
        matchedRule: mRule, mlPred: ml,
        stateChanges: this.stateChanges, rulesFired: this.rulesFired, empathy: emp,
        bookPacket, bookAdaptation,
      });
    }
  }

// [FIX-4] Training wrapper uses explicit toVec(z, bands, behavior) mapping.
// [comment normalized for UTF-8 readability]
  _fusionTrain(buf) {
    if (this._trainDebounceTimer) return;
    this._trainDebounceTimer = setTimeout(() => {
      SensorFusionGen1.train(buf, (s_z, _s_bands, s_beh) => SensorFusionGen1._toVec(s_z, null, s_beh));
      this._trainDebounceTimer = null;
    }, 0);
  }

  resetStats() {
    super.resetStats();
    this.chartData = { hrv:[], hr:[], gsr:[], eeg:[], rr:[], labels:[] };
  }
}

// [comment normalized for UTF-8 readability]
// GLOBAL INSTANCE + BOOT (standalone mode only).
// When bundled, NuengdeawInit.boot() owns engine creation.
// [comment normalized for UTF-8 readability]
window.NuengdeawEngineGen1 = NuengdeawEngineGen1;

['click', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, () => initAudio(), { once: true }));

// [FIX-5] keep SensorFusion factory in shared runtime only (avoid duplicate definitions).
async function bootNuengdeawGen1Standalone() {
  if (window._nuengdeawBundled) return;
  if (window.__nuengdeawGen1StandaloneBooted) return;
  await window.NuengdeawStandardLoader?.ready?.();
  if (typeof refreshNuengdeawStandardBindings === 'function') refreshNuengdeawStandardBindings();
  if (typeof window.engine === 'undefined') {
    window.engine = new NuengdeawEngineGen1();
  }
  const eng = window.engine;
  if (!eng) { console.error('[NuengdeawGen1] engine not ready - skip boot'); return; }
  UIAdaptive.init();
  SensorFusionGen1.init();
  if (window.__nuengdeawWearableBridgeHandler) {
    WearableBridge.off(window.__nuengdeawWearableBridgeHandler);
  }
  window.__nuengdeawWearableBridgeHandler = d => eng.ingestWearable(d);
  WearableBridge.on(window.__nuengdeawWearableBridgeHandler);
  eng.onEmpathy = emp => eng._handleEmpathy(emp);
  window.__nuengdeawGen1StandaloneBooted = true;
  logSys('NuengdeawGen1 v0.0: standalone boot complete');
}

window.bootNuengdeawGen1Standalone = bootNuengdeawGen1Standalone;

document.addEventListener('DOMContentLoaded', () => {
  bootNuengdeawGen1Standalone().catch(e => {
    console.error('[NuengdeawGen1] ' + e.message);
    if (typeof showToast === 'function') showToast('Engine init failed: ' + e.message);
  });
}, { once: true });


