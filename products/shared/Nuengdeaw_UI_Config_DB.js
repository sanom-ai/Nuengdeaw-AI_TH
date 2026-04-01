'use strict';

const NuengdeawUIConfigDB = (() => {
  const LS_KEY = 'nuengdeaw_ui_config_v1';

  const DEFAULT_CONFIG = Object.freeze({
    keyConventions: {
      owners: ['shared', 'gen1', 'gen2', 'gen3', 'gen4'],
      format: '<owner>.<feature>.<name>',
      lineModes: ['single', 'multi'],
    },
    statePalette: {
      FLOW:{dot:'#047857',border:'rgba(4,120,87,.28)',bg:'rgba(4,120,87,.07)'},
      READY:{dot:'#0097a7',border:'rgba(0,151,167,.28)',bg:'rgba(0,151,167,.07)'},
      STRESS:{dot:'#dc2626',border:'rgba(220,38,38,.32)',bg:'rgba(220,38,38,.07)'},
      CONFUSION:{dot:'#7c3aed',border:'rgba(124,58,237,.30)',bg:'rgba(124,58,237,.07)'},
      BOREDOM:{dot:'#64748b',border:'rgba(100,116,139,.25)',bg:'rgba(100,116,139,.06)'},
      EXCITEMENT:{dot:'#b45309',border:'rgba(180,83,9,.28)',bg:'rgba(180,83,9,.07)'},
      FATIGUE:{dot:'#ea580c',border:'rgba(234,88,12,.28)',bg:'rgba(234,88,12,.07)'},
      NEUTRAL:{dot:'#374151',border:'rgba(55,65,81,.20)',bg:'rgba(55,65,81,.05)'},
      FRUSTRATION:{dot:'#c2410c',border:'rgba(194,65,12,.30)',bg:'rgba(194,65,12,.07)'},
      ANXIETY:{dot:'#dc2626',border:'rgba(220,38,38,.38)',bg:'rgba(220,38,38,.09)'},
      CURIOSITY:{dot:'#1a5fff',border:'rgba(26,95,255,.28)',bg:'rgba(26,95,255,.07)'},
      DISGUST:{dot:'#4b5563',border:'rgba(75,85,99,.24)',bg:'rgba(75,85,99,.06)'},
      SURPRISE:{dot:'#0891b2',border:'rgba(8,145,178,.28)',bg:'rgba(8,145,178,.07)'},
      CALM:{dot:'#0d9488',border:'rgba(13,148,136,.28)',bg:'rgba(13,148,136,.07)'},
    },
    severityPalette: {
      critical:'#dc2626',
      warning:'#d97706',
      mild:'#7c3aed',
      neutral:'#0891b2',
      normal:'#64748b',
      positive:'#047857',
    },
    disclaimers: {
      wellness:
        'Warning: For Wellness & Research Purposes Only - NOT a medical device. Not for clinical diagnosis. Consult a licensed healthcare professional.',
    },
    textCatalog: {
      shared: {
        nav: {
          back_to_main: {
            single: 'Back To Main',
            multi: ['Back To', 'Main'],
          },
        },
        export: {
          pdf_research: {
            single: '📄 Export PDF Report (Research)',
            multi: ['📄 Export PDF', 'Report (Research)'],
          },
          json_raw: {
            single: '{ } Export JSON (Raw Data)',
            multi: ['{ } Export JSON', '(Raw Data)'],
          },
          csv_signals: {
            single: '📊 Export CSV (Signals)',
            multi: ['📊 Export CSV', '(Signals)'],
          },
          markdown_summary: {
            single: '📝 Export Markdown (Summary)',
            multi: ['📝 Export Markdown', '(Summary)'],
          },
        },
        status: {
          loading: {
            single: 'Loading...',
            multi: ['Loading...', 'Please wait'],
          },
        },
      },
      gen1: {
        branding: {
          subtitle: {
            single: 'BioSignal-Only Reading System V.0.0 · Gen 1 Baseline',
            multi: ['BioSignal-Only Reading System V.0.0', 'Gen 1 Baseline'],
          },
        },
      },
      gen2: {
        calibration: {
          sub: {
            single: 'กำลังเชื่อมต่อ Passive BCI EEG Module และปรับเทียบ Bayesian Fusion Engine',
            multi: [
              'กำลังเชื่อมต่อ Passive BCI EEG Module',
              'และปรับเทียบ Bayesian Fusion Engine',
            ],
          },
        },
      },
    },
  });

  const _clone = (v) => JSON.parse(JSON.stringify(v));

  const _safeParse = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const _read = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return _clone(DEFAULT_CONFIG);
      const parsed = _safeParse(raw);
      if (!parsed) return _clone(DEFAULT_CONFIG);
      return {
        keyConventions: { ...DEFAULT_CONFIG.keyConventions, ...(parsed.keyConventions || {}) },
        statePalette: { ...DEFAULT_CONFIG.statePalette, ...(parsed.statePalette || {}) },
        severityPalette: { ...DEFAULT_CONFIG.severityPalette, ...(parsed.severityPalette || {}) },
        disclaimers: { ...DEFAULT_CONFIG.disclaimers, ...(parsed.disclaimers || {}) },
        textCatalog: {
          ...DEFAULT_CONFIG.textCatalog,
          ...(parsed.textCatalog || {}),
          shared: {
            ...(DEFAULT_CONFIG.textCatalog.shared || {}),
            ...((parsed.textCatalog && parsed.textCatalog.shared) || {}),
          },
          gen1: {
            ...(DEFAULT_CONFIG.textCatalog.gen1 || {}),
            ...((parsed.textCatalog && parsed.textCatalog.gen1) || {}),
          },
          gen2: {
            ...(DEFAULT_CONFIG.textCatalog.gen2 || {}),
            ...((parsed.textCatalog && parsed.textCatalog.gen2) || {}),
          },
          gen3: {
            ...(DEFAULT_CONFIG.textCatalog.gen3 || {}),
            ...((parsed.textCatalog && parsed.textCatalog.gen3) || {}),
          },
          gen4: {
            ...(DEFAULT_CONFIG.textCatalog.gen4 || {}),
            ...((parsed.textCatalog && parsed.textCatalog.gen4) || {}),
          },
        },
      };
    } catch (_) {
      return _clone(DEFAULT_CONFIG);
    }
  };

  const _write = (cfg) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cfg));
      return true;
    } catch (_) {
      return false;
    }
  };

  const get = () => _read();

  const set = (partial = {}) => {
    const current = _read();
    const next = {
      ...current,
      ...partial,
      keyConventions: { ...current.keyConventions, ...(partial.keyConventions || {}) },
      statePalette: { ...current.statePalette, ...(partial.statePalette || {}) },
      severityPalette: { ...current.severityPalette, ...(partial.severityPalette || {}) },
      disclaimers: { ...current.disclaimers, ...(partial.disclaimers || {}) },
      textCatalog: {
        ...current.textCatalog,
        ...(partial.textCatalog || {}),
        shared: {
          ...(current.textCatalog?.shared || {}),
          ...((partial.textCatalog && partial.textCatalog.shared) || {}),
        },
        gen1: {
          ...(current.textCatalog?.gen1 || {}),
          ...((partial.textCatalog && partial.textCatalog.gen1) || {}),
        },
        gen2: {
          ...(current.textCatalog?.gen2 || {}),
          ...((partial.textCatalog && partial.textCatalog.gen2) || {}),
        },
        gen3: {
          ...(current.textCatalog?.gen3 || {}),
          ...((partial.textCatalog && partial.textCatalog.gen3) || {}),
        },
        gen4: {
          ...(current.textCatalog?.gen4 || {}),
          ...((partial.textCatalog && partial.textCatalog.gen4) || {}),
        },
      },
    };
    _write(next);
    return _clone(next);
  };

  const _getByPath = (obj, path = '') => {
    if (!obj || !path) return null;
    return String(path).split('.').reduce((acc, key) => {
      if (!acc || typeof acc !== 'object') return null;
      return Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : null;
    }, obj);
  };

  const resolveText = (key, options = {}) => {
    const mode = options.mode === 'multi' ? 'multi' : 'single';
    const joinWith = Object.prototype.hasOwnProperty.call(options, 'joinWith') ? String(options.joinWith) : '\n';
    const fallback = Object.prototype.hasOwnProperty.call(options, 'fallback') ? String(options.fallback) : key;
    const cfg = _read();
    const node = _getByPath(cfg.textCatalog, key);
    if (!node || typeof node !== 'object') return fallback;
    if (mode === 'multi') {
      if (Array.isArray(node.multi) && node.multi.length > 0) return node.multi.join(joinWith);
      if (typeof node.single === 'string') return node.single;
      return fallback;
    }
    if (typeof node.single === 'string') return node.single;
    if (Array.isArray(node.multi) && node.multi.length > 0) return node.multi.join(joinWith);
    return fallback;
  };

  const listTextKeys = (owner = null) => {
    const cfg = _read();
    const catalog = cfg.textCatalog || {};
    const owners = owner ? [owner] : Object.keys(catalog);
    const keys = [];
    const walk = (prefix, node) => {
      if (!node || typeof node !== 'object') return;
      const isLeaf = Object.prototype.hasOwnProperty.call(node, 'single') || Object.prototype.hasOwnProperty.call(node, 'multi');
      if (isLeaf) {
        keys.push(prefix);
        return;
      }
      Object.keys(node).forEach((k) => walk(prefix ? `${prefix}.${k}` : k, node[k]));
    };
    owners.forEach((o) => walk(o, catalog[o]));
    return keys;
  };

  const reset = () => {
    const seed = _clone(DEFAULT_CONFIG);
    _write(seed);
    return seed;
  };

  return {
    get,
    set,
    reset,
    resolveText,
    listTextKeys,
    key: LS_KEY,
    version: '1.0.0',
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NuengdeawUIConfigDB;
else if (typeof window !== 'undefined') window.NuengdeawUIConfigDB = NuengdeawUIConfigDB;
