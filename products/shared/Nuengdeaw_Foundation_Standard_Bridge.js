'use strict';

(function attachFoundationStandardBridge(globalScope) {
  const FOUNDATION_URL = '../shared/phasa-tawan-foundation.json';
  const fallbackFoundation = Object.freeze({
    document_name: 'Phasa Tawan Foundation for Nuengdeaw AI',
    document_type: 'language-standard-and-manifesto',
    version: '1.0.0',
    source_files: [FOUNDATION_URL],
    standard: {
      spec_name: 'Phasa Tawan - Nuengdeaw AI Core Language Standard',
      version: '1.0.0',
      status: 'active-foundation',
      source: {
        type: 'runtime-fallback',
        path: FOUNDATION_URL,
      },
      identity: {
        standardName: 'Phasa Tawan',
        runtimeName: 'Phasa Tawan for Nuengdeaw AI',
        lineage_name: 'Phasa Tawan',
        purpose: 'Central language standard for the Nuengdeaw AI foundation and products.',
      },
      ethics: {
        minimumConfidenceForAmbiguousZone: 0.7,
        hardConstraints: [
          'supportive-only',
          'no-coercion',
          'require-consent-for-sensitive-signals',
        ],
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
    },
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function buildFoundationFromCentral(payload) {
    const namespaces = Object.keys(payload?.namespaces ?? {}).map((key) => ({
      prefix: `${key}.`,
      name: key,
      meaning: payload.namespaces[key]?.description ?? '',
      examples: payload.namespaces[key]?.tokens ?? [],
    }));

    const hardConstraints = (payload?.governance?.ethics_sections ?? []).map((section) => ({
      id: section.id,
      title: section.label_en || section.title || section.id,
      rules: [section.title].filter(Boolean),
    }));

    return {
      document_name: 'Phasa Tawan Foundation for Nuengdeaw AI',
      document_type: 'language-standard-and-manifesto',
      version: payload?.schema_version ?? '1.0.0',
      source_files: [FOUNDATION_URL],
      standard: {
        spec_name: 'Phasa Tawan - Nuengdeaw AI Core Language Standard',
        version: payload?.schema_version ?? '1.0.0',
        status: 'active-foundation',
        source: {
          type: 'central-standard',
          path: FOUNDATION_URL,
          generated_at: payload?.generated_at ?? null,
        },
        identity: {
          standardName: payload?.standard_profile?.name_en ?? 'Phasa Tawan',
          runtimeName: 'Phasa Tawan for Nuengdeaw AI',
          lineage_name: payload?.standard_profile?.name_en ?? 'Phasa Tawan',
          purpose: payload?.standard_profile?.purpose ?? fallbackFoundation.standard.identity.purpose,
          design_intent: payload?.standard_profile?.design_intent ?? [],
        },
        ethics: {
          minimumConfidenceForAmbiguousZone: 0.7,
          hardConstraints: hardConstraints.length ? hardConstraints : fallbackFoundation.standard.ethics.hardConstraints,
        },
        namespace_system: {
          known_namespaces: namespaces.length ? namespaces : fallbackFoundation.standard.namespace_system.known_namespaces,
        },
        runtime_profiles: payload?.runtime_profiles ?? null,
      },
      central_standard: payload,
    };
  }

  async function loadJSON(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url}`);
    return response.json();
  }

  async function ready() {
    if (ready._promise) return ready._promise;
    ready._promise = (async () => {
      try {
        const foundation = await loadJSON(FOUNDATION_URL);
        const payload = foundation?.central_standard ?? null;
        if (payload) globalScope.NuengdeawStandard = payload;
        globalScope.PhasaTawanFoundation = foundation;
        return clone(foundation);
      } catch (centralError) {
        globalScope.PhasaTawanFoundation = clone(fallbackFoundation);
        return clone(fallbackFoundation);
      }
    })();
    return ready._promise;
  }

  globalScope.NuengdeawFoundationStandardBridge = {
    ready,
    buildFoundationFromCentral,
    getCurrent: () => clone(globalScope.PhasaTawanFoundation || fallbackFoundation),
  };
})(window);

