'use strict';

if (typeof window !== 'undefined') {
  window.__dashboardFileLoaded = true;
}

let timelineData = [];
let timelineChart = null;
let _lastTimelineSampleTs = 0;
let _lastTimelinePoint = { hr: 0, cognitiveLoad: 0, wellbeing: 0 };
let _feedbackToast = null;
let _pendingBioSnapshot = null;
let _clockTimer = null;
let _dbStatTimer = null;
let _insightTimer = null;
let _calibTimer = null;
let _insightRefreshInFlight = false;
let _latestStructuredSnapshot = null;
let _dashboardStarted = false;

// Keep dashboard-local labels off the shared global names used by HumanSimSystem.js.
const DASHBOARD_EMOTION_STATES = [
  'FLOW',
  'READY',
  'STRESS',
  'CONFUSION',
  'BOREDOM',
  'EXCITEMENT',
  'FATIGUE',
  'NEUTRAL',
  'FRUSTRATION',
  'ANXIETY',
  'CURIOSITY',
  'DISGUST',
  'SURPRISE',
  'CALM',
];

const DASHBOARD_EMOTION_LABELS = {
  FLOW: 'Flow',
  READY: 'Ready',
  STRESS: 'Stress',
  CONFUSION: 'Confusion',
  BOREDOM: 'Boredom',
  EXCITEMENT: 'Excitement',
  FATIGUE: 'Fatigue',
  NEUTRAL: 'Neutral',
  FRUSTRATION: 'Frustration',
  ANXIETY: 'Anxiety',
  CURIOSITY: 'Curiosity',
  DISGUST: 'Disgust',
  SURPRISE: 'Surprise',
  CALM: 'Calm',
};

const INSIGHT_ICONS = {
  peakWindow: 'fa-star',
  patternAlert: 'fa-exclamation-triangle',
  wellbeingTrend: 'fa-chart-line',
};

function normalizeInsight(insight) {
  const score = `${((insight?.score ?? 0) * 100).toFixed(0)}%`;

  switch (insight?.type) {
    case 'peakWindow':
      return {
        title: 'Best focus window',
        body: 'A strong performance window was detected from recent session history.',
        action: 'Use this time block for priority work.',
        score,
      };
    case 'patternAlert':
      return {
        title: 'Recurring pattern detected',
        body: 'A repeated stress-related or negative-state pattern was found in historical sessions.',
        action: 'Review what tends to trigger this pattern.',
        score,
      };
    case 'wellbeingTrend':
      return {
        title: 'Weekly wellbeing trend',
        body: 'Recent sessions show a measurable change in wellbeing versus the prior period.',
        action: 'Reinforce helpful habits or add more recovery time.',
        score,
      };
    default:
      return {
        title: insight?.title || 'Insight',
        body: insight?.body || 'Human-readable insight generated from session history.',
        action: insight?.action || 'Review this signal in context.',
        score,
      };
  }
}

function getCore() {
  return window.NuengdeawCore || null;
}

function getHumanSim() {
  return window.HumanSim || null;
}

const CONSENT_FIELDS = ['physiological', 'cognitive', 'emotional', 'semantic', 'export'];

function getConsentCheckboxId(key) {
  return `consent-${key}`;
}

function updateClock() {
  const el = document.getElementById('live-time');
  if (el) el.innerText = new Date().toLocaleTimeString('en-GB');

  // Keep timeline visually continuous while core runs in STABLE/IDLE tick modes.
  if (
    _lastTimelineSampleTs > 0 &&
    (Date.now() - _lastTimelineSampleTs) >= 1500
  ) {
    updateTimeline(
      _lastTimelinePoint.hr,
      _lastTimelinePoint.cognitiveLoad,
      _lastTimelinePoint.wellbeing,
      Date.now()
    );
  }
}

function clearDashboardTimers() {
  if (_clockTimer) clearInterval(_clockTimer);
  if (_dbStatTimer) clearInterval(_dbStatTimer);
  if (_insightTimer) clearInterval(_insightTimer);
  if (_calibTimer) clearInterval(_calibTimer);
  _clockTimer = null;
  _dbStatTimer = null;
  _insightTimer = null;
  _calibTimer = null;
}

function initChart() {
  const canvas = document.getElementById('timelineChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Cognitive Load',
          data: [],
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74,222,128,0.06)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'HR /10',
          data: [],
          borderColor: '#00f5d4',
          backgroundColor: 'rgba(0,245,212,0.04)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Wellbeing',
          data: [],
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192,132,252,0.04)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { display: false },
        y: {
          min: 0,
          max: 1.2,
          grid: { color: '#1e2538' },
          ticks: { color: '#6b7280', font: { size: 9 } },
        },
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 },
        },
      },
    },
  });
}

function updateTickBadge(mode) {
  const el = document.getElementById('tick-badge');
  if (!el) return;

  const labels = {
    ACTIVE: 'ACTIVE 1s',
    STABLE: 'STABLE 5s',
    IDLE: 'IDLE 30s',
  };

  el.className = `tick-badge ${mode}`;
  el.innerHTML = `<i class="fas fa-${mode === 'ACTIVE' ? 'bolt' : mode === 'STABLE' ? 'leaf' : 'moon'}"></i> ${labels[mode] ?? mode}`;
}

function updatePowerToggle() {
  const core = getCore();
  const button = document.getElementById('power-toggle');
  if (!button || !core) return;

  const paused = !!core.isPaused?.();
  button.textContent = paused ? 'OFF' : 'ON';
  button.className = `power-toggle ${paused ? 'off' : 'on'}`;
  button.setAttribute('aria-pressed', paused ? 'true' : 'false');

  if (paused) {
    const tickBadge = document.getElementById('tick-badge');
    if (tickBadge) {
      tickBadge.className = 'tick-badge IDLE';
      tickBadge.innerHTML = '<i class="fas fa-power-off"></i> OFFLINE';
    }
  }
}

function setTextWithIcon(targetId, iconClass, text, color) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.replaceChildren();

  const icon = document.createElement('i');
  icon.className = `fas ${iconClass}`;
  if (color) icon.style.color = color;

  target.append(icon, document.createTextNode(` ${text}`));
}

function setEmotionName(state) {
  const target = document.getElementById('emotion-name');
  if (!target) return;

  target.replaceChildren();

  const span = document.createElement('span');
  span.className = `emotion-${state}`;
  span.textContent = state;
  target.appendChild(span);
}

function setRecommendation(recommendation) {
  const message = document.getElementById('recommend-message');
  const buttons = document.getElementById('action-buttons');
  if (!message || !buttons) return;

  message.textContent = recommendation?.message ?? '';
  buttons.replaceChildren();

  (recommendation?.actions || []).forEach((action) => {
    const btn = document.createElement('button');
    btn.innerText = action.name;
    btn.style.cssText = 'background:#1e293b;border:1px solid #334155;';
    btn.addEventListener('click', () => console.log('Action:', action.type));
    buttons.appendChild(btn);
  });
}

function setBootStatus(text) {
  const message = document.getElementById('recommend-message');
  if (message) message.textContent = text;
}

function getCurrentStructuredSnapshot() {
  return _latestStructuredSnapshot ?? getCore()?.getSnapshot?.() ?? null;
}

function renderHumanSimLifecycle(lifecycle) {
  const title = document.getElementById('hs-title');
  if (!title) return;

  const summary = document.getElementById('hs-summary');
  const stageBadge = document.getElementById('hs-stage-badge');
  const healthFill = document.getElementById('hs-health-fill');
  const healthVal = document.getElementById('hs-health-val');
  const confidenceCap = document.getElementById('hs-confidence-cap');
  const memoryRetention = document.getElementById('hs-memory-retention');
  const remaining = document.getElementById('hs-remaining-days');
  const quality = document.getElementById('hs-quality');
  const reincarnations = document.getElementById('hs-reincarnations');
  const notice = document.getElementById('hs-notice');
  const policy = document.getElementById('hs-policy');
  const disconnectBtn = document.getElementById('hs-disconnect-btn');
  const extendBtn = document.getElementById('hs-extend-btn');
  const retireBtn = document.getElementById('hs-retire-btn');

  if (!lifecycle) {
    title.textContent = 'Transition layer unavailable';
    summary.textContent = 'Lifecycle manager is not available yet.';
    stageBadge.textContent = '--';
    healthFill.style.width = '0%';
    healthVal.textContent = '-';
    confidenceCap.textContent = '-';
    memoryRetention.textContent = '-';
    remaining.textContent = '-';
    quality.textContent = '-';
    reincarnations.textContent = '0';
    notice.textContent = 'Lifecycle data is not available yet.';
    notice.className = 'hs-notice';
    policy.textContent = 'No lifecycle deletion policy is available.';
    disconnectBtn.disabled = true;
    extendBtn.disabled = true;
    retireBtn.disabled = true;
    return;
  }

  title.textContent = lifecycle.ui?.title ?? `Transition Layer Status: ${lifecycle.stageName ?? '--'}`;
  summary.textContent = lifecycle.ui?.summary ?? lifecycle.stageDescription ?? '';
  stageBadge.textContent = lifecycle.stageName ?? '--';
  healthFill.style.width = `${Math.max(0, Math.min(100, lifecycle.healthPercent ?? 0))}%`;
  healthFill.style.filter = lifecycle.healthPercent <= 20 ? 'saturate(0.7) brightness(0.95)' : 'none';
  healthVal.textContent = `${lifecycle.healthPercent ?? 0}%`;
  confidenceCap.textContent = `${Math.round((lifecycle.confidenceCap ?? 0) * 100)}%`;
  memoryRetention.textContent = `${Math.round((lifecycle.memoryRetention ?? 0) * 100)}%`;
  remaining.textContent = lifecycle.stageName === 'Dead' ? 'Expired' : `${(lifecycle.remainingDays ?? 0).toFixed(1)} days`;
  quality.textContent = lifecycle.lastQuality > 0 ? `${Math.round(lifecycle.lastQuality * 100)}%` : '-';
  reincarnations.textContent = `${lifecycle.reincarnations ?? 0}`;

  let noticeText = lifecycle.ui?.countdown ?? lifecycle.stageDescription ?? '';
  let noticeClass = 'hs-notice';

  if (lifecycle.phase === 'Freeze') {
    noticeText = 'Wearable disconnect detected. The transition layer is frozen temporarily and stays available as the fallback source.';
    noticeClass = 'hs-notice warn';
  } else if (lifecycle.phase === 'Reincarnation') {
    noticeText = 'The transition layer is being rebuilt from legacy-safe aggregate data to preserve continuity.';
    noticeClass = 'hs-notice warn';
  } else if (lifecycle.phase === 'Dead') {
    noticeText = 'The transition layer has been retired. Only metadata and aggregate-safe legacy remain.';
    noticeClass = 'hs-notice bad';
  } else if (lifecycle.degradationPaused) {
    noticeText = lifecycle.pauseReason === 'calibration_guard'
      ? 'Transition slowdown is paused because wearable calibration is not complete yet.'
      : 'Transition slowdown is paused because wearable signal quality is still too low.';
    noticeClass = 'hs-notice warn';
  }

  notice.className = noticeClass;
  notice.textContent = noticeText;

  const policyBits = [];
  if (lifecycle.dataPolicy?.deleteEpisodicOlderThanDays) {
    policyBits.push(`delete episodic memory older than ${lifecycle.dataPolicy.deleteEpisodicOlderThanDays} days`);
  }
  if (lifecycle.dataPolicy?.dropPersonalContext) policyBits.push('drop personal context');
  if (lifecycle.dataPolicy?.dropPersonalityProfile) policyBits.push('drop personality profile');
  if (lifecycle.dataPolicy?.dropRawPhysiology) policyBits.push('reduce to aggregate physiology');
  if (lifecycle.dataPolicy?.metadataOnly) policyBits.push('metadata only');

  policy.textContent = policyBits.length > 0
    ? `Deletion protocol: ${policyBits.join(' | ')}`
    : 'Deletion protocol: no lifecycle-driven deletion is active yet.';

  disconnectBtn.disabled = !lifecycle.wearableConnected;
  extendBtn.disabled = lifecycle.stageName === 'Dead' && lifecycle.phase !== 'Reincarnation';
  retireBtn.disabled = lifecycle.stageName === 'Dead';
}

function setQAAnswer(iconClass, text, color) {
  setTextWithIcon('qa-answer', iconClass, text, color);
}

function setSensorValidation(current) {
  const row = document.getElementById('sensor-valid-row');
  const val = document.getElementById('sensor-valid-val');
  if (!row || !val) return;

  const sensor = current.sensorValidation;
  if (!sensor || current.sourceMode !== 'wearable') {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'flex';
  const cls = sensor.valid ? 'good' : sensor.confidence > 0.6 ? 'warn' : 'bad';
  val.className = `mem-val ${cls}`;
  val.innerText = sensor.valid
    ? `valid (${(sensor.confidence * 100).toFixed(0)}%)`
    : `clamped (${(sensor.confidence * 100).toFixed(0)}%)`;
}

function updateTimeline(hrValue, cognitiveLoad, wellbeing, sampleTs = Date.now()) {
  _lastTimelineSampleTs = sampleTs;
  _lastTimelinePoint = { hr: hrValue, cognitiveLoad, wellbeing };

  timelineData.push({
    hr: hrValue / 10,
    cognitiveLoad,
    wellbeing,
  });

  if (timelineData.length > 60) timelineData.shift();
  if (!timelineChart) return;

  timelineChart.data.labels = timelineData.map((_, index) => index);
  timelineChart.data.datasets[0].data = timelineData.map((point) => point.cognitiveLoad);
  timelineChart.data.datasets[1].data = timelineData.map((point) => Math.min(1.0, point.hr / 14));
  timelineChart.data.datasets[2].data = timelineData.map((point) => point.wellbeing);
  timelineChart.update('none');
}

function updateDashboard(snapshot) {
  const core = getCore();
  if (!core) return;

  try {
    const structured = snapshot ?? _latestStructuredSnapshot;
    if (!structured || structured.error) return;
    _latestStructuredSnapshot = structured;

    const current = structured.current;
    const emotion = current.emotion;
    const physiology = current.physiology;
    const eeg = current.eeg;
    const cognitive = current.cognitive;
    const memory = current.memory || {};
    const social = current.social || {};
    const wellbeing = current.wellbeing;

    updateTickBadge(structured.meta?.tickMode ?? 'ACTIVE');
    setSensorValidation(current);
    setEmotionName(emotion.name);

    document.getElementById('displayed-emotion').innerText = emotion.displayed ?? '--';
    document.getElementById('emotion-intensity-val').innerText = `${Math.round((emotion.intensity ?? 0.5) * 100)}%`;
    document.getElementById('masking-fill').style.width = `${(social.masking ?? emotion.maskingLevel ?? 0) * 100}%`;
    document.getElementById('mask-level-inline').innerText = `${Math.round((social.masking ?? emotion.maskingLevel ?? 0) * 100)}%`;

    document.getElementById('hr-val').innerText = Math.round(physiology.hr?.value ?? 0);
    document.getElementById('hrv-val').innerText = Math.round(physiology.hrv?.value ?? 0);
    document.getElementById('gsr-val').innerText = Number(physiology.gsr?.value ?? 0).toFixed(1);
    document.getElementById('rr-val').innerText = Math.round(physiology.rr?.value ?? 0);
    document.getElementById('hr-fill').style.width = `${Math.min(100, ((physiology.hr?.value ?? 0) / 140) * 100)}%`;
    document.getElementById('gsr-fill').style.width = `${Math.min(100, ((physiology.gsr?.value ?? 0) / 25) * 100)}%`;
    document.getElementById('theta-val').innerText = Number(eeg.theta ?? 0).toFixed(2);
    document.getElementById('alpha-val').innerText = Number(eeg.alpha ?? 0).toFixed(2);
    document.getElementById('beta-val').innerText = Number(eeg.beta ?? 0).toFixed(2);
    document.getElementById('gamma-val').innerText = Number(eeg.gamma ?? 0).toFixed(2);

    document.getElementById('cog-load').innerText = Number(cognitive.load?.value ?? 0).toFixed(2);
    document.getElementById('cog-fill').style.width = `${(cognitive.load?.value ?? 0) * 100}%`;
    document.getElementById('attention-val').innerText = Math.round((cognitive.attention ?? 0) * 100);
    document.getElementById('error-val').innerText = Math.round((cognitive.errorRisk ?? 0) * 100);
    document.getElementById('attention-fill').style.width = `${(cognitive.attention ?? 0) * 100}%`;
    document.getElementById('confidence-val').innerText = Math.round((memory.confidence ?? structured.meta?.confidence ?? 0.5) * 100);
    document.getElementById('anxiety-base').innerText = Math.round((memory.anxietyBaseline ?? 0.3) * 100);
    document.getElementById('sem-count').innerText = memory.semanticCount ?? structured.meta?.semanticCount ?? 0;
    document.getElementById('autobio-count').innerText = memory.autobioCount ?? structured.meta?.autobioCount ?? 0;

    document.getElementById('wellbeing-score').innerText = Number(wellbeing.score ?? 0).toFixed(2);
    document.getElementById('well-fill').style.width = `${(wellbeing.score ?? 0) * 100}%`;
    document.getElementById('risk-level').innerText = Number(wellbeing.risk ?? 0).toFixed(2);
    document.getElementById('risk-fill').style.width = `${(wellbeing.risk ?? 0) * 100}%`;
    document.getElementById('social-pressure').innerText = Math.round((social.pressure ?? 0) * 100);
    document.getElementById('personal-weight-val').innerText = `${((structured.meta?.personalWeight ?? 0.6) * 100).toFixed(0)}%`;
    document.getElementById('baseline-status').innerHTML = core.isCalibrated()
      ? '<span style="color:#4ade80">personal</span>'
      : '<span style="color:#fb923c">static</span>';

    renderHumanSimLifecycle(current.humanSim ?? structured.meta?.humanSimLifecycle ?? core.getHumanSimLifecycleStatus?.() ?? null);
    updateTimeline(physiology.hr?.value ?? 0, cognitive.load?.value ?? 0, wellbeing.score ?? 0);
    setRecommendation(core.getRecommendation ? core.getRecommendation() : { message: '', actions: [] });
  } catch (error) {
    const message = `Dashboard render error: ${error.message}`;
    const recommend = document.getElementById('recommend-message');
    if (recommend) recommend.textContent = message;
    console.error('[dashboard] updateDashboard failed:', error);
  }
}

function setSourceChrome(mode) {
  const isSimulated = mode === 'simulator';
  const badge = document.getElementById('source-badge');
  const strip = document.getElementById('source-strip');
  const btnSim = document.getElementById('btn-sim');
  const btnWear = document.getElementById('btn-wear');

  if (!badge || !strip || !btnSim || !btnWear) return;

  if (isSimulated) {
    badge.className = 'source-badge sim';
    badge.innerHTML = '<i class="fas fa-flask"></i> SIMULATED HUMAN';
    strip.className = 'source-strip sim';
    btnSim.className = 'primary';
    btnWear.className = 'warn-btn';
    btnSim.style.boxShadow = '0 0 8px rgba(0,245,212,0.35)';
    btnWear.style.boxShadow = '';
    return;
  }

  badge.className = 'source-badge wear';
  badge.innerHTML = '<i class="fas fa-watch"></i> WEARABLE';
  strip.className = 'source-strip wear';
  btnSim.className = 'primary';
  btnWear.className = 'warn-btn active';
  btnWear.style.boxShadow = '0 0 8px rgba(249,168,37,0.35)';
  btnSim.style.boxShadow = '';
}

function switchSource(mode) {
  const core = getCore();
  const sim = getHumanSim();
  if (!core) return;

  if (mode === 'simulator') {
    core.useSimulatedHumanSource();
  } else {
    core.useWearable({
      name: 'Demo Wearable Adapter',
      read() {
        if (!sim) return { error: 'HumanSim unavailable for simulated wearable demo' };

        const bio = sim.generateBio();
        const eeg = sim.generateEEGBands();
        const snapshot = sim.snapshot();

        return {
          state: {
            current: snapshot.state,
            displayed: snapshot.displayedEmotion,
            previous: snapshot.prevState,
            age: snapshot.stateAge,
          },
          physiology: {
            hr: bio.hr + (Math.random() - 0.5) * 3,
            hrv: bio.hrv + (Math.random() - 0.5) * 2,
            gsr: bio.gsr,
            rr: bio.rr,
            eeg: bio.eeg,
          },
          eeg: {
            theta: eeg.theta,
            alpha: eeg.alpha,
            beta: eeg.beta,
            gamma: eeg.gamma,
            ratio: eeg.thetaAlphaRatio,
            microstate: eeg.microstateLabel,
          },
          cognitive: {
            load: snapshot.cognitiveLoad,
            errorRate: snapshot.errorRate,
            attention: snapshot.attentionFocus,
          },
          memory: {
            confidence: snapshot.confidence,
            anxietyBaseline: snapshot.anxietyBaseline,
            semanticCount: snapshot.memory?.semanticCount ?? 0,
            autobioCount: snapshot.memory?.autobiographicalCount ?? 0,
          },
          social: {
            pressure: snapshot.socialPressure,
            masking: snapshot.maskingLevel,
          },
          meta: {
            iaf: snapshot.iaf,
            burnoutRisk: snapshot.memory?.burnoutRisk ?? 0,
          },
        };
      },
    }, { deviceName: 'Demo Wearable' });
    setQAAnswer('fa-watch', 'Dashboard is using the demo wearable adapter contract. Real device adapters can plug into the same read/connect/disconnect shape.', '#f9a825');
  }

  if (window.ArtifactDetector?.reset) window.ArtifactDetector.reset();
  if (window.ArtifactDetector?.setSourceMode) window.ArtifactDetector.setSourceMode(mode);

  setSourceChrome(mode);
  _latestStructuredSnapshot = core.getSnapshot ? core.getSnapshot() : _latestStructuredSnapshot;
  updateDashboard(_latestStructuredSnapshot);
}

function dismissToast(immediate = false) {
  const toast = document.getElementById('feedback-toast');
  if (!toast) return;

  if (toast._autoTimer) clearTimeout(toast._autoTimer);

  if (immediate) {
    toast.remove();
    _feedbackToast = null;
    return;
  }

  toast.classList.add('dismissing');
  setTimeout(() => {
    toast.remove();
    _feedbackToast = null;
  }, 260);
}

function handleFeedback(type, predictedState, confirmedState, bioSnapshot) {
  if (window.EthicsGuard) {
    const check = window.EthicsGuard.validateFeedback({
      predictedState,
      confirmedState,
      source: type,
    });

    if (!check.valid) {
      const area = document.getElementById('state-picker-area');
      if (area) area.textContent = check.reason;
      if (check.penalty) dismissToast();
      return;
    }
  }

  const core = getCore();
  if (core) {
    core.submitFeedback({
      predictedState,
      confirmedState,
      bioSnapshot,
    });
  }

  _pendingBioSnapshot = null;
  dismissToast();
  refreshCalibStats();
}

function showStatePicker(predictedState) {
  const area = document.getElementById('state-picker-area');
  if (!area) return;

  area.replaceChildren();

  const label = document.createElement('div');
  label.style.cssText = 'font-size:0.66rem;color:var(--text-secondary);margin-top:8px;margin-bottom:4px;';
  label.textContent = 'What are you actually feeling right now?';
  area.appendChild(label);

  const container = document.createElement('div');
  container.className = 'state-picker';
  area.appendChild(container);

  DASHBOARD_EMOTION_STATES.forEach((state) => {
    const btn = document.createElement('button');
    btn.className = 'state-pick-btn';
    btn.textContent = DASHBOARD_EMOTION_LABELS[state] ?? state;
    btn.addEventListener('click', () => handleFeedback('deny', predictedState, state, _pendingBioSnapshot));
    container.appendChild(btn);
  });
}

function showFeedbackToast(question) {
  if (_feedbackToast) dismissToast(true);

  const { predictedState, confidence, bioSnapshot } = question;
  _pendingBioSnapshot = bioSnapshot;

  const toast = document.createElement('div');
  toast.className = 'feedback-toast';
  toast.id = 'feedback-toast';
  toast.innerHTML = `
    <div class="feedback-title"><i class="fas fa-comment-dots"></i> Confirm Current Emotion</div>
    <div class="feedback-q">The system detected <strong style="color:var(--cyan-core)">${DASHBOARD_EMOTION_LABELS[predictedState] ?? predictedState}</strong>. Is that correct?</div>
    <div class="feedback-conf">confidence: ${(confidence * 100).toFixed(0)}% | HR ${bioSnapshot?.hr?.toFixed(0) ?? '-'} bpm</div>
    <div class="feedback-btns">
      <button id="fb-confirm-btn" class="feedback-btn confirm">Yes</button>
      <button id="fb-deny-btn" class="feedback-btn deny">No</button>
      <button id="fb-skip-btn" class="feedback-btn skip">Skip</button>
    </div>
    <div id="state-picker-area"></div>
    <div class="feedback-dismiss-progress"><div class="feedback-dismiss-bar"></div></div>
  `;

  document.body.appendChild(toast);
  _feedbackToast = toast;
  _feedbackToast._autoTimer = setTimeout(() => dismissToast(), 15000);

  document.getElementById('fb-confirm-btn').addEventListener('click', () => handleFeedback('confirm', predictedState, predictedState, bioSnapshot));
  document.getElementById('fb-deny-btn').addEventListener('click', () => showStatePicker(predictedState));
  document.getElementById('fb-skip-btn').addEventListener('click', () => dismissToast());

  if (window.EthicsGuard?.markToastShown) window.EthicsGuard.markToastShown();
}

function initFeedbackCallback() {
  const core = getCore();
  if (core?.setFeedbackCallback) {
    core.setFeedbackCallback(showFeedbackToast);
  }
}

async function refreshInsights() {
  const core = getCore();
  const list = document.getElementById('insight-list');
  if (!core || !list || _insightRefreshInFlight) return;
  if (typeof core.generateInsights !== 'function') {
    list.innerHTML = '<span style="color:var(--gray-muted);font-size:0.65rem;">Insights engine not ready yet.</span>';
    return;
  }

  _insightRefreshInFlight = true;
  list.innerHTML = '<span style="color:var(--gray-muted);font-size:0.65rem;">Processing insights...</span>';

  try {
    const insights = await core.generateInsights();
    if (!insights || insights.length === 0) {
      list.innerHTML = '<span style="color:var(--gray-muted);font-size:0.65rem;">No insights yet. More longitudinal session data is needed.</span>';
      return;
    }

    list.replaceChildren();

    insights.forEach((insight) => {
      const normalized = normalizeInsight(insight);
      const card = document.createElement('div');
      card.className = `insight-card ${insight.type}`;

      const title = document.createElement('div');
      title.className = 'insight-title';
      title.innerHTML = `<i class="fas ${INSIGHT_ICONS[insight.type] ?? 'fa-info'}"></i> ${normalized.title}`;

      const body = document.createElement('div');
      body.className = 'insight-body';
      body.textContent = normalized.body;

      const action = document.createElement('div');
      action.className = 'insight-action';
      action.textContent = `-> ${normalized.action}`;

      const score = document.createElement('div');
      score.className = 'insight-score';
      score.textContent = `score: ${normalized.score}`;

      card.append(title, body, action, score);
      list.appendChild(card);
    });
  } catch (error) {
    list.textContent = `Error: ${error.message}`;
  } finally {
    _insightRefreshInFlight = false;
  }
}

function applyPersonality() {
  const sim = getHumanSim();
  if (!sim) return;

  sim.setPersonality({
    openness: parseFloat(document.getElementById('openness').value),
    conscientiousness: parseFloat(document.getElementById('conscientiousness').value),
    extraversion: parseFloat(document.getElementById('extraversion').value),
    agreeableness: parseFloat(document.getElementById('agreeableness').value),
    neuroticism: parseFloat(document.getElementById('neuroticism').value),
  });

  updateDashboard();
}

function renderConsumers() {
  const list = document.getElementById('consumer-list');
  const core = getCore();
  if (!list || !core) return;

  list.replaceChildren();

  const names = core.listConsumers().filter((name) => name !== '__dashboard_ui__');
  if (names.length === 0) {
    const empty = document.createElement('span');
    empty.style.cssText = 'color:var(--gray-muted);font-size:0.65rem;';
    empty.textContent = 'No consumers registered.';
    list.appendChild(empty);
    return;
  }

  names.forEach((name) => {
    const row = document.createElement('div');
    row.className = 'consumer-item';

    const label = document.createElement('span');
    label.className = 'consumer-name';
    label.textContent = name;

    const btn = document.createElement('button');
    btn.className = 'consumer-remove';
    btn.type = 'button';
    btn.textContent = 'x';
    btn.addEventListener('click', () => removeConsumer(name));

    row.append(label, btn);
    list.appendChild(row);
  });
}

function addConsumer() {
  const core = getCore();
  const input = document.getElementById('consumer-name-input');
  if (!core || !input) return;

  const name = input.value.trim();
  if (!name) return;

  core.registerConsumer(name, (eventType) => {
    setQAAnswer('fa-broadcast-tower', `${name}: ${eventType}`, 'var(--violet)');
    setTimeout(() => {
      const qa = document.getElementById('qa-answer');
      if (qa && qa.textContent.includes(name)) qa.textContent = '';
    }, 3000);
  });

  input.value = '';
  renderConsumers();
}

function removeConsumer(name) {
  const core = getCore();
  if (!core) return;

  core.unregisterConsumer(name);
  renderConsumers();
}

function syncConsentControls(consent = {}) {
  CONSENT_FIELDS.forEach((key) => {
    const el = document.getElementById(getConsentCheckboxId(key));
    if (el) el.checked = consent[key] !== false;
  });
}

function readConsentControls() {
  return CONSENT_FIELDS.reduce((acc, key) => {
    const el = document.getElementById(getConsentCheckboxId(key));
    acc[key] = !!el?.checked;
    return acc;
  }, {});
}

function renderSecurityStatus(stats) {
  const security = stats?.security || {};
  const authStatus = document.getElementById('db-auth-status');
  const binding = document.getElementById('db-crypto-binding');
  const hint = document.getElementById('security-hint');
  if (authStatus) {
    const label = security.unlocked ? 'unlocked' : security.secretBound ? 'locked' : 'legacy device-bound';
    authStatus.innerHTML = security.unlocked
      ? '<span class="stat-val good">unlocked</span>'
      : security.secretBound
        ? '<span class="stat-val warn">locked</span>'
        : '<span class="stat-val warn">legacy device-bound</span>';
    authStatus.dataset.label = label;
  }
  if (binding) {
    const value = stats?.cryptoBinding || security.cryptoBinding || 'none';
    binding.textContent = value;
  }
  if (hint) {
    hint.textContent = security.unlocked
      ? 'Protected exports and audit reads are available for this session.'
      : 'Export and audit log stay locked until you unlock with a passphrase.';
  }
  syncConsentControls(stats?.consent || {});
}

async function unlockSecurity() {
  if (!window.NuengdeawDB?.unlockWithPassphrase) return;
  const input = document.getElementById('security-passphrase');
  const passphrase = input?.value?.trim() || '';
  const result = await window.NuengdeawDB.unlockWithPassphrase(passphrase);
  if (!result?.success) {
    setQAAnswer('fa-lock', result?.error || 'Unlock failed', '#fca5a5');
    return;
  }
  if (input) input.value = '';
  setQAAnswer('fa-lock-open', 'Security unlocked for protected export and audit actions.', 'var(--green-flow)');
  await refreshDBStats();
  await refreshAuditLog();
}

async function lockSecurity() {
  if (!window.NuengdeawDB?.lockSecurity) return;
  window.NuengdeawDB.lockSecurity();
  setQAAnswer('fa-lock', 'Security locked.', '#f9a825');
  await refreshDBStats();
  await refreshAuditLog();
}

function saveConsentSettings() {
  if (!window.NuengdeawDB?.setConsent) return;
  const result = window.NuengdeawDB.setConsent(readConsentControls());
  if (result?.success) {
    setQAAnswer('fa-shield-heart', 'Consent settings updated.', 'var(--cyan-core)');
    refreshDBStats();
  }
}

async function refreshAuditLog() {
  const box = document.getElementById('audit-log-preview');
  if (!box || !window.NuengdeawDB?.getAuditLog) return;
  const result = window.NuengdeawDB.getAuditLog(12);
  if (result?.success === false) {
    box.textContent = result.error || 'Audit log locked.';
    return;
  }
  if (!Array.isArray(result) || result.length === 0) {
    box.textContent = 'No audit events yet.';
    return;
  }
  box.textContent = result.map((entry) => {
    const ts = entry?.ts ? new Date(entry.ts).toLocaleString('en-GB') : '-';
    return `${ts} | ${entry?.action || 'unknown'} | ${entry?.storageMode || '-'}`;
  }).join('\n');
}

async function deleteUserData() {
  if (!window.NuengdeawDB?.deleteUserData) return;
  if (!confirm('Delete user sessions, events, labels, semantic memory, and export history?')) return;
  const result = await window.NuengdeawDB.deleteUserData();
  if (!result?.success) {
    setQAAnswer('fa-trash', result?.error || 'Delete failed', '#fca5a5');
    return;
  }
  setQAAnswer('fa-trash', 'User data deleted from tracked stores.', '#f9a825');
  await refreshDBStats();
  await refreshAuditLog();
}

async function refreshDBStats() {
  if (!window.NuengdeawDB) return;

  try {
    const stats = await window.NuengdeawDB.getStorageStats();
    const modeEl = document.getElementById('db-storage-mode');

    modeEl.innerHTML = stats.storageMode === 'idb'
      ? '<span class="stat-val good">idb</span>'
      : stats.storageMode === 'ls'
        ? '<span class="stat-val warn">localStorage</span>'
        : '<span class="stat-val bad">memory only</span>';

    document.getElementById('db-encryption').innerHTML = stats.encryption
      ? '<span class="stat-val good">AES-GCM</span>'
      : '<span class="stat-val warn">plaintext</span>';

    if (stats.indexedDB) {
      document.getElementById('db-sessions').innerText = stats.indexedDB.sessions;
      document.getElementById('db-events').innerText = stats.indexedDB.events;
      document.getElementById('db-labels').innerText = stats.indexedDB.labels ?? '-';
    } else if (stats.memory) {
      document.getElementById('db-sessions').innerText = `${stats.memory.sessions} (mem)`;
      document.getElementById('db-events').innerText = `${stats.memory.events} (mem)`;
      document.getElementById('db-labels').innerText = `${stats.memory.labels} (mem)`;
    }

    document.getElementById('db-ls').innerText = stats.localStorage?.kb ? `${stats.localStorage.kb} KB` : '-';
    renderSecurityStatus(stats);

    if (stats.retention) {
      document.getElementById('ret-sessions').value = stats.retention.sessions ?? 7;
      document.getElementById('ret-events').value = stats.retention.events ?? 7;
      document.getElementById('ret-labels').value = stats.retention.labels ?? 90;
    }
    await refreshAuditLog();
  } catch (error) {
    console.warn('DB stats failed:', error.message);
  }
}

async function exportData(format) {
  if (!window.NuengdeawDB) return;

  if (format === 'csv') {
    const result = await window.NuengdeawDB.downloadCSV(7);
    if (result?.success === false) {
      setQAAnswer('fa-lock', result.error || 'Export blocked', '#f9a825');
      await refreshDBStats();
    }
    return;
  }

  const result = await window.NuengdeawDB.downloadJSON(7);
  if (result?.success === false) {
    setQAAnswer('fa-lock', result.error || 'Export blocked', '#f9a825');
    await refreshDBStats();
  }
}

async function nukeDB() {
  if (!confirm('Do you want to wipe all DB data?')) return;

  if (window.NuengdeawDB) await window.NuengdeawDB.nuke();

  const core = getCore();
  if (core) core.resetBaseline();

  await refreshDBStats();
  refreshCalibStats();
}

function applyRetention() {
  if (!window.NuengdeawDB) return;

  const sessions = parseInt(document.getElementById('ret-sessions').value, 10) || 7;
  const events = parseInt(document.getElementById('ret-events').value, 10) || 7;
  const labels = parseInt(document.getElementById('ret-labels').value, 10) || 90;

  window.NuengdeawDB.setRetention('sessions', sessions);
  window.NuengdeawDB.setRetention('events', events);
  window.NuengdeawDB.setRetention('labels', labels);
  refreshDBStats();
}

function refreshCalibStats() {
  const core = getCore();
  if (!core?.getCalibrationStats) return;

  const stats = core.getCalibrationStats();
  document.getElementById('calib-labels').innerText = stats.labelCount;
  document.getElementById('calib-pw').innerText = `${(stats.personalWeight * 100).toFixed(0)}%`;
  document.getElementById('calib-streak').innerText = stats.confirmStreak;
  document.getElementById('calib-ema').innerText = stats.emaStates.length > 0 ? stats.emaStates.join(', ') : '-';
  renderHumanSimLifecycle(core.getHumanSimLifecycleStatus ? core.getHumanSimLifecycleStatus() : null);
}

function simulateFeedback() {
  const snapshot = getCurrentStructuredSnapshot();
  const current = snapshot?.current;
  const bioSnapshot = current ? {
    hr: current.physiology.hr.value,
    hrv: current.physiology.hrv.value,
    gsr: current.physiology.gsr.value,
    rr: current.physiology.rr.value,
  } : {
    hr: 72,
    hrv: 38,
    gsr: 4.5,
    rr: 15,
  };

  showFeedbackToast({
    predictedState: current?.emotion?.name ?? 'NEUTRAL',
    confidence: 0.5,
    bioSnapshot,
  });
}

function resetCalibration() {
  if (!confirm('Reset calibration and delete all labels?')) return;

  const core = getCore();
  if (core) core.resetBaseline();

  refreshCalibStats();
}

function extendHumanSimLife() {
  const core = getCore();
  if (!core?.extendHumanSimLife) return;

  const result = core.extendHumanSimLife(1);
  renderHumanSimLifecycle(result);
  setQAAnswer('fa-hourglass-half', 'Simulation fallback extended by 1 day.', 'var(--cyan-core)');
  updateDashboard(getCurrentStructuredSnapshot());
}

function retireHumanSimNow() {
  const core = getCore();
  if (!core?.retireHumanSimNow) return;
  if (!confirm('Do you want to retire the simulation fallback immediately?')) return;

  const result = core.retireHumanSimNow();
  renderHumanSimLifecycle(result);
  setQAAnswer('fa-skull', 'Simulation fallback has been retired.', '#f9a825');
  updateDashboard(getCurrentStructuredSnapshot());
}

function reportWearableDisconnect() {
  const core = getCore();
  if (!core?.reportWearableDisconnected) return;

  core.reportWearableDisconnected('ui_reported_disconnect');
  switchSource('simulator');
  setQAAnswer('fa-plug-circle-xmark', 'System switched back to simulation fallback.', '#fb923c');
}

function togglePower() {
  const core = getCore();
  if (!core) return;

  if (core.isPaused?.()) {
    const result = core.resume?.();
    if (result?.success) {
      updatePowerToggle();
      setQAAnswer('fa-power-off', 'NuengdeawCore resumed.', 'var(--green-flow)');
      updateDashboard(getCurrentStructuredSnapshot());
    }
    return;
  }

  const result = core.pause?.();
  if (result?.success) {
    updatePowerToggle();
    setQAAnswer('fa-power-off', 'NuengdeawCore paused.', '#fca5a5');
  }
}

function wireControls() {
  ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyPersonality);
  });

  document.getElementById('reset-sim').addEventListener('click', () => {
    const sim = getHumanSim();
    if (sim) sim.reset();
    updateDashboard(getCurrentStructuredSnapshot());
  });

  document.getElementById('scenario-select').addEventListener('change', (event) => {
    const sim = getHumanSim();
    if (sim && event.target.value) sim.setScenario(event.target.value);
    updateDashboard(getCurrentStructuredSnapshot());
  });

  document.getElementById('export-csv').addEventListener('click', () => exportData('csv'));
  document.getElementById('security-unlock-btn').addEventListener('click', unlockSecurity);
  document.getElementById('security-lock-btn').addEventListener('click', lockSecurity);
  document.getElementById('security-audit-btn').addEventListener('click', refreshAuditLog);
  document.getElementById('consent-save-btn').addEventListener('click', saveConsentSettings);
  document.getElementById('delete-user-data-btn').addEventListener('click', deleteUserData);
  document.getElementById('power-toggle').addEventListener('click', togglePower);
  document.getElementById('hs-extend-btn').addEventListener('click', extendHumanSimLife);
  document.getElementById('hs-retire-btn').addEventListener('click', retireHumanSimNow);
  document.getElementById('hs-disconnect-btn').addEventListener('click', reportWearableDisconnect);
  document.getElementById('security-passphrase').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') unlockSecurity();
  });

  document.getElementById('ask-btn').addEventListener('click', () => {
    const core = getCore();
    const question = document.getElementById('ask-input').value.trim();
    if (!question) return;

    const answer = core?.ask ? core.ask(question) : 'Core not ready';
    setQAAnswer('fa-comment', answer);
  });
}

async function startDashboard() {
  const showFatalError = (message) => {
    const box = document.createElement('div');
    box.style.padding = '40px';
    box.style.color = '#f87171';
    box.style.fontFamily = 'monospace';
    box.textContent = String(message || 'Unknown dashboard error');
    document.body.replaceChildren(box);
  };

  const core = getCore();
  if (!core) {
    showFatalError('Error: NuengdeawCore not loaded.');
    return;
  }

  try {
    if (window.NuengdeawFoundationStandardBridge?.ready) {
      setBootStatus('Boot: binding central standard...');
      await window.NuengdeawFoundationStandardBridge.ready();
    }
    if (core.loadLanguageStandard) {
      setBootStatus('Boot: loading Phasa Tawan standard...');
      await core.loadLanguageStandard();
    }
    setBootStatus('Boot: initializing core...');
    const boot = core.bootstrap
      ? core.bootstrap({ outputStyle: 'adaptive', language: 'en', realtimeMode: 'hybrid', autoNotify: true })
      : core.init({ outputStyle: 'adaptive', language: 'en', realtimeMode: 'hybrid', autoNotify: true });

    if (!boot.success) {
      showFatalError(`Core bootstrap failed: ${String(boot.message || 'unknown_error')}`);
      return;
    }

    setBootStatus('Boot: subscribing UI...');
    core.subscribe('__dashboard_ui__', (_eventType, ctx) => {
      _latestStructuredSnapshot = ctx?.structured ?? _latestStructuredSnapshot;
      updateDashboard(_latestStructuredSnapshot);
      updatePowerToggle();
    }, { immediate: true });

    setBootStatus('Boot: wiring feedback...');
    initFeedbackCallback();
    setBootStatus('Boot: building chart...');
    initChart();
    setBootStatus('Boot: wiring controls...');
    wireControls();
    updatePowerToggle();
    setBootStatus('Boot: rendering consumers...');
    renderConsumers();
    setBootStatus('Boot: fetching snapshot...');
    _latestStructuredSnapshot = core.getSnapshot ? core.getSnapshot() : _latestStructuredSnapshot;
    updateDashboard(_latestStructuredSnapshot);
    setBootStatus('Boot: refreshing stats...');
    refreshCalibStats();
    refreshDBStats();
    refreshInsights();

    clearDashboardTimers();
    _dbStatTimer = setInterval(refreshDBStats, 10000);
    _insightTimer = setInterval(refreshInsights, 10 * 60 * 1000);
    _calibTimer = setInterval(refreshCalibStats, 5000);

    window.addEventListener('beforeunload', () => {
      core.unregisterConsumer('__dashboard_ui__');
      clearDashboardTimers();
    }, { once: true });
  } catch (error) {
    setBootStatus(`Boot failed: ${error.message}`);
    console.error('[dashboard] startDashboard failed:', error);
  }
}

function bootDashboard() {
  if (_dashboardStarted) return;
  _dashboardStarted = true;
  updateClock();
  _clockTimer = setInterval(updateClock, 1000);
  startDashboard();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    switchSource,
    refreshInsights,
    addConsumer,
    removeConsumer,
    exportData,
    nukeDB,
    applyRetention,
    simulateFeedback,
    resetCalibration,
    extendHumanSimLife,
    retireHumanSimNow,
    reportWearableDisconnect,
    togglePower,
    bootDashboard,
  });
  window.SimulatedHumanSource = window.SimulatedHumanSource || window.HumanSim || null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDashboard, { once: true });
} else {
  bootDashboard();
}
