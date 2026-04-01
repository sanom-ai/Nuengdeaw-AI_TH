'use strict';
// น้องหนึ่งเดียว AI โดย Tawan 2026

// ============================================================================
// Nuengdeaw Core - Human Context Interpreter
// ============================================================================
// CHANGELOG:
//   [+] AdaptiveTick        - 3-mode sampling: ACTIVE(1s)/STABLE(5s)/IDLE(30s)
//                             Page Visibility API + beforeunload flush
//                             ลด CPU/battery ขณะ state นิ่งหรือ tab hidden
//   [+] SensorValidator     - validate + clamp wearable sensor data
//                             configurable _sensorProfile: 'default'|'medical'|custom
//                             output: { valid, clamped, confidence, reason }
//   [+] FeedbackTrigger     - ground truth label collection
//                             trigger: state นิ่ง >= 90s OR confidence < 0.55
// ---
// ---
//                             EMA per confirmed state -> adjust adaptive AT
//                             disagreementRate guard (reset ถ้า > 80% confirm streak)
// ---
//                             3 types: peakWindow / patternAlert / wellbeingTrend
//                             output: [{ type, title, body, action, score, ts }]
// CHANGELOG (unchanged):
//   [+] Consumer Registry / NuengdeawDB bridge / _persistTick()
// CHANGELOG (unchanged):
//   [+] DataSource API / Personal Baseline / _getRaw()
//
// Runtime role:
//   HumanSim / SimulatedHumanSource = simulated fallback source
//   wearable adapter               = real sensor source
//   NuengdeawCore                  = orchestration + interpretation center
//
// Load order:
//   <script src="HumanSimSystem.js"></script>
//   <script src="NuengdeawDB.js"></script>
//   <script src="NuengdeawCore.js"></script>
// ============================================================================

const NuengdeawCore = (() => {

  // ==========================================================================
  // PRIVATE CONFIG & STATE
  // ==========================================================================

  let _config = {
    outputStyle:        'adaptive',
    language:           'mixed',
    realtimeMode:       'hybrid',
    historyRetention:   3600,
    importantStates:    ['STRESS','FLOW','ANXIETY','FRUSTRATION','SURPRISE','CONFUSION'],
    importantThreshold: 0.6,
    autoNotify:         true,
    contextAware:       true,
  };

  let _contextMemory = {
    events:[], conversations:[], stateHistory:[], userQueries:[], lastInteraction:null,
  };
  const _MEMORY_LIMITS = Object.freeze({
    events: 240,
    conversations: 120,
    stateHistory: 720,
    userQueries: 120,
  });

  let _callbacks = {
    onImportantEvent:[], onStateChange:[], onStressSpike:[], onFlowState:[],
  };

  let _lastProcessedState  = null;
  let _stressAccumulator   = 0;
  let _flowDuration        = 0;
  let _previousSnapshot    = null;
  let _isInitialized       = false;
  let _structuredCache     = null;
  let _structuredCacheTick = -1;
  let _adaptiveATCache     = null;
  let _adaptiveATCacheKey  = '';
  let _interpretationCache = null;
  let _interpretationCacheKey = '';
  let _recommendationCache = null;
  let _recommendationCacheKey = '';
  let _dbHydrated          = false;
  let _lastError           = null;
  const _logger = (() => {
    if (typeof window !== 'undefined' && window.NuengdeawLogger) return window.NuengdeawLogger;
    if (typeof globalThis !== 'undefined' && globalThis.NuengdeawLogger) return globalThis.NuengdeawLogger;
    return {
      debug: (_code, message, context) => console.debug(message, context || ''),
      info: (_code, message, context) => console.log(message, context || ''),
      warn: (_code, message, context) => console.warn(message, context || ''),
      error: (_code, message, context) => console.error(message, context || ''),
    };
  })();
  const _result = (success, extra = {}) => ({ success, ...extra });
  const _recordError = (scope, error, context = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));
    _lastError = {
      scope,
      error: err.message,
      context,
      ts: Date.now(),
    };
    _logger.warn('CORE_ERROR', `[NuengdeawCore] ${scope}: ${err.message}`, { scope, ...context });
    return _result(false, { error: err.message, scope, context });
  };
  const _safeDbWrite = (scope, fn) => {
    try {
      const res = fn();
      if (res && typeof res === 'object' && res.success === false) {
        _recordError(scope, res.error || 'DB write failed');
      }
      return res;
    } catch (e) {
      return _recordError(scope, e);
    }
  };

  const PHASA_TAWAN_SPEC_URL = '../shared/phasa-tawan-foundation.json';
  const _embeddedPhasaTawanSpec = Object.freeze({
    spec_name: 'Phasa Tawan - Nuengdeaw AI Core Language Standard',
    thai_name: 'ภาษาตะวัน - ภาษากลางน้องหนึ่งเดียว AI',
    version: '1.0.0',
    source: {
      type: 'runtime-fallback',
      path: PHASA_TAWAN_SPEC_URL,
    },
    owner: {
      system_name: 'น้องหนึ่งเดียว AI',
      contact_name: 'TAWAN',
      contact_email: 'sanomaiarch@gmail.com',
    },
    identity: {
      standardName: 'Phasa Tawan',
      runtimeName: 'Phasa Tawan for Nuengdeaw AI',
      purpose: 'ภาษาตะวันเป็นมาตรฐานหลักสำหรับน้องหนึ่งเดียว AI',
    },

    ethics: {
      minimumConfidenceForAmbiguousZone: 0.7,
      hardConstraints: [
        'supportive-only',
        'no-coercion',
        'require-consent-for-sensitive-signals',
      ],
    },
    language_model: {
      style: {
        primary_language: 'th',
        technical_language: 'en',
      },
    },
    namespace_system: {
      known_namespaces: [
        { prefix: 'NS.' },
        { prefix: 'BS.' },
        { prefix: 'CS.' },
        { prefix: 'PS.' },
        { prefix: 'ACT.' },
        { prefix: 'RT.' },
      ],
    },
    publication_notice: {
      contact: 'ติดต่อ TAWAN: sanomaiarch@gmail.com',
      scope: 'ส่วนนี้เป็นมาตรฐานเฉพาะของน้องหนึ่งเดียว AI',
      disclosure: 'เนื้อหาเต็มยังไม่เปิดเผย และต้องขออนุญาตก่อนการเผยแพร่หรือใช้นอกขอบเขตที่ได้รับสิทธิ',
    },
  });
  let _phasaTawanSpecState = {
    data: _embeddedPhasaTawanSpec,
    loadState: 'embedded-fallback',
    source: 'embedded-fallback',
    error: null,
    loadedAt: null,
    promise: null,
  };
  let _phasaTawanNamespaceMapCache = null;
  let _phasaTawanNamespaceMapSource = '';
  let _phasaTawanTokenPatternCache = new Map();
  const _extractPhasaTawanSpec = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.standard && typeof payload.standard === 'object') return payload.standard;
    return payload;
  };
  const _getInlinePhasaTawanSpecSource = () => {
    if (typeof window === 'undefined') return null;
    if (window.PhasaTawanFoundation) {
      return {
        payload: window.PhasaTawanFoundation,
        source: 'window.PhasaTawanFoundation',
      };
    }
    if (window.PhasaTawanSpec) {
      return {
        payload: window.PhasaTawanSpec,
        source: 'window.PhasaTawanSpec',
      };
    }
    return null;
  };
  const _clone = (value) => {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  };
  const _trimMemoryEntries = (key, retentionCutoff = null) => {
    const list = Array.isArray(_contextMemory[key]) ? _contextMemory[key] : [];
    let next = list;
    if (typeof retentionCutoff === 'number') {
      next = next.filter((entry) => (entry?.timestamp ?? entry?.ts ?? 0) > retentionCutoff);
    }
    const limit = _MEMORY_LIMITS[key];
    if (typeof limit === 'number' && next.length > limit) {
      next = next.slice(-limit);
    }
    _contextMemory[key] = next;
    return next;
  };
  const _pushMemoryEntry = (key, entry, retentionCutoff = null) => {
    if (!Array.isArray(_contextMemory[key])) _contextMemory[key] = [];
    _contextMemory[key].push(entry);
    return _trimMemoryEntries(key, retentionCutoff);
  };
  const _normalizePhasaTawanSpec = (sourcePayload, sourceLabel) => {
    const spec = _extractPhasaTawanSpec(sourcePayload);
    if (!spec || typeof spec !== 'object') return null;
    const namespaces = Array.isArray(spec.namespace_system?.known_namespaces)
      ? spec.namespace_system.known_namespaces.filter(ns => ns && typeof ns.prefix === 'string')
      : [];
    const sourceEthics = spec.ethics || {};
    const constraints = Array.isArray(sourceEthics.hardConstraints)
      ? sourceEthics.hardConstraints.filter(Boolean)
      : [];
    const minimumConfidenceForAmbiguousZone =
      typeof sourceEthics.minimumConfidenceForAmbiguousZone === 'number'
        ? sourceEthics.minimumConfidenceForAmbiguousZone
        : typeof sourceEthics.confidence_rule?.ambiguous_zone_threshold === 'number'
          ? sourceEthics.confidence_rule.ambiguous_zone_threshold
          : _embeddedPhasaTawanSpec.ethics.minimumConfidenceForAmbiguousZone;
    return {
      ..._embeddedPhasaTawanSpec,
      ...spec,
      source: {
        ..._embeddedPhasaTawanSpec.source,
        ...(spec.source || {}),
        loadedFrom: sourceLabel,
      },
      identity: {
        ..._embeddedPhasaTawanSpec.identity,
        ...(spec.identity || {}),
      },
      ethics: {
        ..._embeddedPhasaTawanSpec.ethics,
        ...sourceEthics,
        minimumConfidenceForAmbiguousZone,
        ambiguous_zone_threshold: minimumConfidenceForAmbiguousZone,
        hardConstraints: constraints.length ? constraints : _embeddedPhasaTawanSpec.ethics.hardConstraints,
      },
      language_model: {
        ..._embeddedPhasaTawanSpec.language_model,
        ...(spec.language_model || {}),
        style: {
          ..._embeddedPhasaTawanSpec.language_model.style,
          ...((spec.language_model && spec.language_model.style) || {}),
        },
      },
      namespace_system: {
        ..._embeddedPhasaTawanSpec.namespace_system,
        ...(spec.namespace_system || {}),
        known_namespaces: namespaces.length ? namespaces : _embeddedPhasaTawanSpec.namespace_system.known_namespaces,
      },
    };
  };
  const _validatePhasaTawanSpecPayload = (payload, sourceLabel = 'unknown') => {
    const normalized = _normalizePhasaTawanSpec(payload, sourceLabel);
    if (!normalized) {
      throw new Error(`Invalid Phasa Tawan payload from ${sourceLabel}`);
    }
    if (!normalized.identity?.standardName && !normalized.spec_name) {
      throw new Error(`Missing standard identity in ${sourceLabel}`);
    }
    if (!Array.isArray(normalized.namespace_system?.known_namespaces) || normalized.namespace_system.known_namespaces.length === 0) {
      throw new Error(`Missing namespace definitions in ${sourceLabel}`);
    }
    return normalized;
  };
  const _parsePhasaTawanSpecText = (text, sourceLabel) => {
    try {
      return _validatePhasaTawanSpecPayload(JSON.parse(text), sourceLabel);
    } catch (error) {
      throw new Error(`Phasa Tawan parse failed for ${sourceLabel}: ${error.message}`);
    }
  };
  const _applyPhasaTawanSpec = (spec, { source = 'embedded-fallback', loadState = 'ready', error = null } = {}) => {
    const normalized = _normalizePhasaTawanSpec(spec, source) || _embeddedPhasaTawanSpec;
    _phasaTawanNamespaceMapCache = null;
    _phasaTawanNamespaceMapSource = '';
    _phasaTawanTokenPatternCache = new Map();
    _phasaTawanSpecState = {
      data: normalized,
      loadState,
      source,
      error,
      loadedAt: Date.now(),
      promise: null,
    };
    return normalized;
  };
  const _getCurrentPhasaTawanSpec = () => _phasaTawanSpecState.data || _embeddedPhasaTawanSpec;
  const _getCurrentPhasaTawanEthics = () => _getCurrentPhasaTawanSpec().ethics || _embeddedPhasaTawanSpec.ethics;
  const _getPhasaTawanConfidenceFloor = () => {
    const ethics = _getCurrentPhasaTawanEthics();
    return ethics.minimumConfidenceForAmbiguousZone
      ?? ethics.ambiguous_zone_threshold
      ?? _embeddedPhasaTawanSpec.ethics.minimumConfidenceForAmbiguousZone;
  };
  const _applyReadyPhasaTawanSpec = (spec, source) => _clone(_applyPhasaTawanSpec(spec, {
    source,
    loadState: 'ready',
  }));
  const _loadPhasaTawanSpecFromXHR = () => new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('XMLHttpRequest unavailable'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', PHASA_TAWAN_SPEC_URL, true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
        try {
          resolve(_parsePhasaTawanSpecText(xhr.responseText, `${PHASA_TAWAN_SPEC_URL}#xhr`));
        } catch (error) {
          reject(error);
        }
        return;
      }
      reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('XHR failed'));
    xhr.send();
  });
  const _loadPhasaTawanSpecFromFetch = async () => {
    const response = await fetch(PHASA_TAWAN_SPEC_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return _parsePhasaTawanSpecText(await response.text(), PHASA_TAWAN_SPEC_URL);
  };
  const _loadPhasaTawanSpecPayload = async () => {
    if (typeof fetch === 'function') {
      try {
        return {
          payload: await _loadPhasaTawanSpecFromFetch(),
          source: PHASA_TAWAN_SPEC_URL,
        };
      } catch (fetchError) {
        if (typeof XMLHttpRequest !== 'undefined') {
          return {
            payload: await _loadPhasaTawanSpecFromXHR(),
            source: `${PHASA_TAWAN_SPEC_URL}#xhr`,
          };
        }
        throw fetchError;
      }
    }

    return {
      payload: await _loadPhasaTawanSpecFromXHR(),
      source: `${PHASA_TAWAN_SPEC_URL}#xhr`,
    };
  };
  const _loadPhasaTawanSpec = (force = false) => {
    if (!force) {
      if (_phasaTawanSpecState.loadState === 'ready') {
        return Promise.resolve(_clone(_phasaTawanSpecState.data));
      }
      if (_phasaTawanSpecState.promise) return _phasaTawanSpecState.promise;
    }

    const inlineSource = _getInlinePhasaTawanSpecSource();
    if (inlineSource) {
      try {
        const validatedInline = _validatePhasaTawanSpecPayload(inlineSource.payload, inlineSource.source);
        return Promise.resolve(_applyReadyPhasaTawanSpec(validatedInline, inlineSource.source));
      } catch (error) {
        _logger.warn('PHASA_TAWAN_INLINE_INVALID', '[NuengdeawCore] inline Phasa Tawan spec invalid, using file fallback', {
          source: inlineSource.source,
          error: error.message,
        });
      }
    }

    const loader = (async () => {
      try {
        const loaded = await _loadPhasaTawanSpecPayload();
        return _applyReadyPhasaTawanSpec(loaded.payload, loaded.source);
      } catch (error) {
        _logger.warn('PHASA_TAWAN_FALLBACK', '[NuengdeawCore] using embedded Phasa Tawan fallback', {
          source: PHASA_TAWAN_SPEC_URL,
          error: error.message,
        });
        const applied = _applyPhasaTawanSpec(_embeddedPhasaTawanSpec, {
          source: 'embedded-fallback',
          loadState: 'fallback',
          error: error.message,
        });
        return _clone(applied);
      }
    })();

    _phasaTawanSpecState.promise = loader;
    return loader;
  };
  const _getPhasaTawanSpec = () => _clone(_phasaTawanSpecState.data);
  const _describePhasaTawanLoadState = (state) => {
    switch (state) {
      case 'ready': return 'พร้อมใช้งาน';
      case 'fallback': return 'พร้อมใช้งานจากมาตรฐานสำรอง';
      case 'embedded-fallback': return 'พร้อมใช้งานจากมาตรฐานสำรอง';
      default: return 'กำลังเตรียมมาตรฐาน';
    }
  };
  const _getPhasaTawanSpecStatus = () => ({
    loadState: _phasaTawanSpecState.loadState,
    loadStateLabel: _describePhasaTawanLoadState(_phasaTawanSpecState.loadState),
    source: _phasaTawanSpecState.source,
    loadedAt: _phasaTawanSpecState.loadedAt,
    error: _phasaTawanSpecState.error,
    standardName: _getCurrentPhasaTawanSpec().identity?.standardName || _getCurrentPhasaTawanSpec().spec_name || 'Phasa Tawan',
    version: _getCurrentPhasaTawanSpec().version || null,
  });
  const _getPhasaTawanNamespaces = () => {
    const spec = _getCurrentPhasaTawanSpec();
    return (spec.namespace_system?.known_namespaces || [])
      .map(ns => ns.prefix)
      .filter(Boolean);
  };
  const _getPhasaTawanNamespaceMap = () => {
    const spec = _getCurrentPhasaTawanSpec();
    const cacheSource = `${_phasaTawanSpecState.source}:${_phasaTawanSpecState.loadedAt || 0}`;
    if (_phasaTawanNamespaceMapCache && _phasaTawanNamespaceMapSource === cacheSource) {
      return _phasaTawanNamespaceMapCache;
    }
    const items = spec.namespace_system?.known_namespaces || [];
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item.prefix !== 'string') continue;
      map.set(item.prefix, item);
    }
    _phasaTawanNamespaceMapCache = map;
    _phasaTawanNamespaceMapSource = cacheSource;
    return map;
  };
  const _escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const _getNamespaceTokenPattern = (prefix) => {
    if (_phasaTawanTokenPatternCache.has(prefix)) return _phasaTawanTokenPatternCache.get(prefix);
    const pattern = new RegExp(`^${_escapeRegExp(prefix)}[A-Z0-9_]+(?:\\[[A-Za-z0-9_]+\\])?(?:\\.[A-Z0-9_]+)*$`);
    _phasaTawanTokenPatternCache.set(prefix, pattern);
    return pattern;
  };
  const _validatePhasaTawanToken = (token) => {
    if (typeof token !== 'string' || !token.trim()) {
      return { valid:false, token, reason:'token must be a non-empty string', namespace:null };
    }
    const trimmed = token.trim();
    const namespaceMap = _getPhasaTawanNamespaceMap();
    const namespace = [...namespaceMap.keys()].find(prefix => trimmed.startsWith(prefix)) || null;
    if (!namespace) {
      return { valid:false, token:trimmed, reason:'unknown namespace prefix', namespace:null };
    }
    if (namespace === 'ACT.' && !/^ACT\.[A-Z0-9_]+$/.test(trimmed)) {
      return { valid:false, token:trimmed, reason:'ACT token must match ACT.XXX', namespace };
    }
    if (!_getNamespaceTokenPattern(namespace).test(trimmed)) {
      return { valid:false, token:trimmed, reason:'token does not match namespace grammar', namespace };
    }
    return {
      valid:true,
      token:trimmed,
      namespace,
      namespaceInfo: namespaceMap.get(namespace) || null,
    };
  };
  const _validatePhasaTawanRuntimePayload = (payload = {}) => {
    const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const tokenResults = tokens.map(_validatePhasaTawanToken);
    const actionResults = actions.map(action => {
      const token = typeof action === 'string' ? action : action?.token || action?.name || '';
      const result = _validatePhasaTawanToken(token);
      if (result.valid && result.namespace !== 'ACT.') {
        return { ...result, valid:false, reason:'action must use ACT. namespace' };
      }
      return result;
    });
    return {
      valid: tokenResults.every(item => item.valid) && actionResults.every(item => item.valid),
      tokens: tokenResults,
      actions: actionResults,
      checkedAt: Date.now(),
      standard: _getPhasaTawanSpecStatus().standardName,
    };
  };
  const _buildPhasaTawanSignalProfile = (structured) => {
    const standardStatus = _getPhasaTawanSpecStatus();
    const namespaces = [];
    if (structured?.current?.eeg) namespaces.push('NS.');
    if (structured?.current?.physiology) namespaces.push('BS.');
    namespaces.push('PS.');
    const suggestedTokens = [];
    if (structured?.current?.eeg) suggestedTokens.push('NS.THETA');
    if (structured?.current?.physiology) suggestedTokens.push('BS.HRV.RMSSD');
    suggestedTokens.push('PS.OVERLOAD');
    const validation = _validatePhasaTawanRuntimePayload({ tokens: suggestedTokens });
    return {
      standard: standardStatus.standardName,
      version: standardStatus.version,
      mode: 'supportive-only',
      confidenceFloor: _getPhasaTawanConfidenceFloor(),
      readiness: standardStatus.loadStateLabel,
      namespacesAvailable: _getPhasaTawanNamespaces(),
      namespacesSuggested: [...new Set(namespaces)],
      validation,
    };
  };
  const _decorateRecommendedActions = (actions = []) => actions.map(action => {
    const suggestedToken = action?.standardToken || `ACT.${String(action?.type || 'GENERIC').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}`;
    const validation = _validatePhasaTawanRuntimePayload({ actions:[suggestedToken] });
    return {
      ...action,
      standardToken: suggestedToken,
      standardRef: {
        namespace: 'ACT.',
        policy: 'supportive-only',
        catalogStatus: validation.valid ? 'runtime-validated' : 'needs-standard-review',
        validation: validation.actions[0] || null,
      },
    };
  });

  // ==========================================================================
  // CONSUMER REGISTRY
  // ==========================================================================

  let _consumers = new Map();

  const _fireConsumers = (eventType, context) => {
    if (_consumers.size === 0) return;
    for (const [name, fn] of _consumers.entries()) {
      try { fn(eventType, context); } catch(e) {
        console.warn(`[NuengdeawCore] consumer "${name}" threw:`, e.message);
      }
    }
  };

  // ==========================================================================
  // DB BRIDGE
  // ==========================================================================

  const _db = () =>
    (typeof NuengdeawDB !== 'undefined' && NuengdeawDB.isReady()) ? NuengdeawDB : null;

  const _persistTick = (structured) => {
    const db = _db(); if (!db || !structured || structured.error) return;
    const d  = structured.current;
    _safeDbWrite('db.writeSession', () => db.writeSession({
      ts:         Date.now(),
      state:      d.emotion.name,
      cogLoad:    +d.cognitive.load.value.toFixed(3),
      hr:         d.physiology.hr.value,
      hrv:        d.physiology.hrv.value,
      gsr:        d.physiology.gsr.value,
      wellbeing:  +d.wellbeing.score.toFixed(3),
      risk:       +d.wellbeing.risk.toFixed(3),
      sourceMode: _sourceMode,
    }));
  };

  const _persistEvent = (event) => {
    const db = _db(); if (!db) return;
    _safeDbWrite('db.writeEvent', () => db.writeEvent({ ts: Date.now(), ...event }));
  };

  const _rehydrateCalibration = (labels = []) => {
    _labelHistory   = labels.slice(-200);
    _confirmStreak  = 0;
    PERSONAL_WEIGHT = 0.6;
    STATIC_WEIGHT   = 0.4;
    Object.keys(_calibEMA).forEach(k => delete _calibEMA[k]);

    for (const record of _labelHistory) {
      _emaUpdate(record.confirmedState, record.bioSnapshot);
      if (record.predictedState === record.confirmedState) _confirmStreak++;
      else _confirmStreak = 0;
    }

    _recomputePersonalWeight();
    _invalidateCache();
  };

  const _hydrateFromDB = async () => {
    const db = _db();
    if (!db || _dbHydrated) return;
    try {
      const labels = await db.readLabels(200);
      _rehydrateCalibration(labels);
      _dbHydrated = true;
    } catch(e) {
      _recordError('db.readLabels', e, { phase:'hydrateCalibration' });
    }
  };

  // ==========================================================================
  // DATA SOURCE
  // ==========================================================================

  let _sourceMode      = 'simulator';
  let _wearableAdapter = null;
  let _wearableAdapterInfo = null;
  const _humanSimLifecycle = (typeof HumanSimLifecycle !== 'undefined' && HumanSimLifecycle)
    ? HumanSimLifecycle
    : (typeof window !== 'undefined' ? window.HumanSimLifecycle || null : null);
  const _getCalibrationSampleCount = () => _baseline?.sampleCount ?? _pendingCalibSamples.length ?? 0;
  const _touchHumanSimLifecycle = (payload = {}) => {
    if (!_humanSimLifecycle || typeof _humanSimLifecycle.update !== 'function') return null;
    try {
      return _humanSimLifecycle.update({
        calibrationSamples: _getCalibrationSampleCount(),
        sourceMode: _sourceMode,
        ...payload,
      });
    } catch (e) {
      _recordError('humanSimLifecycle.update', e, payload);
      return null;
    }
  };

  // HumanSim is the simulated human fallback source used when no real wearable exists.
  const _simulatorAdapter = () => {
    if (typeof HumanSim === 'undefined') return { error:'HumanSim not available' };
    try {
      const bio      = HumanSim.generateBio();
      const eeg      = HumanSim.generateEEGBands();
      const state    = HumanSim.getState();
      const displayed= HumanSim.getDisplayedEmotion ? HumanSim.getDisplayedEmotion() : state;
      const snap     = HumanSim.snapshot ? HumanSim.snapshot() : {};
      const raw = {
        timestamp: _nowSec(),
        tick:      HumanSim.getTick ? HumanSim.getTick() : 0,
        state: {
          current: state, displayed,
          previous:HumanSim.getPrevState ? HumanSim.getPrevState() : null,
          age:     snap.stateAge || 0,
        },
        physiology:{ hr:bio.hr, hrv:bio.hrv, gsr:bio.gsr, rr:bio.rr, eeg:bio.eeg },
        eeg:{ theta:eeg.theta, alpha:eeg.alpha, beta:eeg.beta, gamma:eeg.gamma,
              ratio:eeg.thetaAlphaRatio, microstate:eeg.microstateLabel },
        cognitive:{
          load:      HumanSim.getCognitiveLoad   ? HumanSim.getCognitiveLoad()   : 0.5,
          errorRate: HumanSim.getErrorRate       ? HumanSim.getErrorRate()       : 0.05,
          attention: HumanSim.getAttentionFocus  ? HumanSim.getAttentionFocus()  : 0.8,
        },
        memory:{
          confidence:      HumanSim.getConfidence      ? HumanSim.getConfidence()      : 0.5,
          anxietyBaseline: HumanSim.getAnxietyBaseline ? HumanSim.getAnxietyBaseline() : 0.3,
          semanticCount:   snap.memory?.semanticCount  || 0,
          autobioCount:    snap.memory?.autobiographicalCount || 0,
        },
        social:{ pressure:HumanSim.getSocialPressure ? HumanSim.getSocialPressure() : 0,
                 masking: HumanSim.getMaskingLevel   ? HumanSim.getMaskingLevel()   : 0 },
        meta:{ iaf:snap.iaf, burnoutRisk:snap.memory?.burnoutRisk, sourceMode:'simulator' },
      };
      const applied = _humanSimLifecycle && typeof _humanSimLifecycle.applyToRaw === 'function'
        ? _humanSimLifecycle.applyToRaw(raw, { sourceMode:_sourceMode })
        : raw;
      _touchHumanSimLifecycle({
        wearableQuality: 0,
        sourceMode: 'simulator',
      });
      return applied;
    } catch(e) {
      _recordError('simulatorAdapter', e);
      return { error: e.message };
    }
  };
  const _disconnectWearableAdapter = async (reason = 'manual_disconnect') => {
    if (_wearableAdapterInfo && typeof _wearableAdapterInfo.disconnect === 'function') {
      try {
        await _wearableAdapterInfo.disconnect({ reason });
      } catch (error) {
        _recordError('wearableAdapter.disconnect', error, { reason, adapter: _wearableAdapterInfo.name });
      }
    }
  };
  const _normalizeWearableAdapter = (adapter, options = {}) => {
    if (typeof adapter === 'function') {
      return {
        name: options.deviceName || 'Wearable',
        read: adapter,
        connect: null,
        disconnect: null,
        kind: 'function',
      };
    }
    if (!adapter || typeof adapter !== 'object' || typeof adapter.read !== 'function') return null;
    return {
      name: adapter.name || options.deviceName || 'Wearable',
      read: adapter.read.bind(adapter),
      connect: typeof adapter.connect === 'function' ? adapter.connect.bind(adapter) : null,
      disconnect: typeof adapter.disconnect === 'function' ? adapter.disconnect.bind(adapter) : null,
      kind: adapter.kind || 'object',
    };
  };

  const _wearableAdapterWrapper = () => {
    if (!_wearableAdapter) return { error:'No wearable adapter. Call useWearable(fn) first.' };
    try {
      const raw = _wearableAdapter();
      if (!raw || raw.error) {
        void _disconnectWearableAdapter('wearable_adapter_result_error');
        if (_humanSimLifecycle && typeof _humanSimLifecycle.disconnectWearable === 'function') {
          try { _humanSimLifecycle.disconnectWearable({ reason:'wearable_adapter_result_error' }); } catch (_) {}
        }
        _sourceMode = 'simulator';
        _wearableAdapter = null;
        _wearableAdapterInfo = null;
        _invalidateCache();
        return _simulatorAdapter();
      }
      const ts   = _nowSec();
      const tick = raw.tick ?? ts;
      const built = {
        timestamp: raw.timestamp ?? ts,
        tick,
        state:{
          current:  raw.state?.current   ?? 'NEUTRAL',
          displayed:raw.state?.displayed ?? raw.state?.current ?? 'NEUTRAL',
          previous: raw.state?.previous  ?? null,
          age:      raw.state?.age       ?? 0,
        },
        physiology:{
          hr:  raw.physiology?.hr  ?? 72,
          hrv: raw.physiology?.hrv ?? 38,
          gsr: raw.physiology?.gsr ?? 4.5,
          rr:  raw.physiology?.rr  ?? 15,
          eeg: raw.physiology?.eeg ?? 1.0,
        },
        eeg:{
          theta:     raw.eeg?.theta     ?? 1.0,
          alpha:     raw.eeg?.alpha     ?? 1.0,
          beta:      raw.eeg?.beta      ?? 1.0,
          gamma:     raw.eeg?.gamma     ?? 0.5,
          ratio:     raw.eeg?.ratio     ?? 1.0,
          microstate:raw.eeg?.microstate ?? 'attention',
        },
        cognitive:{
          load:      raw.cognitive?.load      ?? 0.5,
          errorRate: raw.cognitive?.errorRate ?? 0.05,
          attention: raw.cognitive?.attention ?? 0.8,
        },
        memory:{
          confidence:      raw.memory?.confidence      ?? 0.5,
          anxietyBaseline: raw.memory?.anxietyBaseline ?? 0.3,
          semanticCount:   raw.memory?.semanticCount   ?? 0,
          autobioCount:    raw.memory?.autobioCount    ?? 0,
        },
        social:{ pressure:raw.social?.pressure ?? 0, masking:raw.social?.masking ?? 0 },
        meta:{ iaf:raw.meta?.iaf ?? 9.5, burnoutRisk:raw.meta?.burnoutRisk ?? 0, sourceMode:'wearable' },
      };
      //  validate sensor data ถ้า wearable mode
      const validated = _validateSensorData(built);
      _touchHumanSimLifecycle({
        wearableQuality: validated._sensorValidation?.confidence ?? 0,
        sourceMode:'wearable',
      });
      return validated;
    } catch(e) {
      void _disconnectWearableAdapter('wearable_adapter_error');
      if (_humanSimLifecycle && typeof _humanSimLifecycle.disconnectWearable === 'function') {
        try { _humanSimLifecycle.disconnectWearable({ reason:'wearable_adapter_error' }); } catch (_) {}
      }
      _sourceMode = 'simulator';
      _wearableAdapter = null;
      _wearableAdapterInfo = null;
      _invalidateCache();
      _recordError('wearableAdapter', e);
      return _simulatorAdapter();
    }
  };

  const useSimulatedHumanSource = () => {
    _sourceMode = 'simulator';
    void _disconnectWearableAdapter('source_switch_to_simulator');
    _wearableAdapter = null;
    _wearableAdapterInfo = null;
    if (_humanSimLifecycle && typeof _humanSimLifecycle.disconnectWearable === 'function' && typeof _humanSimLifecycle.getStatus === 'function') {
      try {
        const lifecycleStatus = _humanSimLifecycle.getStatus();
        if (lifecycleStatus?.wearableConnected) {
          _humanSimLifecycle.disconnectWearable({ reason:'source_switch_to_simulator' });
        }
      } catch (_) {}
    }
    _invalidateCache();
    return { success:true, mode:'simulator' };
  };

  const useWearable = (adapterFn, options = {}) => {
    const adapter = _normalizeWearableAdapter(adapterFn, options);
    if (!adapter) return { success:false, error:'adapter must be a function or object with read()' };
    _sourceMode      = 'wearable';
    _wearableAdapter = adapter.read;
    _wearableAdapterInfo = adapter;
    if (adapter.connect) {
      try {
        adapter.connect({ deviceName: adapter.name, options: _clone(options) });
      } catch (error) {
        return _recordError('wearableAdapter.connect', error, { deviceName: adapter.name });
      }
    }
    if (_humanSimLifecycle && typeof _humanSimLifecycle.connectWearable === 'function') {
      try { _humanSimLifecycle.connectWearable({ deviceName:adapter.name }); } catch (_) {}
    }
    _invalidateCache();
    return { success:true, mode:'wearable', adapter: adapter.name };
  };

  const getSourceMode = () => _sourceMode;

  // ==========================================================================
  //  SENSOR VALIDATOR
  // ==========================================================================

  const _SENSOR_PROFILES = {
    default: {
      hr:  { min:30,  max:220, maxDelta:15  },   // bpm
      hrv: { min:5,   max:120, maxDelta:20  },   // ms
      gsr: { min:0.1, max:40,  maxDelta:5   },   // µS
      rr:  { min:4,   max:45,  maxDelta:6   },   // breaths/min
      eeg: { min:0.01,max:50,  maxDelta:10  },   // µV²
    },
    medical: {
      hr:  { min:20,  max:300, maxDelta:30  },
      hrv: { min:2,   max:200, maxDelta:40  },
      gsr: { min:0.05,max:80,  maxDelta:10  },
      rr:  { min:2,   max:60,  maxDelta:12  },
      eeg: { min:0.001,max:100,maxDelta:20  },
    },
  };

  let _sensorProfile  = 'default';
  let _prevSensorSnap = null;

  const setSensorProfile = (profileNameOrObj) => {
    if (typeof profileNameOrObj === 'object' && profileNameOrObj !== null) {
      _SENSOR_PROFILES['_custom'] = profileNameOrObj;
      _sensorProfile = '_custom';
    } else {
      _sensorProfile = _SENSOR_PROFILES[profileNameOrObj] ? profileNameOrObj : 'default';
    }
    return { ok:true, profile:_sensorProfile };
  };

  const _validateSensorData = (raw) => {
    const profile = _SENSOR_PROFILES[_sensorProfile] || _SENSOR_PROFILES.default;
    const phys    = raw.physiology;
    const reasons = [];
    let   totalConf = 1.0;

    const _check = (key, val) => {
      const r = profile[key];
      if (!r) return val;
      let v    = val;
      let conf = 1.0;
      // range clamp
      if (v < r.min || v > r.max) {
        reasons.push(`${key} out of range (${v.toFixed(1)})`);
        v    = Math.max(r.min, Math.min(r.max, v));
        conf = 0.4;
      }
      // delta check (noise gate)
      if (_prevSensorSnap && _prevSensorSnap[key] !== undefined) {
        const delta = Math.abs(v - _prevSensorSnap[key]);
        if (delta > r.maxDelta) {
          reasons.push(`${key} delta too large (${delta.toFixed(1)} > ${r.maxDelta})`);
          // dampen: ema
          v    = _prevSensorSnap[key] * 0.8 + v * 0.2;
          conf = Math.min(conf, 0.6);
        }
      }
      totalConf = Math.min(totalConf, conf);
      return +v.toFixed(3);
    };

    const clamped = {
      hr:  _check('hr',  phys.hr),
      hrv: _check('hrv', phys.hrv),
      gsr: _check('gsr', phys.gsr),
      rr:  _check('rr',  phys.rr),
      eeg: _check('eeg', phys.eeg),
    };

    _prevSensorSnap = { ...clamped };

    if (reasons.length > 0) {
      console.warn('[SensorValidator]', reasons.join('; '));
    }

    // รวม validation result เข้า raw object
    return {
      ...raw,
      physiology: clamped,
      _sensorValidation: {
        valid:      reasons.length === 0,
        confidence: +totalConf.toFixed(3),
        reasons,
        profile:    _sensorProfile,
      },
    };
  };

  const validateSensor = (rawData) => _validateSensorData(rawData);

  // ==========================================================================
  // PERSONAL BASELINE
  // ==========================================================================

  const LS_KEY          = 'nuengdeaw_baseline_v2';
  const MIN_SAMPLES     = 8;
  const MAX_SAMPLES     = 120;
  let   STATIC_WEIGHT   = 0.4;
  let   PERSONAL_WEIGHT = 0.6;   //  can increase to 0.8 via CalibrationEngine

  const STATIC_AT = {
    HRV_LOW:6, HRV_STRESS:20, HRV_READY:50,
    HR_BRADY:45, HR_TACHY:120, HR_EXTREME:140,
    GSR_LOW:0.5, GSR_HIGH:15, GSR_EXTREME:20,
    RESP_APNEA:5, RESP_HIGH:30,
  };

  let _pendingCalibSamples = [];
  let _baseline            = null;

  const _loadBaseline = () => {
    try {
      const r = localStorage.getItem(LS_KEY);
      if (r) _baseline = JSON.parse(r);
    } catch(e) { _baseline = null; }
  };
  _loadBaseline();

  const _saveBaseline = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_baseline)); } catch(e) {}
  };

  const _mean = (arr) => arr.reduce((s,v) => s+v, 0) / arr.length;
  const _std  = (arr, m) => {
    const mu = m ?? _mean(arr);
    return Math.sqrt(arr.reduce((s,v) => s+(v-mu)**2, 0) / arr.length);
  };
  const _r2   = (v) => +Number(v).toFixed(2);

  const addCalibrationSample = (bio) => {
    if (!bio || _pendingCalibSamples.length >= MAX_SAMPLES) return _pendingCalibSamples.length;
    _pendingCalibSamples.push({
      hr:_r2(bio.hr??72), hrv:_r2(bio.hrv??38), gsr:_r2(bio.gsr??4.5), rr:_r2(bio.rr??15),
    });
    return _pendingCalibSamples.length;
  };

  const finalizeCalibration = () => {
    if (_pendingCalibSamples.length < MIN_SAMPLES)
      return { ok:false, reason:`ต้องการอย่างน้อย ${MIN_SAMPLES} samples (ปัจจุบัน ${_pendingCalibSamples.length})` };
    const keys=['hr','hrv','gsr','rr']; const mean={}, std={};
    for (const k of keys) {
      const vals = _pendingCalibSamples.map(s => s[k]);
      const m    = _mean(vals);
      mean[k] = _r2(m); std[k] = _r2(_std(vals, m));
    }
    _baseline = { mean, std, sampleCount:_pendingCalibSamples.length, calibratedAt:Date.now() };
    _pendingCalibSamples = [];
    _saveBaseline();
    return { ok:true, mean, std, sampleCount:_baseline.sampleCount };
  };

  const isCalibrated = () => !!_baseline;
  const getBaseline  = () => _baseline ? { ..._baseline } : null;

  const getAdaptiveAT = () => {
    const cacheKey = _getAdaptiveATCacheKey();
    if (_adaptiveATCache && _adaptiveATCacheKey === cacheKey) return { ..._adaptiveATCache };
    if (!_baseline) {
      _adaptiveATCache = { ...STATIC_AT, _isAdaptive:false };
      _adaptiveATCacheKey = cacheKey;
      return { ..._adaptiveATCache };
    }
    const b  = _baseline.mean;
    const sw = STATIC_WEIGHT;
    const pw = PERSONAL_WEIGHT;
    const blend = (sv, pv) => _r2(sv*sw + pv*pw);
    _adaptiveATCache = {
      HRV_LOW:    blend(STATIC_AT.HRV_LOW,    b.hrv*0.30),
      HRV_STRESS: blend(STATIC_AT.HRV_STRESS, b.hrv*0.55),
      HRV_READY:  blend(STATIC_AT.HRV_READY,  b.hrv*1.15),
      HR_BRADY:   blend(STATIC_AT.HR_BRADY,   b.hr *0.72),
      HR_TACHY:   blend(STATIC_AT.HR_TACHY,   b.hr *1.65),
      HR_EXTREME: blend(STATIC_AT.HR_EXTREME, b.hr *1.90),
      GSR_LOW:    blend(STATIC_AT.GSR_LOW,    b.gsr*0.25),
      GSR_HIGH:   blend(STATIC_AT.GSR_HIGH,   b.gsr*2.80),
      GSR_EXTREME:blend(STATIC_AT.GSR_EXTREME,b.gsr*3.50),
      RESP_APNEA: blend(STATIC_AT.RESP_APNEA, b.rr *0.35),
      RESP_HIGH:  blend(STATIC_AT.RESP_HIGH,  b.rr *1.90),
      _isAdaptive: true,
      _personalWeight: PERSONAL_WEIGHT,
      _baselineDate: _baseline.calibratedAt,
    };
    _adaptiveATCacheKey = cacheKey;
    return { ..._adaptiveATCache };
  };

  // ==========================================================================
  //  CALIBRATION ENGINE - feedback-driven AT adjustment
  // ==========================================================================

  const _calibEMA   = {};  // { [confirmedState]: { hr, hrv, gsr, rr, count } }
  let _labelHistory = [];  // local mirror ของ labels store
  let _confirmStreak= 0;   // consecutive "confirmed as predicted" count

  const _EMA_ALPHA = 0.15; // learning rate

  const _emaUpdate = (state, bioSnap) => {
    if (!bioSnap) return;
    if (!_calibEMA[state]) {
      _calibEMA[state] = { hr:bioSnap.hr, hrv:bioSnap.hrv, gsr:bioSnap.gsr, rr:bioSnap.rr, count:0 };
    }
    const e = _calibEMA[state];
    e.hr  = e.hr  * (1-_EMA_ALPHA) + (bioSnap.hr  ?? e.hr)  * _EMA_ALPHA;
    e.hrv = e.hrv * (1-_EMA_ALPHA) + (bioSnap.hrv ?? e.hrv) * _EMA_ALPHA;
    e.gsr = e.gsr * (1-_EMA_ALPHA) + (bioSnap.gsr ?? e.gsr) * _EMA_ALPHA;
    e.rr  = e.rr  * (1-_EMA_ALPHA) + (bioSnap.rr  ?? e.rr)  * _EMA_ALPHA;
    e.count++;
  };

  const _recomputePersonalWeight = () => {
    const labelCount = _labelHistory.length;
    if (labelCount < 20) return;  // ยังไม่พอ
    // ถ้ามี labels เพียงพอ เพิ่ม personal weight
    PERSONAL_WEIGHT = Math.min(0.85, 0.6 + (Math.min(labelCount, 100) / 100) * 0.25);
    STATIC_WEIGHT   = 1 - PERSONAL_WEIGHT;
    _invalidateCache();
  };

  // ---
  const _checkConfirmationBias = (isConfirmed) => {
    if (isConfirmed) {
      _confirmStreak++;
      if (_confirmStreak >= 15) {
        console.warn('[CalibrationEngine] Possible confirmation bias - streak:', _confirmStreak,
          '- consider resetting calibration if predictions seem off.');
      }
    } else {
      _confirmStreak = 0;
    }
  };

  // ---
  const _onLabel = (record) => {
    _labelHistory.push(record);
    if (_labelHistory.length > 200) _labelHistory.shift();
    _invalidateCache();

    _emaUpdate(record.confirmedState, record.bioSnapshot);

    const isConfirmed = record.predictedState === record.confirmedState;
    _checkConfirmationBias(isConfirmed);
    _recomputePersonalWeight();

    // persist ลง DB
    const db = _db();
    if (db) _safeDbWrite('db.writeLabel', () => db.writeLabel(record));
  };

  const getCalibrationStats = () => ({
    labelCount:     _labelHistory.length,
    personalWeight: +PERSONAL_WEIGHT.toFixed(3),
    staticWeight:   +STATIC_WEIGHT.toFixed(3),
    confirmStreak:  _confirmStreak,
    emaStates:      Object.keys(_calibEMA),
    emaData:        { ..._calibEMA },
  });

  // ==========================================================================
  //  FEEDBACK TRIGGER - toast prompt + user response handler
  // ==========================================================================

  let _feedbackCooldown      = 0;       // timestamp (ms) ของ cooldown หมดเวลา
  const FEEDBACK_COOLDOWN_MS = 3 * 60 * 1000;  // ถามซ้ำได้ทุก 3 นาที
  const STABLE_SECONDS       = 90;      // state ต้องนิ่งกี่วินาที
  const CONFIDENCE_THRESHOLD = 0.55;

  let _stableCounter         = 0;       // นับ ticks ที่ state ไม่เปลี่ยน
  let _feedbackCallback      = null;    // fn(question) -> show UI toast

  const setFeedbackCallback = (fn) => {
    if (typeof fn === 'function') _feedbackCallback = fn;
  };

  const _shouldTriggerFeedback = (structured) => {
    const now  = Date.now();
    if (now < _feedbackCooldown) return false;

    const conf  = structured.meta?.confidence ?? 1;
    const stable= _stableCounter >= STABLE_SECONDS;
    const lowConf = conf < CONFIDENCE_THRESHOLD;

    return stable || lowConf;
  };

  // ---
  const _tickFeedbackCheck = (structured) => {
    if (!structured || structured.error) return;
    const currentState = structured.current.emotion.name;

    if (currentState === _lastProcessedState) {
      _stableCounter++;
    } else {
      _stableCounter = 0;
    }

    if (_shouldTriggerFeedback(structured) && _feedbackCallback) {
      _feedbackCooldown = Date.now() + FEEDBACK_COOLDOWN_MS;
      _feedbackCallback({
        predictedState: currentState,
        confidence:     +(structured.meta?.confidence ?? 0.5).toFixed(3),
        bioSnapshot: {
          hr:  structured.current.physiology.hr.value,
          hrv: structured.current.physiology.hrv.value,
          gsr: structured.current.physiology.gsr.value,
          rr:  structured.current.physiology.rr.value,
        },
      });
    }
  };

  // User ตอบ feedback toast
  const submitFeedback = ({ predictedState, confirmedState, bioSnapshot, source = 'user' }) => {
    if (!confirmedState) return { success:false, error:'confirmedState required' };
    const record = {
      ts:             Date.now(),
      predictedState: predictedState ?? _lastProcessedState,
      confirmedState,
      confidence:     0.9,  // user-confirmed = high confidence
      bioSnapshot:    bioSnapshot ?? {},
      source,
    };
    _onLabel(record);
    _stableCounter = 0;  // reset หลัง feedback
    _invalidateCache();
    return { success:true, record };
  };

  // ==========================================================================
  //  INSIGHT ENGINE - human-readable summary
  // ==========================================================================

  const _POSITIVE_STATES = new Set(['FLOW','CALM','READY','CURIOSITY','EXCITEMENT']);
  const _NEGATIVE_STATES = new Set(['STRESS','ANXIETY','FRUSTRATION','FATIGUE','CONFUSION']);

  const _thaiState = {
    FLOW:'ภาวะลื่นไหล', READY:'พร้อมทำงาน', STRESS:'เครียด', CONFUSION:'สับสน',
    BOREDOM:'เบื่อ', EXCITEMENT:'ตื่นเต้น', FATIGUE:'เหนื่อยล้า', NEUTRAL:'ปกติ',
    FRUSTRATION:'หงุดหงิด', ANXIETY:'กังวล', CURIOSITY:'อยากรู้', DISGUST:'รังเกียจ',
    SURPRISE:'ประหลาดใจ', CALM:'สงบ',
  };

  const _fmtTime = (ms) => {
    const d   = new Date(ms);
    const h   = String(d.getHours()).padStart(2,'0');
    const m   = String(d.getMinutes()).padStart(2,'0');
    return `${h}:${m}`;
  };

  // Insight 1: หา peak window (run ยาวที่สุดของ positive states)
  const _insightPeakWindow = (sessions) => {
    if (sessions.length < 10) return null;
    let best = null, run = 0, runStart = 0;
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (_POSITIVE_STATES.has(s.state)) {
        if (run === 0) runStart = i;
        run++;
      } else {
        if (run > (best?.run ?? 0)) {
          best = { run, startIdx:runStart, endIdx:i-1 };
        }
        run = 0;
      }
    }
    if (run > (best?.run ?? 0)) best = { run, startIdx:runStart, endIdx:sessions.length-1 };
    if (!best || best.run < 5) return null;

    const startMs = sessions[best.startIdx]?.ts ?? 0;
    const endMs   = sessions[best.endIdx]?.ts   ?? startMs;
    const minDur  = Math.round((endMs - startMs) / 60000);
    const state   = sessions[best.startIdx]?.state ?? 'FLOW';
    const score   = Math.min(1, best.run / 60);

    return {
      type:   'peakWindow',
      title:  'ช่วงโฟกัสดีที่สุดวันนี้',
      body:   `${_fmtTime(startMs)}-${_fmtTime(endMs)} น. (${minDur > 0 ? minDur + ' นาที' : 'ช่วงสั้น'}) - ${_thaiState[state] ?? state}`,
      action: 'พรุ่งนี้ควรจัดงานสำคัญไว้ในช่วงเวลานี้',
      score,
      ts:     Date.now(),
    };
  };

  // Insight 2: pattern alert - state ซ้ำในช่วงเวลาเดิมหลายวัน
  const _insightPatternAlert = (sessions) => {
    if (sessions.length < 50) return null;  // ต้องการข้อมูลหลายวัน
    // bucket ต่อ hour-of-day x state
    const buckets = {};
    for (const s of sessions) {
      if (!_NEGATIVE_STATES.has(s.state)) continue;
      const hour  = new Date(s.ts).getHours();
      const key   = `${hour}:${s.state}`;
      const day   = new Date(s.ts).toDateString();
      if (!buckets[key]) buckets[key] = new Set();
      buckets[key].add(day);
    }
    let topKey = null, topDays = 0;
    for (const [k, days] of Object.entries(buckets)) {
      if (days.size > topDays) { topKey = k; topDays = days.size; }
    }
    if (!topKey || topDays < 3) return null;

    const [hourStr, state] = topKey.split(':');
    const hour = parseInt(hourStr);
    const score = Math.min(1, topDays / 7);
    return {
      type:   'patternAlert',
      title:  `พบรูปแบบซ้ำ: ${_thaiState[state] ?? state}`,
      body:   `ช่วง ${hour}:00-${hour+1}:00 น. เกิดซ้ำมาแล้ว ${topDays} วัน`,
      action: `ลองจัดการสาเหตุที่ทำให้${_thaiState[state] ?? state}ในช่วงเวลานี้`,
      score,
      ts:     Date.now(),
    };
  };

  // ---
  const _insightWellbeingTrend = (sessions) => {
    if (sessions.length < 20) return null;
    const now    = Date.now();
    const week1  = sessions.filter(s => s.ts >= now - 7*24*3600*1000);
    const week2  = sessions.filter(s => s.ts >= now - 14*24*3600*1000 && s.ts < now - 7*24*3600*1000);
    if (week1.length < 5 || week2.length < 5) return null;

    const avg = (arr) => arr.reduce((s,r) => s + (r.wellbeing ?? 0.5), 0) / arr.length;
    const a1  = avg(week1);
    const a2  = avg(week2);
    const pct = Math.round(((a1 - a2) / (a2 || 0.01)) * 100);
    const dir = pct >= 0 ? 'ดีขึ้น' : 'ลดลง';
    const score = Math.min(1, Math.abs(pct) / 30);

    return {
      type:   'wellbeingTrend',
      title:  `สุขภาวะ${dir}จากสัปดาห์ที่แล้ว`,
      body:   `${dir} ${Math.abs(pct)}% (สัปดาห์นี้ ${(a1*100).toFixed(0)}% vs สัปดาห์ก่อน ${(a2*100).toFixed(0)}%)`,
      action: pct >= 0 ? 'ทำสิ่งที่ทำให้รู้สึกดีต่อไป' : 'พิจารณาปรับลดภาระงานหรือเพิ่มการพักผ่อน',
      score,
      ts:     Date.now(),
    };
  };

  // ---
  const generateInsights = async (sessions) => {
    // ---
    let data = sessions;
    if (!data) {
      const db = _db();
      data = db ? await db.readSessionsByDay(14) : [];
    }
    const insights = [
      _insightPeakWindow(data),
      _insightPatternAlert(data),
      _insightWellbeingTrend(data),
    ].filter(Boolean).sort((a,b) => b.score - a.score);

    return insights;
  };

  // ==========================================================================
  //  ADAPTIVE TICK - 3 modes: ACTIVE(1s) / STABLE(5s) / IDLE(30s)
  // ==========================================================================

  const TICK_MODES = { ACTIVE:1000, STABLE:5000, IDLE:30000 };
  const STABLE_PROMOTE_TICKS  = 60;   // ACTIVE->STABLE หลัง 60 ticks ที่ไม่เปลี่ยน
  const IDLE_PROMOTE_TICKS    = 360;  // STABLE->IDLE (6 นาทีหลัง STABLE)
  const HR_DELTA_ACTIVE_LIMIT = 15;   // bpm - ถ้า delta เกินนี้ -> กลับ ACTIVE

  let _tickMode         = 'ACTIVE';
  let _tickTimer        = null;
  let _stableTickCount  = 0;
  let _lastTickHR       = null;
  let _isPaused         = false;

  const _getTickInterval = () => TICK_MODES[_tickMode] ?? 1000;
  const _stopTickLoop = () => {
    if (_tickTimer) {
      clearInterval(_tickTimer);
      _tickTimer = null;
    }
  };
  const _startTickLoop = () => {
    if (_config.realtimeMode === 'ondemand' || _isPaused) return;
    _tickTimer = setInterval(_onTick, _getTickInterval());
  };

  const _promoteTickMode = () => {
    if (_tickMode === 'ACTIVE') {
      _stableTickCount++;
      if (_stableTickCount >= STABLE_PROMOTE_TICKS) {
        _tickMode = 'STABLE'; _stableTickCount = 0;
        console.log('[AdaptiveTick] -> STABLE (5s)');
        _rescheduleMainLoop();
      }
    } else if (_tickMode === 'STABLE') {
      _stableTickCount++;
      if (_stableTickCount >= IDLE_PROMOTE_TICKS) {
        _tickMode = 'IDLE'; _stableTickCount = 0;
        console.log('[AdaptiveTick] -> IDLE (30s)');
        _rescheduleMainLoop();
      }
    }
  };

  const _demoteToActive = (reason) => {
    if (_tickMode === 'ACTIVE') return;
    _tickMode = 'ACTIVE'; _stableTickCount = 0;
    console.log('[AdaptiveTick] -> ACTIVE (1s) - reason:', reason);
    _rescheduleMainLoop();
  };

  const _rescheduleMainLoop = () => {
    _stopTickLoop();
    _startTickLoop();
  };

  const _onTick = () => {
    // ---
    if (_sourceMode === 'simulator' && typeof HumanSim === 'undefined') return;

    if (_sourceMode === 'simulator' && HumanSim.tick) {
      HumanSim.tick();
    }

    _detectImportantEvents();

    // ตรวจว่าควร promote หรือ demote
    const s = _getStructured();
    if (s && !s.error) {
      const hr = s.current.physiology.hr.value;
      if (_lastTickHR !== null && Math.abs(hr - _lastTickHR) > HR_DELTA_ACTIVE_LIMIT) {
        _demoteToActive('HR delta spike');
      }
      _lastTickHR = hr;
    }

    if (s && !s.error && s.current.emotion.name === _lastProcessedState) {
      _promoteTickMode();
    } else {
      _demoteToActive('state change');
    }
  };

  // Page Visibility API - ไป IDLE เมื่อ tab hidden
  const _initVisibilityHandler = () => {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _tickMode = 'IDLE'; _stableTickCount = 0;
        _rescheduleMainLoop();
        console.log('[AdaptiveTick] tab hidden -> IDLE');
      } else {
        _demoteToActive('tab visible');
      }
    });
  };

  // ---
  const _initBeforeUnload = () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      const db = _db(); if (db) db.flush();
    });
  };

  // ==========================================================================
  // UTILITIES (unchanged from v2.x)
  // ==========================================================================

  const _clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const _nowSec = () => Date.now() / 1000;
  const _getAdaptiveATCacheKey = () => {
    if (!_baseline) return `static:${STATIC_WEIGHT}:${PERSONAL_WEIGHT}`;
    return `baseline:${_baseline.calibratedAt}:${_baseline.sampleCount}:${STATIC_WEIGHT}:${PERSONAL_WEIGHT}`;
  };
  const _invalidateCache = () => {
    _structuredCache = null;
    _structuredCacheTick = -1;
    _adaptiveATCache = null;
    _adaptiveATCacheKey = '';
    _interpretationCache = null;
    _interpretationCacheKey = '';
    _recommendationCache = null;
    _recommendationCacheKey = '';
  };

  const _thaiEmotionMap = {
    FLOW:'ภาวะลื่นไหล', READY:'พร้อมทำงาน', STRESS:'เครียด', CONFUSION:'สับสน',
    BOREDOM:'เบื่อ', EXCITEMENT:'ตื่นเต้น', FATIGUE:'เหนื่อยล้า', NEUTRAL:'ปกติ',
    FRUSTRATION:'หงุดหงิด', ANXIETY:'กังวล', CURIOSITY:'อยากรู้', DISGUST:'รังเกียจ',
    SURPRISE:'ประหลาดใจ', CALM:'สงบ',
  };

  // ==========================================================================
  // LEVEL 1: RAW DATA
  // ==========================================================================

  const _getRaw = () =>
    _sourceMode === 'simulator' ? _simulatorAdapter() : _wearableAdapterWrapper();

  // ==========================================================================
  // LEVEL 2: STRUCTURED DATA
  // ==========================================================================

  const _detectTrends = (raw) => {
    if (!_previousSnapshot) { _previousSnapshot = raw; return { hrTrend:'stable', stressTrend:'stable', cognitiveTrend:'stable' }; }
    const hc = (raw.physiology.hr - (_previousSnapshot.physiology?.hr ?? raw.physiology.hr)) / ((_previousSnapshot.physiology?.hr ?? 1) || 1);
    const sc = (raw.state.current==='STRESS'?1:0) - ((_previousSnapshot.state?.current==='STRESS')?1:0);
    const cc = raw.cognitive.load - ((_previousSnapshot.cognitive?.load) ?? raw.cognitive.load);
    _previousSnapshot = raw;
    return {
      hrTrend:      hc > 0.05 ? 'rising'     : hc < -0.05 ? 'falling'    : 'stable',
      stressTrend:  sc > 0    ? 'increasing'  : sc < 0     ? 'decreasing' : 'stable',
      cognitiveTrend:cc> 0.05 ? 'increasing'  : cc < -0.05 ? 'decreasing' : 'stable',
    };
  };

  const _calculateRiskLevel = (raw, at = getAdaptiveAT()) => {
    let risk = 0;
    if (raw.state.current==='STRESS')      risk += 0.40;
    if (raw.state.current==='ANXIETY')     risk += 0.35;
    if (raw.state.current==='FRUSTRATION') risk += 0.30;
    if (raw.physiology.hr  > at.HR_TACHY)  risk += 0.20;
    if (raw.physiology.gsr > at.GSR_HIGH)  risk += 0.15;
    if (raw.cognitive.load > 0.7)          risk += 0.25;
    if (raw.memory.anxietyBaseline > 0.5)  risk += 0.20;
    return _clamp(risk, 0, 1);
  };

  const _calculateWellbeing = (raw, at = getAdaptiveAT()) => {
    let w = 1.0;
    if (raw.state.current==='FLOW')        w += 0.20;
    if (raw.state.current==='CALM')        w += 0.15;
    if (raw.state.current==='READY')       w += 0.10;
    if (raw.state.current==='STRESS')      w -= 0.30;
    if (raw.state.current==='ANXIETY')     w -= 0.25;
    if (raw.state.current==='FRUSTRATION') w -= 0.20;
    if (raw.state.current==='FATIGUE')     w -= 0.20;
    if (raw.physiology.hr  > at.HR_TACHY)  w -= 0.15;
    if (raw.physiology.hrv < at.HRV_STRESS)w -= 0.10;
    if (raw.cognitive.load > 0.7)          w -= 0.20;
    if (raw.cognitive.load < 0.3)          w -= 0.10;
    return _clamp(w, 0, 1);
  };

  const _getStructuredUncached = () => {
    const raw = _getRaw(); if (raw.error) return { error:raw.error };
    const adaptiveAT = getAdaptiveAT();
    const humanSimLifecycle = _humanSimLifecycle && typeof _humanSimLifecycle.getStatus === 'function'
      ? _humanSimLifecycle.getStatus()
      : null;
    const trends    = _detectTrends(raw);
    const risk      = _calculateRiskLevel(raw, adaptiveAT);
    const wellbeing = _calculateWellbeing(raw, adaptiveAT);

    const cutoff = _nowSec() - _config.historyRetention;
    _pushMemoryEntry('stateHistory', { timestamp:raw.timestamp, state:raw.state.current, load:raw.cognitive.load }, cutoff);

    return {
      current:{
        emotion:{
          name:raw.state.current, nameThai:_thaiEmotionMap[raw.state.current]||raw.state.current,
          intensity:raw.state.age>30?0.8:raw.state.age>15?0.6:0.4,
          displayed:raw.state.displayed, displayedThai:_thaiEmotionMap[raw.state.displayed]||raw.state.displayed,
          maskingLevel:raw.social.masking,
        },
        physiology:{
          hr: {value:raw.physiology.hr,  unit:'bpm',          status:raw.physiology.hr>90?'elevated':raw.physiology.hr<60?'low':'normal'},
          hrv:{value:raw.physiology.hrv, unit:'ms',           status:raw.physiology.hrv<25?'low':raw.physiology.hrv>50?'high':'normal'},
          gsr:{value:raw.physiology.gsr, unit:'µS',           status:raw.physiology.gsr>10?'elevated':raw.physiology.gsr<2?'low':'normal'},
          rr: {value:raw.physiology.rr,  unit:'breaths/min',  status:raw.physiology.rr>20?'rapid':raw.physiology.rr<12?'slow':'normal'},
        },
        eeg:{
          theta:raw.eeg.theta,
          alpha:raw.eeg.alpha,
          beta:raw.eeg.beta,
          gamma:raw.eeg.gamma,
          dominantBand:raw.eeg.beta>raw.eeg.alpha?'beta':raw.eeg.alpha>raw.eeg.theta?'alpha':'theta',
          arousal:raw.eeg.beta/(raw.eeg.alpha+0.01), microstate:raw.eeg.microstate,
        },
        cognitive:{
          load:{value:raw.cognitive.load, status:raw.cognitive.load>0.7?'overload':raw.cognitive.load<0.3?'underload':'optimal'},
          errorRisk:raw.cognitive.errorRate, attention:raw.cognitive.attention,
        },
        memory:{
          confidence:raw.memory.confidence,
          anxietyBaseline:raw.memory.anxietyBaseline,
          semanticCount:raw.memory.semanticCount,
          autobioCount:raw.memory.autobioCount,
        },
        social:{
          pressure:raw.social.pressure,
          masking:raw.social.masking,
        },
        humanSim: humanSimLifecycle,
        wellbeing:{ score:wellbeing, risk, status:wellbeing>0.7?'good':wellbeing>0.4?'moderate':'poor' },
        baseline:isCalibrated()?{calibrated:true,mean:_baseline.mean}:{calibrated:false},
        sourceMode: raw.meta?.sourceMode ?? _sourceMode,
        sensorValidation: raw._sensorValidation ?? null,  // 
      },
      trends,
      summary:{
        dominantEmotion:     raw.state.current,
        dominantEmotionThai: _thaiEmotionMap[raw.state.current]||raw.state.current,
        needsIntervention:   risk > 0.6,
        needsSupport:        wellbeing < 0.4,
        actionable:          risk > 0.5 || wellbeing < 0.5,
      },
      meta:{
        timestamp:    raw.timestamp,
        tick:         raw.tick,
        confidence:   raw.memory.confidence,
        semanticCount:raw.memory.semanticCount,
        autobioCount: raw.memory.autobioCount,
        tickMode:     _tickMode,        // 
        personalWeight: +PERSONAL_WEIGHT.toFixed(3),  // 
        humanSimLifecycle,
        languageStandard: _getPhasaTawanSpecStatus(),
        signalProfile: _buildPhasaTawanSignalProfile({
          current: {
            eeg: raw.eeg,
            physiology: raw.physiology,
          },
        }),
      },
    };
  };

  const _getStructured = () => {
    const currentTick = (_sourceMode==='simulator' && typeof HumanSim!=='undefined' && HumanSim.getTick)
      ? HumanSim.getTick() : _nowSec();
    if (_structuredCache && _structuredCacheTick === currentTick) return _structuredCache;
    _structuredCache     = _getStructuredUncached();
    _structuredCacheTick = currentTick;
    return _structuredCache;
  };

  // ==========================================================================
  // LEVEL 3: INTERPRETATION (unchanged from v2.x)
  // ==========================================================================

  const _detectLanguage = () =>
    _config.language==='th'?'th':_config.language==='en'?'en':'mixed';
  const _getStructuredCacheSignature = (structured) =>
    `${structured.meta?.tick ?? 'na'}:${structured.current?.sourceMode ?? _sourceMode}`;

  const _getInterpretationClinical = (structured, lang) => {
    const d=structured.current, tr=structured.trends, sm=structured.summary;
    const src = d.sourceMode==='wearable' ? ' [wearable]' : ' [sim]';
    if (lang!=='en') {
      let t=`[Clinical Assessment${src}]\n`;
      t+=`สภาวะ: ${d.emotion.nameThai} (${d.emotion.name})\n`;
      t+=`HR ${d.physiology.hr.value} bpm, HRV ${d.physiology.hrv.value} ms, GSR ${d.physiology.gsr.value} µS\n`;
      t+=`Cog Load: ${(d.cognitive.load.value*100).toFixed(0)}% (${d.cognitive.load.status})\n`;
      t+=`Wellbeing: ${(d.wellbeing.score*100).toFixed(0)}%  Risk: ${(d.wellbeing.risk*100).toFixed(0)}%\n`;
      t+=`Adaptive AT: ${d.baseline.calibrated?'Personalized (w='+PERSONAL_WEIGHT.toFixed(2)+')':'Static'}\n`;
      if (sm.needsIntervention) t+='ต้องการ intervention';
      return t;
    }
    let t=`[Clinical${src}] ${d.emotion.name} | HR ${d.physiology.hr.value} HRV ${d.physiology.hrv.value} GSR ${d.physiology.gsr.value}\n`;
    t+=`Cog ${(d.cognitive.load.value*100).toFixed(0)}% W ${(d.wellbeing.score*100).toFixed(0)}% R ${(d.wellbeing.risk*100).toFixed(0)}%`;
    return t;
  };

  const _getInterpretationEmpathetic = (structured, lang) => {
    const d=structured.current, tr=structured.trends, sm=structured.summary;
    let t='';
    if (lang!=='en') {
      if (d.emotion.name==='STRESS' )      { t=`ดูเหมือนคุณกำลังเครียดอยู่นะคะ `; if(d.physiology.hr.value>90)t+=`หัวใจเต้นเร็ว (${d.physiology.hr.value} bpm) `; }
      else if (d.emotion.name==='FLOW')   t=`คุณอยู่ในภาวะลื่นไหล โฟกัสได้ดีมากค่ะ `;
      else if (d.emotion.name==='ANXIETY'){ t=`คุณดูกังวลอยู่นะคะ `; if(d.physiology.hrv.value<25)t+=`HRV ต่ำ `; }
      else if (d.emotion.name==='FATIGUE'){ t=`คุณดูเหนื่อยแล้วค่ะ Cog Load ${(d.cognitive.load.value*100).toFixed(0)}% `; }
      else if (d.emotion.name==='CALM')    t=`คุณสงบมากค่ะ เหมาะพักผ่อนหรือทำสมาธิ `;
      else { t=`ตอนนี้รู้สึก${d.emotion.nameThai}ค่ะ `; if(d.wellbeing.score<0.4)t+=`ดูมีอะไรยากอยู่ `; }
      if (tr.stressTrend==='increasing') t+=`\nความเครียดกำลังเพิ่มขึ้น ลองหายใจลึกๆ ดูไหมคะ?`;
      if (sm.needsSupport) t+=`\nถ้าต้องการพูดคุย ฉันอยู่ตรงนี้ค่ะ `;
      return t;
    }
    if (d.emotion.name==='STRESS')      t=`You seem stressed. HR ${d.physiology.hr.value} bpm. `;
    else if (d.emotion.name==='FLOW')   t=`You're in flow - deeply focused. `;
    else if (d.emotion.name==='ANXIETY')t=`You seem anxious. Low HRV ${d.physiology.hrv.value}ms. `;
    else if (d.emotion.name==='FATIGUE')t=`Showing fatigue (cog ${(d.cognitive.load.value*100).toFixed(0)}%). `;
    else if (d.emotion.name==='CALM')   t=`You're calm - great for rest. `;
    else t=`Feeling ${d.emotion.name.toLowerCase()}. `;
    if (tr.stressTrend==='increasing') t+='\nStress rising. Deep breath? ';
    return t;
  };

  const _getInterpretationTechnical = (structured, lang) =>
    JSON.stringify({
      type:'technical', language:lang,
      languageStandard:_getPhasaTawanSpecStatus(),
      signalProfile:_buildPhasaTawanSignalProfile(structured),
      sourceMode:structured.current.sourceMode,
      adaptiveAT:getAdaptiveAT(),
      tickMode: _tickMode,
      calibration: getCalibrationStats(),
      state:structured.current.emotion.name,
      physiology:structured.current.physiology,
      eeg:structured.current.eeg,
      cognitive:structured.current.cognitive,
      wellbeing:structured.current.wellbeing,
      trends:structured.trends,
    }, null, 2);

  const _getInterpretationAdaptive = (structured) => {
    const lang = _detectLanguage();
    const r = structured.current.wellbeing.risk, w = structured.current.wellbeing.score;
    if (r>0.7) return _getInterpretationClinical(structured, lang);
    if (w<0.4) return _getInterpretationEmpathetic(structured, lang);
    if (structured.current.cognitive.load.status==='overload') return _getInterpretationClinical(structured, lang);
    return _getInterpretationEmpathetic(structured, lang);
  };

  const _getInterpretation = () => {
    const s = _getStructured(); if (s.error) return s.error;
    const lang = _detectLanguage();
    const cacheKey = `${_config.outputStyle}:${lang}:${_getStructuredCacheSignature(s)}`;
    if (_interpretationCache && _interpretationCacheKey === cacheKey) return _interpretationCache;

    let interpretation = '';
    switch (_config.outputStyle) {
      case 'clinical':   interpretation = _getInterpretationClinical(s, lang); break;
      case 'empathetic': interpretation = _getInterpretationEmpathetic(s, lang); break;
      case 'technical':  interpretation = _getInterpretationTechnical(s, lang); break;
      default:           interpretation = _getInterpretationAdaptive(s); break;
    }

    _interpretationCache = interpretation;
    _interpretationCacheKey = cacheKey;
    return interpretation;
  };

  // ==========================================================================
  // LEVEL 4: RECOMMENDATION (unchanged from v2.x)
  // ==========================================================================

  const _getRecommendation = () => {
    const s = _getStructured(); if (s.error) return { message:s.error, actions:[] };
    const lang = _detectLanguage();
    const cacheKey = `${lang}:${_getStructuredCacheSignature(s)}`;
    if (_recommendationCache && _recommendationCacheKey === cacheKey) return _clone(_recommendationCache);
    const d = s.current; const risk=d.wellbeing.risk, w=d.wellbeing.score, em=d.emotion.name;
    let message='', actions=[];
    if (risk>0.7){
      message=lang!=='en'?'ความเครียดและความเสี่ยงสูงมาก ควรหยุดพักทันที':'Very high stress. Immediate break recommended.';
      actions=lang!=='en'?[{type:'breathing',name:'หายใจลึก ๆ 5 ครั้ง',duration:60},{type:'break',name:'หยุดพัก 5-10 นาที',duration:300},{type:'walk',name:'เดินเปลี่ยนบรรยากาศ',duration:300}]
                         :[{type:'breathing',name:'Deep breathing (5x)',duration:60},{type:'break',name:'5-10 min break',duration:300},{type:'walk',name:'Short walk',duration:300}];
    } else if(risk>0.5){
      message=lang!=='en'?'ความเครียดระดับปานกลาง':'Moderate stress.';
      actions=lang!=='en'?[{type:'breathing',name:'หายใจลึก ๆ 3 ครั้ง',duration:30},{type:'stretch',name:'ยืดเส้น',duration:60},{type:'hydrate',name:'ดื่มน้ำ',duration:30}]
                         :[{type:'breathing',name:'Deep breathing (3x)',duration:30},{type:'stretch',name:'Stretch',duration:60},{type:'hydrate',name:'Drink water',duration:30}];
    } else if(w<0.4){
      message=lang!=='en'?'คุณดูเหนื่อยหรือเครียด ลองหากิจกรรมที่ชอบ':'You seem tired.';
      actions=lang!=='en'?[{type:'music',name:'ฟังเพลง',duration:180},{type:'talk',name:'พูดคุยกับคนใกล้ตัว',duration:300}]
                         :[{type:'music',name:'Listen to music',duration:180},{type:'talk',name:'Talk to someone',duration:300}];
    } else if(em==='FLOW'){
      message=lang!=='en'?'คุณอยู่ในภาวะลื่นไหล ช่วงประสิทธิภาพสูงสุด':'Flow state! Peak performance.';
      actions=lang!=='en'?[{type:'continue',name:'ทำงานต่อเนื่อง',duration:0}]:[{type:'continue',name:'Keep working',duration:0}];
    } else if(em==='FATIGUE'){
      message=lang!=='en'?'เริ่มเหนื่อยแล้ว ควรพักสักหน่อย':'Signs of fatigue.';
      actions=lang!=='en'?[{type:'nap',name:'งีบ 15-20 นาที',duration:900},{type:'break',name:'พักสายตา 5 นาที',duration:300}]
                         :[{type:'nap',name:'15-20 min power nap',duration:900},{type:'break',name:'Rest eyes 5 min',duration:300}];
    } else if(d.cognitive.load.status==='overload'){
      message=lang!=='en'?'สมองทำงานหนักเกินไป':'Cognitive overload.';
      actions=lang!=='en'?[{type:'simplify',name:'ลดความซับซ้อนของงาน',duration:0},{type:'break',name:'พัก 5 นาที',duration:300}]
                         :[{type:'simplify',name:'Simplify task',duration:0},{type:'break',name:'5 min break',duration:300}];
    } else {
      message=lang!=='en'?'สภาวะโดยรวมปกติดี':'Overall condition normal.';
      actions=lang!=='en'?[{type:'maintain',name:'ทำงานต่อไป',duration:0}]:[{type:'maintain',name:'Continue',duration:0}];
    }
    _recommendationCache = {
      message,
      actions: _decorateRecommendedActions(actions),
      languageStandard: _getPhasaTawanSpecStatus(),
      signalProfile: _buildPhasaTawanSignalProfile(s),
    };
    _recommendationCacheKey = cacheKey;
    return _clone(_recommendationCache);
  };

  // ==========================================================================
  // LEVEL 5: Q&A (unchanged from v2.x + new 'insight' intent)
  // ==========================================================================

  const _questionPatterns = {
    feeling:  ['รู้สึก','feel','เป็นไง','how are','เป็นยังไง','status'],
    stress:   ['เครียด','stress','กังวล','anxious','worried'],
    energy:   ['พลังงาน','energy','เหนื่อย','tired','fatigue'],
    focus:    ['โฟกัส','focus','สมาธิ','attention','concentrate'],
    recommend:['แนะนำ','recommend','ควรทำ','should','suggestion'],
    why:      ['ทำไม','why','เกิดอะไร','what happened','cause'],
    source:   ['source','wearable','simu','simulator','datasource','แหล่งข้อมูล'],
    insight:  ['insight','สรุป','วิเคราะห์','แนวโน้ม','trend','peak','pattern'],
    tick:     ['tick','sampling','rate','battery','cpu','mode'],                   // 
    standard: ['phasa','tawan','signal language','standard','namespace','token','act.','ps.','ns.','bs.'],
  };

  const _detectQuestionIntent = (q) => {
    const ql = q.toLowerCase();
    for (const [intent, pats] of Object.entries(_questionPatterns))
      for (const p of pats) if (ql.includes(p)) return intent;
    return 'general';
  };

  const _answerQuestion = (question) => {
    const s = _getStructured(); if (s.error) return `[Error] ${s.error}`;
    const intent = _detectQuestionIntent(question);
    const lang   = _detectLanguage();
    const d      = s.current;
    _pushMemoryEntry('userQueries', { timestamp:_nowSec(), question, intent });

    switch(intent) {
      case 'feeling':
        return lang!=='en'
          ? `ตอนนี้คุณกำลัง${d.emotion.nameThai}อยู่ (intensity: ${d.emotion.intensity===0.8?'สูง':d.emotion.intensity===0.6?'ปานกลาง':'ต่ำ'})`
          : `Feeling ${d.emotion.name.toLowerCase()} (intensity: ${d.emotion.intensity===0.8?'high':d.emotion.intensity===0.6?'moderate':'low'}).`;
      case 'stress': {
        const sl = d.emotion.name==='STRESS'?0.8:d.emotion.name==='ANXIETY'?0.6:d.emotion.name==='FRUSTRATION'?0.5:0.2;
        return lang!=='en'
          ? `ระดับเครียด ${(sl*100).toFixed(0)}% - HR ${d.physiology.hr.value} bpm, GSR ${d.physiology.gsr.value} µS`
          : `Stress ${(sl*100).toFixed(0)}% - HR ${d.physiology.hr.value} bpm`;
      }
      case 'energy': {
        const el = 1-(d.cognitive.load.value*0.5)-(d.emotion.name==='FATIGUE'?0.3:0);
        return lang!=='en'
          ? `พลังงาน ${(el*100).toFixed(0)}% - Cog Load ${(d.cognitive.load.value*100).toFixed(0)}%`
          : `Energy ${(el*100).toFixed(0)}% - Cog Load ${(d.cognitive.load.value*100).toFixed(0)}%`;
      }
      case 'focus':
        return lang!=='en'
          ? `สมาธิ ${(d.cognitive.attention*100).toFixed(0)}%, Error rate ${(d.cognitive.errorRisk*100).toFixed(0)}%`
          : `Attention ${(d.cognitive.attention*100).toFixed(0)}%`;
      case 'recommend': return _getRecommendation().message;
      case 'why':
        return lang!=='en'
          ? `สภาวะ${d.emotion.nameThai}เกิดจาก Cog Load ${(d.cognitive.load.value*100).toFixed(0)}% ร่วมกับสัญญาณชีพที่เปลี่ยนไป`
          : `${d.emotion.name} caused by cog load ${(d.cognitive.load.value*100).toFixed(0)}% and physiological changes.`;
      case 'source':
        return `DataSource: ${_sourceMode.toUpperCase()}. Baseline: ${isCalibrated()?'Personal':'Static'}. Labels: ${_labelHistory.length}. personalWeight=${PERSONAL_WEIGHT.toFixed(2)}.`;
      case 'insight':
        return lang!=='en'
          ? `กำลังสร้าง insights... ใช้ NuengdeawCore.generateInsights() เพื่อดูผล`
          : `Use NuengdeawCore.generateInsights() to view human-readable insights.`;
      case 'tick':
        return `AdaptiveTick mode: ${_tickMode} (${TICK_MODES[_tickMode]}ms). stableCount: ${_stableTickCount}.`;
      case 'standard': {
        const standard = _getPhasaTawanSpecStatus();
        const signalProfile = _buildPhasaTawanSignalProfile(s);
        const prefixes = signalProfile.namespacesAvailable.join(' ');
        return lang!=='en'
          ? `มาตรฐานภาษา: ${standard.standardName} v${standard.version || 'draft'} (${standard.loadStateLabel}). supportive-only, confidence floor ${signalProfile.confidenceFloor.toFixed(2)}, namespaces ${prefixes}.`
          : `Language standard: ${standard.standardName} v${standard.version || 'draft'} (${standard.loadStateLabel}). supportive-only, confidence floor ${signalProfile.confidenceFloor.toFixed(2)}, namespaces ${prefixes}.`;
      }
      default:
        return lang!=='en'
          ? `ขณะนี้อยู่ในสภาวะ${d.emotion.nameThai} Wellbeing ${(d.wellbeing.score*100).toFixed(0)}% Risk ${(d.wellbeing.risk*100).toFixed(0)}%`
          : `State: ${d.emotion.name}. Wellbeing ${(d.wellbeing.score*100).toFixed(0)}%`;
    }
  };

  // ==========================================================================
  // IMPORTANT EVENT DETECTION  [feedback check]
  // ==========================================================================

  const _detectImportantEvents = () => {
    const s = _getStructured(); if (s.error) return;
    const currentState = s.current.emotion.name;
    const risk         = s.current.wellbeing.risk;

    _persistTick(s);

    if (currentState !== _lastProcessedState) {
      _callbacks.onStateChange.forEach(cb => { try { cb({ from:_lastProcessedState, to:currentState, risk }); } catch(e) {} });
      _pushMemoryEntry('stateHistory', { timestamp:_nowSec(), from:_lastProcessedState, to:currentState }, _nowSec() - _config.historyRetention);
      _fireConsumers('stateChange', { from:_lastProcessedState, to:currentState, risk, structured:s });
    }

    if (currentState==='STRESS') {
      _stressAccumulator++;
      if (_stressAccumulator >= 5) {
        _callbacks.onStressSpike.forEach(cb => { try { cb({ duration:_stressAccumulator, risk }); } catch(e) {} });
        _fireConsumers('stressSpike', { duration:_stressAccumulator, risk, structured:s });
      }
    } else { _stressAccumulator = 0; }

    if (currentState==='FLOW') {
      _flowDuration++;
      if (_flowDuration === 10) {
        _callbacks.onFlowState.forEach(cb => { try { cb({ duration:_flowDuration }); } catch(e) {} });
        _fireConsumers('flowState', { duration:_flowDuration, structured:s });
      }
    } else { _flowDuration = 0; }

    if (risk > _config.importantThreshold) {
      const last = _contextMemory.events[_contextMemory.events.length-1];
      if (!last || last.timestamp < _nowSec()-30) {
        const ev = { timestamp:_nowSec(), type:'important_risk', level:risk, state:currentState };
        _pushMemoryEntry('events', ev, _nowSec() - _config.historyRetention);
        _persistEvent(ev);
        if (_config.autoNotify) {
          _callbacks.onImportantEvent.forEach(cb => { try { cb({ type:'high_risk', level:risk, state:currentState }); } catch(e) {} });
          _fireConsumers('importantEvent', { type:'high_risk', level:risk, state:currentState, structured:s });
        }
      }
    }

    const cutoff = _nowSec() - _config.historyRetention;
    _trimMemoryEntries('events', cutoff);
    _trimMemoryEntries('stateHistory', cutoff);
    _lastProcessedState   = currentState;

    // ---
    _tickFeedbackCheck(s);
  };

  const ingestExternalSession = (record = {}) => {
    const db = _db();
    if (!db) return _result(false, { error:'DB not loaded' });

    const safe = {
      ts: Number.isFinite(record.ts) ? record.ts : Date.now(),
      state: String(record.state || 'NEUTRAL'),
      cogLoad: Number.isFinite(record.cogLoad) ? record.cogLoad : 0,
      hr: Number.isFinite(record.hr) ? record.hr : 0,
      hrv: Number.isFinite(record.hrv) ? record.hrv : 0,
      gsr: Number.isFinite(record.gsr) ? record.gsr : 0,
      wellbeing: Number.isFinite(record.wellbeing) ? record.wellbeing : 0,
      risk: Number.isFinite(record.risk) ? record.risk : 0,
      sourceMode: record.sourceMode || _sourceMode,
    };

    const writeSessionResult = _safeDbWrite('db.writeSession.external', () => db.writeSession(safe));
    _safeDbWrite('db.writeEvent.external', () => db.writeEvent({
      ts: safe.ts,
      type: 'external_session_ingest',
      state: safe.state,
      sourceMode: safe.sourceMode,
    }));
    _pushMemoryEntry('events', { timestamp: _nowSec(), type: 'external_session_ingest', state: safe.state }, _nowSec() - _config.historyRetention);

    if (writeSessionResult && writeSessionResult.success === false) return writeSessionResult;
    return _result(true, { session: safe });
  };

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  const init = (config = {}) => {
    // ---
    if (_isInitialized) {
      _logger.warn('CORE_INIT_DUPLICATE', '[NuengdeawCore] init() called again - skipped');
      return { success:false, message:'Already initialized' };
    }
    _config      = { ..._config, ...config };
    _isInitialized = true;
    // ---
    _stopTickLoop();
    if (_config.realtimeMode !== 'ondemand') {
      _initVisibilityHandler();
      _initBeforeUnload();
      _isPaused  = false;
      _tickMode  = 'ACTIVE';
      _startTickLoop();
    }
    _loadPhasaTawanSpec().catch(() => {});
    _logger.info('CORE_INIT_READY', '[NuengdeawCore] init ready', {
      sourceMode: _sourceMode,
      baselineMode: isCalibrated() ? 'personal' : 'static',
      tickMode: _tickMode,
    });
    return { success:true, message:'NuengdeawCore initialized' };
  };

  const bootstrap = (config = {}) => {
    if (!_isInitialized) return init(config);
    _loadPhasaTawanSpec().catch(() => {});
    if (typeof NuengdeawDB !== 'undefined' && NuengdeawDB.ready) {
      NuengdeawDB.ready().then(_hydrateFromDB).catch(() => {});
    }
    return { success:true, message:'NuengdeawCore already running', alreadyRunning:true };
  };

  return {
    // Core
    init,
    bootstrap,
    getRaw:            () => _getRaw(),
    getStructured:     () => _getStructured(),
    getSnapshot:       () => _getStructured(),
    getInterpretation: () => _getInterpretation(),
    getRecommendation: () => _getRecommendation(),
    ingestExternalSession,
    ask:               (q) => _answerQuestion(q),
    getFullContext:    () => ({
      raw:            _getRaw(),
      structured:     _getStructured(),
      interpretation: _getInterpretation(),
      recommendation: _getRecommendation(),
      languageStandard: _getPhasaTawanSpec(),
      languageStandardStatus: _getPhasaTawanSpecStatus(),
      baseline:       getBaseline(),
      adaptiveAT:     getAdaptiveAT(),
      sourceMode:     _sourceMode,
      tickMode:       _tickMode,
    }),
    loadLanguageStandard: (force = false) => _loadPhasaTawanSpec(force),
    getLanguageStandard: () => _getPhasaTawanSpec(),
    getLanguageStandardStatus: () => _getPhasaTawanSpecStatus(),
    validateLanguageToken: (token) => _validatePhasaTawanToken(token),
    validateLanguagePayload: (payload) => _validatePhasaTawanRuntimePayload(payload),

    // DataSource
    useSimulatedHumanSource,
    useWearable,
    getSourceMode,
    getHumanSimLifecycleStatus: () => _humanSimLifecycle && typeof _humanSimLifecycle.getStatus === 'function'
      ? _humanSimLifecycle.getStatus()
      : null,
    extendHumanSimLife: (days = 1) => _humanSimLifecycle && typeof _humanSimLifecycle.extendLife === 'function'
      ? _humanSimLifecycle.extendLife({ days })
      : { success:false, error:'HumanSimLifecycle not loaded' },
    retireHumanSimNow: () => _humanSimLifecycle && typeof _humanSimLifecycle.retireNow === 'function'
      ? _humanSimLifecycle.retireNow()
      : { success:false, error:'HumanSimLifecycle not loaded' },
    reportWearableDisconnected: (reason = 'manual_report') => _humanSimLifecycle && typeof _humanSimLifecycle.disconnectWearable === 'function'
      ? _humanSimLifecycle.disconnectWearable({ reason })
      : { success:false, error:'HumanSimLifecycle not loaded' },

    // Consumer Registry
    registerConsumer: (name, fn) => {
      if (typeof name!=='string'||!name) return { success:false, error:'name must be non-empty string' };
      if (typeof fn!=='function')        return { success:false, error:'fn must be a function' };
      _consumers.set(name, fn);
      return { success:true, name, totalConsumers:_consumers.size };
    },
    unregisterConsumer: (name) => {
      const existed = _consumers.delete(name);
      return { success:existed, name, totalConsumers:_consumers.size };
    },
    subscribe: (name, fn, options = {}) => {
      if (typeof name!=='string'||!name) return { success:false, error:'name must be non-empty string' };
      if (typeof fn!=='function')        return { success:false, error:'fn must be a function' };
      _consumers.set(name, fn);
      if (options.immediate) {
        try { fn('snapshot', { structured:_getStructured() }); } catch(e) {}
      }
      return { success:true, name, totalConsumers:_consumers.size };
    },
    listConsumers:  () => [..._consumers.keys()],
    fireConsumers:  (eventType, context) => _fireConsumers(eventType, context),

    // DB passthrough
    db: {
      ready:           () => _db() ? NuengdeawDB.ready()                    : Promise.resolve(),
      isReady:         () => !!_db(),
      writeSession:    (record) => _db() ? NuengdeawDB.writeSession(record) : { success:false, error:'DB not loaded' },
      writeEvent:      (record) => _db() ? NuengdeawDB.writeEvent(record)   : { success:false, error:'DB not loaded' },
      readSessions:    (n) => _db() ? NuengdeawDB.readSessions(n)           : Promise.resolve([]),
      readEvents:      (n) => _db() ? NuengdeawDB.readEvents(n)             : Promise.resolve([]),
      readSessionsByDay:(d)=> _db() ? NuengdeawDB.readSessionsByDay(d)      : Promise.resolve([]),
      readSemantic:    ()  => _db() ? NuengdeawDB.readLatestSemanticSnapshot(): Promise.resolve(null),
      readLabels:      (n) => _db() ? NuengdeawDB.readLabels(n)             : Promise.resolve([]),  // 
      downloadCSV:     (d) => _db() ? NuengdeawDB.downloadCSV(d)            : Promise.reject(new Error('DB not loaded')),
      downloadJSON:    (d) => _db() ? NuengdeawDB.downloadJSON(d)           : Promise.reject(new Error('DB not loaded')),
      stats:           ()  => _db() ? NuengdeawDB.getStorageStats()         : Promise.resolve({ ready:false }),
      storageMode:     ()  => _db() ? NuengdeawDB.getStorageMode()          : 'unavailable',
      nuke:            ()  => _db() ? NuengdeawDB.nuke()                    : Promise.resolve(),
      setRetention:    (s,d)=>_db() ? NuengdeawDB.setRetention(s,d)         : { success:false, error:'DB not loaded' },
      getRetention:    ()  => _db() ? NuengdeawDB.getRetention()            : {},
    },

    // Baseline
    addCalibrationSample,
    finalizeCalibration,
    isCalibrated,
    getBaseline,
    getAdaptiveAT,
    resetBaseline: () => {
      _baseline = null; _pendingCalibSamples = [];
      PERSONAL_WEIGHT = 0.6; STATIC_WEIGHT = 0.4;
      _labelHistory = []; _confirmStreak = 0;
      _dbHydrated = false;
      Object.keys(_calibEMA).forEach(k => delete _calibEMA[k]);
      try { localStorage.removeItem(LS_KEY); } catch(e) {}
    },

    //  Sensor Validator
    setSensorProfile,
    validateSensor,
    getSensorProfile: () => _sensorProfile,

    //  Feedback / Calibration
    setFeedbackCallback,
    submitFeedback,
    getCalibrationStats,
    getLastError: () => _lastError ? { ..._lastError } : null,

    //  Insight Engine
    generateInsights,

    //  Adaptive Tick
    getTickMode:   () => _tickMode,
    isPaused:      () => _isPaused,
    pause:         () => {
      _isPaused = true;
      _stopTickLoop();
      return { success:true, paused:true };
    },
    resume:        () => {
      if (!_isInitialized) return { success:false, error:'Core not initialized' };
      _isPaused = false;
      _rescheduleMainLoop();
      return { success:true, paused:false, mode:_tickMode };
    },
    forceTickMode: (mode) => {
      if (!TICK_MODES[mode]) return { success:false, error:'Unknown tick mode' };
      _tickMode = mode; _stableTickCount = 0;
      _rescheduleMainLoop();
      return { success:true, mode };
    },

    // History & memory
    getHistory: (type='all') => {
      if (type==='events')  return [..._contextMemory.events];
      if (type==='states')  return [..._contextMemory.stateHistory];
      if (type==='queries') return [..._contextMemory.userQueries];
      return { events:[..._contextMemory.events], states:[..._contextMemory.stateHistory], queries:[..._contextMemory.userQueries] };
    },
    clearHistory: () => {
      _contextMemory = { events:[], conversations:[], stateHistory:[], userQueries:[], lastInteraction:null };
      _invalidateCache();
      return { success:true };
    },

    // Config
    getConfig: () => ({ ..._config }),
    setConfig: (c) => {
      _config = { ..._config, ...c };
      _invalidateCache();
      return { success:true };
    },

    // Callbacks
    on:  (event, cb) => { if (_callbacks[event]) { _callbacks[event].push(cb); return { success:true, event }; } return { success:false, error:`Unknown: ${event}` }; },
    off: (event, cb) => { if (_callbacks[event]) { const i=_callbacks[event].indexOf(cb); if(i>-1)_callbacks[event].splice(i,1); } return { success:true }; },
    checkNow: () => { _detectImportantEvents(); return _getStructured(); },

    // Status
    getStatus: () => ({
      initialized:          _isInitialized,
      sourceMode:           _sourceMode,
      calibrated:           isCalibrated(),
      pendingCalibSamples:  _pendingCalibSamples.length,
      consumers:            [..._consumers.keys()],
      dbReady:              !!_db(),
      dbStorageMode:        _db() ? NuengdeawDB.getStorageMode() : 'unavailable',
      tickMode:             _tickMode,             // 
      paused:               _isPaused,
      stableTickCount:      _stableTickCount,      // 
      sensorProfile:        _sensorProfile,        // 
      calibrationLabels:    _labelHistory.length,  // 
      personalWeight:       +PERSONAL_WEIGHT.toFixed(3),  // 
      humanSimLifecycle:    _humanSimLifecycle && typeof _humanSimLifecycle.getStatus === 'function' ? _humanSimLifecycle.getStatus() : null,
      languageStandard:     _getPhasaTawanSpecStatus(),
      config:               _config,
      memorySize: {
        events:  _contextMemory.events.length,
        states:  _contextMemory.stateHistory.length,
        queries: _contextMemory.userQueries.length,
      },
      lastEvent: _contextMemory.events[_contextMemory.events.length-1] || null,
    }),
  };
})();

// ============================================================================
// BROWSER EXPORT
// ============================================================================

if (typeof window !== 'undefined') {
  window.NuengdeawCore = NuengdeawCore;
  if (typeof NuengdeawDB !== 'undefined') {
    NuengdeawDB.ready()
      .then(() => console.log('[NuengdeawCore] น้องหนึ่งเดียว AI connected -', NuengdeawDB.getStorageMode()))
      .catch(() => console.warn('[NuengdeawCore] น้องหนึ่งเดียว AI DB fallback active'));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawCore;
}

console.log('NuengdeawCore.js loaded - AdaptiveTick + SensorValidator + FeedbackLoop + InsightEngine');



