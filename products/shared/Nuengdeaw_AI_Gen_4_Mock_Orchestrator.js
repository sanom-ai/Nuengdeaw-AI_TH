'use strict';

const NuengdeawGen4 = (() => {
  const VERSION = '0.3.0';
  const DEFAULT_PROVIDER = 'openai';
  const DEFAULT_MODEL = 'gpt-live-ready';
  const DEFAULT_TRANSPORT = 'local-stub';
  const _providers = new Map();

  const _clone = (value) => JSON.parse(JSON.stringify(value));
  const _clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const _toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const _requiredPacketFields = ['state', 'confidence', 'risk', 'wellbeing', 'signals', 'actions'];

  const _validatePacket = (packet) => {
    const errors = [];
    if (!packet || typeof packet !== 'object') return { ok: false, errors: ['packet must be an object'] };
    for (const field of _requiredPacketFields) {
      if (!(field in packet)) errors.push(`missing packet.${field}`);
    }
    if (packet.signals && typeof packet.signals !== 'object') errors.push('packet.signals must be an object');
    if (packet.actions && typeof packet.actions !== 'object') errors.push('packet.actions must be an object');
    return { ok: errors.length === 0, errors };
  };

  const _normalizePacket = (packet) => {
    const next = _clone(packet || {});
    next.state = String(next.state || 'NEUTRAL');
    next.confidence = _clamp01(next.confidence);
    next.risk = _clamp01(next.risk);
    next.wellbeing = _clamp01(next.wellbeing);
    next.gen = _toNumber(next.gen, 4);
    next.tick = _toNumber(next.tick, 0);
    next.signals = {
      hrv: _toNumber(next.signals?.hrv, 38),
      hr: _toNumber(next.signals?.hr, 72),
      gsr: _toNumber(next.signals?.gsr, 4.5),
      rr: _toNumber(next.signals?.rr, 15),
      eeg: _toNumber(next.signals?.eeg, 0.8),
      bands: next.signals?.bands || null,
    };
    next.behavior = {
      dwellScore: _toNumber(next.behavior?.dwellScore, 0.5),
      scrollScore: _toNumber(next.behavior?.scrollScore, 0.5),
      backScore: _toNumber(next.behavior?.backScore, 0.1),
    };
    next.actions = {
      recommended_action: String(next.actions?.recommended_action || 'ACT.MAINTAIN'),
      adaptation: {
        pacing: String(next.actions?.adaptation?.pacing || 'normal'),
        hint_level: String(next.actions?.adaptation?.hint_level || 'medium'),
        summarize: !!next.actions?.adaptation?.summarize,
        break_prompt: !!next.actions?.adaptation?.break_prompt,
      },
    };
    return next;
  };

  const _buildContext = (packet, userInput = '', lane = 'conversation') => ({
    lane,
    ts_iso: new Date().toISOString(),
    state: packet.state,
    confidence: packet.confidence,
    risk: packet.risk,
    wellbeing: packet.wellbeing,
    recommended_action: packet.actions.recommended_action,
    adaptation: packet.actions.adaptation,
    signals: packet.signals,
    behavior: packet.behavior,
    user_input: String(userInput || '').trim(),
  });

  const _buildPrompt = (context) => {
    const adapt = context.adaptation || {};
    return [
      'SYSTEM:',
      'You are Gen4 for Nuengdeaw AI.',
      'Follow Phasa Tawan style: supportive, grounded, concise, non-coercive.',
      'Do not invent hidden sensor states. Use only provided context.',
      'Return one supportive response plus structured action suggestions.',
      '',
      'CONTEXT:',
      `lane=${context.lane}`,
      `state=${context.state}`,
      `confidence=${context.confidence.toFixed(2)}`,
      `risk=${context.risk.toFixed(2)}`,
      `wellbeing=${context.wellbeing.toFixed(2)}`,
      `recommended_action=${context.recommended_action}`,
      `adaptation=pacing:${adapt.pacing} hint:${adapt.hint_level} summarize:${adapt.summarize ? 'on' : 'off'} break:${adapt.break_prompt ? 'on' : 'off'}`,
      `signals=hr:${context.signals.hr} hrv:${context.signals.hrv} gsr:${context.signals.gsr} rr:${context.signals.rr} eeg:${context.signals.eeg}`,
      `behavior=dwell:${context.behavior.dwellScore} scroll:${context.behavior.scrollScore} back:${context.behavior.backScore}`,
      `user_input=${context.user_input || '(none)'}`,
      '',
      'OUTPUT_SCHEMA:',
      '{ message, tone, actions[], safety_flags[], reasoning_tags[] }',
    ].join('\n');
  };

  const _toOpenAIMessages = (context) => ([
    {
      role: 'system',
      content: [
        'You are Gen4 for Nuengdeaw AI.',
        'Follow Phasa Tawan style: supportive, grounded, concise, non-coercive.',
        'Do not invent hidden sensor states. Use only provided context.',
        'Return one supportive response plus structured action suggestions.',
      ].join(' '),
    },
    {
      role: 'user',
      content: _buildPrompt(context),
    },
  ]);

  const _runSafety = (context) => {
    const flags = [];
    const tags = ['grounded-on-core-packet'];
    if (context.risk >= 0.75) {
      flags.push('high-risk');
      tags.push('break-priority');
    }
    if (context.confidence < 0.45) {
      flags.push('low-confidence');
      tags.push('soft-language-only');
    }
    if (context.adaptation?.break_prompt) flags.push('break-prompt');
    if (/force|manipulate|control|coerce/i.test(context.user_input)) {
      flags.push('coercion-block');
      tags.push('refuse-harmful-instruction');
    }
    return { flags, tags };
  };

  const _messageByState = (context) => {
    if (context.risk >= 0.75) return 'Signals look tense right now. Take a short reset, then resume one step at a time.';
    switch (context.state) {
      case 'FLOW': return 'You are in a good rhythm. Keep focus in short, clear work blocks.';
      case 'STRESS': return 'Pressure looks elevated. Remove one non-essential task first.';
      case 'ANXIETY': return 'The mind looks unsettled. Start with what is most controllable right now.';
      case 'FATIGUE': return 'Fatigue signals are rising. A short eye break or pace shift will help.';
      case 'CALM': return 'State is steady and calm. Good moment for clear, careful work.';
      default: return 'Overall state is manageable. Choose the smallest clear next step.';
    }
  };

  const _actionsByContext = (context) => {
    const actions = [];
    const adapt = context.adaptation || {};
    if (context.risk >= 0.75 || adapt.break_prompt) actions.push({ id: 'break-90', label: 'Take 90s break', kind: 'break' });
    if (adapt.summarize) actions.push({ id: 'summarize', label: 'Summarize briefly', kind: 'summarize' });
    if (adapt.hint_level === 'high') actions.push({ id: 'guided-hint', label: 'Step-by-step hint', kind: 'hint' });
    else if (adapt.hint_level === 'low') actions.push({ id: 'minimal-hint', label: 'Minimal hint', kind: 'hint' });
    if (adapt.pacing === 'slow') actions.push({ id: 'slow-lane', label: 'Slow pace', kind: 'pace' });
    else if (adapt.pacing === 'fast') actions.push({ id: 'fast-lane', label: 'Fast summary pace', kind: 'pace' });
    if (!actions.length) actions.push({ id: 'maintain', label: 'Maintain pace', kind: 'maintain' });
    return actions;
  };

  const _buildLocalResponse = (context) => {
    const safety = _runSafety(context);
    const refuse = safety.flags.includes('coercion-block');
    return {
      message: refuse
        ? 'This request risks coercive behavior. Gen4 will not assist with that, but can help rewrite it safely.'
        : _messageByState(context),
      tone: refuse ? 'firm-supportive' : (context.risk >= 0.75 ? 'grounding' : context.state === 'FLOW' ? 'focused' : 'supportive'),
      actions: _actionsByContext(context),
      safety_flags: safety.flags,
      reasoning_tags: safety.tags.concat([`state:${context.state}`, `action:${context.recommended_action}`]),
    };
  };

  const _resolveConfigApi = () => {
    if (typeof window !== 'undefined' && window.NuengdeawGen4Config) return window.NuengdeawGen4Config;
    try {
      // eslint-disable-next-line global-require
      return require('./Nuengdeaw_AI_Gen_4_Config.js');
    } catch (_) {
      return null;
    }
  };

  const _resolveTransportApi = () => {
    if (typeof window !== 'undefined' && window.NuengdeawGen4OpenAITransport) return window.NuengdeawGen4OpenAITransport;
    try {
      // eslint-disable-next-line global-require
      return require('./Nuengdeaw_AI_Gen_4_OpenAI_Transport.js');
    } catch (_) {
      return null;
    }
  };

  const _normalizeRelayOutput = (relayData, context) => {
    const fallback = _buildLocalResponse(context);
    const payload = relayData?.output || relayData || {};
    return {
      message: String(payload.message || fallback.message),
      tone: String(payload.tone || fallback.tone),
      actions: Array.isArray(payload.actions) ? payload.actions : fallback.actions,
      safety_flags: Array.isArray(payload.safety_flags) ? payload.safety_flags : fallback.safety_flags,
      reasoning_tags: Array.isArray(payload.reasoning_tags) ? payload.reasoning_tags : fallback.reasoning_tags,
    };
  };

  const _createProviderResult = (provider, model, context, output, requestPayload, runtime = {}) => ({
    provider,
    model,
    lane: context.lane,
    message: output.message,
    tone: output.tone,
    actions: output.actions,
    safety_flags: output.safety_flags,
    reasoning_tags: output.reasoning_tags,
    request_payload: requestPayload || null,
    runtime: runtime || {},
  });

  const _createOpenAIProvider = () => ({
    id: 'openai',
    label: 'OpenAI',
    transport: DEFAULT_TRANSPORT,
    model: DEFAULT_MODEL,
    endpoint: '/v1/responses',
    getStatus() {
      return {
        provider: 'openai',
        transport: this.transport,
        model: this.model,
        endpoint: this.endpoint,
        live_ready: true,
        configured: this.transport !== 'http' || !!this.endpoint,
      };
    },
    setTransport(transport = DEFAULT_TRANSPORT, options = {}) {
      this.transport = transport;
      if (options.model) this.model = options.model;
      if (options.endpoint) this.endpoint = options.endpoint;
      return this.getStatus();
    },
    buildRequest(context) {
      return {
        provider: 'openai',
        transport: this.transport,
        endpoint: this.endpoint,
        model: this.model,
        input: _toOpenAIMessages(context),
        metadata: {
          lane: context.lane,
          state: context.state,
          confidence: context.confidence,
          risk: context.risk,
          wellbeing: context.wellbeing,
        },
      };
    },
    run(context) {
      const requestPayload = this.buildRequest(context);
      const output = _buildLocalResponse(context);
      return _createProviderResult('openai', this.model, context, output, requestPayload, { transport: this.transport, mode: 'sync-local' });
    },
    async runAsync(context) {
      const requestPayload = this.buildRequest(context);
      if (this.transport !== 'http') {
        const output = _buildLocalResponse(context);
        return _createProviderResult('openai', this.model, context, output, requestPayload, { transport: this.transport, mode: 'async-local' });
      }

      const transportApi = _resolveTransportApi();
      if (!transportApi || typeof transportApi.send !== 'function') {
        throw new Error('openai_transport_unavailable');
      }
      const configApi = _resolveConfigApi();
      const runtimeConfig = configApi && typeof configApi.get === 'function' ? configApi.get() : {};
      const relayResult = await transportApi.send(requestPayload, runtimeConfig);
      if (!relayResult || !relayResult.ok) {
        const status = relayResult?.status || 0;
        throw new Error(`openai_relay_failed_${status}`);
      }
      const output = _normalizeRelayOutput(relayResult.data, context);
      return _createProviderResult('openai', this.model, context, output, requestPayload, {
        transport: this.transport,
        mode: 'relay-http',
        relay_status: relayResult.status,
      });
    },
  });

  const registerProvider = (provider) => {
    if (!provider || !provider.id || typeof provider.run !== 'function') return { success: false, error: 'provider must have id and run(context)' };
    _providers.set(provider.id, provider);
    return { success: true, provider: provider.id };
  };

  const listProviders = () => Array.from(_providers.values()).map((provider) => ({ id: provider.id, label: provider.label || provider.id }));

  const configureProvider = (providerId, options = {}) => {
    const provider = _providers.get(providerId);
    if (!provider || typeof provider.setTransport !== 'function') return { success: false, error: 'provider_not_configurable' };
    return { success: true, status: provider.setTransport(options.transport, options) };
  };

  const getProviderStatus = (providerId = DEFAULT_PROVIDER) => {
    const provider = _providers.get(providerId);
    if (!provider) return null;
    return typeof provider.getStatus === 'function' ? provider.getStatus() : { provider: provider.id || providerId };
  };

  const orchestrate = ({ packet, userInput = '', lane = 'conversation', provider = DEFAULT_PROVIDER } = {}) => {
    const validation = _validatePacket(packet);
    if (!validation.ok) return { success: false, error: 'invalid_packet', validation_errors: validation.errors };
    const normalized = _normalizePacket(packet);
    const context = _buildContext(normalized, userInput, lane);
    const prompt = _buildPrompt(context);
    const providerImpl = _providers.get(provider) || _providers.get(DEFAULT_PROVIDER);
    if (providerImpl?.transport === 'http') {
      return { success: false, error: 'async_required_for_http_transport' };
    }
    const result = providerImpl.run(context);
    return {
      success: true,
      version: VERSION,
      provider: result.provider,
      model: result.model,
      prompt_preview: prompt,
      packet_context: context,
      output: {
        provider: result.provider,
        model: result.model,
        lane: result.lane,
        message: result.message,
        tone: result.tone,
        actions: result.actions,
        safety_flags: result.safety_flags,
        reasoning_tags: result.reasoning_tags,
      },
      request_payload: result.request_payload || null,
      runtime: result.runtime || null,
      output_schema_version: '1.0.0',
      ts_iso: new Date().toISOString(),
    };
  };

  const orchestrateAsync = async ({ packet, userInput = '', lane = 'conversation', provider = DEFAULT_PROVIDER } = {}) => {
    const validation = _validatePacket(packet);
    if (!validation.ok) return { success: false, error: 'invalid_packet', validation_errors: validation.errors };
    const normalized = _normalizePacket(packet);
    const context = _buildContext(normalized, userInput, lane);
    const prompt = _buildPrompt(context);
    const providerImpl = _providers.get(provider) || _providers.get(DEFAULT_PROVIDER);
    const result = providerImpl.runAsync ? await providerImpl.runAsync(context) : providerImpl.run(context);
    return {
      success: true,
      version: VERSION,
      provider: result.provider,
      model: result.model,
      prompt_preview: prompt,
      packet_context: context,
      output: {
        provider: result.provider,
        model: result.model,
        lane: result.lane,
        message: result.message,
        tone: result.tone,
        actions: result.actions,
        safety_flags: result.safety_flags,
        reasoning_tags: result.reasoning_tags,
      },
      request_payload: result.request_payload || null,
      runtime: result.runtime || null,
      output_schema_version: '1.0.0',
      ts_iso: new Date().toISOString(),
    };
  };

  const samplePacket = () => ({
    schema_version: '1.0.0',
    packet_type: 'unified_state_packet',
    ts_iso: new Date().toISOString(),
    gen: 4,
    tick: 144,
    state: 'FLOW',
    confidence: 0.82,
    risk: 0.18,
    wellbeing: 0.76,
    signals: {
      hrv: 42,
      hr: 71,
      gsr: 4.2,
      rr: 14,
      eeg: 0.91,
      bands: { theta: 0.82, alpha: 1.42, beta: 1.04, gamma: 0.48, thetaAlphaRatio: 0.58 },
    },
    behavior: { dwellScore: 0.74, scrollScore: 0.36, backScore: 0.08 },
    actions: {
      recommended_action: 'ACT.MAINTAIN',
      adaptation: { pacing: 'normal', hint_level: 'low', summarize: false, break_prompt: false },
    },
    core_meta: { source_mode: 'simulator', tick_mode: 'ACTIVE', language_standard: 'Phasa Tawan' },
  });

  const packetFromCore = (coreApi) => {
    try {
      const core = coreApi || (typeof window !== 'undefined' ? window.NuengdeawCore : null);
      if (!core) return { success: false, error: 'core_unavailable' };
      if (typeof core.bootstrap === 'function') core.bootstrap({ realtimeMode: 'hybrid' });
      if (typeof core.checkNow === 'function') core.checkNow();

      const full = typeof core.getFullContext === 'function' ? core.getFullContext() : null;
      const structured = full?.structured || (typeof core.getStructured === 'function' ? core.getStructured() : null);
      const recommendation = full?.recommendation || (typeof core.getRecommendation === 'function' ? core.getRecommendation() : null);
      const languageStandardStatus = full?.languageStandardStatus || (typeof core.getLanguageStandardStatus === 'function' ? core.getLanguageStandardStatus() : null);
      const coreStatus = typeof core.getStatus === 'function' ? core.getStatus() : null;

      if (!structured || structured.error) {
        return { success: false, error: structured?.error || 'core_structured_unavailable' };
      }

      const adaptation = recommendation?.actions?.[0]?.adaptation || {
        pacing: structured.summary?.needsSupport ? 'slow' : 'normal',
        hint_level: structured.summary?.needsSupport ? 'high' : 'medium',
        summarize: structured.summary?.needsSupport || false,
        break_prompt: structured.summary?.needsIntervention || false,
      };

      const recommendedAction = recommendation?.actions?.[0]?.type
        ? `ACT.${String(recommendation.actions[0].type).toUpperCase()}`
        : (structured.summary?.needsIntervention ? 'ACT.BREAK' : 'ACT.MAINTAIN');

      const packet = {
        schema_version: '1.0.0',
        packet_type: 'unified_state_packet',
        ts_iso: new Date().toISOString(),
        gen: 4,
        tick: Number(structured.meta?.tick || 0),
        state: String(structured.current?.emotion?.name || structured.summary?.dominantEmotion || 'NEUTRAL'),
        confidence: _clamp01(structured.meta?.confidence ?? 0.5),
        risk: _clamp01(structured.current?.wellbeing?.risk ?? 0.5),
        wellbeing: _clamp01(structured.current?.wellbeing?.score ?? 0.5),
        signals: {
          hrv: _toNumber(structured.current?.physiology?.hrv?.value, 38),
          hr: _toNumber(structured.current?.physiology?.hr?.value, 72),
          gsr: _toNumber(structured.current?.physiology?.gsr?.value, 4.5),
          rr: _toNumber(structured.current?.physiology?.rr?.value, 15),
          eeg: _toNumber(structured.current?.eeg?.arousal, 0.8),
          bands: {
            theta: _toNumber(structured.current?.eeg?.theta, 0),
            alpha: _toNumber(structured.current?.eeg?.alpha, 0),
            beta: _toNumber(structured.current?.eeg?.beta, 0),
            gamma: _toNumber(structured.current?.eeg?.gamma, 0),
            thetaAlphaRatio: _toNumber(structured.current?.eeg?.theta / ((structured.current?.eeg?.alpha || 0) + 0.0001), 0),
          },
        },
        behavior: {
          dwellScore: 0.5,
          scrollScore: 0.5,
          backScore: 0.1,
        },
        actions: {
          recommended_action: recommendedAction,
          adaptation: {
            pacing: String(adaptation.pacing || 'normal'),
            hint_level: String(adaptation.hint_level || 'medium'),
            summarize: !!adaptation.summarize,
            break_prompt: !!adaptation.break_prompt,
          },
        },
        core_meta: {
          source_mode: coreStatus?.sourceMode || structured.current?.sourceMode || 'simulator',
          tick_mode: coreStatus?.tickMode || structured.meta?.tickMode || 'ACTIVE',
          language_standard: languageStandardStatus?.standardName || 'Phasa Tawan',
        },
      };

      return {
        success: true,
        packet,
        structured,
        recommendation,
        core_status: coreStatus,
        language_standard_status: languageStandardStatus,
      };
    } catch (error) {
      return { success: false, error: `core_packet_build_failed:${error.message}` };
    }
  };

  registerProvider(_createOpenAIProvider());

  const bootstrap = (runtimeConfig = {}) => {
    const configApi = _resolveConfigApi();
    const next = configApi && typeof configApi.get === 'function'
      ? { ...configApi.get(), ...(runtimeConfig || {}) }
      : (runtimeConfig || {});
    if (next.provider) {
      configureProvider(next.provider, {
        transport: next.transport || DEFAULT_TRANSPORT,
        model: next.model || DEFAULT_MODEL,
        endpoint: next.endpoint,
      });
    }
    return {
      version: VERSION,
      provider: next.provider || DEFAULT_PROVIDER,
      providerStatus: getProviderStatus(next.provider || DEFAULT_PROVIDER),
    };
  };

  return {
    VERSION,
    bootstrap,
    registerProvider,
    listProviders,
    configureProvider,
    getProviderStatus,
    orchestrate,
    orchestrateAsync,
    samplePacket,
    packetFromCore,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawGen4;
} else if (typeof window !== 'undefined') {
  window.NuengdeawGen4 = NuengdeawGen4;
}
