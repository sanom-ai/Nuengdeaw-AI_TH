'use strict';

const NuengdeawGen4OpenAITransport = (() => {
  const createRelayRequest = (requestPayload, config = {}) => ({
    url: config.relayEndpoint || '/api/gen4/openai',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gen4-Provider': 'openai',
    },
    body: JSON.stringify({
      provider: requestPayload.provider,
      model: requestPayload.model,
      endpoint: requestPayload.endpoint,
      input: requestPayload.input,
      metadata: requestPayload.metadata,
    }),
    timeoutMs: Number(config.timeoutMs || 20000),
  });

  const parseRelayResponse = async (response) => {
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  };

  const send = async (requestPayload, config = {}) => {
    const relayRequest = createRelayRequest(requestPayload, config);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), relayRequest.timeoutMs) : null;
    try {
      const response = await fetch(relayRequest.url, {
        method: relayRequest.method,
        headers: relayRequest.headers,
        body: relayRequest.body,
        signal: controller ? controller.signal : undefined,
      });
      return await parseRelayResponse(response);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  return { createRelayRequest, parseRelayResponse, send };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NuengdeawGen4OpenAITransport;
} else if (typeof window !== 'undefined') {
  window.NuengdeawGen4OpenAITransport = NuengdeawGen4OpenAITransport;
}
