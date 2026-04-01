/**
 * [comment normalized for UTF-8 readability]
 * Nuengdeaw Gen 2 - NeuroSignal Product
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
 * [comment normalized for UTF-8 readability]
 */

'use strict';

// Guard: requires shared engine runtime from Nuengdeaw_Product_Runtime.js
if (typeof NuengdeawBaseEngine === 'undefined') {
  throw new Error('[Gen2] Nuengdeaw_Product_Runtime.js is missing - check <script> load order');
}
if (typeof _makeSensorFusion === 'undefined') {
  throw new Error('[Gen2] _makeSensorFusion is missing - Nuengdeaw_Product_Runtime.js not ready');
}
// [FIX-1] SensorFusion factory lives in shared runtime; do not redefine in Gen files.
// Guard cleanup: runtime now checks shared factory/base engine directly.

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// Hamming-windowed FFT band power extraction
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
const EEGProcessor = (() => {
  const FS       = 256;     // sample rate Hz
  const EPOCH    = 256;     // epoch length (1 second)
  const _buffers = new Map();

  // Hamming window coefficients (pre-computed for EPOCH length)
  const _hamming = Float32Array.from({ length: EPOCH }, (_, n) => 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (EPOCH - 1)));

  const _push = (ch, sample) => {
    if (!_buffers.has(ch)) _buffers.set(ch, new Float32Array(EPOCH));
    const buf = _buffers.get(ch);
    buf.copyWithin(0, 1);
    buf[EPOCH - 1] = sample;
  };

  const _psd = (ch) => {
    const buf = _buffers.get(ch);
    if (!buf) return null;
    const N   = buf.length;
    const psd = new Float32Array(Math.floor(N / 2));
    for (let k = 0; k < psd.length; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const s = buf[n] * _hamming[n];   // apply Hamming window
        const a = (2 * Math.PI * k * n) / N;
        re += s * Math.cos(a);
        im -= s * Math.sin(a);
      }
      psd[k] = (re * re + im * im) / N;
    }
    return psd;
  };

  const _bandPower = (psd, fLow, fHigh) => {
    let sum = 0, count = 0;
    for (let k = 0; k < psd.length; k++) {
      const freq = k * FS / EPOCH;
      if (freq >= fLow && freq < fHigh) { sum += psd[k]; count++; }
    }
    return count > 0 ? sum / count : 0;
  };

  const _defaultBands = () => ({ theta:1.0, alpha:1.0, beta:0.5, gamma:0.2, thetaAlphaRatio:1.0 });

  return {
    push: _push,

    getBands(ch) {
      const psd = _psd(ch);
      if (!psd) return _defaultBands();
      const theta = _bandPower(psd, 4, 8);
      const alpha = _bandPower(psd, 8, 13);
      const beta  = _bandPower(psd, 13, 30);
      const gamma = _bandPower(psd, 30, 45);
      return { theta, alpha, beta, gamma, thetaAlphaRatio: alpha > 0.001 ? theta / alpha : 1.0 };
    },

    detectERP(ch) {
      const buf = _buffers.get(ch);
      if (!buf) return { n400: false, p300: false };
      const recent = Array.from(buf.slice(-52));
      const mean   = recent.reduce((s, v) => s + v, 0) / recent.length;
      return {
        n400: Math.min(...recent.slice(0, 26)) < mean - 2.0,
        p300: Math.max(...recent.slice(26))    > mean + 2.0,
      };
    },

    reset() { _buffers.clear(); },
  };
})();
window.EEGProcessor = EEGProcessor;

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
const MuseBridge = (() => {
  const EEG_SERVICE = '0000fe8d-0000-1000-8000-00805f9b34fb';
  const EEG_CHAR    = '273e0003-4c4d-454d-96be-f03bac821358';
  const PPG_CHAR    = '273e000f-4c4d-454d-96be-f03bac821358';
  const CHANNELS    = ['TP9','AF7','AF8','TP10'];

  let _device    = null;
  let _callbacks = [];

  const _emit = d => _callbacks.forEach(fn => fn(d));

  const _parseEEG = (val) => {
    try {
      const view = new DataView(val.buffer);
      CHANNELS.forEach((ch, ci) => {
        for (let s = 0; s < 12; s++) {
          EEGProcessor.push(ch, view.getInt16((ci * 24) + (s * 2) + 2, false) * 0.48828125);
        }
      });
      const bands = EEGProcessor.getBands('AF7');
      const erp   = EEGProcessor.detectERP('Fz');
      _emit({ type:'eeg', bands, erp, channels: CHANNELS });
    } catch {}
  };

  const _parsePPG = (val) => {
    try {
      const view = new DataView(val.buffer);
      _emit({ type:'ppg', ppg: view.getUint32(2, false) });
    } catch {}
  };

  return {
    async connect() {
      if (!navigator.bluetooth) { showToast('[WARN] Web Bluetooth is not supported'); return false; }
      try {
        _device = await navigator.bluetooth.requestDevice({ filters:[{ namePrefix:'Muse' }], optionalServices:[EEG_SERVICE] });
        const server  = await _device.gatt.connect();
        const svc     = await server.getPrimaryService(EEG_SERVICE);
        const eegChar = await svc.getCharacteristic(EEG_CHAR);
        await eegChar.startNotifications();
        eegChar.addEventListener('characteristicvaluechanged', e => _parseEEG(e.target.value));
// [comment normalized for UTF-8 readability]
        try {
          const ppgChar = await svc.getCharacteristic(PPG_CHAR);
          await ppgChar.startNotifications();
          ppgChar.addEventListener('characteristicvaluechanged', e => _parsePPG(e.target.value));
        } catch {}
        // Reconnect on disconnect
        _device.addEventListener('gattserverdisconnected', () => {
          window._museConnected = false;
          showToast('[WARN] Muse disconnected - reconnecting...');
          setTimeout(() => this.connect(), 2000);
        });
        showToast('[OK] Muse S connected');
        window._museConnected = true;
        return true;
      } catch (e) {
        showToast('[ERR] Muse: ' + e.message);
        return false;
      }
    },

    disconnect() {
      if (_device?.gatt?.connected) _device.gatt.disconnect();
      window._museConnected = false;
      showToast('[INFO] Muse disconnected');
    },

    on(fn)  { _callbacks.push(fn); },
    off(fn) { _callbacks = _callbacks.filter(f => f !== fn); },
    isConnected() { return _device?.gatt?.connected ?? false; },
  };
})();
window.MuseBridge = MuseBridge;

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// HRV, HR, GSR, RR, EEG, Theta, Alpha, ThetaAlphaRatio, Dwell, Scroll
// [comment normalized for UTF-8 readability]
const SensorFusionGen2 = _makeSensorFusion({ inputDim:10, hiddenUnits:24, dropoutRate:0.25, name:'SensorFusionGen2' });
SensorFusionGen2._toVec = (z, bands = {}, beh = {}) => [
  z.hrv ?? 0, z.hr ?? 0, z.gsr ?? 0, z.rr ?? 0, z.eeg ?? 0,
  bands.theta ?? 0, bands.alpha ?? 0, bands.thetaAlphaRatio ?? 1,
  beh.dwellScore ?? 0, beh.scrollScore ?? 0,
];
window.SensorFusionGen2 = SensorFusionGen2;

// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
class NuengdeawEngineGen2 extends NuengdeawBaseEngine {
  constructor() {
    super();
    this._eegBands = { theta:1.0, alpha:1.0, beta:0.5, gamma:0.2, thetaAlphaRatio:1.0 };
    this._n400Veto = false;
    // Extra chart channels for EEG
    this.chartData.theta = [];
    this.chartData.alpha = [];
  }

// [comment normalized for UTF-8 readability]
  _buildRules() {
    return buildRulesFromStandard('gen2_rules', ['z', 'v', 'b']);
  }

  _exportPrefix() { return 'nuengdeaw_gen2'; }

// [comment normalized for UTF-8 readability]
  ingestEEG(data) {
    if (data.bands) this._eegBands = data.bands;
    if (data.erp)   this._n400Veto = data.erp.n400;
  }

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

    const bands   = this._eegBands;
    const beh     = BehaviorTracker.getSignals();
    const vetoed  = this._n400Veto;

    let mState = this.currentState, mConf = this.stateConf, mRule = null;

    // ML path
    const ml = this._trainBuf.length >= 10 ? SensorFusionGen2.predict(z, bands, beh) : null;
    if (ml && ml.confidence > 0.72 && !(vetoed && ['CONFUSION','STRESS'].includes(ml.state))) {
      mState = ml.state; mConf = ml.confidence;
    } else {
      const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);
      for (const r of sorted) {
        if (r.cond(z, f, bands) && !(vetoed && ['CONFUSION','STRESS'].includes(r.state))) {
          mRule = r; mState = r.state;
          mConf = Math.min(0.99, 0.60 + (Math.abs(z.hrv) + Math.abs(z.hr) + Math.abs(z.gsr)) * 0.05);
          break;
        }
      }
    }

    // Training buffer
    if (mState !== this.currentState) {
      const li = SensorFusionGen2._getStates().indexOf(mState);
      if (li >= 0) {
        this._trainBuf.push({ z, bands, beh, li });
        if (this._trainBuf.length > 200) this._trainBuf.shift();
      }
    }

    const emp = this._runStep(f, z, beh, mState, mConf, mRule, ml);

    // Extra chart channels
    this.chartData.theta.push(+(bands.theta ?? 0).toFixed(3));
    this.chartData.alpha.push(+(bands.alpha ?? 0).toFixed(3));
    this._trimChartData(['theta', 'alpha']);
    const bookPacket = window.NuengdeawBookContract?.buildPacket?.({
      gen: 2,
      engine: this,
      payload: { tick: this.tick, raw, filtered: f, z, beh, bands, eegBands: bands, state: this.currentState, conf: this.stateConf, matchedRule: mRule, mlPred: ml },
    }) ?? null;
    const bookAdaptation = window.NuengdeawBookContract?.mapAdaptation?.(bookPacket) ?? null;

    if (this.onUpdate) {
      this.onUpdate({
        tick: this.tick, raw, filtered: f, z, beh, bands,
        eegBands: bands, n400Veto: vetoed,
        state: this.currentState, conf: this.stateConf,
        matchedRule: mRule, mlPred: ml,
        stateChanges: this.stateChanges, rulesFired: this.rulesFired, empathy: emp,
        bookPacket, bookAdaptation,
      });
    }
  }

// [FIX-4] Training wrapper uses explicit toVec(z, bands, behavior) mapping.
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
  _fusionTrain(buf) {
    if (this._trainDebounceTimer) return;
    this._trainDebounceTimer = setTimeout(() => {
      SensorFusionGen2.train(buf, (s_z, s_bands, s_beh) => SensorFusionGen2._toVec(s_z, s_bands, s_beh));
      this._trainDebounceTimer = null;
    }, 0);
  }

  resetStats() {
    super.resetStats();
    this.chartData = { hrv:[], hr:[], gsr:[], eeg:[], rr:[], theta:[], alpha:[], labels:[] };
  }
}

// [comment normalized for UTF-8 readability]
// GLOBAL INSTANCE + BOOT (standalone mode only).
// [comment normalized for UTF-8 readability]
// [comment normalized for UTF-8 readability]
window.NuengdeawEngineGen2 = NuengdeawEngineGen2;

['click', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, () => initAudio(), { once: true }));

// [FIX-5] bundled mode skips standalone boot; NuengdeawInit.boot() handles it.
async function bootNuengdeawGen2Standalone() {
  if (window._nuengdeawBundled) return;
  await window.NuengdeawStandardLoader?.ready?.();
  if (typeof refreshNuengdeawStandardBindings === 'function') refreshNuengdeawStandardBindings();
  if (typeof window.engine === 'undefined') {
    window.engine = new NuengdeawEngineGen2();
  }
  const eng = window.engine;
  if (!eng) { console.error('[NuengdeawGen2] engine not ready - skip boot'); return; }
  UIAdaptive.init();
  SensorFusionGen2.init();
  MuseBridge.on(d => { if (d.type === 'eeg') eng.ingestEEG(d); });
  eng.onEmpathy = emp => eng._handleEmpathy(emp);
  logSys('NuengdeawGen2 v0.0: standalone boot complete');
}

window.bootNuengdeawGen2Standalone = bootNuengdeawGen2Standalone;

window.addEventListener('load', () => {
  bootNuengdeawGen2Standalone().catch(e => {
    console.error('[NuengdeawGen2] ' + e.message);
    if (typeof showToast === 'function') showToast('Engine init failed: ' + e.message);
  });
});



