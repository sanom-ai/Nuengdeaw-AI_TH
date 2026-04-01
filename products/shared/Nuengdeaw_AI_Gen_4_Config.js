'use strict';

const NuengdeawGen4Config = (() => {
  const config = {
    provider: 'openai',
    transport: 'local-stub',
    endpoint: '/v1/responses',
    relayEndpoint: '/api/gen4/openai',
    model: 'gpt-live-ready',
    timeoutMs: 20000,
  };

  const get = () => JSON.parse(JSON.stringify(config));

  const set = (next = {}) => {
    Object.assign(config, next || {});
    return get();
  };

  return { get, set };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawGen4Config;
} else if (typeof window !== 'undefined') {
  window.NuengdeawGen4Config = NuengdeawGen4Config;
}
