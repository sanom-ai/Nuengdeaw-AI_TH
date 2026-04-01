// Nuengdeaw_Wellness_Runtime.js
// DEDUPE ROUND-1: removed embedded Sim_Human1/2 + Deception stack.
// Shared dependencies are now loaded from:
// - HumanSimSystem.js (HumanSim/EMOTION_STATES/MICROSTATES)
// - SignalAnalysis.js (DeceptionEngine/DeceptionScorer/ArtifactDetector)
// - ABTestManager.js (AB testing)

'use strict';

// ===== BEGIN NuengdeawAura.js =====

'use strict';

const LIBRA_TOKENS = {
  severity:{
    critical:{ bg:'#1a0000', border:'#ff3b3b', text:'#ff6b6b', badge:'#ff3b3b', badgeText:'#fff' },
    warning: { bg:'#1a1000', border:'#ffaa00', text:'#ffcc44', badge:'#ffaa00', badgeText:'#000' },
    mild:    { bg:'#0d0d1a', border:'#8888ff', text:'#aaaaff', badge:'#5555dd', badgeText:'#fff' },
    neutral: { bg:'#0d1017', border:'#4488aa', text:'#66aacc', badge:'#336688', badgeText:'#fff' },
    normal:  { bg:'#0d1117', border:'#334455', text:'#99aabb', badge:'#223344', badgeText:'#fff' },
    positive:{ bg:'#001a0d', border:'#00cc77', text:'#00ffaa', badge:'#00aa55', badgeText:'#fff' },
  },
  signal:{ good:'#00cc77', warning:'#ffaa00', critical:'#ff3b3b', normal:'#557799' },
  font:{ display:"'JetBrains Mono','Courier New',monospace", body:"'Sarabun','Noto Sans Thai',sans-serif" },
};

const _CSS_ID='nuengdeaw-libra-style';
const _injectCSS=()=>{
  if(typeof document==='undefined'||document.getElementById(_CSS_ID))return;
  const style=document.createElement('style');
  style.id=_CSS_ID;
  style.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&family=JetBrains+Mono:wght@400;600&display=swap');
    .nd-card{font-family:'Sarabun','Noto Sans Thai',sans-serif;background:#0d1117;border-radius:12px;border:1px solid #223344;padding:20px;color:#c9d1d9;max-width:720px;box-sizing:border-box;}
    .nd-card *{box-sizing:border-box;}
    .nd-critical-banner{background:#1a0000;border:2px solid #ff3b3b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px;}
    .nd-critical-banner .nd-icon{font-size:20px;flex-shrink:0;margin-top:2px;}
    .nd-critical-banner .nd-body{flex:1;}
    .nd-critical-banner .nd-title{color:#ff6b6b;font-weight:600;font-size:14px;margin:0 0 4px;}
    .nd-critical-banner .nd-msg{color:#ffaaaa;font-size:13px;margin:0 0 4px;font-family:'JetBrains Mono',monospace;}
    .nd-critical-banner .nd-act{color:#ff3b3b;font-size:12px;font-weight:600;margin:0;}
    .nd-state-header{display:flex;align-items:center;gap:14px;margin-bottom:16px;padding:14px 16px;border-radius:10px;border:1px solid;}
    .nd-state-emoji{font-size:36px;flex-shrink:0;}
    .nd-state-info{flex:1;}
    .nd-state-label{font-size:20px;font-weight:600;margin:0 0 2px;}
    .nd-state-labelTH{font-size:13px;opacity:0.7;margin:0 0 4px;}
    .nd-state-desc{font-size:13px;opacity:0.8;margin:0;line-height:1.5;}
    .nd-state-meta{text-align:right;flex-shrink:0;}
    .nd-confidence{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:600;margin:0;}
    .nd-conf-label{font-size:11px;opacity:0.6;margin:0;}
    .nd-action-badge{display:inline-block;margin-top:8px;padding:3px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;}
    .nd-section{margin-bottom:14px;}
    .nd-section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#557799;margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid #1a2533;}
    .nd-signal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;}
    .nd-signal-item{background:#111b27;border-radius:8px;padding:10px 12px;border-left:3px solid;}
    .nd-signal-name{font-size:11px;color:#6688aa;margin:0 0 3px;font-family:'JetBrains Mono',monospace;}
    .nd-signal-value{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:600;margin:0 0 2px;}
    .nd-anomaly-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;margin-bottom:5px;font-size:13px;}
    .nd-anomaly-item.critical{background:#1a0000;color:#ff8888;}
    .nd-anomaly-item.warning{background:#1a1000;color:#ffcc77;}
    .nd-anomaly-item.good{background:#001a0d;color:#55ffaa;}
    .nd-anomaly-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
    .nd-firstaid-list{list-style:none;padding:0;margin:0;}
    .nd-firstaid-list li{padding:7px 10px 7px 28px;position:relative;font-size:13px;line-height:1.5;border-radius:5px;margin-bottom:4px;background:#111b27;}
    .nd-firstaid-list li::before{content:'→';position:absolute;left:10px;color:#3399ff;font-weight:600;}
    .nd-firstaid-list li.critical-step{background:#1a0005;color:#ffaaaa;}
    .nd-firstaid-list li.critical-step::before{content:'Warning';left:8px;}
    .nd-medical-item{background:#111b27;border-radius:8px;padding:12px 14px;margin-bottom:8px;border-left:3px solid;}
    .nd-medical-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
    .nd-medical-icd{font-family:'JetBrains Mono',monospace;font-size:11px;padding:2px 6px;border-radius:3px;background:#1e2d3d;color:#6699bb;}
    .nd-medical-label{font-size:14px;font-weight:600;}
    .nd-medical-desc{font-size:12px;color:#8899aa;margin:0 0 8px;line-height:1.5;}
    .nd-medical-symptoms{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}
    .nd-symptom-tag{font-family:'JetBrains Mono',monospace;font-size:11px;background:#1e2d3d;color:#aabbcc;padding:2px 8px;border-radius:99px;}
    .nd-ref-item{font-size:11px;font-family:'JetBrains Mono',monospace;color:#446677;margin-bottom:6px;line-height:1.6;}
    .nd-ref-author{color:#557799;}
    .nd-ref-year{color:#446677;}
    .nd-footer{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;color:#334455;margin-top:16px;padding-top:10px;border-top:1px solid #1a2533;}
    .nd-ambiguous{background:#1a1000;border:1px solid #ffaa00;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#ffcc44;font-size:13px;}
    .nd-toggle{cursor:pointer;display:flex;justify-content:space-between;align-items:center;}
    .nd-toggle-arrow{transition:transform 0.2s;}
    .nd-toggle.open .nd-toggle-arrow{transform:rotate(90deg);}
    .nd-collapsible{overflow:hidden;max-height:0;transition:max-height 0.3s ease;}
    .nd-collapsible.open{max-height:9999px;}
  `;
  document.head.appendChild(style);
};

const _esc=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const _buildCriticalAlerts=(alerts)=>{
  if(!alerts||alerts.length===0)return'';
  return alerts.map(a=>`<div class="nd-critical-banner"><div class="nd-icon">[!]</div><div class="nd-body"><p class="nd-title">${_esc(a.label)}</p><p class="nd-msg">${_esc(a.message)}</p><p class="nd-act">> ${_esc(a.action)}</p></div></div>`).join('');
};

const _buildStateHeader=(state)=>{
  if(!state)return'';
  const tok=LIBRA_TOKENS.severity[state.severity]||LIBRA_TOKENS.severity.normal;
  const confPct=Math.round((state.confidence||0)*100);
  const ambiguousNote=state.isAmbiguous?`<span style="color:#ffaa00;font-size:11px"> [!] Low confidence - assessment may be unstable</span>`:'';
  return`<div class="nd-state-header" style="background:${tok.bg};border-color:${tok.border}"><div class="nd-state-emoji">${_esc(state.emoji)}</div><div class="nd-state-info"><p class="nd-state-label" style="color:${tok.text}">${_esc(state.label)}</p><p class="nd-state-labelTH">${_esc(state.labelTH)} ${ambiguousNote}</p><p class="nd-state-desc">${_esc(state.description)}</p><span class="nd-action-badge" style="background:${tok.badge};color:${tok.badgeText}">${_esc(state.action)}</span><span style="font-size:12px;color:${tok.text};margin-left:6px">${_esc(state.actionDesc)}</span></div><div class="nd-state-meta"><p class="nd-confidence" style="color:${tok.text}">${confPct}%</p><p class="nd-conf-label">confidence</p><div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#446677;margin-top:4px">${_esc(state.code)}</div></div></div>`;
};

const _buildSignalGrid=(signals)=>{
  if(!signals)return'';
  const items=[
    {key:'hrv',label:'HRV RMSSD (ms)',unit:'ms',   value:signals.hrv},
    {key:'hr', label:'Heart Rate (HR)',unit:'bpm',  value:signals.hr },
    {key:'gsr',label:'GSR / EDA',     unit:'µS',   value:signals.gsr},
    {key:'rr', label:'Resp. Rate (RR)',unit:'br/min',value:signals.rr},
    {key:'eeg',label:'EEG Power (µV²)',unit:'µV²', value:signals.eeg},
  ].filter(i=>i.value!==undefined&&i.value!==null);
  if(signals.bands?.thetaAlphaRatio!==undefined)items.push({key:'tar',label:'θ/α Ratio',unit:'',value:+signals.bands.thetaAlphaRatio.toFixed(2)});
  if(items.length===0)return'';

  const cells=items.map(item=>{
    const val=typeof item.value==='number'?item.value.toFixed(item.key==='tar'?2:1):_esc(item.value);
    let color=LIBRA_TOKENS.signal.normal;
    if(item.key==='hrv')color=item.value<10?LIBRA_TOKENS.signal.critical:item.value<20?LIBRA_TOKENS.signal.warning:item.value>50?LIBRA_TOKENS.signal.good:LIBRA_TOKENS.signal.normal;
    else if(item.key==='hr')color=item.value>140?LIBRA_TOKENS.signal.critical:item.value>120||item.value<45?LIBRA_TOKENS.signal.warning:LIBRA_TOKENS.signal.normal;
    else if(item.key==='gsr')color=item.value>20?LIBRA_TOKENS.signal.critical:item.value>15?LIBRA_TOKENS.signal.warning:LIBRA_TOKENS.signal.normal;
    else if(item.key==='rr')color=item.value<5?LIBRA_TOKENS.signal.critical:item.value>30?LIBRA_TOKENS.signal.warning:LIBRA_TOKENS.signal.normal;
    else if(item.key==='tar')color=item.value>2.5?LIBRA_TOKENS.signal.warning:LIBRA_TOKENS.signal.normal;
    return`<div class="nd-signal-item" style="border-color:${color}"><p class="nd-signal-name">${_esc(item.label)}</p><p class="nd-signal-value" style="color:${color}">${val}<span style="font-size:12px;font-weight:400;color:#446677"> ${_esc(item.unit)}</span></p></div>`;
  }).join('');
  return`<div class="nd-section"><p class="nd-section-title">Biometric Signals</p><div class="nd-signal-grid">${cells}</div></div>`;
};

const _buildAnomalies=(anomalies)=>{
  if(!anomalies||anomalies.length===0)return'';
  const items=anomalies.map(a=>{
    const dotColor=a.status==='critical'?'#ff3b3b':a.status==='warning'?'#ffaa00':'#00cc77';
    const val=typeof a.value==='number'?a.value.toFixed(1):a.value;
    return`<div class="nd-anomaly-item ${_esc(a.status)}"><div class="nd-anomaly-dot" style="background:${dotColor}"></div><span style="font-family:'JetBrains Mono',monospace;font-size:12px;flex-shrink:0">${_esc(a.signal)}</span><span style="font-family:'JetBrains Mono',monospace;font-weight:600">${val} ${_esc(a.unit)}</span><span style="opacity:0.85">${_esc(a.note)}</span></div>`;
  }).join('');
  return`<div class="nd-section"><p class="nd-section-title">Signal Anomalies</p>${items}</div>`;
};

const _buildSuggestedActions=(firstAid)=>{
  if(!firstAid||firstAid.length===0)return'';
  const items=firstAid.map(fa=>`<li class="${fa.startsWith('[!]')?'critical-step':''}">${_esc(fa)}</li>`).join('');
  return`<div class="nd-section"><p class="nd-section-title">Wellness Guidance</p><ul class="nd-firstaid-list">${items}</ul></div>`;
};

const _buildMedicalFindings=(findings)=>{
  if(!findings||findings.length===0)return'';
  const cards=findings.map(f=>{
    const tok=LIBRA_TOKENS.severity[f.severity]||LIBRA_TOKENS.severity.warning;
    const symptoms=(f.symptoms||[]).map(s=>`<span class="nd-symptom-tag">${_esc(s)}</span>`).join('');
    const icd=f.refCode?`<span class="nd-medical-icd">REF: ${_esc(f.refCode)}</span>`:'';
    return`<div class="nd-medical-item" style="border-color:${tok.border}"><div class="nd-medical-header">${icd}<span class="nd-medical-label" style="color:${tok.text}">${_esc(f.label)}</span></div><p class="nd-medical-desc">${_esc(f.description)}</p><div class="nd-medical-symptoms">${symptoms}</div></div>`;
  }).join('');
  return`<div class="nd-section"><p class="nd-section-title">Wellness Observations</p>${cards}</div>`;
};

const _buildReferences=(refs)=>{
  if(!refs||refs.length===0)return'';
  const items=refs.map(r=>`<div class="nd-ref-item"><span class="nd-ref-author">${_esc(r.author)}</span><span class="nd-ref-year"> (${_esc(r.year)}). </span>${_esc(r.title)}. <em style="color:#3a5066">${_esc(r.source)}</em></div>`).join('');
  const uid='nd-refs-'+Date.now();
  return`<div class="nd-section"><p class="nd-section-title nd-toggle" id="${uid}-toggle" onclick="var t=document.getElementById('${uid}-toggle');var c=document.getElementById('${uid}-body');t.classList.toggle('open');c.classList.toggle('open');">References (${refs.length})<span class="nd-toggle-arrow">></span></p><div class="nd-collapsible" id="${uid}-body">${items}</div></div>`;
};

const _buildAmbiguousWarning=()=>`<div class="nd-ambiguous">[!] Confidence < 50% - signal quality is not sufficient for stable assessment<br><span style="font-size:11px;color:#556677">Collect more signal or verify sensor connection</span></div>`;

const _buildFooter=(result)=>{
  const ts=result.timestamp?new Date(result.timestamp).toLocaleTimeString('th-TH'):'—';
  const sessionMin=result.sessionSec?Math.round(result.sessionSec/60):0;
  return`<div class="nd-footer"><span>${_esc(result.engine||'NuengdeawWellnessCore')} v${_esc(result.version||'1.0.0')}</span><span>Session ${sessionMin} min</span><span>${ts}</span></div>`;
};

const renderHTML=(result)=>{
  if(!result)return'<div class="nd-card"><p style="color:#ff6b6b">No data</p></div>';
  const parts=[
    _buildCriticalAlerts(result.criticalAlerts),
    result.state?.isAmbiguous?_buildAmbiguousWarning():_buildStateHeader(result.state),
    _buildSignalGrid(result.signals),
    _buildAnomalies(result.anomalies),
    _buildSuggestedActions(result.suggestedActions),
    _buildMedicalFindings(result.wellnessObservations),
    _buildReferences(result.references),
    _buildFooter(result),
  ];
  return`<div class="nd-card">${parts.join('')}</div>`;
};

const render=(result,target)=>{
  if(typeof document==='undefined')return;
  _injectCSS();
  const el=typeof target==='string'?document.querySelector(target):target;
  if(!el){console.warn('NuengdeawAura: target element not found:',target);return;}
  el.innerHTML=renderHTML(result);
};

const renderSignalBar=(result,target)=>{
  if(typeof document==='undefined')return;
  _injectCSS();
  const el=typeof target==='string'?document.querySelector(target):target;
  if(!el)return;
  el.innerHTML=`<div class="nd-card" style="padding:12px">${_buildSignalGrid(result?.signals||{})}</div>`;
};

const renderCompact=(result,target)=>{
  if(typeof document==='undefined')return;
  _injectCSS();
  const el=typeof target==='string'?document.querySelector(target):target;
  if(!el)return;
  const state=result?.state;
  const tok=LIBRA_TOKENS.severity[state?.severity||'normal'];
  const confPct=Math.round((state?.confidence||0)*100);
  const critHtml=result?.hasCritical?`<div style="margin-top:8px">${_buildCriticalAlerts(result.criticalAlerts)}</div>`:'';
  el.innerHTML=`<div class="nd-card" style="padding:12px"><div style="display:flex;align-items:center;gap:10px;padding:10px;background:${tok.bg};border-radius:8px;border:1px solid ${tok.border}"><span style="font-size:28px">${_esc(state?.emoji||'—')}</span><div style="flex:1"><div style="color:${tok.text};font-weight:600;font-size:15px">${_esc(state?.labelTH||'—')} <span style="font-size:12px;opacity:0.7">${_esc(state?.label||'')}</span></div><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#446677">${_esc(state?.code||'')}</div></div><div style="text-align:right"><div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;color:${tok.text}">${confPct}%</div><div style="font-size:10px;color:#446677">confidence</div></div></div>${critHtml}</div>`;
};

const startLive=(options={})=>{
  const{getInput,target,mode='full',interval=1000,onUpdate}=options;
  if(typeof getInput!=='function'){console.error('NuengdeawAura.startLive: getInput must be a function');return()=>{};}
  const core=(typeof window!=='undefined'&&window.NuengdeawWellnessCore)||(typeof NuengdeawWellnessCore!=='undefined'&&NuengdeawWellnessCore)||null;
  if(!core){console.error('NuengdeawAura.startLive: NuengdeawWellnessCore not found');return()=>{};}
  const renderFn=mode==='compact'?renderCompact:mode==='signal'?renderSignalBar:render;
  const _tick=()=>{try{const input=getInput();const result=core.assess(input);if(target)renderFn(result,target);if(typeof onUpdate==='function')onUpdate(result);}catch(err){console.error('NuengdeawAura live tick error:',err);}};
  _tick();
  const timer=setInterval(_tick,interval);
  return()=>clearInterval(timer);
};

const NuengdeawAura={render,renderHTML,renderCompact,renderSignalBar,startLive,injectCSS:_injectCSS,TOKENS:LIBRA_TOKENS,version:'1.0.0'};

if(typeof module!=='undefined'&&module.exports)module.exports=NuengdeawAura;
else if(typeof window!=='undefined')window.NuengdeawAura=NuengdeawAura;

// ===== END NuengdeawAura.js =====

// ===== BEGIN NuengdeawInput.js =====

'use strict';

/**
 * WearableDriver  v1.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * ---
 *
 * HOW TO INTEGRATE:
 * ---
 * ---
 * ---
 * ---
 *
 * SUPPORTED DEVICE TYPES (ขยายได้):
 *   'polar'     — Polar H10 / Verity Sense via Web Bluetooth (HR, HRV RMSSD)
 *   'empatica'  — Empatica E4 via REST API (HR, HRV, GSR/EDA, RR)
 *   'muse'      — Muse 2 / Muse S via mind.js SDK (EEG bands, HR)
 *   'generic'   — Generic BLE device — implement _mapGenericData() ด้วยตัวเอง
 * ---
 * ─────────────────────────────────────────────────────────────────────────────
 */
const WearableDriver = (() => {

  // ---
  const DEVICE_TYPE          = 'mock';   // 'polar' | 'empatica' | 'muse' | 'generic' | 'mock'
  const RECONNECT_MAX_TRIES  = 3;
  const RECONNECT_DELAY_MS   = 2000;
  const CONNECTION_TIMEOUT_MS= 10000;

  // ── Internal state ────────────────────────────────────────────────────────
  let _status    = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
  let _device    = null;           // BLE device handle หรือ SDK instance
  let _lastErr   = null;
  let _retryCount= 0;
  let _state = {
    bio:   { hr: null, hrv: null, gsr: null, rr: null, eeg: null },
    bands: { theta: null, alpha: null, beta: null, gamma: null,
             thetaAlphaRatio: null, iaf: null, microstate: 'A' },
    emotionState: 'NEUTRAL',
    lastUpdated: null,
  };

  // ── Device-specific connectors ────────────────────────────────────────────

  /** Polar H10 / Verity Sense — Web Bluetooth API */
  const _connectPolar = async () => {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth ไม่รองรับใน Browser นี้');
    _device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar' }],
      optionalServices: ['heart_rate', '0000180d-0000-1000-8000-00805f9b34fb'],
    });
    const server  = await _device.gatt.connect();
    const svc     = await server.getPrimaryService('heart_rate');
    const char    = await svc.getCharacteristic('heart_rate_measurement');
    await char.startNotifications();
    char.addEventListener('characteristicvaluechanged', (e) => {
      const val  = e.target.value;
      const flag = val.getUint8(0);
      const hr   = (flag & 0x01) ? val.getUint16(1, true) : val.getUint8(1);
      // RR intervals (ms) → HRV RMSSD approximation
      let hrv = null;
      if ((flag & 0x10) && val.byteLength >= 4) {
        const rr1 = val.getUint16(2, true) / 1024 * 1000;
        const rr2 = val.byteLength >= 6 ? val.getUint16(4, true) / 1024 * 1000 : rr1;
        hrv = Math.round(Math.sqrt(Math.pow(rr2 - rr1, 2)));
      }
      _state.bio.hr  = hr;
      _state.bio.hrv = hrv ?? _state.bio.hrv;
      _state.lastUpdated = Date.now();
    });
    _device.addEventListener('gattserverdisconnected', () => {
      _status = 'disconnected';
      console.warn('[WearableDriver] Polar disconnected — auto-reconnect...');
      reconnect();
    });
  };

  /* --- */
  const _connectEmpatica = async () => {
    const E4_SERVER = 'ws://127.0.0.1:28000';  // แก้ host/port ตาม E4 Streaming Server
    const ws = new WebSocket(E4_SERVER);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Empatica E4: Connection timeout')), CONNECTION_TIMEOUT_MS);
      ws.onopen  = () => { clearTimeout(t); res(); };
      ws.onerror = (e) => { clearTimeout(t); rej(new Error('Empatica E4: WebSocket error')); };
    });
    ws.send('device_connect_btle\r\n');
    ws.send('device_subscribe gsr ON\r\n');
    ws.send('device_subscribe bvp ON\r\n');  // BVP → HR/HRV
    ws.send('device_subscribe rsp ON\r\n');  // Respiration rate
    ws.onmessage = (e) => {
      const parts = e.data.trim().split(' ');
      if (parts[0] === 'E4_Gsr')  { _state.bio.gsr = parseFloat(parts[2]); }
      if (parts[0] === 'E4_Bvp')  { /* compute HR/HRV from BVP peaks — ต้อง implement peak detector */ }
      if (parts[0] === 'E4_Hr')   { _state.bio.hr  = parseFloat(parts[2]); }
      _state.lastUpdated = Date.now();
    };
    ws.onclose = () => { _status = 'disconnected'; reconnect(); };
    _device = ws;
  };

  /** Muse 2 / Muse S — mind.js / muse-js SDK */
  const _connectMuse = async () => {
    // npm: muse-js  →  import { MuseClient } from 'muse-js'
    // ---
    if (typeof window.MuseClient === 'undefined') throw new Error('Muse SDK (muse-js) ยังไม่ได้โหลด');
    const client = new window.MuseClient();
    await client.connect();
    await client.start();
    _device = client;
    client.eegReadings.subscribe((r) => {
      // r.electrode: 0=TP9 1=AF7 2=AF8 3=TP10 4=AUX
      // r.samples: Float32Array 12 samples @ 256Hz
      // ---
      // สำหรับ production ให้ใช้ FFT library (e.g. fft.js)
      // ที่นี่ map ตัวอย่างเท่านั้น
      _state.bands.lastRaw = r.samples;
      _state.lastUpdated   = Date.now();
    });
    client.telemetryData.subscribe((t) => {
      _state.bio.hr = t.heartRate;
      _state.lastUpdated = Date.now();
    });
  };

  /* --- */
  const _connectGeneric = async () => {
    throw new Error(
      'WearableDriver (generic): ยังไม่ได้ implement\n' +
      'กรุณา implement _connectGeneric() ใน NuengdeawInput.js\n' +
      'แล้ว map ค่าเข้า _state.bio และ _state.bands'
    );
  };

  /* --- */
  const _connectMock = async () => {
    // สร้าง fake streaming interval
    _device = setInterval(() => {
      _state.bio = {
        hr:  60 + Math.random() * 20,
        hrv: 30 + Math.random() * 20,
        gsr:  3 + Math.random() * 4,
        rr:  14 + Math.random() * 4,
        eeg:  0.8 + Math.random() * 0.4,
      };
      _state.bands = {
        theta: 0.8 + Math.random() * 0.4,
        alpha: 1.5 + Math.random() * 0.5,
        beta:  1.0 + Math.random() * 0.6,
        gamma: 0.4 + Math.random() * 0.2,
        thetaAlphaRatio: null,
        iaf: 10.0, microstate: 'A',
      };
      _state.bands.thetaAlphaRatio = _state.bands.theta / (_state.bands.alpha || 1);
      _state.lastUpdated = Date.now();
    }, 500);
  };

  // ── connect ────────────────────────────────────────────────────────────────
  const connect = async () => {
    if (_status === 'connected') return;
    _status = 'connecting';
    _lastErr = null;
    const fn = { polar:_connectPolar, empatica:_connectEmpatica, muse:_connectMuse, generic:_connectGeneric, mock:_connectMock }[DEVICE_TYPE];
    if (!fn) throw new Error(`WearableDriver: ไม่รู้จัก DEVICE_TYPE '${DEVICE_TYPE}'`);
    await fn();
    _status = 'connected';
    _retryCount = 0;
    console.info(`[WearableDriver] Connected (${DEVICE_TYPE})`);
  };

  // ── checkConnection ────────────────────────────────────────────────────────
  const checkConnection = () => {
    const staleSec = _state.lastUpdated ? (Date.now() - _state.lastUpdated) / 1000 : Infinity;
    return {
      status: _status,
      deviceType: DEVICE_TYPE,
      lastUpdatedSec: staleSec === Infinity ? null : +staleSec.toFixed(1),
      isStale: staleSec > 5,      // ไม่มีข้อมูลใหม่เกิน 5 วิ = stale
      lastError: _lastErr,
      retryCount: _retryCount,
    };
  };

  // ── reconnect ──────────────────────────────────────────────────────────────
  const reconnect = async () => {
    if (_status === 'connecting') return;
    if (_retryCount >= RECONNECT_MAX_TRIES) {
      _status  = 'error';
      _lastErr = `เกินจำนวน retry สูงสุด (${RECONNECT_MAX_TRIES} ครั้ง)`;
      console.error('[WearableDriver] Max retries reached:', _lastErr);
      return;
    }
    _retryCount++;
    _status = 'disconnected';
    console.warn(`[WearableDriver] Reconnecting... (try ${_retryCount}/${RECONNECT_MAX_TRIES})`);
    await new Promise(r => setTimeout(r, RECONNECT_DELAY_MS));
    try { await connect(); }
    catch (e) {
      _lastErr = e.message;
      _status  = 'error';
      console.error('[WearableDriver] Reconnect failed:', e.message);
    }
  };

  // ── disconnect ─────────────────────────────────────────────────────────────
  const disconnect = () => {
    if (DEVICE_TYPE === 'mock' && _device) { clearInterval(_device); }
    else if (_device?.gatt?.connected)     { _device.gatt.disconnect(); }
    else if (_device?.close)               { _device.close(); }
    else if (_device?.disconnect)          { _device.disconnect(); }
    _device = null; _status = 'disconnected';
    console.info('[WearableDriver] Disconnected');
  };

  // ── getBio ─────────────────────────────────────────────────────────────────
  const getBio = async () => {
    if (_status !== 'connected') {
      await connect(); // auto-connect ถ้ายังไม่ได้ต่อ
    }
    const { bio } = _state;
    const missing = ['hr','hrv','gsr','rr'].filter(k => bio[k] === null);
    if (missing.length > 0) {
      throw new Error(`WearableDriver.getBio(): missing data [${missing.join(', ')}] - waiting for wearable stream`);
    }
    return { ...bio };
  };

  // ── getEEGBands ────────────────────────────────────────────────────────────
  const getEEGBands = async () => {
    if (_status !== 'connected') await connect();
    const { bands } = _state;
    if (bands.theta === null) {
      throw new Error('WearableDriver.getEEGBands(): EEG data unavailable - verify EEG sensor');
    }
    return { ...bands };
  };

  // ── getState ───────────────────────────────────────────────────────────────
  const getState = () => _state.emotionState;

  // ── public ─────────────────────────────────────────────────────────────────
  return { getBio, getEEGBands, getState, connect, disconnect, checkConnection, reconnect, DEVICE_TYPE };
})();

const NuengdeawInput = {
  mode: 'sim',

  setMode(mode) {
    if(!['sim','wearable'].includes(mode)){console.warn(`NuengdeawInput.setMode: โหมด '${mode}' ไม่ถูกต้อง`);return;}
    this.mode = mode;
  },

  _fromSim() {
    if(typeof HumanSim==='undefined')throw new Error('NuengdeawInput: HumanSim is not ready - load Nuengdeaw_Sim_Human1.js first');
    HumanSim.tick();
    return{bio:HumanSim.generateBio(),bands:HumanSim.generateEEGBands(),state:HumanSim.getState(),history:HumanSim.getHistory().slice(-10).map(x=>x.state)};
  },

  _fromSimForced(forcedState) {
    if(typeof HumanSim==='undefined')throw new Error('NuengdeawInput: HumanSim ไม่พร้อม');
    HumanSim.force(forcedState);
    for(let i=0;i<4;i++)HumanSim.tick();
    return{bio:HumanSim.generateBio(),bands:HumanSim.generateEEGBands(),state:HumanSim.getState(),history:HumanSim.getHistory().slice(-10).map(x=>x.state)};
  },

  async _fromWearable() {
    const[bio,bands]=await Promise.all([WearableDriver.getBio(),WearableDriver.getEEGBands()]);
    return{bio,bands,state:WearableDriver.getState(),history:[]};
  },

  async get(options={}) {
    if(this.mode==='sim')return options.forceState?this._fromSimForced(options.forceState):this._fromSim();
    if(this.mode==='wearable')return await this._fromWearable();
    throw new Error(`NuengdeawInput.get(): โหมด '${this.mode}' ไม่รู้จัก`);
  },

  status(){return{mode:this.mode,simAvailable:typeof HumanSim!=='undefined',wearableReady:false};},
};

if(typeof module!=='undefined'&&module.exports){module.exports={NuengdeawInput,WearableDriver};}
else if(typeof window!=='undefined'){
  window.NuengdeawInput = window.NuengdeawInput || NuengdeawInput;
  window.WearableDriver = window.WearableDriver || WearableDriver;
}

// ===== END NuengdeawInput.js =====

// ===== BEGIN NuengdeawStore.js =====

'use strict';

/**
 * NuengdeawStore.js
 * ---
 *
 * API:
 * ---
 * ---
 * ---
 * ---
 * ---
 */

const NuengdeawStore = (() => {
  const LS_KEY = 'nuengdeaw_scan_log';
  const MAX_ROWS = 500;

  // ---
  let _rows = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  })();

  const _save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_rows.slice(-MAX_ROWS))); }
    catch { /* storage full — skip */ }
  };

  // ── columns ──────────────────────────────────────────────────────────
  const COLS = [
    'scan_no', 'timestamp', 'elapsed_sec',
    'state', 'severity', 'confidence_pct',
    'hr_bpm', 'hrv_ms', 'gsr_us', 'rr_bpm', 'eeg_uv2',
    'theta', 'alpha', 'beta', 'gamma', 'theta_alpha_ratio',
    'microstate', 'iaf_hz',
    'critical_alerts', 'medical_findings',
    'summary',
  ];

  // ── sessionStart: wall-clock เมื่อโหลดหน้า ───────────────────────────
  const _sessionStart = Date.now();

  // ── push ─────────────────────────────────────────────────────────────
  const push = (result, bio, bands) => {
    if (!result) return;
    const now = Date.now();
    const b = bio  || result.signals || {};
    const bd = bands || result.signals?.bands || {};

    const row = {
      scan_no:            _rows.length + 1,
      timestamp:          new Date(now).toISOString(),
      elapsed_sec:        Math.round((now - _sessionStart) / 1000),

      state:              result.state?.name       ?? '',
      severity:           result.state?.severity   ?? '',
      confidence_pct:     result.state?.confidence != null
                          ? Math.round(result.state.confidence * 100)
                          : '',

      hr_bpm:             _r(b.hr),
      hrv_ms:             _r(b.hrv),
      gsr_us:             _r(b.gsr),
      rr_bpm:             _r(b.rr),
      eeg_uv2:            _r(b.eeg),

      theta:              _r(bd.theta),
      alpha:              _r(bd.alpha),
      beta:               _r(bd.beta),
      gamma:              _r(bd.gamma),
      theta_alpha_ratio:  _r(bd.thetaAlphaRatio),
      microstate:         bd.microstate ?? '',
      iaf_hz:             _r(bd.iaf),

      critical_alerts:    (result.criticalAlerts || []).map(a => a.id).join(';'),
      medical_findings:   (result.wellnessObservations || result.medicalFindings || []).map(m => m.id).join(';'),
      summary:            result.summary ?? '',
    };

    _rows.push(row);
    _save();
    return row;
  };

  // round helper
  const _r = (v) => v != null ? +Number(v).toFixed(2) : '';

  // ── exportCSV ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (_rows.length === 0) { alert('No data yet - run at least 1 scan before export'); return; }

    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    const header = COLS.join(',');
    const body   = _rows.map(row => COLS.map(c => escape(row[c])).join(',')).join('\n');
    const csv    = '\uFEFF' + header + '\n' + body; // BOM สำหรับ Excel Thai

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `nuengdeaw_scan_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── public ────────────────────────────────────────────────────────────
  return {
    push,
    exportCSV,
    getAll:  () => [..._rows],
    getLast: (n = 20) => _rows.slice(-n),
    clear:   () => { _rows = []; localStorage.removeItem(LS_KEY); },
    count:   () => _rows.length,
    sessionStartTime: _sessionStart,
    COLS,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NuengdeawStore;
else if (typeof window !== 'undefined') window.NuengdeawStore = NuengdeawStore;

// ===== END NuengdeawStore.js =====

// ===== BEGIN NuengdeawBaseline.js =====

'use strict';

/**
 * NuengdeawBaseline.js  v1.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * ---
 * ---
 *
 * API (public):
 * ---
 * ---
 * ---
 * ---
 * ---
 * ---
 * ---
 * ---
 *
 * Blended Threshold Formula:
 *   effective = (STATIC_AT × STATIC_WEIGHT) + (personal_mean × PERSONAL_WEIGHT)
 *   default weights: STATIC=0.4, PERSONAL=0.6
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NuengdeawBaseline = (() => {
  // ── Config ────────────────────────────────────────────────────────────────
  const LS_KEY        = 'nuengdeaw_baseline_v1';
  const MIN_SAMPLES   = 8;    // ต้องการ sample อย่างน้อยกี่ตัวจึง finalize ได้
  const MAX_SAMPLES   = 120;  // เก็บได้สูงสุดกี่ sample (2 นาที x 1 sample/วิ = 120)
  const STATIC_WEIGHT = 0.4;
  const PERSONAL_WEIGHT = 0.6;

  // ---
  // ---
  const STATIC_AT = {
    HRV_LOW:    10,
    HRV_STRESS: 20,
    HRV_READY:  50,
    HR_BRADY:   45,
    HR_TACHY:   120,
    HR_EXTREME: 140,
    GSR_LOW:    0.5,
    GSR_HIGH:   15,
    GSR_EXTREME:20,
    RESP_APNEA: 5,
    RESP_HIGH:  30,
  };

  // ── In-memory state ────────────────────────────────────────────────────────
  let _pending  = [];   // samples ระหว่าง calibration ยังไม่ finalize
  let _baseline = null; // { mean:{hr,hrv,gsr,rr}, std:{...}, sampleCount, calibratedAt }

  // ---
  const _load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const mean = parsed?.mean;
        const keys = ['hr', 'hrv', 'gsr', 'rr'];
        const valid = !!mean && keys.every(k => Number.isFinite(Number(mean[k])));
        _baseline = valid ? parsed : null;
        if (!valid) localStorage.removeItem(LS_KEY);
      }
    } catch { _baseline = null; }
  };
  _load();

  // ── save ──────────────────────────────────────────────────────────────────
  const _save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_baseline)); }
    catch { /* storage full */ }
  };

  // ── math helpers ──────────────────────────────────────────────────────────
  const _mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const _std  = (arr, mean) => {
    const m = mean ?? _mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };
  const _r2 = (v) => +Number(v).toFixed(2);
  const _isFiniteNum = (v) => Number.isFinite(Number(v));
  const _isValidBaseline = (baseline) => {
    if (!baseline || typeof baseline !== 'object') return false;
    if (!baseline.mean || typeof baseline.mean !== 'object') return false;
    const keys = ['hr', 'hrv', 'gsr', 'rr'];
    return keys.every(k => _isFiniteNum(baseline.mean[k]));
  };

  // ── addCalibrationSample ──────────────────────────────────────────────────
  /**
   * ---
   * @param {object} bio  { hr, hrv, gsr, rr }
   * ---
   */
  const addCalibrationSample = (bio) => {
    if (!bio) return _pending.length;
    if (_pending.length >= MAX_SAMPLES) return _pending.length; // เต็มแล้ว
    _pending.push({
      hr:  +Number(bio.hr  ?? 72).toFixed(2),
      hrv: +Number(bio.hrv ?? 38).toFixed(2),
      gsr: +Number(bio.gsr ?? 4.5).toFixed(2),
      rr:  +Number(bio.rr  ?? 15).toFixed(2),
    });
    return _pending.length;
  };

  // ── finalizeCalibration ───────────────────────────────────────────────────
  /**
   * ---
   * @returns {{ ok:boolean, mean:object, std:object, sampleCount:number } | { ok:false, reason:string }}
   */
  const finalizeCalibration = () => {
    if (_pending.length < MIN_SAMPLES) {
      return { ok: false, reason: `ต้องการอย่างน้อย ${MIN_SAMPLES} samples (มีแค่ ${_pending.length})` };
    }

    const keys = ['hr', 'hrv', 'gsr', 'rr'];
    const mean = {}, std = {}, sampleCount = _pending.length;

    for (const k of keys) {
      const vals = _pending.map(s => s[k]);
      const m = _mean(vals);
      mean[k] = _r2(m);
      std[k]  = _r2(_std(vals, m));
    }

    _baseline = { mean, std, sampleCount, calibratedAt: Date.now() };
    _pending  = [];
    _save();

    return { ok: true, mean, std, sampleCount };
  };

  // ── isCalibrated ──────────────────────────────────────────────────────────
  const isCalibrated = () => _isValidBaseline(_baseline);

  // ── getOffset ─────────────────────────────────────────────────────────────
  /**
   * คืน mean ของผู้ใช้ (personal resting baseline)
   * ถ้ายังไม่ calibrate จะคืน null
   */
  const getOffset = () => _baseline ? { ..._baseline.mean } : null;

  // ── getAdaptiveAT ─────────────────────────────────────────────────────────
  /**
   * คำนวณ AT ที่ผสม Static × 0.4 + Personal × 0.6
   * ถ้ายังไม่ calibrate คืน STATIC_AT เดิมทั้งหมด
   * @returns {object} AT object ที่พร้อมส่งเข้า WellnessCore.assess()
   */
  const getAdaptiveAT = () => {
    if (!_isValidBaseline(_baseline)) return { ...STATIC_AT };

    const b = _baseline.mean;
    const sw = STATIC_WEIGHT;
    const pw = PERSONAL_WEIGHT;

    // ---
    const blend = (staticVal, personalVal) => _r2(staticVal * sw + personalVal * pw);

    // HRV thresholds — ยิ่ง HRV สูง ยิ่งดี; threshold ขยับตาม baseline
    const hrvBase = b.hrv;
    const adaptedHRV_LOW    = _r2(blend(STATIC_AT.HRV_LOW,    hrvBase * 0.30));  // 30% ของ resting
    const adaptedHRV_STRESS = _r2(blend(STATIC_AT.HRV_STRESS, hrvBase * 0.55));  // 55% ของ resting
    const adaptedHRV_READY  = _r2(blend(STATIC_AT.HRV_READY,  hrvBase * 1.15));  // 115% ของ resting

    // HR thresholds — threshold Tachy/Brady ขยับตาม resting HR
    const hrBase = b.hr;
    const adaptedHR_BRADY   = _r2(blend(STATIC_AT.HR_BRADY,   hrBase  * 0.72));  // 72% of resting
    const adaptedHR_TACHY   = _r2(blend(STATIC_AT.HR_TACHY,   hrBase  * 1.65));  // 165% of resting
    const adaptedHR_EXTREME = _r2(blend(STATIC_AT.HR_EXTREME, hrBase  * 1.90));  // 190% of resting

    // GSR thresholds
    const gsrBase = b.gsr;
    const adaptedGSR_LOW    = _r2(blend(STATIC_AT.GSR_LOW,    gsrBase * 0.25));
    const adaptedGSR_HIGH   = _r2(blend(STATIC_AT.GSR_HIGH,   gsrBase * 2.80));
    const adaptedGSR_EXTREME= _r2(blend(STATIC_AT.GSR_EXTREME,gsrBase * 3.50));

    // RR thresholds
    const rrBase = b.rr;
    const adaptedRESP_APNEA = _r2(blend(STATIC_AT.RESP_APNEA, rrBase  * 0.35));
    const adaptedRESP_HIGH  = _r2(blend(STATIC_AT.RESP_HIGH,  rrBase  * 1.90));

    return {
      // Adaptive thresholds
      HRV_LOW:     adaptedHRV_LOW,
      HRV_STRESS:  adaptedHRV_STRESS,
      HRV_READY:   adaptedHRV_READY,
      HR_BRADY:    adaptedHR_BRADY,
      HR_TACHY:    adaptedHR_TACHY,
      HR_EXTREME:  adaptedHR_EXTREME,
      GSR_LOW:     adaptedGSR_LOW,
      GSR_HIGH:    adaptedGSR_HIGH,
      GSR_EXTREME: adaptedGSR_EXTREME,
      RESP_APNEA:  adaptedRESP_APNEA,
      RESP_HIGH:   adaptedRESP_HIGH,
      // ค่าที่ไม่มี personal signal ให้ใช้ static เดิม
      N400_VETO:        4.0,
      THETA_ALPHA_HIGH: 2.5,
      SESSION_MAX:      7200,
      CONFIDENCE_MIN:   0.50,
      // metadata
      _isAdaptive:      true,
      _baselineDate:    _baseline.calibratedAt,
    };
  };

  // ── getStatus ─────────────────────────────────────────────────────────────
  const getStatus = () => ({
    calibrated:   isCalibrated(),
    sampleCount:  _pending.length,
    minSamples:   MIN_SAMPLES,
    maxSamples:   MAX_SAMPLES,
    mean:         _baseline?.mean   ?? null,
    std:          _baseline?.std    ?? null,
    calibratedAt: _baseline?.calibratedAt ? new Date(_baseline.calibratedAt).toLocaleString('th-TH') : null,
    adaptiveAT:   isCalibrated() ? getAdaptiveAT() : null,
  });

  // ── reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    _baseline = null;
    _pending  = [];
    localStorage.removeItem(LS_KEY);
  };

  // ── clearPending ──────────────────────────────────────────────────────────
  const clearPending = () => { _pending = []; };

  // ── public ────────────────────────────────────────────────────────────────
  return {
    addCalibrationSample,
    finalizeCalibration,
    isCalibrated,
    getOffset,
    getAdaptiveAT,
    getStatus,
    reset,
    clearPending,
    MIN_SAMPLES,
    MAX_SAMPLES,
    version: '1.0.0',
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NuengdeawBaseline;
else if (typeof window !== 'undefined') window.NuengdeawBaseline = NuengdeawBaseline;

// ===== END NuengdeawBaseline.js =====

// ===== BEGIN NuengdeawDevTools.js =====

'use strict';

/**
 * NuengdeawDevTools.js  v1.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * ---
 *
 * ฟีเจอร์ที่ wrap:
 * ---
 *   B. DeceptionScorer  — คำนวณ PCI (Physiological Coherence Index)
 *   C. ArtifactDetector — ตรวจ Motion Artifact / Electrode Pop / Drift
 *   D. ABTestManager    — A/B Testing framework (สำหรับ researcher)
 *   E. ModelPortability — Export/Import TF.js model weights (advanced)
 *
 * USAGE ใน demo:
 *   NuengdeawDevTools.enable('deception')  // เปิด Deception Engine
 *   NuengdeawDevTools.enable('artifact')   // เปิด Artifact Detector
 *   NuengdeawDevTools.process(bio, bands, state) → { bio, bands, flags }
 *
 * TOGGLE ใน UI:
 * ---
 *   จะ render toggle panel ที่ผู้ใช้เปิด/ปิดได้เอง
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NuengdeawDevTools = (() => {

  // ── Feature flags ─────────────────────────────────────────────────────────
  const _flags = {
    deception: false,
    artifact:  false,
    abtest:    false,
  };

  // ── Dependency check ──────────────────────────────────────────────────────
  const _require = (name) => {
    const map = {
      DeceptionEngine:  () => typeof DeceptionEngine  !== 'undefined',
      DeceptionScorer:  () => typeof DeceptionScorer  !== 'undefined',
      ArtifactDetector: () => typeof ArtifactDetector !== 'undefined',
      ABTestManager:    () => typeof ABTestManager     !== 'undefined',
      ModelPortability: () => typeof ModelPortability  !== 'undefined',
    };
    if (map[name] && !map[name]()) {
      console.warn(`[NuengdeawDevTools] ${name} not found - check whether Nuengdeaw_Sim_Human2.js is loaded`);
      return false;
    }
    return true;
  };

  // ── enable / disable ──────────────────────────────────────────────────────
  const enable  = (feature) => { if (feature in _flags) { _flags[feature] = true;  _syncPanel(); } };
  const disable = (feature) => { if (feature in _flags) { _flags[feature] = false; _syncPanel(); } };
  const toggle  = (feature) => { _flags[feature] ? disable(feature) : enable(feature); };
  const isEnabled = (feature) => !!_flags[feature];

  // ---
  /**
   * @param {object} bio    { hr, hrv, gsr, rr, eeg }
   * @param {object} bands  EEG band object
   * @param {string} state  emotion state name
   * @returns {{ bio, bands, artifactReport, deceptionReport }}
   */
  const process = (bio, bands, state) => {
    let outBio = { ...bio }, outBands = bands ? { ...bands } : null;
    let artifactReport = null, deceptionReport = null;

    // A. Artifact Detector
    if (_flags.artifact && _require('ArtifactDetector')) {
      artifactReport = ArtifactDetector.check(outBio, outBands);
    }

    // B. Deception Engine (modifies bio/bands in-place)
    if (_flags.deception && _require('DeceptionEngine')) {
      const r = DeceptionEngine.applyDeception(outBio, outBands);
      outBio   = r.bio;
      outBands = r.bands;
    }

    // C. Deception Scorer
    if (_flags.deception && _require('DeceptionScorer')) {
      deceptionReport = DeceptionScorer.score(outBio, outBands, state);
    }

    return { bio: outBio, bands: outBands, artifactReport, deceptionReport };
  };

  // ── A/B Test helpers (researcher API) ────────────────────────────────────
  const abtest = {
    create:  (...a) => _require('ABTestManager') && ABTestManager.createTest(...a),
    assign:  (...a) => _require('ABTestManager') && ABTestManager.assign(...a),
    record:  (...a) => _require('ABTestManager') && ABTestManager.record(...a),
    result:  (...a) => _require('ABTestManager') && ABTestManager.getResult(...a),
    list:    ()     => _require('ABTestManager') && ABTestManager.listTests(),
  };

  // ── UI Panel ──────────────────────────────────────────────────────────────
  let _panelEl = null;

  const PANEL_FEATURES = [
    { key: 'artifact',  label: 'Artifact Detector', desc: 'Detect Motion / Electrode / Drift artifacts' },
    { key: 'deception', label: 'Deception Engine',  desc: 'PCI - Biosignal consistency checks' },
    { key: 'abtest',    label: 'A/B Test Manager',  desc: 'Researcher Mode (console API)' },
  ];

  const injectPanel = (selectorOrEl) => {
    const target = typeof selectorOrEl === 'string'
      ? document.querySelector(selectorOrEl)
      : selectorOrEl;
    if (!target) { console.warn('[NuengdeawDevTools] injectPanel: target not found'); return; }

    const panel = document.createElement('div');
    panel.id = 'nd-devtools-panel';
    panel.style.cssText = [
      'background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:12px;',
      'padding:14px 16px;margin-top:12px;box-shadow:0 2px 10px rgba(13,21,38,.07);',
      'font-family:\'Share Tech Mono\',monospace;',
    ].join('');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(0,0,0,.07);">
        <div style="width:3px;height:13px;border-radius:2px;background:#7c3aed;flex-shrink:0;"></div>
        <span style="font-size:.53rem;letter-spacing:.22em;text-transform:uppercase;color:#8a9bba;">Dev Tools</span>
        <span style="margin-left:auto;font-size:.46rem;color:#c4b5fd;letter-spacing:.10em;">Sim_Human2</span>
      </div>
      <div id="nd-devtools-toggles" style="display:flex;flex-direction:column;gap:9px;"></div>
    `;
    target.appendChild(panel);
    _panelEl = panel;
    _syncPanel();
  };

  const _syncPanel = () => {
    if (!_panelEl) return;
    const container = _panelEl.querySelector('#nd-devtools-toggles');
    if (!container) return;
    container.innerHTML = PANEL_FEATURES.map(f => `
      <div style="display:flex;align-items:center;gap:10px;">
        <button
          id="ndt-btn-${f.key}"
          onclick="NuengdeawDevTools.toggle('${f.key}')"
          style="
            flex-shrink:0;width:36px;height:20px;border-radius:12px;border:none;cursor:pointer;
            background:${_flags[f.key] ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'rgba(0,0,0,.08)'};
            position:relative;transition:all .2s;
          "
          title="${_flags[f.key] ? 'Disable' : 'Enable'} ${f.label}"
        >
          <div style="
            position:absolute;top:2px;
            left:${_flags[f.key] ? '18px' : '2px'};
            width:16px;height:16px;border-radius:50%;
            background:${_flags[f.key] ? '#fff' : '#aaa'};
            transition:left .2s;
          "></div>
        </button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.52rem;letter-spacing:.12em;color:${_flags[f.key] ? '#5b21b6' : '#3d4f6e'};">${f.label}</div>
          <div style="font-size:.46rem;letter-spacing:.08em;color:#8a9bba;margin-top:1px;">${f.desc}</div>
        </div>
        <div style="
          font-size:.44rem;letter-spacing:.12em;padding:2px 7px;border-radius:4px;
          background:${_flags[f.key] ? 'rgba(124,58,237,.10)' : 'rgba(0,0,0,.04)'};
          color:${_flags[f.key] ? '#7c3aed' : '#aab'};
          flex-shrink:0;
        ">${_flags[f.key] ? 'ON' : 'OFF'}</div>
      </div>
    `).join('');
  };

  // ── public ─────────────────────────────────────────────────────────────────
  return {
    enable, disable, toggle, isEnabled,
    process,
    abtest,
    injectPanel,
    getFlags: () => ({ ..._flags }),
    version: '1.0.0',
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NuengdeawDevTools;
else if (typeof window !== 'undefined') window.NuengdeawDevTools = NuengdeawDevTools;

// ===== END NuengdeawDevTools.js =====

