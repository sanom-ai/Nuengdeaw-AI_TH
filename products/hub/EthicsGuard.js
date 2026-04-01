'use strict';
// น้องหนึ่งเดียวAIโดย2026ตะวัน

// ============================================================================
// EthicsGuard.js — Phasa Tawan Ethics Enforcement
// ============================================================================
// จุดประสงค์: บังคับใช้มาตรฐาน Phasa Tawan ใน runtime
//
// 4 ฟีเจอร์หลัก:
//   [1] DeceptionEngine Consent Gate  — ต้อง explicit consent ก่อนเปิด
//   [2] Access Control               — จำกัดใครดู DeceptionEngine output ได้
//   [3] Accuracy Disclaimer          — label ชัดว่าตัวเลขมาจาก simulator
//   [4] Anti-Gaming Guard            — ป้องกัน feedback ที่ไม่ซื่อสัตย์
//
// Load order:
//   <script src="js/core/HumanSim.js"></script>
//   <script src="js/core/DeceptionEngine.js"></script>  ← wrap โดย EthicsGuard
//   <script src="js/core/EthicsGuard.js"></script>      ← โหลดทีหลัง
//   <script src="js/interpreter/NuengdeawCore.js"></script>
// ============================================================================

const EthicsGuard = (() => {
  let _deceptionEngine = null;
  const _result = (success, extra = {}) => ({ success, ...extra });
  const _getEngine = () =>
    _deceptionEngine || (typeof DeceptionEngine !== 'undefined' ? DeceptionEngine : null);
  const injectDeceptionEngine = (engine) => {
    _deceptionEngine = engine || null;
    return _result(true, { hasEngine: !!_deceptionEngine });
  };

  // ==========================================================================
  // STATE
  // ==========================================================================

  const _state = {
    // [1] Consent
    deceptionConsentGranted: false,
    deceptionConsentTs:      null,
    consentVersion:          '1.0',

    // [2] Access Control
    allowedRoles: new Set(['user_self']),   // default: user เท่านั้น
    accessLog:    [],

    // [3] Accuracy
    accuracySource: 'simulator',   // 'simulator' | 'pilot_study' | 'peer_reviewed'

    // [4] Anti-Gaming
    feedbackHistory:    [],
    feedbackCooldownMs: 10_000,    // ห้าม feedback ถี่กว่า 10 วิ
    lastFeedbackTs:     0,
    streakLimit:        5,         // confirm ติดกัน > 5 ครั้ง → warn
    confirmStreak:      0,
    gamingWarnings:     0,
  };

  // ==========================================================================
  // [1] DECEPTION ENGINE CONSENT GATE
  // ==========================================================================
  // ปัญหา: ผู้ใช้อาจไม่รู้ว่าระบบวิเคราะห์ว่าตน "โกหก" อยู่
  // แก้:  ต้องกด explicit consent แยกต่างหาก ก่อน DeceptionEngine เปิดได้

  const DECEPTION_CONSENT_TEXT = {
    th: `
🔍 การวิเคราะห์พฤติกรรม Micro-Expression (DeceptionEngine)

ระบบนี้จะวิเคราะห์ว่าสัญญาณชีพของคุณ (HR, HRV, GSR, EEG)
สอดคล้องกับอารมณ์ที่คุณแสดงออกหรือไม่
รวมถึงตรวจจับการ "ซ่อนอารมณ์" (Masking) และ Micro-expression leakage

⚠️  สิ่งที่ระบบทำ:
  • ตรวจจับว่าอารมณ์ที่แสดงออกตรงกับสัญญาณชีพหรือไม่
  • คำนวณ "ความน่าจะเป็นของการ masking" ต่อ tick
  • ส่ง output นี้ให้ NuengdeawCore เท่านั้น (ไม่ถึง agent ภายนอก)

🔒  สิ่งที่ระบบ ไม่ทำ:
  • ไม่ใช้เพื่อสรุปว่าคุณ "โกหก" ใคร
  • ไม่แชร์ผลกับ employer, agent ภายนอก หรือบุคคลที่สาม
  • ไม่บันทึกใน Ready Mode หากไม่ยินยอมข้อนี้แยกต่างหาก

คุณสามารถเพิกถอนความยินยอมนี้ได้ตลอดเวลาผ่าน Settings
    `.trim(),
    en: `
🔍 Micro-Expression Behavior Analysis (DeceptionEngine)

This system will analyze whether your bio-signals (HR, HRV, GSR, EEG)
are consistent with the emotion you express outwardly,
including detection of emotional "masking" and micro-expression leakage.

⚠️  What the system DOES:
  • Detect if displayed emotion matches bio-signal patterns
  • Compute "masking probability" per tick
  • Pass output only to NuengdeawCore (not external agents)

🔒  What the system does NOT do:
  • Does not conclude you are "lying" to someone
  • Does not share results with employers, external agents, or third parties
  • Does not store results unless you explicitly consent here

You may revoke this consent at any time in Settings.
    `.trim(),
  };

  /**
   * requestDeceptionConsent(lang, onAccept, onDecline)
   * แสดง dialog ขอ consent — ต้องเรียกก่อน DeceptionEngine.setLevel(>0)
   */
  const requestDeceptionConsent = (lang = 'th', onAccept, onDecline) => {
    if (_state.deceptionConsentGranted) {
      // ยืนยันแล้ว ไม่ต้องถามซ้ำ
      if (onAccept) onAccept();
      return;
    }

    const text = DECEPTION_CONSENT_TEXT[lang] || DECEPTION_CONSENT_TEXT.th;

    // สร้าง modal ถ้าอยู่ใน browser
    if (typeof document !== 'undefined') {
      _showConsentModal(text, lang, onAccept, onDecline);
    } else {
      // Node.js / test environment
      console.warn('[EthicsGuard] DeceptionEngine consent required. Call grantDeceptionConsent() manually.');
    }
  };

  const _showConsentModal = (text, lang, onAccept, onDecline) => {
    const overlay = document.createElement('div');
    overlay.id = 'ethics-consent-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;

    const isTh = lang !== 'en';
    overlay.innerHTML = `
      <div style="background:#0c0f1a;border:1px solid #00f5d4;border-radius:20px;
                  max-width:520px;width:100%;padding:28px;color:#edf2f7;font-family:'Inter',sans-serif;">
        <div style="font-size:0.8rem;font-weight:700;color:#00f5d4;margin-bottom:16px;letter-spacing:1px;">
          PHASA TAWAN · ETHICS CONSENT
        </div>
        <pre style="white-space:pre-wrap;font-size:0.75rem;color:#94a3b8;
                    background:#070b14;border-radius:12px;padding:14px;
                    line-height:1.7;max-height:320px;overflow-y:auto;">${text}</pre>
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
          <button id="ethics-decline-btn"
            style="padding:8px 18px;border-radius:30px;border:1px solid #f87171;
                   background:rgba(248,113,113,0.1);color:#f87171;cursor:pointer;font-size:0.8rem;">
            ${isTh ? '❌ ไม่ยินยอม' : '❌ Decline'}
          </button>
          <button id="ethics-accept-btn"
            style="padding:8px 18px;border-radius:30px;border:1px solid #00f5d4;
                   background:rgba(0,245,212,0.12);color:#00f5d4;cursor:pointer;font-size:0.8rem;font-weight:600;">
            ${isTh ? '✅ ยินยอม — เปิด DeceptionEngine' : '✅ Accept — Enable DeceptionEngine'}
          </button>
        </div>
        <div style="font-size:0.62rem;color:#6b7280;margin-top:10px;text-align:center;">
          Consent v${_state.consentVersion} · ${isTh ? 'เพิกถอนได้ใน Settings' : 'Revocable in Settings'}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ethics-accept-btn').onclick = () => {
      grantDeceptionConsent();
      overlay.remove();
      if (onAccept) onAccept();
    };
    document.getElementById('ethics-decline-btn').onclick = () => {
      overlay.remove();
      if (onDecline) onDecline();
    };
  };

  const grantDeceptionConsent = () => {
    _state.deceptionConsentGranted = true;
    _state.deceptionConsentTs      = Date.now();
    console.log('[EthicsGuard] DeceptionEngine consent granted ✓', new Date(_state.deceptionConsentTs).toISOString());
    return _result(true, { granted:true, ts:_state.deceptionConsentTs });
  };

  const revokeDeceptionConsent = () => {
    _state.deceptionConsentGranted = false;
    _state.deceptionConsentTs      = null;
    // ปิด DeceptionEngine ทันที
    const engine = _getEngine();
    if (engine) {
      if (typeof engine.setLevelUnsafe === 'function') engine.setLevelUnsafe(0);
      else if (typeof engine.setLevel === 'function') engine.setLevel(0);
      console.log('[EthicsGuard] DeceptionEngine consent revoked — engine stopped.');
    }
    return _result(true, { granted:false });
  };

  /**
   * safeSetDeceptionLevel(level, lang)
   * แทน DeceptionEngine.setLevel() โดยตรง — บังคับ consent ก่อน
   */
  const safeSetDeceptionLevel = (level, lang = 'th') => {
    const engine = _getEngine();
    if (!engine) return _result(false, { error:'DeceptionEngine not loaded' });

    if (level === 0) {
      if (typeof engine.setLevelUnsafe === 'function') engine.setLevelUnsafe(0);
      else if (typeof engine.setLevel === 'function') engine.setLevel(0);
      return _result(true, { level:0, consentRequired:false });
    }
    if (!_state.deceptionConsentGranted) {
      requestDeceptionConsent(
        lang,
        () => {
          if (typeof engine.setLevelUnsafe === 'function') engine.setLevelUnsafe(level);
          else if (typeof engine.setLevel === 'function') engine.setLevel(level);
          console.log(`[EthicsGuard] DeceptionEngine level set to ${level} after consent`);
        },
        () => console.log('[EthicsGuard] User declined DeceptionEngine consent')
      );
      return _result(true, { pendingConsent:true, level });
    } else {
      if (typeof engine.setLevelUnsafe === 'function') engine.setLevelUnsafe(level);
      else if (typeof engine.setLevel === 'function') engine.setLevel(level);
      return _result(true, { level, consentRequired:false });
    }
  };

  // ==========================================================================
  // [2] ACCESS CONTROL — จำกัดใครดู DeceptionEngine output ได้
  // ==========================================================================
  // ปัญหา: ถ้า output ไปถึง employer หรือ external agent → coercion risk
  // แก้:  output ของ DeceptionEngine ต้องผ่าน checkAccess() ก่อนส่งออก

  const ROLE_DESCRIPTIONS = {
    user_self:         'ผู้ใช้ตัวเอง (เสมอได้รับอนุญาต)',
    nuengdeaw_core:    'NuengdeawCore (internal processing)',
    research_aggregate:'งานวิจัย aggregate เท่านั้น (ไม่มี PII)',
    // ห้ามเพิ่ม: employer, external_agent, third_party
  };

  const BLOCKED_ROLES = new Set(['employer', 'external_agent', 'third_party', 'hr_system', 'insurer']);

  /**
   * checkAccess(role, dataType)
   * คืน { allowed: bool, reason: string }
   */
  const checkAccess = (role, dataType = 'deception_output') => {
    // บทบาทต้องห้าม — ปฏิเสธเสมอ
    if (BLOCKED_ROLES.has(role)) {
      _logAccess(role, dataType, false, 'BLOCKED_ROLE');
      return {
        allowed: false,
        reason:  `[EthicsGuard] Role "${role}" is permanently blocked from accessing deception data (Phasa Tawan §3.2)`,
      };
    }
    // ต้องอยู่ใน allowedRoles
    if (!_state.allowedRoles.has(role)) {
      _logAccess(role, dataType, false, 'NOT_IN_ALLOWLIST');
      return {
        allowed: false,
        reason:  `[EthicsGuard] Role "${role}" not in allowed list. Add via EthicsGuard.grantRole() first.`,
      };
    }
    // ต้องได้รับ consent ก่อน
    if (!_state.deceptionConsentGranted) {
      _logAccess(role, dataType, false, 'NO_CONSENT');
      return {
        allowed: false,
        reason:  '[EthicsGuard] Deception data access denied — user has not granted DeceptionEngine consent.',
      };
    }
    _logAccess(role, dataType, true, 'OK');
    return { allowed: true, reason: 'OK' };
  };

  const grantRole = (role) => {
    if (BLOCKED_ROLES.has(role)) {
      console.error(`[EthicsGuard] Cannot grant blocked role: "${role}"`);
      return false;
    }
    _state.allowedRoles.add(role);
    console.log(`[EthicsGuard] Role granted: "${role}"`);
    return true;
  };

  const revokeRole = (role) => {
    if (role === 'user_self') { console.warn('[EthicsGuard] Cannot revoke user_self role'); return; }
    _state.allowedRoles.delete(role);
    console.log(`[EthicsGuard] Role revoked: "${role}"`);
  };

  const _logAccess = (role, dataType, allowed, reason) => {
    _state.accessLog.push({ ts: Date.now(), role, dataType, allowed, reason });
    if (_state.accessLog.length > 200) _state.accessLog.shift();
    if (!allowed) {
      console.warn(`[EthicsGuard] ACCESS DENIED — role:${role} data:${dataType} reason:${reason}`);
    }
  };

  /**
   * getDeceptionOutput(role)
   * wrapper ที่ตรวจ access ก่อนคืนค่า DeceptionEngine data
   */
  const getDeceptionOutput = (role = 'user_self') => {
    const { allowed, reason } = checkAccess(role, 'deception_output');
    if (!allowed) return { error: reason, pci: null, maskingLevel: null };

    const engine = _getEngine();
    if (!engine) return { success:false, error: 'DeceptionEngine not loaded' };
    return {
      success: true,
      level:      engine.getLevel(),
      levelName:  engine.getLevelName(),
      isActive:   engine.isActive(),
      _note:      'Output scoped to consented user only. Not for third-party use.',
    };
  };

  // ==========================================================================
  // [3] ACCURACY DISCLAIMER
  // ==========================================================================
  // ปัญหา: "78–82% accuracy" มาจาก simulator ของตัวเอง ไม่ใช่ real-world study
  // แก้:  ทุก accuracy display ต้องมี label source ที่ชัดเจน

  const ACCURACY_LABELS = {
    simulator: {
      th: '⚗️ จาก simulator (ยังไม่ได้ทดสอบกับผู้ใช้จริง)',
      en: '⚗️ Simulated estimate (not validated on real users)',
    },
    pilot_study: {
      th: '🔬 จาก pilot study (n < 100)',
      en: '🔬 Pilot study estimate (n < 100)',
    },
    peer_reviewed: {
      th: '📚 อ้างอิงจากงานวิจัย peer-reviewed',
      en: '📚 Based on peer-reviewed research',
    },
  };

  /**
   * labeledAccuracy(value, source, lang)
   * คืนข้อความ accuracy พร้อม disclaimer
   * เช่น "~80% ⚗️ จาก simulator (ยังไม่ได้ทดสอบกับผู้ใช้จริง)"
   */
  const labeledAccuracy = (value, source = null, lang = 'th') => {
    const src   = source || _state.accuracySource;
    const label = ACCURACY_LABELS[src]?.[lang] || ACCURACY_LABELS.simulator[lang];
    return `~${typeof value === 'number' ? Math.round(value * 100) + '%' : value} ${label}`;
  };

  /**
   * setAccuracySource(source)
   * อัปเดตเมื่อมี pilot data จริง
   */
  const setAccuracySource = (source) => {
    if (ACCURACY_LABELS[source]) {
      _state.accuracySource = source;
      console.log(`[EthicsGuard] Accuracy source updated to: ${source}`);
    } else {
      console.warn(`[EthicsGuard] Unknown accuracy source: ${source}`);
    }
  };

  // inject disclaimer ลงใน DOM element ถ้ามี
  const injectAccuracyDisclaimer = (elementId, value, lang = 'th') => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(elementId);
    if (!el) return;
    const src   = _state.accuracySource;
    const label = ACCURACY_LABELS[src]?.[lang] || ACCURACY_LABELS.simulator[lang];
    el.title    = label;  // tooltip
    el.style.cursor = 'help';
    // เพิ่ม superscript disclaimer
    const next = el.nextSibling;
    const span = document.createElement('span');
    span.style.cssText = 'font-size:0.55rem;color:#fb923c;margin-left:4px;cursor:help;';
    span.title   = label;
    span.innerText = '⚗️';
    if (next) el.parentNode.insertBefore(span, next);
    else el.parentNode.appendChild(span);
  };

  // ==========================================================================
  // [4] ANTI-GAMING GUARD — ป้องกัน feedback ไม่ซื่อสัตย์
  // ==========================================================================
  // ปัญหา: user กด confirm ทุกครั้งเพื่อรับ token → ground truth เสีย
  // แก้:
  //   • cooldown 10 วิ ระหว่าง feedback
  //   • confirm streak > 5 → warning + soft cooldown เพิ่ม
  //   • response time < 1.5 วิ → ถือว่า auto-click → reject
  // FIX #6: persist lastFeedbackTs และ feedbackCooldownMs ลง localStorage
  //         เพื่อให้ cooldown 5 นาทียังมีผลหลัง page refresh

  const _LS_COOLDOWN_KEY = 'nuengdeaw_ethics_cooldown_v1';
  let _cooldownMemoryState = null;
  let _cooldownStorageMode = 'memory';
  let _storageWarningShown = false;
  const _COOLDOWN_STORES = [
    { mode:'localStorage', get:() => (typeof localStorage !== 'undefined' ? localStorage : null) },
    { mode:'sessionStorage', get:() => (typeof sessionStorage !== 'undefined' ? sessionStorage : null) },
  ];

  const _warnStorageFallback = (mode, error) => {
    if (_storageWarningShown) return;
    _storageWarningShown = true;
    console.warn(`[EthicsGuard] Cooldown persistence fell back to ${mode}:`, error?.message || error || 'unavailable');
  };

  const _writeCooldownState = (payload) => {
    const serialized = JSON.stringify(payload);
    for (const candidate of _COOLDOWN_STORES) {
      try {
        const store = candidate.get();
        if (!store) continue;
        store.setItem(_LS_COOLDOWN_KEY, serialized);
        _cooldownStorageMode = candidate.mode;
        return true;
      } catch (e) {
        _warnStorageFallback(candidate.mode === 'localStorage' ? 'session/memory storage' : 'memory storage', e);
      }
    }
    _cooldownMemoryState = payload;
    _cooldownStorageMode = 'memory';
    return true;
  };

  const _readCooldownState = () => {
    for (const candidate of _COOLDOWN_STORES) {
      try {
        const store = candidate.get();
        if (!store) continue;
        const raw = store.getItem(_LS_COOLDOWN_KEY);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.savedAt && Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
          store.removeItem(_LS_COOLDOWN_KEY);
          continue;
        }
        _cooldownStorageMode = candidate.mode;
        return parsed;
      } catch (e) {
        _warnStorageFallback(candidate.mode === 'localStorage' ? 'session/memory storage' : 'memory storage', e);
      }
    }
    _cooldownStorageMode = 'memory';
    return _cooldownMemoryState;
  };

  const _clearCooldownState = () => {
    for (const candidate of _COOLDOWN_STORES) {
      try {
        const store = candidate.get();
        if (store) store.removeItem(_LS_COOLDOWN_KEY);
      } catch (e) {
        _warnStorageFallback(candidate.mode === 'localStorage' ? 'session/memory storage' : 'memory storage', e);
      }
    }
    _cooldownMemoryState = null;
    _cooldownStorageMode = 'memory';
  };

  const _saveCooldown = () => {
    try {
      _writeCooldownState({
        lastFeedbackTs:    _state.lastFeedbackTs,
        feedbackCooldownMs:_state.feedbackCooldownMs,
        confirmStreak:     _state.confirmStreak,
        gamingWarnings:    _state.gamingWarnings,
        savedAt:           Date.now(),
      });
    } catch(e) { /* quota — ไม่ critical */ }
  };

  const _loadCooldown = () => {
    try {
      const saved = _readCooldownState();
      if (!saved) return;
      // ใช้ข้อมูลถ้าบันทึกไม่นานกว่า 24 ชม
      if (Date.now() - saved.savedAt < 24 * 60 * 60 * 1000) {
        _state.lastFeedbackTs     = saved.lastFeedbackTs     ?? 0;
        _state.feedbackCooldownMs = saved.feedbackCooldownMs ?? 10_000;
        _state.confirmStreak      = saved.confirmStreak      ?? 0;
        _state.gamingWarnings     = saved.gamingWarnings     ?? 0;
        console.log(`[EthicsGuard] Cooldown state restored from ${_cooldownStorageMode}`);
      }
    } catch(e) {}
  };
  _loadCooldown(); // โหลดเมื่อ module init

  const MIN_RESPONSE_MS    = 1500;   // ต้องอ่านอย่างน้อย 1.5 วิ
  const STREAK_WARN_LIMIT  = 5;
  const STREAK_BLOCK_LIMIT = 15;

  let _toastShownTs = 0;  // เวลาที่ toast แสดง

  // แจ้งเวลาที่ toast เริ่มแสดง — dashboard.js เรียกตอน showFeedbackToast
  const markToastShown = () => { _toastShownTs = Date.now(); };

  /**
   * validateFeedback({ predictedState, confirmedState, source })
   * คืน { valid: bool, reason: string, penalty: bool }
   * ควรเรียกก่อน NuengdeawCore.submitFeedback()
   */
  const validateFeedback = ({ predictedState, confirmedState, source = 'user' }) => {
    const now        = Date.now();
    const sinceToast = now - _toastShownTs;
    const sinceLast  = now - _state.lastFeedbackTs;

    // 1. Cooldown
    if (sinceLast < _state.feedbackCooldownMs) {
      return {
        valid:  false,
        reason: `กรุณารอ ${Math.ceil((_state.feedbackCooldownMs - sinceLast) / 1000)} วินาทีก่อน feedback อีกครั้ง`,
        penalty: false,
      };
    }

    // 2. Response time too fast (auto-click detection)
    if (_toastShownTs > 0 && sinceToast < MIN_RESPONSE_MS) {
      console.warn(`[EthicsGuard] Feedback too fast (${sinceToast}ms) — possible auto-click`);
      return {
        valid:   false,
        reason:  'กรุณาอ่าน feedback ก่อนตอบ (ตอบเร็วเกินไป)',
        penalty: false,
      };
    }

    // 3. Streak check
    const isConfirm = (predictedState === confirmedState);
    if (isConfirm) {
      _state.confirmStreak++;
    } else {
      _state.confirmStreak = 0;
    }

    if (_state.confirmStreak > STREAK_BLOCK_LIMIT) {
      _state.gamingWarnings++;
      // เพิ่ม cooldown เป็น 5 นาที
      _state.feedbackCooldownMs = 5 * 60 * 1000;
      _saveCooldown(); // FIX #6: persist penalty cooldown ข้าม refresh
      return {
        valid:   false,
        reason:  `ตรวจพบ feedback streak สูงผิดปกติ (${_state.confirmStreak} ครั้ง) — ระบบหยุดรับ feedback ชั่วคราว 5 นาที`,
        penalty: true,
      };
    }

    if (_state.confirmStreak > STREAK_WARN_LIMIT) {
      console.warn(`[EthicsGuard] High confirm streak: ${_state.confirmStreak} — possible gaming`);
      // แจ้งเตือนใน UI ถ้าเป็นไปได้
      _showGamingWarning(_state.confirmStreak);
    }

    // 4. บันทึกและผ่าน
    _state.lastFeedbackTs = now;
    _state.feedbackHistory.push({
      ts: now,
      predictedState,
      confirmedState,
      isConfirm,
      responseMs: sinceToast,
      source,
    });
    if (_state.feedbackHistory.length > 500) _state.feedbackHistory.shift();

    // reset cooldown ถ้าผ่านนาน
    if (_state.feedbackCooldownMs > 10_000 && sinceLast > 10 * 60 * 1000) {
      _state.feedbackCooldownMs = 10_000;
    }

    _saveCooldown(); // FIX #6: persist lastFeedbackTs ข้าม page refresh
    return { valid: true, reason: 'OK', penalty: false };
  };

  const _showGamingWarning = (streak) => {
    if (typeof document === 'undefined') return;
    // ไม่สร้าง modal ใหม่ถ้ามีอยู่แล้ว
    const existing = document.getElementById('ethics-gaming-warn');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'ethics-gaming-warn';
    el.style.cssText = `
      position:fixed;bottom:20px;left:20px;
      background:#1a0f00;border:1px solid #fb923c;border-radius:12px;
      padding:12px 16px;max-width:280px;z-index:9998;
      font-size:0.72rem;color:#fb923c;font-family:'Inter',sans-serif;
    `;
    el.innerHTML = `
      <strong>⚠️ คุณภาพ Ground Truth</strong><br>
      ตรวจพบการยืนยันซ้ำ ${streak} ครั้งติดต่อกัน<br>
      <span style="color:#94a3b8;">กรุณาตอบตามความเป็นจริงเพื่อ Emotional AI ที่แม่นยำ</span>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  };

  const getFeedbackStats = () => ({
    total:          _state.feedbackHistory.length,
    confirmStreak:  _state.confirmStreak,
    gamingWarnings: _state.gamingWarnings,
    cooldownMs:     _state.feedbackCooldownMs,
    confirmRate:    _state.feedbackHistory.length > 0
      ? +(_state.feedbackHistory.filter(f => f.isConfirm).length / _state.feedbackHistory.length).toFixed(3)
      : null,
    avgResponseMs:  _state.feedbackHistory.length > 0
      ? Math.round(_state.feedbackHistory.reduce((s, f) => s + (f.responseMs || 0), 0) / _state.feedbackHistory.length)
      : null,
  });

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    // [1] Consent
    requestDeceptionConsent,
    grantDeceptionConsent,
    revokeDeceptionConsent,
    injectDeceptionEngine,
    safeSetDeceptionLevel,
    isDeceptionConsentGranted: () => _state.deceptionConsentGranted,
    getConsentInfo: () => ({
      granted:   _state.deceptionConsentGranted,
      ts:        _state.deceptionConsentTs,
      version:   _state.consentVersion,
    }),

    // [2] Access Control
    checkAccess,
    grantRole,
    revokeRole,
    getDeceptionOutput,
    listAllowedRoles: () => [..._state.allowedRoles],
    getAccessLog:     (n = 20) => _state.accessLog.slice(-n),

    // [3] Accuracy
    labeledAccuracy,
    setAccuracySource,
    injectAccuracyDisclaimer,
    getAccuracySource: () => _state.accuracySource,

    // [4] Anti-Gaming
    validateFeedback,
    markToastShown,
    getFeedbackStats,
    resetFeedbackCooldown: () => {
      _state.feedbackCooldownMs = 10_000;
      _state.confirmStreak      = 0;
      _clearCooldownState();
      console.log('[EthicsGuard] Feedback cooldown reset');
    },

    // Status
    getStatus: () => ({
      deceptionConsent:  _state.deceptionConsentGranted,
      allowedRoles:      [..._state.allowedRoles],
      accuracySource:    _state.accuracySource,
      feedbackStats:     getFeedbackStats(),
      accessLogCount:    _state.accessLog.length,
    }),
  };
})();

// ==========================================================================
// AUTO-INIT: inject accuracy disclaimer ใน DOM elements มาตรฐาน
// ==========================================================================
if (typeof window !== 'undefined') {
  window.EthicsGuard = EthicsGuard;
  if (window.DeceptionEngine && typeof window.DeceptionEngine.setEthicsGuard === 'function') {
    window.DeceptionEngine.setEthicsGuard(EthicsGuard);
    EthicsGuard.injectDeceptionEngine(window.DeceptionEngine);
  }

  // รอ DOM โหลดก่อน inject
  const _injectDisclaimers = () => {
    // element IDs ที่แสดงตัวเลข accuracy (ถ้ามีใน dashboard)
    ['confidence-val', 'wellbeing-score'].forEach(id =>
      EthicsGuard.injectAccuracyDisclaimer(id, null, 'th')
    );
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectDisclaimers);
  } else {
    setTimeout(_injectDisclaimers, 500);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EthicsGuard;
}

console.log('✅ EthicsGuard.js loaded — Consent Gate + Access Control + Accuracy Label + Anti-Gaming');
