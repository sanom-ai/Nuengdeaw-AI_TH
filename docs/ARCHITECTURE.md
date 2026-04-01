# Nuengdeaw AI Architecture

## Foundation

- `index.html` is the base dashboard entry derived from `Original`.
- `NuengdeawCore.js` is the Original base AI foundation.
- `Nuengdeaw_Foundation_Standard_Bridge.js` binds the foundation to `phasa-tawan-foundation.json`.
- `phasa-tawan-foundation.json` is the single standard file used by the Original base.

## Products

- `gen1.html` is the Gen 1 BioSignal product entry.
- `gen2.html` is the Gen 2 NeuroSignal product entry.
- `gen3_wellness.html` is the Gen 3 Wellness product entry.
- `gen4_llm_hub.html` is the Gen 4 LLM orchestration entry.
- `Nuengdeaw_Product_Runtime.js` is the shared product runtime bundle for Gen extensions.
- Source-of-truth for shared Gen engine primitives is `Nuengdeaw_Product_Runtime.js`:
- `_makeSensorFusion(...)`
- `NuengdeawBaseEngine`
- `Nuengdeaw_Wellness_Runtime.js` is the Gen 3 runtime bundle (Aura/Input/Store/Baseline/DevTools).
- Dedupe round-1: embedded `Sim_Human1/2` and embedded Deception stack were removed from `Nuengdeaw_Wellness_Runtime.js`.
- Gen 3 now consumes shared dependencies from `HumanSimSystem.js`, `SignalAnalysis.js`, and `ABTestManager.js` before loading `Nuengdeaw_Wellness_Runtime.js`.
- `Nuengdeaw_UI_Config_DB.js` is the shared UI-config database for reusable palettes/disclaimers (reduces duplicated HTML constants).
- `Nuengdeaw_AI_Gen_1_for_BioSignal.js` is the Gen 1 extension module.
- `Nuengdeaw_AI_Gen_2_for_NeuroSignal.js` is the Gen 2 extension module.
- `Nuengdeaw_AI_Gen_3_for_Wellness.js` is the Gen 3 extension module.

## Unified Packet Alignment

- Gen 1/2 build packets via `NuengdeawBookContract` in `Nuengdeaw_Product_Runtime.js`.
- Gen 3 now exposes `NuengdeawWellnessCore.toUnifiedPacket()` and `persistUnifiedPacket()` in `Nuengdeaw_AI_Gen_3_for_Wellness.js`.
- Gen 4 consumes core-derived packets via `NuengdeawGen4.packetFromCore()` in `Nuengdeaw_AI_Gen_4_Mock_Orchestrator.js`.

## UI Text Catalog (Single-line / Multi-line)

- `Nuengdeaw_UI_Config_DB.js` includes `textCatalog` for shared and per-gen labels:
- owner namespaces: `shared`, `gen1`, `gen2`, `gen3`, `gen4`
- key format: `<owner>.<feature>.<name>` (example: `shared.export.csv_signals`)
- line modes:
- `single`: one-line text
- `multi`: string array for multiline rendering (`joinWith` controls delimiter such as `<br>`)

Current usage:
- `gen1.html` resolves shared export/back labels and `gen1` branding subtitle.
- `gen2.html` resolves shared export/back labels and multiline calibration subtitle from `gen2`.

Lint tooling:
- `npm run lint:ui-keys` checks:
- missing keys referenced in pages
- owner-policy violations per page (`shared/gen1/gen2/gen3/gen4`)
- unused catalog keys (warning-only)
- `npm run lint:ui-keys:strict` also fails on unused keys.

## Standard

- `phasa-tawan-foundation.json` contains both the base language standard and the merged product runtime profiles.

## Legacy

- `Legacy_Workbench/` stores older demos and the preserved `Original` source snapshot.
