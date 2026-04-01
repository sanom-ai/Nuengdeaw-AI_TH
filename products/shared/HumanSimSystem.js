'use strict';
// น้องหนึ่งเดียวAIโดย2026ตะวัน

// ============================================================================
// HumanSimSystem.js
// Role:
//   HumanSim is a simulated human data source used to test NuengdeawCore
//   when a real wearable device is unavailable.
//   It is not the wearable itself.
// Combined module:
// - HumanSim
// - HumanSimLifecycle
// ============================================================================
// Load order:
//   (no dependencies — load first)
// ============================================================================

// ============================================================================
// SECTION 1: CONSTANTS & REFERENCE DATA
// ============================================================================

const EMOTION_STATES = [
  'FLOW','READY','STRESS','CONFUSION','BOREDOM','EXCITEMENT','FATIGUE','NEUTRAL',
  'FRUSTRATION','ANXIETY','CURIOSITY','DISGUST','SURPRISE','CALM',
];

const _PHYSIO_REF = {
  FLOW:        { hrv:[52,6,28,80],  hr:[66,5,54,80],   gsr:[2.8,0.8,1.0,6.5],  rr:[13,2,9,18],  eeg:[0.55,0.10,0.25,0.90] },
  READY:       { hrv:[56,5,36,78],  hr:[62,5,50,76],   gsr:[2.2,0.6,1.0,5.0],  rr:[11,2,8,16],  eeg:[0.40,0.08,0.20,0.70] },
  STRESS:      { hrv:[18,4,10,30],  hr:[108,8,85,132], gsr:[15,3,8.0,25],       rr:[25,4,18,35], eeg:[3.10,0.30,2.0,4.2]   },
  CONFUSION:   { hrv:[22,5,12,36],  hr:[98,7,78,120],  gsr:[11,2,6.0,18],       rr:[22,3,16,30], eeg:[2.60,0.25,1.8,3.6]   },
  BOREDOM:     { hrv:[36,5,22,52],  hr:[66,4,56,78],   gsr:[8.5,1.5,5.0,14],   rr:[14,2,10,18], eeg:[1.30,0.15,0.8,1.9]   },
  EXCITEMENT:  { hrv:[34,5,20,50],  hr:[92,8,74,118],  gsr:[12,2,7.0,20],       rr:[20,3,14,28], eeg:[1.70,0.20,1.0,2.6]   },
  FATIGUE:     { hrv:[30,5,16,46],  hr:[70,5,58,86],   gsr:[3.5,0.8,1.5,7.5],  rr:[16,2,11,22], eeg:[1.10,0.12,0.6,1.7]   },
  NEUTRAL:     { hrv:[38,6,22,58],  hr:[72,6,57,92],   gsr:[4.5,1.0,2.0,9.0],  rr:[15,2,10,20], eeg:[1.00,0.10,0.5,1.5]   },
  FRUSTRATION: { hrv:[16,4,8,28],   hr:[112,9,90,138], gsr:[17,3,10.0,28],      rr:[26,4,18,36], eeg:[3.30,0.30,2.2,4.5]   },
  ANXIETY:     { hrv:[14,3,7,24],   hr:[115,9,92,140], gsr:[16,3,9.0,26],       rr:[28,5,20,38], eeg:[3.50,0.35,2.4,4.8]   },
  CURIOSITY:   { hrv:[44,5,28,64],  hr:[78,6,64,96],   gsr:[5.5,1.0,2.5,10],   rr:[16,2,11,22], eeg:[1.20,0.14,0.6,2.0]   },
  DISGUST:     { hrv:[20,4,10,32],  hr:[90,7,72,112],  gsr:[13,2,7.0,22],       rr:[20,3,14,28], eeg:[2.20,0.22,1.4,3.2]   },
  SURPRISE:    { hrv:[28,6,14,44],  hr:[100,10,78,130],gsr:[14,3,7.0,24],       rr:[22,4,14,32], eeg:[2.00,0.25,1.2,3.0]   },
  CALM:        { hrv:[62,6,40,90],  hr:[58,4,46,70],   gsr:[1.8,0.5,0.6,4.0],  rr:[10,2,6,14],  eeg:[0.38,0.08,0.18,0.65] },
};

const _EEG_BAND_REF = {
  FLOW:        { theta:0.90, alpha:2.20, beta:1.00, gamma:0.50 },
  READY:       { theta:0.70, alpha:2.50, beta:0.80, gamma:0.30 },
  STRESS:      { theta:1.40, alpha:0.60, beta:2.80, gamma:1.20 },
  CONFUSION:   { theta:2.20, alpha:0.80, beta:2.00, gamma:0.80 },
  BOREDOM:     { theta:1.80, alpha:1.20, beta:0.70, gamma:0.20 },
  EXCITEMENT:  { theta:1.00, alpha:1.00, beta:2.50, gamma:1.50 },
  FATIGUE:     { theta:2.50, alpha:1.50, beta:0.50, gamma:0.20 },
  NEUTRAL:     { theta:1.00, alpha:1.00, beta:1.00, gamma:0.50 },
  FRUSTRATION: { theta:1.80, alpha:0.50, beta:2.60, gamma:0.90 },
  ANXIETY:     { theta:1.20, alpha:0.55, beta:3.20, gamma:1.10 },
  CURIOSITY:   { theta:1.60, alpha:1.30, beta:1.40, gamma:1.80 },
  DISGUST:     { theta:1.50, alpha:0.70, beta:1.80, gamma:0.60 },
  SURPRISE:    { theta:0.80, alpha:0.60, beta:2.20, gamma:2.00 },
  CALM:        { theta:0.60, alpha:3.00, beta:0.50, gamma:0.15 },
};

const _STATE_ORDER = EMOTION_STATES;
const HUMAN_SIM_REFS = Object.freeze({
  STATE_ORDER: EMOTION_STATES,
  PHYSIO_REF: _PHYSIO_REF,
  EEG_BAND_REF: _EEG_BAND_REF,
});

const _MARKOV_TBL = {
  FLOW:       [0.55,0.12,0.02,0.03,0.04,0.07,0.03,0.02,0.01,0.01,0.05,0.01,0.01,0.03],
  READY:      [0.18,0.42,0.03,0.06,0.03,0.05,0.03,0.03,0.02,0.02,0.07,0.01,0.02,0.03],
  STRESS:     [0.02,0.04,0.40,0.12,0.02,0.01,0.14,0.05,0.10,0.07,0.01,0.01,0.01,0.00],
  CONFUSION:  [0.04,0.08,0.14,0.36,0.05,0.02,0.09,0.04,0.08,0.05,0.03,0.01,0.01,0.00],
  BOREDOM:    [0.06,0.08,0.03,0.04,0.38,0.12,0.06,0.04,0.04,0.02,0.07,0.02,0.02,0.02],
  EXCITEMENT: [0.14,0.07,0.06,0.03,0.04,0.36,0.05,0.09,0.03,0.03,0.04,0.01,0.04,0.01],
  FATIGUE:    [0.03,0.05,0.09,0.06,0.12,0.02,0.42,0.04,0.06,0.05,0.02,0.01,0.01,0.02],
  NEUTRAL:    [0.08,0.13,0.06,0.06,0.10,0.08,0.08,0.22,0.04,0.04,0.05,0.02,0.03,0.01],
  FRUSTRATION:[0.02,0.04,0.22,0.10,0.02,0.02,0.08,0.06,0.32,0.08,0.01,0.01,0.00,0.00],
  ANXIETY:    [0.01,0.03,0.20,0.08,0.02,0.02,0.10,0.06,0.08,0.32,0.02,0.01,0.01,0.04],
  CURIOSITY:  [0.12,0.10,0.02,0.04,0.03,0.10,0.03,0.05,0.02,0.02,0.36,0.02,0.05,0.04],
  DISGUST:    [0.02,0.04,0.10,0.08,0.05,0.02,0.07,0.10,0.06,0.06,0.02,0.32,0.02,0.04],
  SURPRISE:   [0.05,0.08,0.06,0.06,0.04,0.12,0.03,0.10,0.04,0.06,0.10,0.02,0.20,0.04],
  CALM:       [0.08,0.10,0.01,0.02,0.06,0.04,0.04,0.10,0.01,0.02,0.06,0.02,0.02,0.42],
};

const COGNITIVE_THRESHOLDS = { UNDERLOAD:0.3, OPTIMAL_MIN:0.3, OPTIMAL_MAX:0.7, OVERLOAD:0.7 };
const WORKING_MEMORY_CONFIG = { CAPACITY_MEAN:7, CAPACITY_RANGE:2, DECAY_RATE:0.75, REHEARSAL_BOOST:0.5 };
const LEARNING_CONFIG = { OPERANT_SUCCESS_BOOST:0.05, OPERANT_FAILURE_PENALTY:0.03, ANXIETY_BUILDUP:0.02, CONFIDENCE_TO_FLOW:0.24 };

const EVENT_IMPACTS = {
  criticism:          { stress:0.40, frustration:0.30, anxiety:0.20 },
  praise:             { confidence:0.20, excitement:0.15, flow:0.10 },
  deadline_approaching:{ stress:0.30, anxiety:0.25, timePressure:0.40 },
  social_pressure:    { anxiety:0.25, masking:0.30 },
  success:            { confidence:0.15, excitement:0.20, flow:0.10 },
  failure:            { frustration:0.30, anxiety:0.10, confidence:-0.20 },
  memory_recall:      { stress:0.15, surprise:0.20 },
  cognitive_overload: { stress:0.25, confusion:0.30, frustration:0.20 },
};

const _CIRCADIAN_TABLE = {
   0:[-8,4,-1.2],  1:[-12,6,-1.6], 2:[-15,7,-1.9], 3:[-18,8,-2.0],
   4:[-18,8,-2.0], 5:[-15,7,-1.8], 6:[-10,5,-1.4], 7:[-5,3,-1.0],
   8:[-2,2,-0.5],  9:[0,0,0.0],   10:[2,-1,0.3],  11:[3,-2,0.5],
  12:[2,-1,0.3],  13:[1,0,0.2],   14:[-3,2,-0.4], 15:[-2,1,-0.3],
  16:[1,-1,0.2],  17:[3,-2,0.4],  18:[4,-2,0.5],  19:[5,-3,0.6],
  20:[5,-3,0.6],  21:[4,-2,0.5],  22:[2,-1,0.3],  23:[-3,2,-0.6],
};

const TASK_EEG_MODIFIERS = {
  problem_solving: { theta:1.35, alpha:0.90, beta:1.10, gamma:1.00 },
  creativity:      { theta:1.10, alpha:1.35, beta:1.05, gamma:1.25 },
  concentration:   { theta:0.85, alpha:0.80, beta:1.40, gamma:1.10 },
  mind_wandering:  { theta:1.35, alpha:1.25, beta:0.70, gamma:0.80 },
  neutral:         { theta:1.00, alpha:1.00, beta:1.00, gamma:1.00 },
};

const MICROSTATES = { A:'self_referential', B:'visual', C:'salience', D:'attention' };

const _DEFAULT_PERSONALITY = {
  openness:0.5, conscientiousness:0.5, extraversion:0.5, agreeableness:0.5, neuroticism:0.5,
};
const _DEFAULT_CONTEXT = {
  timeOfDay:'morning', dayOfWeek:1, socialContext:'alone', taskType:'learning',
  environment:'quiet', caffeineIntake:0, sleepQuality:7, ambientTemp:23, systolicBP:120,
};

// ============================================================================
// SECTION 2: UTILITIES
// ============================================================================

const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _randn = () => { let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const _lerp = (a, b, t) => a + (b-a)*t;

// ============================================================================
// SECTION 3–9: CORE HUMAN SIMULATOR
// ============================================================================

const HumanSim = (() => {
  let _state='NEUTRAL', _prevState='NEUTRAL', _tickCount=0, _stateAge=0, _refractory=0;
  let _scenarioQ=[], _history=[];
  let _personality = { ..._DEFAULT_PERSONALITY };
  let _context = { ..._DEFAULT_CONTEXT };
  const _iaf = 9.5 + (Math.random()-0.5)*1.5;
  let _p300=null, _empathyBoost=null;

  const _ou = {
    hrv:{x:38,th:0.07,sig:1.4}, hr:{x:72,th:0.07,sig:1.8}, gsr:{x:4.5,th:0.09,sig:0.38},
    rr:{x:15,th:0.06,sig:0.75}, eeg:{x:1.0,th:0.11,sig:0.05},
    theta_b:{x:1.0,th:0.09,sig:0.07}, alpha_b:{x:1.0,th:0.09,sig:0.07},
    beta_b:{x:1.0,th:0.11,sig:0.09},  gamma_b:{x:0.5,th:0.14,sig:0.06},
  };

  let _hour=new Date().getHours(), _sleepP=0, _ultra=0;
  const _ultraRate = (2*Math.PI)/10800;

  const _ouStep = (key,mu) => { const o=_ou[key]; o.x=_clamp(o.x+o.th*(mu-o.x)+o.sig*_randn(),-99999,99999); return o.x; };
  const _sample = (key,state) => { const [mean,,lo,hi]=_PHYSIO_REF[state][key]; return _clamp(_ouStep(key,mean),lo,hi); };

  const _applyContextBaseline = (bio) => {
    const c=_context;
    if(c.socialContext==='with_friends'){bio.gsr+=1.5;bio.hr+=3;}
    if(c.socialContext==='in_class'){bio.gsr+=2.0;bio.hr+=4;}
    if(c.socialContext==='presentation'){bio.gsr+=4.0;bio.hr+=8;}
    bio.hr=_clamp(bio.hr+c.caffeineIntake*0.02,40,145);
    const sp=(10-c.sleepQuality)*0.04;
    bio.hrv=_clamp(bio.hrv-sp*8,6,95);
    bio.hr=_clamp(bio.hr+sp*4,40,145);
    return bio;
  };
  const _applyPersonalityBaseline = (bio) => {
    const p=_personality;
    bio.hr=_clamp(bio.hr+(p.extraversion-0.5)*6,40,145);
    bio.gsr=_clamp(bio.gsr+(p.extraversion-0.5)*1.5,0.3,28);
    bio.hrv=_clamp(bio.hrv-(p.neuroticism-0.5)*8,6,95);
    return bio;
  };
  const _thermoRegulation = (bio) => { const t=_context.ambientTemp; if(t>28)bio.gsr=_clamp(bio.gsr*1.2,0.3,28); else if(t<18)bio.gsr=_clamp(bio.gsr*0.7,0.3,28); return bio; };
  const _baroreflex    = (bio) => { bio.hr=_clamp(bio.hr-(_context.systolicBP-120)*0.05,40,145); return bio; };
  const _addRSA        = (bio) => { const a=8/Math.max(bio.rr,4); bio.hrv=_clamp(bio.hrv+a*Math.sin(Date.now()/(60000/Math.max(bio.rr,4))),6,95); return bio; };
  const _crossCorr     = (bio) => { const r=_PHYSIO_REF[_state]; const d=bio.hrv-r.hrv[0]; bio.hr=_clamp(bio.hr-0.42*d,r.hr[2],r.hr[3]); bio.gsr=_clamp(bio.gsr+0.018*(bio.hr-r.hr[0]),r.gsr[2],r.gsr[3]); return bio; };
  const _circadianCorr = (bio) => {
    const [dH,dR,dG]=_CIRCADIAN_TABLE[_hour]||[0,0,0]; const u=Math.sin(_ultra); const sp=_sleepP;
    bio.hrv=_clamp(bio.hrv+dH+u*3.0-sp*11.0,8,95);
    bio.hr =_clamp(bio.hr+dR-u*1.8+sp*5.5,40,145);
    bio.gsr=_clamp(bio.gsr+dG+u*0.5+sp*2.0,0.3,28);
    bio.rr =_clamp(bio.rr-dH*0.1+u*0.6+sp*1.5,6,36);
    bio.eeg=_clamp(bio.eeg-dH*0.018+sp*0.30,0.05,5.0);
    return bio;
  };
  const _tickCircadian = () => { _ultra=(_ultra+_ultraRate)%(2*Math.PI); _sleepP=Math.min(1.0,_sleepP+1/115200); if(_tickCount%7200===0)_hour=new Date().getHours(); };
  const _getMicrostate  = () => ({FLOW:'D',READY:'D',STRESS:'C',CONFUSION:'C',BOREDOM:'A',EXCITEMENT:'B',FATIGUE:'A',NEUTRAL:'A',FRUSTRATION:'C',ANXIETY:'C',CURIOSITY:'B',DISGUST:'C',SURPRISE:'B',CALM:'A'}[_state]??'A');
  const _computePAC     = (tp,ga) => ga*Math.cos(tp);

  // SECTION 4: COGNITIVE
  let _cognitiveLoad=0.5, _taskDifficulty=0.5, _timePressure=0.3, _taskType='neutral';
  let _workingMemory={items:[],lastRehearsal:0}, _errorRate=0.05, _attentionFocus=0.8;
  let _heuristicBiasEnabled=true;

  const _updateCognitiveLoad = () => {
    const sf=['STRESS','ANXIETY','FRUSTRATION'].includes(_state)?0.4:_state==='CONFUSION'?0.3:0.1;
    const ff=_state==='FATIGUE'?0.3:_state==='BOREDOM'?0.1:0;
    _cognitiveLoad=_clamp(_taskDifficulty*0.4+sf*0.3+ff*0.2+_timePressure*0.1,0,1);
    if(_cognitiveLoad>COGNITIVE_THRESHOLDS.OVERLOAD) _errorRate=_clamp(_errorRate+0.02,0.05,0.35);
    else if(_cognitiveLoad<COGNITIVE_THRESHOLDS.UNDERLOAD) _errorRate=_clamp(_errorRate-0.01,0.02,0.25);
    else _errorRate=_clamp(_errorRate*0.99,0.02,0.20);
    _attentionFocus=_clamp(0.9-(_cognitiveLoad*0.3)+(Math.random()-0.5)*0.1,0.3,0.95);
    return _cognitiveLoad;
  };
  const _updateWorkingMemory = () => {
    const cap=WORKING_MEMORY_CONFIG.CAPACITY_MEAN+(Math.random()-0.5)*WORKING_MEMORY_CONFIG.CAPACITY_RANGE;
    const now=Date.now()/1000; const decay=WORKING_MEMORY_CONFIG.DECAY_RATE*Math.min(now-_workingMemory.lastRehearsal,10);
    _workingMemory.items=_workingMemory.items.filter(i=>{i.strength-=decay;return i.strength>0.1;});
    const hardCap = (WORKING_MEMORY_CONFIG.CAPACITY_MEAN + WORKING_MEMORY_CONFIG.CAPACITY_RANGE) * 2;
    if(_workingMemory.items.length>hardCap)_workingMemory.items=_workingMemory.items.slice(-Math.ceil(hardCap/2));
    while(_workingMemory.items.length>cap)_workingMemory.items.shift();
    _workingMemory.lastRehearsal=now;
  };
  const _makeDecision = (options) => {
    if(!_heuristicBiasEnabled||Math.random()>0.7) return options.reduce((b,o)=>o.value>b.value?o:b,options[0]);
    const sl=['STRESS','ANXIETY'].includes(_state)?0.7:0.3;
    const rb=_personality.extraversion>0.6?0.7:0.3;
    if(Math.random()<sl) return options.reduce((b,o)=>(o.risk||0)<(b.risk||0)?o:b,options[0]);
    if(Math.random()<rb) return options.reduce((b,o)=>(o.risk||0)>(b.risk||0)?o:b,options[0]);
    return options[Math.floor(Math.random()*options.length)];
  };

  // SECTION 5: MEMORY & LEARNING
  let _episodicMemory=[];
  let _conditioning={
    classical:new Map(),
    operant:{successCount:0,failureCount:0,confidence:0.5,anxietyBaseline:0.3,avoidance:new Map()},
  };
  let _learningEnabled=true, _memoryPersistence=false;

  // SEMANTIC MEMORY (Tulving 1972)
  let _semanticMemory = {
    concepts: new Map(),
    autobiographical: [],
  };

  const _consolidateToSemantic = (episode) => {
    const highArousal = ['STRESS','ANXIETY','FLOW','FRUSTRATION','EXCITEMENT'].includes(episode.state);
    const intensity = highArousal ? 0.75 : 0.25;
    if(Math.random() > intensity) return;
    const key = `${episode.type}_${episode.state}`;
    const existing = _semanticMemory.concepts.get(key) || { strength:0, count:0, associations:[], lastAccess:0 };
    existing.strength = _clamp(existing.strength + 0.08, 0, 1);
    existing.count++;
    existing.lastAccess = Date.now();
    if(_context.taskType && !existing.associations.includes(_context.taskType))
      existing.associations.push(_context.taskType);
    _semanticMemory.concepts.set(key, existing);
    if(intensity > 0.6 && Math.random() < 0.25) {
      _semanticMemory.autobiographical.push({
        summary: `${episode.state} during ${_context.taskType} (${_context.socialContext})`,
        strength: intensity,
        emotionalTag: episode.state,
        ts: Date.now(),
      });
      if(_semanticMemory.autobiographical.length > 60) _semanticMemory.autobiographical.shift();
    }
  };

  const _recordEpisodic = (event) => {
    const entry = { ...event, ts:Date.now(), state:_state, cognitiveLoad:_cognitiveLoad };
    _episodicMemory.push(entry);
    if(_episodicMemory.length > 200) _episodicMemory.shift();
    _consolidateToSemantic(entry);
    if(_memoryPersistence) {
      try { localStorage.setItem('nuengdeaw_episodic', JSON.stringify(_episodicMemory.slice(-50))); } catch(e){}
    }
  };

  const _applyOperantConditioning = (outcome) => {
    if(!_learningEnabled) return;
    if(outcome==='success') {
      _conditioning.operant.successCount++;
      _conditioning.operant.confidence=_clamp(_conditioning.operant.confidence+LEARNING_CONFIG.OPERANT_SUCCESS_BOOST,0,1);
      _conditioning.operant.anxietyBaseline=_clamp(_conditioning.operant.anxietyBaseline-0.01,0,0.8);
    } else if(outcome==='failure') {
      _conditioning.operant.failureCount++;
      _conditioning.operant.confidence=_clamp(_conditioning.operant.confidence-LEARNING_CONFIG.OPERANT_FAILURE_PENALTY,0,1);
      _conditioning.operant.anxietyBaseline=_clamp(_conditioning.operant.anxietyBaseline+LEARNING_CONFIG.ANXIETY_BUILDUP,0,1);
    }
  };
  const _applyClassicalConditioning = (stimulus, response) => {
    const key=`${stimulus}_${response}`; const cur=_conditioning.classical.get(key)||0;
    _conditioning.classical.set(key, _clamp(cur+0.05,0,1));
  };
  const _getConditionedResponse = (stimulus) => {
    let max=0, best=null;
    for(const [k,s] of _conditioning.classical.entries())
      if(k.startsWith(stimulus+'_')&&s>max){max=s;best=k.slice(stimulus.length+1);}
    return best;
  };

  // PERSONALITY DRIFT (McCrae & Costa 2003)
  let _personalityDrift = { lastDrift: Date.now(), flowCount: 0, stressCount: 0 };

  const _driftPersonality = () => {
    const elapsed = (Date.now() - _personalityDrift.lastDrift) / 1000;
    if(elapsed < 30) return;
    const keys = ['openness','conscientiousness','extraversion','agreeableness','neuroticism'];
    for(const k of keys) {
      _personality[k] = _clamp(_personality[k] + _randn() * 0.006, 0.05, 0.95);
    }
    if(_state === 'FLOW' && _stateAge > 15) {
      _personality.neuroticism      = _clamp(_personality.neuroticism      - 0.003, 0.05, 0.95);
      _personality.conscientiousness = _clamp(_personality.conscientiousness + 0.002, 0.05, 0.95);
    }
    if(['STRESS','ANXIETY'].includes(_state) && _stateAge > 20) {
      _personality.neuroticism  = _clamp(_personality.neuroticism  + 0.002, 0.05, 0.95);
      _personality.agreeableness= _clamp(_personality.agreeableness- 0.001, 0.05, 0.95);
    }
    if(_conditioning.operant.successCount > 0 && _conditioning.operant.successCount % 10 === 0) {
      _personality.openness = _clamp(_personality.openness + 0.005, 0.05, 0.95);
    }
    _personalityDrift.lastDrift = Date.now();
  };

  // SECTION 6: EVENT SYSTEM
  let _pendingEvents=[], _emotionalInertia=0.5, _eventOverrideEnabled=true, _messyTransitionRate=0.05;

  const _triggerEvent = (eventName, intensity=1.0) => {
    const impact=EVENT_IMPACTS[eventName]; if(!impact) return false;
    _pendingEvents.push({ name:eventName, impact, intensity:_clamp(intensity,0,1), ts:Date.now() });
    _recordEpisodic({ type:'event', name:eventName, intensity });
    return true;
  };
  const _processEvents = () => {
    if(!_eventOverrideEnabled||!_pendingEvents.length) return null;
    let ts=0,ta=0,tf=0,tc=0,te=0;
    for(const ev of _pendingEvents) {
      const i=ev.intensity;
      ts+=(ev.impact.stress||0)*i; ta+=(ev.impact.anxiety||0)*i;
      tf+=(ev.impact.frustration||0)*i; tc+=(ev.impact.confidence||0)*i; te+=(ev.impact.excitement||0)*i;
    }
    _pendingEvents=[];
    if(ts>0.3)_applyClassicalConditioning('stressful_event','STRESS');
    if(tc>0.2)_applyOperantConditioning('success');
    const t=0.25;
    if(ts>t&&_state!=='STRESS')return'STRESS';
    if(ta>t&&_state!=='ANXIETY')return'ANXIETY';
    if(tf>t&&_state!=='FRUSTRATION')return'FRUSTRATION';
    if(te>t&&_state!=='EXCITEMENT')return'EXCITEMENT';
    if(tc!==0)_conditioning.operant.confidence=_clamp(_conditioning.operant.confidence+tc*0.3,0,1);
    return null;
  };

  // SECTION 7: SOCIAL INTELLIGENCE
  let _socialContext='alone', _audienceSize=0, _socialStakes=0.3;
  let _theoryOfMindEnabled=true, _maskingLevel=0, _displayedEmotion='NEUTRAL';

  const _updateSocialPressure = () => _clamp((_audienceSize/100)*_socialStakes*(1-_personality.extraversion/2),0,1);
  const _updateMasking = () => {
    const sp=_updateSocialPressure();
    const base=_personality.neuroticism*0.5+(1-_personality.agreeableness)*0.3+sp*0.4;
    _maskingLevel=_clamp(base,0,1);

    // DeceptionEngine integration (optional dependency)
    if(typeof DeceptionEngine!=='undefined'&&DeceptionEngine.isActive()) {
      const leak = DeceptionEngine.getMicroLeakRate(_personality);
      _maskingLevel=_clamp(_maskingLevel+DeceptionEngine.getLevel()*0.2,0,1);
      _cognitiveLoad=_clamp(_cognitiveLoad+DeceptionEngine.getCognitiveCost(),0,1);
      if(DeceptionEngine.checkMicroLeak(leak)) {
        _displayedEmotion=_state;
        return;
      }
    }

    if(Math.random()<_maskingLevel) {
      const safe=['NEUTRAL','CALM','READY'];
      _displayedEmotion=safe[Math.floor(Math.random()*safe.length)];
    } else {
      _displayedEmotion=_state;
    }
  };
  const _theoryOfMind = (otherState) => {
    if(!_theoryOfMindEnabled) return null;
    const emp=_personality.agreeableness*0.7+(1-_personality.neuroticism)*0.3;
    return { state:otherState, confidence:_clamp(0.5+emp*0.3+(Math.random()-0.5)*0.2,0,1) };
  };

  // SECTION 8: NOISE & ARTIFACT
  let _sensorDropoutRate=0, _contradictionMode=false, _inconsistencyLevel=0.15;

  const _applyNoise = (bio) => {
    if(_sensorDropoutRate>0&&Math.random()<_sensorDropoutRate) {
      const f=['hrv','hr','gsr','rr','eeg'][Math.floor(Math.random()*5)];
      bio[f]=null;
    }
    if(Math.random()<_inconsistencyLevel) {
      bio.hr+=(Math.random()-0.5)*8; bio.hrv+=(Math.random()-0.5)*6; bio.gsr+=(Math.random()-0.5)*1.5;
      bio=Object.fromEntries(Object.entries(bio).map(([k,v])=>[k,_clamp(v,0,999)]));
    }
    return bio;
  };
  const _applyContradiction = (bio) => {
    if(!_contradictionMode) return bio;
    if(['STRESS','ANXIETY'].includes(_state)) { bio.hr=_clamp(bio.hr*0.7,55,85); bio.hrv=_clamp(bio.hrv*1.3,35,70); bio.gsr=_clamp(bio.gsr*0.5,1,8); }
    if(_state==='CALM'&&Math.random()<0.3) { bio.hr=_clamp(bio.hr*1.4,80,120); bio.gsr=_clamp(bio.gsr*2.5,5,20); }
    return bio;
  };

  // STATE TRANSITIONS
  const _softmax = (scores) => {
    const maxScore = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - maxScore));
    const total = exps.reduce((sum, value) => sum + value, 0) || 1;
    return exps.map((value) => value / total);
  };
  const _nextState = () => {
    const row = _MARKOV_TBL[_state] || _MARKOV_TBL.NEUTRAL;
    const p = _personality;
    const stateIndex = new Map(_STATE_ORDER.map((state, i) => [state, i]));
    const scores = row.map((value) => Math.log(Math.max(value, 1e-6)));
    const adjust = (state, delta) => {
      const i = stateIndex.get(state);
      if (typeof i === 'number') scores[i] += delta;
    };

    const neuroticism = Math.max(0, p.neuroticism - 0.5);
    const extraversion = p.extraversion - 0.5;
    const conscientiousness = p.conscientiousness - 0.5;
    const openness = p.openness - 0.5;

    if (neuroticism > 0) {
      adjust('STRESS', neuroticism * 1.15);
      adjust('ANXIETY', neuroticism * 1.05);
      adjust('CALM', -neuroticism * 0.75);
      adjust('FLOW', -neuroticism * 0.45);
    }
    adjust('EXCITEMENT', extraversion * 0.55);
    adjust('BOREDOM', -extraversion * 0.45);
    adjust('READY', extraversion * 0.18);

    if (conscientiousness > 0) {
      if (_state === 'FLOW') adjust('FLOW', conscientiousness * 0.85);
      adjust('READY', conscientiousness * 0.35);
      adjust('BOREDOM', -conscientiousness * 0.55);
    }

    adjust('CURIOSITY', openness * 0.42);
    adjust('CONFUSION', -Math.max(0, openness) * 0.12);

    const probs = _softmax(scores);
    let r = Math.random(), cum = 0;
    for (let i = 0; i < _STATE_ORDER.length; i++) {
      cum += probs[i];
      if (r < cum) return _STATE_ORDER[i];
    }
    return _state;
  };
  const _flipTo = (next) => {
    if(next===_state)return;
    _prevState=_state; _state=next; _stateAge=0; _refractory=3;
    _history.push({state:next,ts:Date.now()});
    if(_history.length>500)_history.shift();
    if(next==='SURPRISE')_p300={latency:300+Math.random()*50,amplitude:5+Math.random()*3,ts:Date.now()};
  };

  const _SCENARIOS = {
    wearable_monitoring_normal:['NEUTRAL','READY','READY','FLOW','FLOW','FLOW','FATIGUE','NEUTRAL'],
    acute_stress_episode:['READY','READY','STRESS','STRESS','STRESS','FATIGUE','FATIGUE','NEUTRAL'],
    hypoarousal_recovery:['NEUTRAL','BOREDOM','BOREDOM','EXCITEMENT','FLOW','FLOW'],
    anxiety_escalation:['READY','EXCITEMENT','STRESS','CONFUSION','CONFUSION','FATIGUE'],
    sympathetic_hyperactivation:['READY','ANXIETY','ANXIETY','STRESS','FRUSTRATION','FATIGUE','NEUTRAL'],
    positive_arousal_flow:['NEUTRAL','CURIOSITY','CURIOSITY','FLOW','FLOW','CALM'],
    recovery:['STRESS','FATIGUE','NEUTRAL','CALM','CALM','READY'],
  };

  // SECTION 9: MAIN TICK
  const _tick = () => {
    _tickCount++; _stateAge++;
    _tickCircadian();
    _updateWorkingMemory();
    _updateCognitiveLoad();
    _driftPersonality();

    const evOverride=_processEvents();
    if(evOverride){_flipTo(evOverride);_refractory=2;}
    _updateMasking();

    if(_refractory>0){_refractory--;return;}
    const HIGH=['STRESS','CONFUSION','FRUSTRATION','ANXIETY'];
    const MED=['FLOW','FATIGUE','CALM'];
    let minDwell=HIGH.includes(_state)?6:MED.includes(_state)?4:2;
    if(_cognitiveLoad>0.7)minDwell+=2; if(_cognitiveLoad<0.3)minDwell-=1;
    const neuroExt=(['STRESS','ANXIETY'].includes(_state))?Math.round((_personality.neuroticism-0.5)*8):0;
    const conExt=_state==='FLOW'?Math.round((_personality.conscientiousness-0.5)*6):0;
    if(_stateAge<minDwell+neuroExt+conExt)return;
    if(_scenarioQ.length>0){
      const target=_scenarioQ[0];
      if(_state===target&&_stateAge>=minDwell+2)_scenarioQ.shift();
      else if(_state!==target)_flipTo(target);
    } else {
      if(Math.random()<_messyTransitionRate){
        const r=_STATE_ORDER[Math.floor(Math.random()*_STATE_ORDER.length)];
        if(r!==_state)_flipTo(r);
      } else {
        const next=_nextState();
        const inertia=_emotionalInertia*(HIGH.includes(_state)?1.5:1);
        if(Math.random()>inertia)_flipTo(next);
      }
    }
  };

  // GENERATE BIO
  const generateBio = () => {
    let bio={ hrv:_sample('hrv',_state), hr:_sample('hr',_state), gsr:_sample('gsr',_state), rr:_sample('rr',_state), eeg:_sample('eeg',_state) };
    bio=_crossCorr(bio); bio=_circadianCorr(bio); bio=_addRSA(bio); bio=_baroreflex(bio);
    bio=_thermoRegulation(bio); bio=_applyPersonalityBaseline(bio); bio=_applyContextBaseline(bio);
    bio.hr =_clamp(bio.hr +(_cognitiveLoad-0.5)*8,40,145);
    bio.gsr=_clamp(bio.gsr+(_cognitiveLoad-0.5)*2,0.3,28);
    const sp=_updateSocialPressure();
    bio.hr =_clamp(bio.hr +sp*5,40,145);
    bio.gsr=_clamp(bio.gsr+sp*1.5,0.3,28);
    if(_empathyBoost&&['STRESS','ANXIETY','FRUSTRATION'].includes(_state)){bio.hrv=_clamp(bio.hrv+_empathyBoost.hrvBoost,6,95);_empathyBoost=null;}
    bio=_applyNoise(bio);
    bio=_applyContradiction(bio);
    return bio;
  };

  // GENERATE EEG
  const generateEEGBands = () => {
    const t=_EEG_BAND_REF[_state];
    let theta=_clamp(_ouStep('theta_b',t.theta),0.10,5.0);
    let alpha=_clamp(_ouStep('alpha_b',t.alpha),0.10,5.0);
    let beta =_clamp(_ouStep('beta_b', t.beta), 0.10,6.0);
    let gamma=_clamp(_ouStep('gamma_b',t.gamma),0.05,3.0);
    const tm=TASK_EEG_MODIFIERS[_taskType]||TASK_EEG_MODIFIERS.neutral;
    theta=_clamp(theta*tm.theta,0.1,5.0); alpha=_clamp(alpha*tm.alpha,0.1,5.0);
    beta =_clamp(beta *tm.beta, 0.1,6.0); gamma=_clamp(gamma*tm.gamma,0.05,3.0);
    if(['CONFUSION','STRESS','FRUSTRATION'].includes(_state)) alpha=_clamp(alpha,0.1,Math.min(alpha,theta*0.55));
    if(['FLOW','READY'].includes(_state)){theta=_clamp(theta,0.1,Math.min(theta,alpha*0.50));beta=_clamp(beta,0.1,1.4);}
    if(_state==='FATIGUE'){beta=_clamp(beta*0.62,0.1,1.0);gamma=_clamp(gamma*0.58,0.05,0.5);}
    if(['EXCITEMENT','CURIOSITY'].includes(_state)) gamma=_clamp(gamma,Math.max(gamma,beta*0.58),3.0);
    if(_state==='CALM'){theta=_clamp(theta,0.1,Math.min(theta,alpha*0.25));beta=_clamp(beta*0.4,0.1,0.6);}
    if(_state==='ANXIETY'){beta=_clamp(beta,Math.max(beta,2.5),6.0);alpha=_clamp(alpha*0.5,0.1,1.0);}
    if(_state==='SURPRISE') gamma=_clamp(gamma*1.8,0.05,3.0);
    alpha=_clamp(alpha*(_iaf/10.0),0.1,5.0);
    const tp=(Date.now()/1000)*2*Math.PI*(t.theta*0.5);
    gamma=_clamp(gamma+_computePAC(tp,gamma)*0.06,0.05,3.0);
    return { theta,alpha,beta,gamma, thetaAlphaRatio:alpha>0.01?theta/alpha:1.0, iaf:_iaf, microstate:_getMicrostate(), microstateLabel:MICROSTATES[_getMicrostate()], p300:_p300 };
  };

  // PUBLIC API
  return {
    tick() { _tick(); },
    generateBio, generateEEGBands,
    getState()            { return _state; },
    getPrevState()        { return _prevState; },
    getDisplayedEmotion() { return _displayedEmotion; },
    getTick()             { return _tickCount; },
    getHistory()          { return [..._history]; },
    getPersonality()      { return { ..._personality }; },
    getContext()          { return { ..._context }; },

    getCognitiveLoad()    { return _cognitiveLoad; },
    getErrorRate()        { return _errorRate; },
    getAttentionFocus()   { return _attentionFocus; },
    getWorkingMemory()    { return { items:[..._workingMemory.items], capacity:WORKING_MEMORY_CONFIG.CAPACITY_MEAN }; },
    setTaskDifficulty(d)  { _taskDifficulty=_clamp(d,0,1); },
    setTimePressure(p)    { _timePressure=_clamp(p,0,1); },
    setTaskType(t)        { if(TASK_EEG_MODIFIERS[t])_taskType=t; },
    makeDecision(opts)    { return _makeDecision(opts); },
    enableHeuristicBias(e){ _heuristicBiasEnabled=e; },

    getMemory() {
      return {
        episodic:[..._episodicMemory],
        semantic: { concepts:Object.fromEntries(_semanticMemory.concepts), autobiographical:[..._semanticMemory.autobiographical] },
        conditioning:{ classical:Object.fromEntries(_conditioning.classical), operant:{..._conditioning.operant} },
      };
    },
    recordOutcome(o)       { _applyOperantConditioning(o); _recordEpisodic({type:'outcome',outcome:o}); },
    recallRecent(n=10)     { return _episodicMemory.slice(-n); },
    recallSemantic(key)    { return _semanticMemory.concepts.get(key)||null; },
    getAutobiographical()  { return [..._semanticMemory.autobiographical]; },
    getConfidence()        { return _conditioning.operant.confidence; },
    getAnxietyBaseline()   { return _conditioning.operant.anxietyBaseline; },
    enableLearning(e)      { _learningEnabled=e; },
    enableMemoryPersistence(e){ _memoryPersistence=e; },

    triggerEvent(n,i=1.0)  { return _triggerEvent(n,i); },
    setEmotionalInertia(i) { _emotionalInertia=_clamp(i,0.3,0.7); },
    enableEventOverride(e) { _eventOverrideEnabled=e; },
    setMessyTransitionRate(r){ _messyTransitionRate=_clamp(r,0,0.15); },

    setSocialContext(ctx)  {
      _socialContext=ctx; _context.socialContext=ctx;
      _audienceSize=ctx==='presentation'?50:ctx==='in_class'?30:ctx==='with_friends'?3:0;
    },
    setAudienceSize(n)     { _audienceSize=Math.max(0,n); },
    setSocialStakes(s)     { _socialStakes=_clamp(s,0,1); },
    getSocialPressure()    { return _updateSocialPressure(); },
    getMaskingLevel()      { return _maskingLevel; },
    getTheoryOfMind(s)     { return _theoryOfMind(s); },
    enableTheoryOfMind(e)  { _theoryOfMindEnabled=e; },

    setSensorDropoutRate(r){ _sensorDropoutRate=_clamp(r,0,0.1); },
    enableContradictionMode(e){ _contradictionMode=e; },
    setInconsistencyLevel(l){ _inconsistencyLevel=_clamp(l,0,0.3); },

    setPersonality(t={})   { _personality={..._DEFAULT_PERSONALITY,..._personality,...t}; },
    setContext(c={})        { _context={..._DEFAULT_CONTEXT,..._context,...c}; },
    setScenario(n)          { _scenarioQ=_SCENARIOS[n]?[..._SCENARIOS[n]]:[]; },
    force(s)                { const u=s?.toUpperCase(); if(_PHYSIO_REF[u])_flipTo(u); },
    applyEmpathy(type='stress_comfort') {
      if(type==='stress_comfort'&&['STRESS','ANXIETY','FRUSTRATION'].includes(_state)){_empathyBoost={hrvBoost:5};_refractory=0;}
      else if(type==='encouragement'){_empathyBoost={hrvBoost:3};}
      else if(type==='calm_presence'){_empathyBoost={hrvBoost:8};if(_state!=='CALM')_flipTo('CALM');}
    },
    performAction(action) {
      const sp=1-_errorRate-(_cognitiveLoad>0.7?0.2:0);
      const ok=Math.random()<sp;
      _recordEpisodic({type:'action',action,success:ok});
      _applyOperantConditioning(ok?'success':'failure');
      if(ok&&_cognitiveLoad<COGNITIVE_THRESHOLDS.OPTIMAL_MAX)_triggerEvent('success',0.5);
      else if(!ok)_triggerEvent('failure',0.6);
      return ok;
    },

    reset() {
      _state='NEUTRAL'; _prevState='NEUTRAL'; _tickCount=0; _stateAge=0; _refractory=0;
      _scenarioQ=[]; _history=[]; _ultra=Math.random()*2*Math.PI; _sleepP=0;
      _hour=new Date().getHours(); _p300=null; _empathyBoost=null;
      _cognitiveLoad=0.5; _taskDifficulty=0.5; _timePressure=0.3; _taskType='neutral';
      _workingMemory={items:[],lastRehearsal:0}; _errorRate=0.05; _attentionFocus=0.8;
      _pendingEvents=[];
      _episodicMemory=[];
      _semanticMemory={ concepts:new Map(), autobiographical:[] };
      _personalityDrift={ lastDrift:Date.now(), flowCount:0, stressCount:0 };
      _conditioning={ classical:new Map(), operant:{successCount:0,failureCount:0,confidence:0.5,anxietyBaseline:0.3,avoidance:new Map()} };
      const d={hrv:38,hr:72,gsr:4.5,rr:15,eeg:1.0,theta_b:1.0,alpha_b:1.0,beta_b:1.0,gamma_b:0.5};
      for(const k of Object.keys(_ou))_ou[k].x=d[k]??1.0;
    },

    snapshot() {
      return {
        state:_state, displayedEmotion:_displayedEmotion, prevState:_prevState,
        tick:_tickCount, stateAge:_stateAge, cognitiveLoad:_cognitiveLoad,
        errorRate:_errorRate, attentionFocus:_attentionFocus,
        confidence:_conditioning.operant.confidence,
        anxietyBaseline:_conditioning.operant.anxietyBaseline,
        socialPressure:_updateSocialPressure(), maskingLevel:_maskingLevel,
        personality:{..._personality},
        context:{..._context},
        circadian:{hour:_hour,sleepPressure:+_sleepP.toFixed(4)},
        iaf:+_iaf.toFixed(2), microstate:_getMicrostate(), p300Active:!!_p300,
        memory:{
          burnoutRisk:_clamp((_cognitiveLoad>0.7?0.4:0)+_conditioning.operant.anxietyBaseline*0.3+_sleepP*0.3,0,1),
          confidence:_conditioning.operant.confidence,
          episodicCount:_episodicMemory.length,
          semanticCount:_semanticMemory.concepts.size,
          autobiographicalCount:_semanticMemory.autobiographical.length,
        },
        personalityDrift:{ lastDrift:_personalityDrift.lastDrift, current:{..._personality} },
      };
    },
  };
})();

const createHumanSimLifecycle = (options = {}) => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const FREEZE_REWIND_MS = 5 * 60 * 1000;
  const REINCARNATION_AFTER_MS = 24 * 60 * 60 * 1000;
  const UPDATE_THROTTLE_MS = 60 * 1000;
  const key = options.storageKey || 'nuengdeaw_humansim_lifecycle_v1';

  const memoryStorage = (() => {
    const data = new Map();
    return {
      getItem(name) { return data.has(name) ? data.get(name) : null; },
      setItem(name, value) { data.set(name, String(value)); },
      removeItem(name) { data.delete(name); },
    };
  })();

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage);

  const STAGES = [
    { day: 0, name: 'Healthy', confidenceCap: 0.70, memoryRetention: 1.00, noise: 0.00, latency: 1.00, aggregateOnly: false, description: 'Simulation fallback is fully available.' },
    { day: 1, name: 'Confused', confidenceCap: 0.65, memoryRetention: 0.95, noise: 0.02, latency: 1.08, aggregateOnly: false, description: 'Transition has started and response quality is slightly reduced.' },
    { day: 2, name: 'Forgetful', confidenceCap: 0.60, memoryRetention: 0.80, noise: 0.04, latency: 1.16, aggregateOnly: false, description: 'Older memory is reduced while wearable handoff continues.' },
    { day: 3, name: 'Unstable', confidenceCap: 0.50, memoryRetention: 0.60, noise: 0.08, latency: 1.24, aggregateOnly: false, description: 'Simulation output is less stable while the wearable takes over.' },
    { day: 4, name: 'Erratic', confidenceCap: 0.40, memoryRetention: 0.40, noise: 0.12, latency: 1.34, aggregateOnly: false, description: 'Simulation is now secondary and may disagree with live input.' },
    { day: 5, name: 'Dying', confidenceCap: 0.25, memoryRetention: 0.22, noise: 0.18, latency: 1.48, aggregateOnly: true, description: 'Only limited fallback behavior remains available.' },
    { day: 6, name: 'Decomposing', confidenceCap: 0.15, memoryRetention: 0.10, noise: 0.24, latency: 1.62, aggregateOnly: true, description: 'Fallback is reduced to aggregate-level support.' },
    { day: 7, name: 'Dead', confidenceCap: 0.00, memoryRetention: 0.00, noise: 0.32, latency: 1.90, aggregateOnly: true, description: 'Simulation layer is retired and only metadata remains.' },
  ];

  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const nowMs = () => Date.now();
  const pickStage = (progressDays) => STAGES[Math.min(STAGES.length - 1, Math.max(0, Math.floor(progressDays)))];
  const tryStore = (fn) => {
    try { return fn(); } catch (_) { return null; }
  };
  const readPersisted = () => {
    const raw = tryStore(() => storage.getItem(key));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  };
  const persist = () => {
    tryStore(() => storage.setItem(key, JSON.stringify(state)));
  };
  const qualityToRate = (quality, calibrationSamples) => {
    let baseRate = 0;
    if (quality > 0.8) baseRate = 1.0;
    else if (quality > 0.6) baseRate = 0.7;
    else if (quality > 0.4) baseRate = 0.5;
    else if (quality > 0.2) baseRate = 0.3;
    else baseRate = 0.0;

    const completeness = calibrationSamples >= 30 ? 1.0 : calibrationSamples >= 10 ? 0.7 : 0.5;
    return +(baseRate * completeness).toFixed(4);
  };
  const rewindProgress = (progress, elapsedMs) => {
    const steps = Math.floor(elapsedMs / FREEZE_REWIND_MS);
    if (steps <= 0) return progress;
    return clamp(progress - (steps / 24), 0, 7);
  };
  const withNoise = (value, factor) => {
    const jitter = (Math.random() - 0.5) * 2 * factor;
    return +(value * (1 + jitter)).toFixed(3);
  };

  const baseState = {
    phase: 'Healthy',
    wearableConnected: false,
    wearableDevice: null,
    progressDays: 0,
    lastTickAt: nowMs(),
    connectedAt: null,
    disconnectedAt: null,
    frozenAt: null,
    reincarnations: 0,
    lastQuality: 0,
    degradationPaused: false,
    pauseReason: null,
    notificationPrefs: { notifyBeforeDeath: true },
    auditTrail: [],
  };

  const state = { ...baseState, ...(readPersisted() || {}) };

  const addAudit = (event, extra = {}) => {
    state.auditTrail.push({ ts: nowMs(), event, ...extra });
    if (state.auditTrail.length > 200) state.auditTrail.shift();
  };

  const setPhase = (phase, extra = {}) => {
    state.phase = phase;
    if (extra.reason) state.pauseReason = extra.reason;
    addAudit('phase_change', { phase, ...extra });
  };

  const connectWearable = ({ deviceName = null } = {}) => {
    state.wearableConnected = true;
    state.wearableDevice = deviceName || state.wearableDevice;
    state.connectedAt = nowMs();
    state.disconnectedAt = null;
    state.frozenAt = null;
    state.degradationPaused = false;
    state.pauseReason = null;
    setPhase(state.progressDays <= 0 ? 'Monitoring' : 'Degrading', { deviceName: state.wearableDevice });
    state.lastTickAt = nowMs();
    persist();
    return getStatus();
  };

  const disconnectWearable = ({ reason = 'disconnect' } = {}) => {
    state.wearableConnected = false;
    state.disconnectedAt = nowMs();
    state.frozenAt = nowMs();
    if (state.progressDays >= 7) {
      state.reincarnations += 1;
      state.progressDays = 2;
      setPhase('Reincarnation', { reason });
    } else {
      setPhase('Freeze', { reason });
    }
    state.lastTickAt = nowMs();
    persist();
    return getStatus();
  };

  const update = ({ wearableQuality = 0, calibrationSamples = 0, sourceMode = 'simulator', now = nowMs() } = {}) => {
    const elapsedMs = Math.max(0, now - (state.lastTickAt || now));
    const shouldThrottle =
      elapsedMs < UPDATE_THROTTLE_MS &&
      state.phase !== 'Degrading' &&
      !(state.phase === 'Freeze' && state.frozenAt);

    state.lastQuality = wearableQuality;

    if (shouldThrottle) {
      return getStatus();
    }

    state.lastTickAt = now;

    if (!state.wearableConnected) {
      if (state.phase === 'Freeze' && state.frozenAt) {
        state.progressDays = rewindProgress(state.progressDays, now - state.frozenAt);
        if (now - state.frozenAt >= REINCARNATION_AFTER_MS && state.progressDays >= 5) {
          state.reincarnations += 1;
          state.progressDays = Math.max(2, state.progressDays - 3);
          setPhase('Reincarnation', { reason: 'freeze_timeout' });
        }
      }
      persist();
      return getStatus();
    }

    const rate = qualityToRate(wearableQuality, calibrationSamples);
    const calibrationGuard = calibrationSamples < 30 && state.progressDays >= 3;
    const qualityGuard = wearableQuality < 0.3;

    if (calibrationGuard || qualityGuard) {
      state.degradationPaused = true;
      state.pauseReason = calibrationGuard ? 'calibration_guard' : 'quality_guard';
      setPhase('Monitoring', { reason: state.pauseReason, sourceMode });
      persist();
      return getStatus();
    }

    state.degradationPaused = false;
    state.pauseReason = null;
    state.progressDays = clamp(state.progressDays + ((elapsedMs / DAY_MS) * rate), 0, 7);
    setPhase(state.progressDays >= 7 ? 'Dead' : 'Degrading', {
      wearableQuality: +wearableQuality.toFixed(3),
      rate,
    });
    persist();
    return getStatus();
  };

  const extendLife = ({ days = 1 } = {}) => {
    state.progressDays = clamp(state.progressDays - days, 0, 7);
    setPhase('Monitoring', { reason: 'manual_extend', days });
    persist();
    return getStatus();
  };

  const retireNow = () => {
    state.progressDays = 7;
    setPhase('Dead', { reason: 'manual_retire' });
    persist();
    return getStatus();
  };

  const getStatus = () => {
    const stage = pickStage(state.progressDays);
    return {
      phase: state.phase,
      wearableConnected: state.wearableConnected,
      wearableDevice: state.wearableDevice,
      progressDays: +state.progressDays.toFixed(3),
      dayIndex: Math.floor(state.progressDays),
      stageName: stage.name,
      healthPercent: Math.round((1 - (state.progressDays / 7)) * 100),
      confidenceCap: stage.confidenceCap,
      memoryRetention: stage.memoryRetention,
      aggregateOnly: stage.aggregateOnly,
      noise: stage.noise,
      latency: stage.latency,
      degradationPaused: state.degradationPaused,
      pauseReason: state.pauseReason,
      lastQuality: +state.lastQuality.toFixed(3),
      remainingDays: +Math.max(0, 7 - state.progressDays).toFixed(2),
      reincarnations: state.reincarnations,
      stageDescription: stage.description,
      ui: {
        title: `Transition Layer Status: ${stage.name}`,
        summary: state.wearableConnected
          ? `Transitioning responsibility to wearable${state.wearableDevice ? ` (${state.wearableDevice})` : ''}.`
          : 'Simulation layer is active as the fallback source.',
        countdown: stage.name === 'Dead'
          ? 'Simulation layer retired.'
          : `Estimated transition completion in ${Math.max(0, Math.ceil(7 - state.progressDays))} days.`,
      },
      dataPolicy: {
        deleteEpisodicOlderThanDays: state.progressDays >= 3 ? 7 : null,
        dropPersonalContext: state.progressDays >= 4,
        dropPersonalityProfile: state.progressDays >= 5,
        dropRawPhysiology: state.progressDays >= 6,
        metadataOnly: state.progressDays >= 7,
      },
    };
  };

  const applyToRaw = (raw, context = {}) => {
    const status = getStatus();
    if (!raw || raw.error || context.sourceMode !== 'simulator') return raw;
    if (status.progressDays <= 0 && !status.wearableConnected && status.phase !== 'Freeze') {
      return {
        ...raw,
        meta: { ...raw.meta, humanSimLifecycle: status },
      };
    }

    const stage = pickStage(status.progressDays);
    const degraded = {
      ...raw,
      physiology: { ...raw.physiology },
      eeg: { ...raw.eeg },
      cognitive: { ...raw.cognitive },
      memory: { ...raw.memory },
      social: { ...raw.social },
      meta: { ...raw.meta, humanSimLifecycle: status },
    };

    degraded.memory.confidence = Math.min(degraded.memory.confidence ?? 0.5, stage.confidenceCap);
    degraded.memory.semanticCount = Math.max(0, Math.round((degraded.memory.semanticCount ?? 0) * stage.memoryRetention));
    degraded.memory.autobioCount = Math.max(0, Math.round((degraded.memory.autobioCount ?? 0) * stage.memoryRetention));

    if (stage.noise > 0) {
      degraded.physiology.hr = withNoise(degraded.physiology.hr, stage.noise * 0.35);
      degraded.physiology.hrv = withNoise(degraded.physiology.hrv, stage.noise * 0.50);
      degraded.physiology.gsr = withNoise(degraded.physiology.gsr, stage.noise * 0.60);
      degraded.physiology.rr = withNoise(degraded.physiology.rr, stage.noise * 0.25);
      degraded.eeg.theta = withNoise(degraded.eeg.theta, stage.noise * 0.80);
      degraded.eeg.alpha = withNoise(degraded.eeg.alpha, stage.noise * 0.80);
      degraded.eeg.beta = withNoise(degraded.eeg.beta, stage.noise * 0.80);
      degraded.eeg.gamma = withNoise(degraded.eeg.gamma, stage.noise * 0.80);
      degraded.cognitive.load = clamp(withNoise(degraded.cognitive.load, stage.noise * 0.40), 0, 1);
      degraded.cognitive.errorRate = clamp(withNoise(degraded.cognitive.errorRate, stage.noise * 0.60), 0, 1);
      degraded.cognitive.attention = clamp(withNoise(degraded.cognitive.attention, stage.noise * 0.40), 0, 1);
      degraded.social.masking = clamp(withNoise(degraded.social.masking ?? 0, stage.noise), 0, 1);
    }

    if (status.progressDays >= 5) {
      degraded.memory.semanticCount = Math.min(degraded.memory.semanticCount, 8);
      degraded.memory.autobioCount = Math.min(degraded.memory.autobioCount, 3);
      degraded.meta.aggregateOnly = true;
    }
    if (status.progressDays >= 7) {
      degraded.memory.semanticCount = 0;
      degraded.memory.autobioCount = 0;
      degraded.memory.confidence = 0;
      degraded.meta.unreliable = true;
    }

    return degraded;
  };

  return {
    connectWearable,
    disconnectWearable,
    update,
    extendLife,
    retireNow,
    getStatus,
    applyToRaw,
    getAuditTrail: () => [...state.auditTrail],
    reset: () => {
      Object.assign(state, { ...baseState, lastTickAt: nowMs() });
      persist();
      return getStatus();
    },
  };
};

const HumanSimLifecycle = createHumanSimLifecycle();

if(typeof window!=='undefined'){
  window.HumanSim       = HumanSim;
  window.SimulatedHumanSource = HumanSim;
  window.EMOTION_STATES = EMOTION_STATES;
  window.HUMAN_SIM_REFS = HUMAN_SIM_REFS;
  window.MICROSTATES    = MICROSTATES;
  window.createHumanSimLifecycle = createHumanSimLifecycle;
  window.HumanSimLifecycle = HumanSimLifecycle;
}
if(typeof module!=='undefined'&&module.exports) module.exports = { HumanSim, SimulatedHumanSource: HumanSim, EMOTION_STATES, HUMAN_SIM_REFS, MICROSTATES, createHumanSimLifecycle, HumanSimLifecycle };

console.log('HumanSimSystem.js loaded');
