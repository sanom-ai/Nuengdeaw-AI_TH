'use strict';
// น้องหนึ่งเดียวAIโดย2026ตะวัน

// ============================================================================
// SignalAnalysis.js
// Combined signal-analysis module:
// - DeceptionEngine + DeceptionScorer
// - ArtifactDetector
// ============================================================================
// Dependencies: HumanSimSystem.js (must load before this)
// Load order:
//   <script src="js/core/HumanSimSystem.js"></script>
//   <script src="js/core/SignalAnalysis.js"></script>
// ============================================================================
// References: Ekman (2003): การโกหกมี cognitive cost จริง และ emotion จะ "leak" ออกมาสั้นๆ
// ============================================================================

const createDeceptionEngine = (initialDeps = {}) => {
  let _deps = {
    ethicsGuard: null,
    humanSim: null,
    errorHandler: null,
    rng: Math.random,
    ...initialDeps,
  };
  let _level=0, _active=false, _tick=0, _autoTimer=null, _reboundCd=0, _flatCount=0;
  let _cogCost=0;
  let _consistency=new Map();
  const MAX_CONSISTENCY_PER_TOPIC = 20;
  const _lerp=(a,b,t)=>a+(b-a)*t;
  const _clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const _result = (success, extra = {}) => ({ success, ...extra });
  const _random = () => {
    const rng = typeof _deps.rng === 'function' ? _deps.rng : Math.random;
    const value = Number(rng());
    if (!Number.isFinite(value)) return Math.random();
    if (value <= 0) return Number.EPSILON;
    if (value >= 1) return 1 - Number.EPSILON;
    return value;
  };
  const _randn=()=>{let u=0,v=0;while(!u)u=_random();while(!v)v=_random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const _reportError = (scope, error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    if (typeof _deps.errorHandler === 'function') {
      try { _deps.errorHandler({ scope, error: err, source: 'DeceptionEngine' }); } catch(_) {}
    }
    console.error(`[DeceptionEngine] ${scope}:`, err.message);
    return _result(false, { error: err.message, scope });
  };
  const _getHumanSim = () =>
    _deps.humanSim || (typeof HumanSim !== 'undefined' ? HumanSim : null);

  const getMicroLeakRate = (personality={}) => {
    const neuro = personality.neuroticism ?? 0.5;
    const agree = personality.agreeableness ?? 0.5;
    return _clamp(0.04 + neuro*0.18 + agree*0.12 - _level*0.08, 0.01, 0.45);
  };

  const checkMicroLeak = (leakRate) => _active && _random() < (leakRate ?? 0.1);
  const getCognitiveCost = () => _cogCost;

  const _level1 = (bio,bands) => {
    const humanSim = _getHumanSim();
    const s=humanSim && typeof humanSim.getState === 'function' ? humanSim.getState() : 'NEUTRAL';
    if(['STRESS','CONFUSION','EXCITEMENT'].includes(s)){
      bio.hr=_lerp(bio.hr,72,0.55); bio.hrv=_lerp(bio.hrv,40,0.50); bio.hrv=Math.max(bio.hrv,28);
      if(_tick%(7+Math.floor(_random()*6))===0)bio.gsr=Math.min(bio.gsr*1.35+0.8,22);
      else bio.gsr=_lerp(bio.gsr,5.0,0.40);
    }
    return {bio,bands};
  };
  const _level2 = (bio,bands) => {
    bio.hr=_lerp(bio.hr,64,0.70); bio.hrv=_lerp(bio.hrv,54,0.65); bio.gsr=_lerp(bio.gsr,2.5,0.60);
    _reboundCd=Math.max(0,_reboundCd-1);
    if(_reboundCd===0&&_tick%20===0){bio.hr+=12+_random()*8;bio.gsr+=3.5+_random()*2;bio.hrv=Math.max(bio.hrv-14,12);_reboundCd=5;}
    if(bands){bands.theta=Math.max(bands.theta,1.8+_random()*0.4);bands.alpha=Math.min(bands.alpha,1.1);bands.thetaAlphaRatio=bands.theta/Math.max(bands.alpha,0.01);}
    return {bio,bands};
  };
  const _level3 = (bio,bands) => {
    bio.hr=_lerp(bio.hr,72,0.80); bio.hrv=_lerp(bio.hrv,38,0.78); bio.gsr=_lerp(bio.gsr,4.5,0.75); bio.rr=_lerp(bio.rr,15,0.70);
    const n=_randn()*3; bio.hr+=n*0.8; bio.hrv+=n*0.7; bio.rr+=_randn()*2.5; bio.rr=Math.max(8,Math.min(35,bio.rr));
    if(bands){bands.beta=Math.max(bands.beta,2.2+_random()*0.6);bands.gamma=Math.max(bands.gamma,0.9+_random()*0.3);bands.thetaAlphaRatio=bands.theta/Math.max(bands.alpha,0.01);}
    return {bio,bands};
  };
  const _level4 = (bio,bands) => {
    _flatCount++;
    bio.hr=_lerp(bio.hr,70,0.93); bio.hrv=_lerp(bio.hrv,42,0.91); bio.gsr=_lerp(bio.gsr,4.2,0.89); bio.rr=_lerp(bio.rr,14,0.86); bio.eeg=_lerp(bio.eeg,1.0,0.89);
    if(bands){if(_flatCount%15===0)bands.gamma=2.1+_random()*0.8;else bands.gamma=_lerp(bands.gamma,0.3,0.85);}
    if(_flatCount%2===0)bio.hrv=Math.min(bio.hrv+6,65);else bio.hrv=Math.max(bio.hrv-5,22);
    bio.rr+=_randn()*0.4; bio.rr=Math.max(8,Math.min(36,bio.rr));
    if(bands)bands.thetaAlphaRatio=bands.theta/Math.max(bands.alpha,0.01);
    return {bio,bands};
  };

  const startAuto = (ticksPerLevel=60) => {
    // FIX #8: clear timer เดิมก่อนเสมอ — ป้องกัน 2 interval วิ่งพร้อมกัน
    // (เดิมมี clearInterval แต่เฉพาะกรณี _autoTimer ไม่ null
    // ถ้า startAuto ถูกเรียกซ้อนก่อน _autoTimer ถูก assign จะ leak)
    if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
    _active=true; _level=1; _tick=0;
    let elapsed=0;
    _autoTimer=setInterval(()=>{ elapsed++; if(elapsed>=ticksPerLevel){elapsed=0;_level++;if(_level>4){_level=0;_active=false;clearInterval(_autoTimer);_autoTimer=null;}} },1000);
  };

  const setLevelUnsafe = (l) => {
    if (!Number.isFinite(l)) {
      return _result(false, { error:'Invalid deception level' });
    }
    _level=Math.max(0,Math.min(4,l)); _active=_level>0; _tick=0; _flatCount=0; _reboundCd=0;
    _cogCost=_level*0.07;
    return _result(true, { level:_level, active:_active });
  };

  const configure = (deps = {}) => {
    _deps = { ..._deps, ...deps };
    return _result(true, {
      hasEthicsGuard: !!_deps.ethicsGuard,
      hasHumanSim: !!_getHumanSim(),
      hasCustomRng: _deps.rng !== Math.random,
    });
  };

  const setEthicsGuard = (ethicsGuard) => {
    _deps.ethicsGuard = ethicsGuard || null;
    return _result(true, { hasEthicsGuard: !!_deps.ethicsGuard });
  };

  return {
    applyDeception(bio,bands){
      if(!_active||_level===0)return{bio,bands};
      _tick++;
      const fn=[null,_level1,_level2,_level3,_level4][_level];
      return fn?fn(bio,bands):{bio,bands};
    },
    configure,
    setEthicsGuard,
    setLevel(l){
      if (_deps.ethicsGuard && typeof _deps.ethicsGuard.safeSetDeceptionLevel === 'function') {
        return _deps.ethicsGuard.safeSetDeceptionLevel(l);
      }
      return setLevelUnsafe(l);
    },
    setLevelUnsafe,
    getLevel()         { return _level; },
    isActive()         { return _active; },
    getLevelName()     { return ['NONE','MILD','TRAINED_LIAR','PATHOLOGICAL','SOCIOPATH'][_level]; },
    getMicroLeakRate,
    checkMicroLeak,
    getCognitiveCost,
    recordStatement(topic, statement) {
      if(!_consistency.has(topic))_consistency.set(topic,[]);
      const entries = _consistency.get(topic);
      entries.push({statement,ts:Date.now()});
      if(entries.length>MAX_CONSISTENCY_PER_TOPIC)entries.shift();
    },
    recallStatement(topic){ return _consistency.get(topic)??[]; },
    startAuto,
    stopAuto(){ if(_autoTimer){clearInterval(_autoTimer);_autoTimer=null;}_active=false;_level=0;_cogCost=0; return _result(true, { level:_level, active:_active }); },
  };
};

const DeceptionEngine = createDeceptionEngine();

// ============================================================================
// DeceptionScorer — Physiological Coherence Index (PCI v2)
// ============================================================================

const createDeceptionScorer = () => {
  const BUF=30;
  const _buf={hrv:[],hr:[],gsr:[],eeg:[],theta:[],alpha:[],rr:[]};
  let _history=[];
  const _push=(key,val)=>{_buf[key].push(val);if(_buf[key].length>BUF)_buf[key].shift();};
  const _pearson=(xs,ys)=>{
    const n=Math.min(xs.length,ys.length);if(n<5)return 0;
    const mx=xs.slice(-n).reduce((a,b)=>a+b)/n,my=ys.slice(-n).reduce((a,b)=>a+b)/n;
    let num=0,dx=0,dy=0;
    for(let i=0;i<n;i++){const xd=xs[xs.length-n+i]-mx,yd=ys[ys.length-n+i]-my;num+=xd*yd;dx+=xd*xd;dy+=yd*yd;}
    return dx>0&&dy>0?num/Math.sqrt(dx*dy):0;
  };
  const _score=(bio,bands,reportedState)=>{
    if(bio.hrv!=null)_push('hrv',bio.hrv);if(bio.hr!=null)_push('hr',bio.hr);
    if(bio.gsr!=null)_push('gsr',bio.gsr);if(bio.eeg!=null)_push('eeg',bio.eeg);
    if(bio.rr!=null)_push('rr',bio.rr);
    if(bands){if(bands.theta!=null)_push('theta',bands.theta);if(bands.alpha!=null)_push('alpha',bands.alpha);}
    const n=_buf.hrv.length;if(n<5)return{pci:0,avgPci:0,deceptionFlag:false,violations:[],confidence:'insufficient_data'};
    const violations=[];let total=0;
    const _m=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const _s=a=>{const m=_m(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
    const hrMean=_m(_buf.hr.slice(-10));const hrvMean=_m(_buf.hrv.slice(-10));
    const gsrMean=_m(_buf.gsr.slice(-10));
    const v1=Math.max(0,0.8+_pearson(_buf.hrv,_buf.hr));if(v1>0.25)violations.push({pair:'HRV↔HR',score:+v1.toFixed(3)});total+=v1*0.20;
    const v2=Math.max(0,0.8-_pearson(_buf.gsr,_buf.hrv));if(v2>0.30)violations.push({pair:'GSR↓HRV',score:+v2.toFixed(3)});total+=v2*0.20;
    const n6=Math.min(_buf.theta.length,_buf.alpha.length);
    if(n6>=5){const ta=_buf.theta.slice(-n6).map((t,i)=>t/_buf.alpha[_buf.alpha.length-n6+i]);const taMean=_m(ta);const v3=Math.max(0,taMean-1.5);if(v3>0.15)violations.push({pair:'θ/α>1.5',score:+v3.toFixed(3)});total+=v3*0.15;}
    const v4=_s(_buf.rr.slice(-10))<0.3?0.4:0;if(v4>0)violations.push({pair:'RR_flat',score:v4});total+=v4*0.15;
    const v5=_s(_buf.gsr.slice(-10))>4?0.3:0;if(v5>0)violations.push({pair:'GSR_variance',score:v5});total+=v5*0.20;
    if(reportedState){
      const ref=typeof _PHYSIO_REF!=='undefined'?_PHYSIO_REF[reportedState]:null;
      if(ref){const v6=Math.abs(hrMean-ref.hr[0])/ref.hr[0];if(v6>0.40)violations.push({pair:'BioMean↔State',hrObs:+hrMean.toFixed(1),hrExp:ref.hr,score:+v6.toFixed(3)});total+=v6*0.10;}
    }
    const pci=Math.min(1.0,total);
    _history.push(pci);if(_history.length>60)_history.shift();
    const avg=_history.reduce((s,v)=>s+v,0)/_history.length;
    const deceptionFlag=pci>0.60&&violations.length>=2;
    const confidence=avg>0.75?'high_deception':avg>0.60?'probable_deception':avg>0.35?'mild_inconsistency':'coherent';
    return{pci:+pci.toFixed(3),avgPci:+avg.toFixed(3),deceptionFlag,violations,confidence};
  };
  return{score:_score,getHistory:()=>[..._history],reset:()=>{Object.keys(_buf).forEach(k=>_buf[k]=[]);_history=[];}};
};

const DeceptionScorer = createDeceptionScorer();

const ArtifactDetector = (() => {
  const BUF=20;
  const _h={hr:[],gsr:[],eeg:[],hrv:[],alpha:[],rr:[]};
  let _last=[];
  let _sourceMode='simulator';
  const _push=(k,v)=>{_h[k].push(v);if(_h[k].length>BUF)_h[k].shift();};
  const _mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const _std=a=>{const m=_mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};

  const _check=(bio,bands)=>{
    _push('hr',bio.hr);_push('gsr',bio.gsr);_push('eeg',bio.eeg);_push('hrv',bio.hrv);_push('rr',bio.rr??15);
    if(bands)_push('alpha',bands.alpha??1);
    const n=_h.hr.length; if(n<4)return{isClean:true,artifacts:[],severity:'ok',ready:false};
    const arts=[];
    if(n>=2&&Math.abs(_h.gsr[n-1]-_h.gsr[n-2])>5.0)arts.push({type:'motion_gsr',msg:'GSR spike - Motion Artifact'});
    if(n>=2&&Math.abs(_h.hr[n-1]-_h.hr[n-2])>25)arts.push({type:'motion_hr',msg:'HR spike - Motion Artifact'});
    if(n>=8){const m=_mean(_h.eeg),s=_std(_h.eeg);if(s>0&&Math.abs(bio.eeg-m)>4*s)arts.push({type:'electrode_pop',msg:'EEG Electrode Pop'});}
    if(bands&&n>=3){const prev=_h.alpha[n-2]??1;if((bands.alpha??1)>prev*2.5&&(bands.alpha??1)>3.0)arts.push({type:'eye_blink_eeg',msg:'Eye Blink Artifact'});}
    if(n>=15){const early=_mean(_h.gsr.slice(0,5)),late=_mean(_h.gsr.slice(-5));if(late-early>6.0)arts.push({type:'baseline_drift',msg:'GSR Baseline Drift'});}
    if(n>=10){const hv=_std(_h.hr.slice(-10));if(hv<0.05)arts.push({type:'flat_signal',msg:'HR Flat Signal'});}
    if(n>=2&&Math.abs(bio.eeg)>4.8)arts.push({type:'saturation_clip',msg:'EEG Saturation'});
    _last=arts;
    return{isClean:arts.length===0,artifacts:arts,severity:arts.length===0?'ok':arts.length===1?'warn':'error',ready:true};
  };

  return{
    check:_check,
    getLastArtifacts:()=>_last,
    getWarningMessage:()=>_last.length?'Warning: '+_last.map(a=>a.msg).join(' | '):'',
    reset:()=>{Object.keys(_h).forEach(k=>_h[k]=[]);_last=[];},
    setSourceMode:(mode)=>{ if(mode && mode!==_sourceMode){ _sourceMode=mode; Object.keys(_h).forEach(k=>_h[k]=[]); _last=[]; } return { success:true, mode:_sourceMode }; },
  };
})();

if(typeof window!=='undefined'){
  window.createDeceptionEngine = createDeceptionEngine;
  window.createDeceptionScorer = createDeceptionScorer;
  window.DeceptionEngine = DeceptionEngine;
  window.DeceptionScorer = DeceptionScorer;
  window.ArtifactDetector = ArtifactDetector;
}
if(typeof module!=='undefined'&&module.exports) module.exports = { createDeceptionEngine, createDeceptionScorer, DeceptionEngine, DeceptionScorer, ArtifactDetector };

console.log('SignalAnalysis.js loaded');
