'use strict';

const NuengdeawLogger = (() => {
  const MAX_ENTRIES = 500;
  const entries = [];
  let level = 'info';
  let sink = null;

  const LEVEL_RANK = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  const shouldLog = (nextLevel) => (LEVEL_RANK[nextLevel] || 20) >= (LEVEL_RANK[level] || 20);

  const clone = (value) => {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  };

  const emitConsole = (entry) => {
    const line = JSON.stringify(entry);
    if (entry.level === 'error') console.error(line);
    else if (entry.level === 'warn') console.warn(line);
    else if (entry.level === 'debug') console.debug(line);
    else console.log(line);
  };

  const log = (nextLevel, code, message, context = {}) => {
    if (!shouldLog(nextLevel)) return null;
    const entry = {
      ts: new Date().toISOString(),
      level: nextLevel,
      code,
      message,
      context: clone(context),
    };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();

    if (typeof sink === 'function') {
      try { sink(entry); } catch (_) {}
    } else {
      emitConsole(entry);
    }
    return entry;
  };

  return {
    debug: (code, message, context) => log('debug', code, message, context),
    info: (code, message, context) => log('info', code, message, context),
    warn: (code, message, context) => log('warn', code, message, context),
    error: (code, message, context) => log('error', code, message, context),
    setLevel: (nextLevel = 'info') => { level = nextLevel; },
    setSink: (nextSink) => { sink = typeof nextSink === 'function' ? nextSink : null; },
    getEntries: () => entries.map(clone),
    clear: () => { entries.length = 0; },
  };
})();

if (typeof window !== 'undefined') {
  window.NuengdeawLogger = NuengdeawLogger;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawLogger;
}
