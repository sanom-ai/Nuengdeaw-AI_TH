'use strict';
// น้องหนึ่งเดียวAIโดย2026ตะวัน

// ============================================================================
// NUENGDEAW DB — Persistent Storage Layer
// ============================================================================
// CHANGELOG:
//   [+] StorageFallback     — _storageMode: 'idb' | 'ls' | 'memory'
//                             Incognito/blocked IDB → localStorage → in-memory
//   [+] CryptoEngine        — AES-GCM 256-bit encryption ผ่าน Web Crypto API
//                             key derive จาก deviceId ผ่าน PBKDF2
//                             fallback: ถ้า crypto unavailable จะ store plaintext
//   [+] Configurable Retention — setRetention(store, days) / getRetention()
//                             prune ทุก boot + daily interval (24h)
//   [+] labels store        — Ground Truth feedback records
//                             { ts, predictedState, confirmedState, confidence,
//                               bioSnapshot, source:'user'|'auto' }
//   [~] _deleteRange()      — ใช้ index scan แทน IDBKeyRange bound ที่ error
//                             ได้กับ store ที่ไม่มี 'ts' index (semantic/export)
//   [~] nuke()              — ล้าง labels store ด้วย
//
// Architecture (unchanged):
//   localStorage  — fast cache: baseline, config, memory fallback (sync, <5 KB)
//   IndexedDB     — long-term: sessions, events, semantic, export, labels (async)
//
// Load order:
//   <script src="nuengdeaw_simu.js"></script>
//   <script src="NuengdeawDB.js"></script>
//   <script src="NuengdeawCore.js"></script>
// ============================================================================

const NuengdeawDB = (() => {

  // ==========================================================================
  // CONFIG
  // ==========================================================================

  const DB_NAME    = 'nuengdeaw_v2';   // bump version ให้ onupgradeneeded รัน
  const DB_VERSION = 2;
  const STORES = {
    sessions: { keyPath:'id', autoIncrement:true },
    events:   { keyPath:'id', autoIncrement:true },
    semantic: { keyPath:'key' },
    export:   { keyPath:'id', autoIncrement:true },
    labels:   { keyPath:'id', autoIncrement:true },  // [ground truth]
  };

  // Default retention (days) — user-configurable via setRetention()
  let _retentionDays = {
    sessions: 7,
    events:   7,
    semantic: 30,
    export:   3,
    labels:   90,   // labels เก็บนานเพราะใช้ train calibration
  };

  const LS = {
    BASELINE:  'nuengdeaw_baseline_v2',
    CONFIG:    'nuengdeaw_db_config',
    CACHE:     'nuengdeaw_cache_v2',
    DEVICE_ID: 'nuengdeaw_device_id',
    RETENTION: 'nuengdeaw_retention_v2',
    SECURITY:  'nuengdeaw_security_v1',
    CONSENT:   'nuengdeaw_consent_v1',
    AUDIT:     'nuengdeaw_audit_v1',
  };

  const ERROR_CODES = {
    DB_WRITE_FAILED: 'DB_WRITE_FAILED',
    DB_BOOT_FAILED: 'DB_BOOT_FAILED',
    DB_EXPORT_BLOCKED: 'DB_EXPORT_BLOCKED',
    DB_AUTH_REQUIRED: 'DB_AUTH_REQUIRED',
    DB_DECRYPT_FAILED: 'DB_DECRYPT_FAILED',
    DB_DELETE_FAILED: 'DB_DELETE_FAILED',
    DB_INVALID_CONSENT: 'DB_INVALID_CONSENT',
  };

  // ==========================================================================
  // STATE
  // ==========================================================================

  let _db          = null;
  let _ready       = false;
  let _readyErr    = null;
  let _readyCbs    = [];
  let _storageMode = 'memory';   // 'idb' | 'ls' | 'memory'
  let _writeBuf    = { sessions:[], events:[], labels:[] };
  let _flushTimer  = null;
  let _pruneTimer  = null;
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
  const _errorResult = (scope, error, code = ERROR_CODES.DB_WRITE_FAILED, context = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));
    _logger.warn(code, `[NuengdeawDB] ${scope}: ${err.message}`, { scope, storageMode: _storageMode, ...context });
    return _result(false, { error: err.message, code, scope, storageMode: _storageMode });
  };

  // ==========================================================================
  // CRYPTO ENGINE — AES-GCM 256-bit
  // ==========================================================================

  let _cryptoKey   = null;  // CryptoKey object หรือ null ถ้า unavailable
  let _cryptoBinding = 'none';
  let _securityState = {
    authMode: 'passphrase',
    exportRequiresAuth: true,
    secretBound: false,
    unlocked: false,
    lastUnlockedAt: null,
  };
  let _consentState = {
    physiological: true,
    cognitive: true,
    emotional: true,
    semantic: true,
    export: true,
  };

  const _clone = (value) => {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  };
  const _audit = (action, details = {}) => {
    const entry = {
      ts: _now(),
      action,
      storageMode: _storageMode,
      details: _clone(details),
    };
    try {
      const raw = localStorage.getItem(LS.AUDIT);
      const audit = raw ? JSON.parse(raw) : [];
      audit.push(entry);
      while (audit.length > 200) audit.shift();
      localStorage.setItem(LS.AUDIT, JSON.stringify(audit));
    } catch (_) {}
    _logger.info('AUDIT_EVENT', `[NuengdeawDB] audit:${action}`, entry);
    return entry;
  };
  const _loadSecurityState = () => {
    try {
      const savedSecurity = localStorage.getItem(LS.SECURITY);
      if (savedSecurity) _securityState = { ..._securityState, ...JSON.parse(savedSecurity) };
      const savedConsent = localStorage.getItem(LS.CONSENT);
      if (savedConsent) _consentState = { ..._consentState, ...JSON.parse(savedConsent) };
    } catch (_) {}
  };
  const _saveSecurityState = () => {
    try {
      localStorage.setItem(LS.SECURITY, JSON.stringify(_securityState));
      localStorage.setItem(LS.CONSENT, JSON.stringify(_consentState));
    } catch (_) {}
  };
  const _hasRequiredConsent = (types = []) => types.every((type) => _consentState[type] !== false);
  const _requireExportAccess = () => {
    if (!_consentState.export) {
      return _result(false, {
        error: 'Export consent is required',
        code: ERROR_CODES.DB_INVALID_CONSENT,
      });
    }
    if (_securityState.exportRequiresAuth && _securityState.secretBound && !_securityState.unlocked) {
      return _result(false, {
        error: 'Authentication required before export',
        code: ERROR_CODES.DB_AUTH_REQUIRED,
      });
    }
    return _result(true);
  };
  const _requireSensitiveReadAccess = (types = []) => {
    if (!_hasRequiredConsent(types)) {
      return _result(false, {
        error: 'Consent is required for this data type',
        code: ERROR_CODES.DB_INVALID_CONSENT,
      });
    }
    if (_securityState.secretBound && !_securityState.unlocked) {
      return _result(false, {
        error: 'Authentication required before reading sensitive data',
        code: ERROR_CODES.DB_AUTH_REQUIRED,
      });
    }
    return _result(true);
  };

  const _cryptoApi = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) return window.crypto;
    return null;
  };

  const _hasCrypto = () => {
    const cryptoApi = _cryptoApi();
    return !!(cryptoApi && typeof cryptoApi.subtle.importKey === 'function');
  };

  const _getOrCreateDeviceId = () => {
    try {
      let id = localStorage.getItem(LS.DEVICE_ID);
      if (!id) {
        // UUID v4 simple
        id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        localStorage.setItem(LS.DEVICE_ID, id);
      }
      return id;
    } catch(e) {
      return 'fallback-device-id';
    }
  };

  const _deriveCryptoKey = async (secret) => {
    if (!_hasCrypto()) return null;
    try {
      const cryptoApi = _cryptoApi();
      const enc      = new TextEncoder();
      const keySeed  = typeof secret === 'string' && secret.trim()
        ? secret.trim()
        : _getOrCreateDeviceId();
      const keyMat   = await cryptoApi.subtle.importKey(
        'raw', enc.encode(keySeed), { name:'PBKDF2' }, false, ['deriveKey']
      );
      const salt = enc.encode('nuengdeaw-salt-v2');
      const derivedKey = await cryptoApi.subtle.deriveKey(
        { name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' },
        keyMat,
        { name:'AES-GCM', length:256 },
        false,
        ['encrypt', 'decrypt']
      );
      _cryptoBinding = typeof secret === 'string' && secret.trim() ? 'secret-bound' : 'device-bound-legacy';
      _securityState.secretBound = _cryptoBinding === 'secret-bound';
      _securityState.unlocked = _securityState.secretBound;
      _securityState.lastUnlockedAt = _securityState.unlocked ? _now() : _securityState.lastUnlockedAt;
      return derivedKey;
    } catch(e) {
      _logger.warn('DB_CRYPTO_INIT_FAILED', '[NuengdeawDB] CryptoEngine init failed', { error: e.message });
      return null;
    }
  };

  const _encrypt = async (obj) => {
    if (!_cryptoKey) return { _plain: obj };
    try {
      const cryptoApi = _cryptoApi();
      const iv   = cryptoApi.getRandomValues(new Uint8Array(12));
      const data = new TextEncoder().encode(JSON.stringify(obj));
      const buf  = await cryptoApi.subtle.encrypt({ name:'AES-GCM', iv }, _cryptoKey, data);
      return {
        _enc: true,
        iv:   Array.from(iv),
        data: Array.from(new Uint8Array(buf)),
      };
    } catch(e) {
      return { _plain: obj };
    }
  };

  const _decrypt = async (stored) => {
    if (!stored) return stored;
    // plaintext fallback (crypto unavailable หรือ encrypt ล้มเหลว)
    if (stored._plain !== undefined) return stored._plain;
    if (!stored._enc || !_cryptoKey) return stored;
    try {
      const cryptoApi = _cryptoApi();
      const iv   = new Uint8Array(stored.iv);
      const data = new Uint8Array(stored.data);
      const buf  = await cryptoApi.subtle.decrypt({ name:'AES-GCM', iv }, _cryptoKey, data);
      return JSON.parse(new TextDecoder().decode(buf));
    } catch(e) {
      _logger.warn(ERROR_CODES.DB_DECRYPT_FAILED, '[NuengdeawDB] decrypt failed for record', { error: e.message });
      return null;
    }
  };

  // ==========================================================================
  // RETENTION HELPERS
  // ==========================================================================

  const _retentionMS = (store) => (_retentionDays[store] ?? 7) * 24 * 3600 * 1000;

  // Load persisted retention config
  const _loadRetention = () => {
    try {
      const raw = localStorage.getItem(LS.RETENTION);
      if (raw) Object.assign(_retentionDays, JSON.parse(raw));
    } catch(e) {}
  };

  const _saveRetention = () => {
    try { localStorage.setItem(LS.RETENTION, JSON.stringify(_retentionDays)); } catch(e) {}
  };

  // ==========================================================================
  // INDEXEDDB INIT
  // ==========================================================================

  const _open = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, opts);
          if (name === 'sessions' || name === 'events' || name === 'labels') {
            store.createIndex('ts', 'ts', { unique: false });
          }
        }
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
    req.onblocked = ()  => reject(new Error('IndexedDB blocked (another tab open?)'));
  });

  // ==========================================================================
  // BOOT — graceful 3-tier fallback
  // ==========================================================================

  const _boot = async () => {
    _loadRetention();
    _loadSecurityState();

    if (typeof window === 'undefined') {
      _storageMode = 'memory';
      _ready = true;
      _logger.info('DB_BOOT_NODE', '[NuengdeawDB] running without browser storage, memory mode only');
      return;
    }

    // Tier 1: IndexedDB
    try {
      _db          = await _open();
      _storageMode = 'idb';
      _cryptoKey   = await _deriveCryptoKey();
      _ready       = true;
      _scheduleDailyPrune();
      await _pruneOld();
      _readyCbs.forEach(cb => { try { cb(null); } catch(e) {} });
      _readyCbs = [];
      const cryptoStatus = _cryptoKey ? '+ AES-GCM encryption' : '(no crypto)';
      _logger.info('DB_BOOT_IDB_READY', `[NuengdeawDB] IndexedDB ready ${cryptoStatus}`, { storageMode: _storageMode, cryptoBinding: _cryptoBinding });
      return;
    } catch(err) {
      _logger.warn(ERROR_CODES.DB_BOOT_FAILED, '[NuengdeawDB] IndexedDB failed, trying localStorage', { error: err.message });
    }

    // Tier 2: localStorage
    try {
      // ทดสอบว่า localStorage เขียนได้จริง
      const testKey = '__nuengdeaw_ls_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      _storageMode = 'ls';
      _readyErr    = new Error('IndexedDB unavailable — using localStorage');
      _ready       = true;
      _readyCbs.forEach(cb => { try { cb(_readyErr); } catch(e) {} });
      _readyCbs    = [];
      _logger.warn('DB_BOOT_LS_FALLBACK', '[NuengdeawDB] localStorage fallback active', { storageMode: _storageMode });
      return;
    } catch(err) {
      _logger.warn(ERROR_CODES.DB_BOOT_FAILED, '[NuengdeawDB] localStorage failed, switching to memory', { error: err.message });
    }

    // Tier 3: in-memory
    _storageMode = 'memory';
    _readyErr    = new Error('All storage unavailable — in-memory only (data lost on reload)');
    _ready       = true;
    _readyCbs.forEach(cb => { try { cb(_readyErr); } catch(e) {} });
    _readyCbs    = [];
    _logger.warn('DB_BOOT_MEMORY_FALLBACK', '[NuengdeawDB] in-memory fallback active', { storageMode: _storageMode });
  };

  // In-memory store สำหรับ Tier 3
  const _memStore = { sessions:[], events:[], labels:[] };

  _boot();

  // ==========================================================================
  // IDB UTILS
  // ==========================================================================

  const _now = () => Date.now();

  const _tx = (storeName, mode = 'readonly') => {
    if (!_db) throw new Error('IDB not ready');
    return _db.transaction(storeName, mode).objectStore(storeName);
  };

  const _put = (storeName, obj) => new Promise((res, rej) => {
    const req = _tx(storeName, 'readwrite').put(obj);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  const _add = (storeName, obj) => new Promise((res, rej) => {
    const req = _tx(storeName, 'readwrite').add(obj);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  const _getAll = (storeName, count) => new Promise((res, rej) => {
    const req = count
      ? _tx(storeName).getAll(null, count)
      : _tx(storeName).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  const _get = (storeName, key) => new Promise((res, rej) => {
    const req = _tx(storeName).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  // ลบผ่าน ts index — เฉพาะ store ที่มี index 'ts'
  const _deleteOldByTs = (storeName, cutoffMs) => new Promise((res, rej) => {
    try {
      const store  = _tx(storeName, 'readwrite');
      const idx    = store.index('ts');
      const range  = IDBKeyRange.upperBound(cutoffMs);
      const req    = idx.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); } else res();
      };
      req.onerror = () => rej(req.error);
    } catch(e) { res(); } // store ไม่มี ts index → ข้ามไป
  });

  // ==========================================================================
  // PRUNE OLD RECORDS
  // ==========================================================================

  const _pruneOld = async () => {
    if (!_db) return;
    const now = _now();
    for (const store of ['sessions', 'events', 'labels']) {
      try { await _deleteOldByTs(store, now - _retentionMS(store)); } catch(e) {}
    }
    // semantic: เก็บ 30 snapshots ล่าสุด (ไม่ใช้ ts-based)
    try {
      const all  = await _getAll('semantic');
      const hist = all.filter(x => x.key.startsWith('snap_')).sort((a,b) => a.ts - b.ts);
      const keep = Math.max(0, hist.length - 30);
      for (const old of hist.slice(0, keep)) {
        try { _tx('semantic','readwrite').delete(old.key); } catch(e) {}
      }
    } catch(e) {}
  };

  const _scheduleDailyPrune = () => {
    if (_pruneTimer) clearInterval(_pruneTimer);
    _pruneTimer = setInterval(() => _pruneOld(), 24 * 3600 * 1000);
  };

  // ==========================================================================
  // MICRO-BATCH FLUSH — writes every 5s max
  // ==========================================================================

  const _scheduleFlush = () => {
    if (_flushTimer) return;
    _flushTimer = setTimeout(_flush, 5000);
  };

  const _flush = async () => {
    _flushTimer = null;
    if (_storageMode !== 'idb') return;

    const buf = {
      sessions: [..._writeBuf.sessions],
      events:   [..._writeBuf.events],
      labels:   [..._writeBuf.labels],
    };
    _writeBuf.sessions = [];
    _writeBuf.events   = [];
    _writeBuf.labels   = [];

    for (const rec of buf.sessions) {
      try {
        const payload = await _encrypt(rec);
        await _add('sessions', { ts: rec.ts, _payload: payload });
      } catch(e) {}
    }
    for (const rec of buf.events) {
      try {
        const payload = await _encrypt(rec);
        await _add('events', { ts: rec.ts, _payload: payload });
      } catch(e) {}
    }
    for (const rec of buf.labels) {
      try {
        const payload = await _encrypt(rec);
        await _add('labels', { ts: rec.ts, _payload: payload });
      } catch(e) {}
    }
  };

  // Helper: decrypt batch
  const _decryptAll = async (rows) => {
    const out = [];
    for (const row of rows) {
      if (row._payload !== undefined) {
        const dec = await _decrypt(row._payload);
        if (dec) out.push({ id: row.id, ...dec });
      } else {
        out.push(row); // legacy plaintext
      }
    }
    return out;
  };

  // ==========================================================================
  // LS FALLBACK HELPERS
  // ==========================================================================

  const _lsRead = (key, def) => {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch(e) { return def; }
  };
  const _lsWrite = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  };

  const _lsPush = (listKey, record, maxLen) => {
    const cache = _lsRead(LS.CACHE, {});
    if (!cache[listKey]) cache[listKey] = [];
    cache[listKey].push(record);
    if (cache[listKey].length > maxLen) cache[listKey].shift();
    _lsWrite(LS.CACHE, cache);
  };

  const _lsReadList = (listKey, limit) => {
    const cache = _lsRead(LS.CACHE, {});
    const list  = cache[listKey] ?? [];
    return list.slice(-limit);
  };

  const _round = (value, digits = 2) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value;
    return +value.toFixed(digits);
  };
  const _sanitizeFilenamePart = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
  const _anonymizeSession = (session = {}) => ({
    tsBucket: typeof session.ts === 'number' ? new Date(session.ts).toISOString().slice(0, 13) + ':00:00Z' : null,
    state: session.state ?? null,
    cogLoad: _round(session.cogLoad, 3),
    hr: _round(session.hr, 0),
    hrv: _round(session.hrv, 0),
    gsr: _round(session.gsr, 1),
    wellbeing: _round(session.wellbeing, 3),
    risk: _round(session.risk, 3),
    sourceMode: session.sourceMode ?? null,
  });
  const _anonymizeEvent = (event = {}) => ({
    tsBucket: typeof event.ts === 'number' ? new Date(event.ts).toISOString().slice(0, 10) : null,
    type: event.type ?? null,
    state: event.state ?? null,
    level: _round(event.level, 3),
  });
  const _anonymizeLabel = (label = {}) => ({
    tsBucket: typeof label.ts === 'number' ? new Date(label.ts).toISOString().slice(0, 10) : null,
    predictedState: label.predictedState ?? null,
    confirmedState: label.confirmedState ?? null,
    confidence: _round(label.confidence, 3),
    source: label.source ?? null,
  });
  const _anonymizeSemantic = (semantic) => {
    if (!semantic) return null;
    return {
      key: semantic.key ?? 'latest',
      tsBucket: typeof semantic.ts === 'number' ? new Date(semantic.ts).toISOString().slice(0, 10) : null,
      dataSummary: semantic.data ? Object.keys(semantic.data) : [],
    };
  };
  const _anonymizeExportBundle = ({ sessions, events, labels, semantic }) => ({
    sessions: sessions.map(_anonymizeSession),
    events: events.map(_anonymizeEvent),
    labels: labels.map(_anonymizeLabel),
    semantic: _anonymizeSemantic(semantic),
  });
  const _deleteStoreRange = async (storeName) => {
    if (_storageMode === 'idb' && _db) {
      await new Promise((res, rej) => {
        const req = _tx(storeName, 'readwrite').clear();
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
      return;
    }
    if (_storageMode === 'ls') {
      const cache = _lsRead(LS.CACHE, {});
      if (storeName === 'sessions' || storeName === 'events' || storeName === 'labels') {
        cache[storeName] = [];
        _lsWrite(LS.CACHE, cache);
      }
      return;
    }
    if (_memStore[storeName]) _memStore[storeName] = [];
  };

  // ==========================================================================
  // PUBLIC API — SESSIONS
  // ==========================================================================

  const writeSession = (record) => {
    try {
      if (!_hasRequiredConsent(['physiological', 'cognitive', 'emotional'])) {
        return _result(false, { error:'Consent required for session storage', code: ERROR_CODES.DB_INVALID_CONSENT });
      }
      const r = { ...record, ts: record.ts ?? _now() };
      if (_storageMode === 'idb') {
        _writeBuf.sessions.push(r);
        _scheduleFlush();
      } else if (_storageMode === 'ls') {
        _lsPush('sessions', r, 200);
      } else {
        _memStore.sessions.push(r);
        if (_memStore.sessions.length > 500) _memStore.sessions.shift();
      }
      return _result(true, { storageMode:_storageMode, record:r });
    } catch(e) {
      return _errorResult('writeSession', e);
    }
  };

  const readSessions = async (limit = 300) => {
    if (_storageMode === 'idb') {
      try {
        const raw = await _getAll('sessions');
        const dec = await _decryptAll(raw);
        return dec.sort((a,b) => a.ts - b.ts).slice(-limit);
      } catch(e) { return []; }
    }
    if (_storageMode === 'ls') return _lsReadList('sessions', limit);
    return [..._memStore.sessions].slice(-limit);
  };

  const readSessionsByDay = async (daysBack = 7) => {
    const cutoff = _now() - daysBack * 24 * 3600 * 1000;
    const all    = await readSessions(5000);
    return all.filter(r => r.ts >= cutoff);
  };

  // ==========================================================================
  // PUBLIC API — EVENTS
  // ==========================================================================

  const writeEvent = (event) => {
    try {
      if (!_hasRequiredConsent(['emotional'])) {
        return _result(false, { error:'Consent required for event storage', code: ERROR_CODES.DB_INVALID_CONSENT });
      }
      const r = { ...event, ts: event.ts ?? _now() };
      if (_storageMode === 'idb') {
        _writeBuf.events.push(r);
        _scheduleFlush();
      } else if (_storageMode === 'ls') {
        _lsPush('events', r, 100);
      } else {
        _memStore.events.push(r);
        if (_memStore.events.length > 200) _memStore.events.shift();
      }
      return _result(true, { storageMode:_storageMode, record:r });
    } catch(e) {
      return _errorResult('writeEvent', e);
    }
  };

  const readEvents = async (limit = 200) => {
    if (_storageMode === 'idb') {
      try {
        const raw = await _getAll('events');
        const dec = await _decryptAll(raw);
        return dec.sort((a,b) => a.ts - b.ts).slice(-limit);
      } catch(e) { return []; }
    }
    if (_storageMode === 'ls') return _lsReadList('events', limit);
    return [..._memStore.events].slice(-limit);
  };

  // ==========================================================================
  // PUBLIC API — LABELS (Ground Truth)  
  // ==========================================================================

  const writeLabel = (record) => {
    // record = { ts, predictedState, confirmedState, confidence, bioSnapshot, source }
    try {
      if (!_hasRequiredConsent(['physiological', 'emotional'])) {
        return _result(false, { error:'Consent required for label storage', code: ERROR_CODES.DB_INVALID_CONSENT });
      }
      const r = { ...record, ts: record.ts ?? _now() };
      if (_storageMode === 'idb') {
        _writeBuf.labels.push(r);
        _scheduleFlush();
      } else if (_storageMode === 'ls') {
        _lsPush('labels', r, 500);
      } else {
        _memStore.labels.push(r);
        if (_memStore.labels.length > 500) _memStore.labels.shift();
      }
      return _result(true, { storageMode:_storageMode, record:r });
    } catch(e) {
      return _errorResult('writeLabel', e);
    }
  };

  const readLabels = async (limit = 500) => {
    if (_storageMode === 'idb') {
      try {
        const raw = await _getAll('labels');
        const dec = await _decryptAll(raw);
        return dec.sort((a,b) => a.ts - b.ts).slice(-limit);
      } catch(e) { return []; }
    }
    if (_storageMode === 'ls') return _lsReadList('labels', limit);
    return [..._memStore.labels].slice(-limit);
  };

  const readLabelsByState = async (confirmedState, limit = 200) => {
    const all = await readLabels(2000);
    return all.filter(l => l.confirmedState === confirmedState).slice(-limit);
  };

  // ==========================================================================
  // PUBLIC API — SEMANTIC MEMORY
  // ==========================================================================

  const writeSemanticSnapshot = async (snapshot) => {
    if (!_hasRequiredConsent(['semantic'])) {
      return _result(false, { error:'Consent required for semantic storage', code: ERROR_CODES.DB_INVALID_CONSENT });
    }
    const r = { key:'latest', ts:_now(), data: snapshot };
    if (_storageMode === 'idb') {
      try {
        await _put('semantic', r);
        await _put('semantic', { key:`snap_${_now()}`, ts:_now(), data: snapshot });
        // prune extra snapshots
        const all  = await _getAll('semantic');
        const hist = all.filter(x => x.key.startsWith('snap_')).sort((a,b) => a.ts - b.ts);
        if (hist.length > 30) {
          for (const old of hist.slice(0, hist.length - 30)) {
            try { _tx('semantic','readwrite').delete(old.key); } catch(e) {}
          }
        }
      } catch(e) {}
    } else {
      try { localStorage.setItem('nuengdeaw_semantic_snap', JSON.stringify(r)); } catch(e) {}
    }
  };

  const readLatestSemanticSnapshot = async () => {
    if (_storageMode === 'idb') {
      try { return await _get('semantic', 'latest'); } catch(e) { return null; }
    }
    try {
      const raw = localStorage.getItem('nuengdeaw_semantic_snap');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  };

  // ==========================================================================
  // PUBLIC API — BASELINE
  // ==========================================================================

  const readBaseline = () => {
    try {
      const raw = localStorage.getItem(LS.BASELINE);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  };

  const writeBaseline = async (baseline) => {
    try { localStorage.setItem(LS.BASELINE, JSON.stringify(baseline)); } catch(e) {}
    if (_storageMode === 'idb') {
      try { await _put('semantic', { key:'baseline', ts:_now(), data:baseline }); } catch(e) {}
    }
  };

  const clearBaseline = () => {
    try { localStorage.removeItem(LS.BASELINE); } catch(e) {}
    if (_storageMode === 'idb') {
      try { _tx('semantic','readwrite').delete('baseline'); } catch(e) {}
    }
  };

  // ==========================================================================
  // PUBLIC API — RETENTION CONFIG  
  // ==========================================================================

  const setRetention = (store, days) => {
    if (!_retentionDays.hasOwnProperty(store)) return { success:false, error:`Unknown store: ${store}` };
    const d = Math.max(1, Math.min(365, parseInt(days) || 7));
    _retentionDays[store] = d;
    _saveRetention();
    _logger.info('DB_RETENTION_UPDATED', `[NuengdeawDB] retention: ${store} -> ${d} days`, { store, days: d });
    _audit('retention.updated', { store, days: d });
    return { success:true, store, days:d };
  };

  const getRetention = () => ({ ..._retentionDays });

  const setConsent = (nextConsent = {}) => {
    _consentState = { ..._consentState, ...nextConsent };
    _saveSecurityState();
    _audit('consent.updated', { consent: _consentState });
    return { success: true, consent: _clone(_consentState) };
  };

  const getConsent = () => _clone(_consentState);

  const unlockWithPassphrase = async (passphrase) => {
    if (typeof passphrase !== 'string' || passphrase.trim().length < 8) {
      return _result(false, { error: 'Passphrase must be at least 8 characters', code: ERROR_CODES.DB_AUTH_REQUIRED });
    }
    const key = await _deriveCryptoKey(passphrase);
    if (!key) {
      return _result(false, { error: 'Failed to derive key from passphrase', code: ERROR_CODES.DB_AUTH_REQUIRED });
    }
    _cryptoKey = key;
    _securityState.unlocked = true;
    _securityState.secretBound = true;
    _securityState.lastUnlockedAt = _now();
    _saveSecurityState();
    _audit('security.unlocked', { binding: _cryptoBinding });
    return { success: true, security: _clone(_securityState), cryptoBinding: _cryptoBinding };
  };

  const lockSecurity = () => {
    if (_cryptoBinding === 'secret-bound') {
      _cryptoKey = null;
    }
    _securityState.unlocked = false;
    _saveSecurityState();
    _audit('security.locked');
    return { success: true, unlocked: false };
  };

  const getSecurityStatus = () => ({
    ..._clone(_securityState),
    encryptionEnabled: !!_cryptoKey,
    cryptoBinding: _cryptoBinding,
  });

  const deleteUserData = async (stores = ['sessions', 'events', 'labels', 'semantic', 'export']) => {
    try {
      for (const store of stores) {
        if (!STORES[store]) continue;
        await _deleteStoreRange(store);
      }
      _audit('data.deleted', { stores });
      return { success: true, stores };
    } catch (error) {
      return _errorResult('deleteUserData', error, ERROR_CODES.DB_DELETE_FAILED, { stores });
    }
  };

  const getAuditLog = (limit = 100) => {
    const access = _requireSensitiveReadAccess(['export']);
    if (!access.success) return access;
    const audit = _lsRead(LS.AUDIT, []);
    return audit.slice(-limit);
  };

  // ==========================================================================
  // PUBLIC API — EXPORT
  // ==========================================================================

  const exportCSV = async (daysBack = 7, options = {}) => {
    const access = _requireExportAccess();
    if (!access.success) return access;
    const sessions = await readSessionsByDay(daysBack);
    const rowsSource = options.anonymize === false ? sessions : sessions.map(_anonymizeSession);
    const headers  = ['timestamp','state','cogLoad','hr','hrv','gsr','wellbeing','risk','sourceMode'];
    const rows     = rowsSource.map(r => headers.map(h =>
      h === 'timestamp'
        ? (r.ts ? new Date(r.ts).toISOString() : (r.tsBucket ?? ''))
        : (r[h] ?? '')
    ).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    if (_storageMode === 'idb') {
      try { await _add('export', { ts:_now(), rows:sessions.length, daysBack }); } catch(e) {}
    }
    _audit('data.export.csv', { daysBack, anonymized: options.anonymize !== false, rows: rowsSource.length });
    return csv;
  };

  const exportJSON = async (daysBack = 7, options = {}) => {
    const access = _requireExportAccess();
    if (!access.success) return access;
    const [sessions, events, labels, semantic] = await Promise.all([
      readSessionsByDay(daysBack),
      readEvents(500),
      readLabels(500),
      readLatestSemanticSnapshot(),
    ]);
    const payload = options.anonymize === false
      ? { sessions, events, labels, semantic }
      : _anonymizeExportBundle({ sessions, events, labels, semantic });
    _audit('data.export.json', { daysBack, anonymized: options.anonymize !== false, sessions: payload.sessions.length });
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      daysBack, storageMode: _storageMode,
      anonymized: options.anonymize !== false,
      ...payload,
    }, null, 2);
  };

  const downloadCSV = async (daysBack = 7) => {
    const csv  = await exportCSV(daysBack);
    if (typeof csv !== 'string') return csv;
    const blob = new Blob([csv], { type:'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${_sanitizeFilenamePart('nuengdeaw')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    return _result(true, { format: 'csv' });
  };

  const downloadJSON = async (daysBack = 7) => {
    const json = await exportJSON(daysBack);
    if (typeof json !== 'string') return json;
    const blob = new Blob([json], { type:'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${_sanitizeFilenamePart('nuengdeaw')}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    return _result(true, { format: 'json' });
  };

  // ==========================================================================
  // PUBLIC API — STATUS & READY
  // ==========================================================================

  const ready = () => new Promise((resolve, reject) => {
    if (_ready)    { resolve(); return; }
    if (_readyErr && _storageMode === 'memory') { resolve(); return; }
    _readyCbs.push((err) => resolve());  // always resolve, never reject boot
  });

  const isReady       = () => _ready;
  const hasIDB        = () => _storageMode === 'idb';
  const getStorageMode= () => _storageMode;

  const getStorageStats = async () => {
    const stats = {
      ready:       _ready,
      storageMode: _storageMode,
      encryption:  !!_cryptoKey,
      cryptoBinding: _cryptoBinding,
      security: _clone(_securityState),
      consent: _clone(_consentState),
      retention:   { ..._retentionDays },
      localStorage:{},
      indexedDB:   null,
      memory:      null,
    };
    try {
      const keys = [LS.BASELINE, LS.CACHE, 'nuengdeaw_semantic_snap'];
      let lsBytes = 0;
      keys.forEach(k => { const v = localStorage.getItem(k); if(v) lsBytes += v.length * 2; });
      stats.localStorage = { bytes:lsBytes, kb:+(lsBytes/1024).toFixed(1) };
    } catch(e) {}
    if (_storageMode === 'idb') {
      try {
        const [sess, evts, lbls] = await Promise.all([
          _getAll('sessions'), _getAll('events'), _getAll('labels'),
        ]);
        stats.indexedDB = { sessions:sess.length, events:evts.length, labels:lbls.length };
      } catch(e) {}
    }
    if (_storageMode === 'memory') {
      stats.memory = {
        sessions: _memStore.sessions.length,
        events:   _memStore.events.length,
        labels:   _memStore.labels.length,
      };
    }
    return stats;
  };

  const flush = async () => _flush();

  const nuke = async () => {
    if (_flushTimer) {
      clearTimeout(_flushTimer);
      _flushTimer = null;
    }
    _writeBuf.sessions = [];
    _writeBuf.events   = [];
    _writeBuf.labels   = [];
    [LS.BASELINE, LS.CONFIG, LS.CACHE, LS.RETENTION,
     'nuengdeaw_semantic_snap'].forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });
    if (_storageMode === 'idb') {
      for (const name of Object.keys(STORES)) {
        try {
          await new Promise((res,rej) => {
            const req = _tx(name,'readwrite').clear();
            req.onsuccess = () => res();
            req.onerror   = () => rej(req.error);
          });
        } catch(e) {}
      }
    }
    _memStore.sessions = [];
    _memStore.events   = [];
    _memStore.labels   = [];
    _retentionDays     = { sessions:7, events:7, semantic:30, export:3, labels:90 };
    _audit('data.nuked');
    _logger.warn('DB_DATA_NUKED', '[NuengdeawDB] all data cleared (nuke)', { storageMode: _storageMode });
  };

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  return {
    // Lifecycle
    ready,
    isReady,
    hasIDB,
    flush,
    nuke,
    getStorageStats,
    getStorageMode,

    // Sessions
    writeSession,
    readSessions,
    readSessionsByDay,

    // Events
    writeEvent,
    readEvents,

    // Labels (Ground Truth)   
    writeLabel,
    readLabels,
    readLabelsByState,

    // Semantic
    writeSemanticSnapshot,
    readLatestSemanticSnapshot,

    // Baseline
    readBaseline,
    writeBaseline,
    clearBaseline,

    // Retention config        
    setRetention,
    getRetention,
    setConsent,
    getConsent,
    unlockWithPassphrase,
    lockSecurity,
    getSecurityStatus,
    deleteUserData,
    getAuditLog,

    // Export
    exportCSV,
    exportJSON,
    downloadCSV,
    downloadJSON,

    __private: {
      anonymizeSession: _anonymizeSession,
      anonymizeEvent: _anonymizeEvent,
      anonymizeLabel: _anonymizeLabel,
      anonymizeExportBundle: _anonymizeExportBundle,
    },
  };

})();

// ============================================================================
// AUTO-EXPORT
// ============================================================================

if (typeof window !== 'undefined') {
  window.NuengdeawDB = NuengdeawDB;
  if (window.NuengdeawLogger) {
    window.NuengdeawLogger.info('DB_MODULE_LOADED', '[NuengdeawDB] loaded');
  } else {
    console.log('[NuengdeawDB] loaded — StorageFallback + CryptoEngine + Retention + Labels');
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawDB;
}
