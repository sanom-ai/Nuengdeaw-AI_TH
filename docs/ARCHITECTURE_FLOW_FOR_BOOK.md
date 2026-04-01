# ARCHITECTURE_FLOW_FOR_BOOK

## 1) Objective
Define a clean, extensible book pipeline using:
- `Original` as base architecture
- central standard: `phasa-tawan-foundation.json`
- product modules: `Gen1` (BioSignal), `Gen2` (NeuroSignal), optional `Gen3` (Wellness)

This flow keeps all products compatible through one shared JSON contract.

## 2) Core Principle
- Base handles shared runtime logic (validation, ethics, state pipeline, logging, storage).
- Each Gen only overrides product-specific behavior.
- Book content flows through a single neutral schema (no Gen-specific payload format).

## 3) Book Runtime Flow
1. **Author Input**
- Source from `author_studio` or direct import.
- Normalize to central book JSON (`book_manifest`, `chapters`, `segments`, metadata).

2. **Standard Binding**
- Base loads `phasa-tawan-foundation.json`.
- Validate namespace/tokens/rule IDs against central standard.

3. **Session Bootstrap**
- User opens session from `index` or Gen page.
- Runtime mounts selected Gen engine (`Gen1` or `Gen2`).

4. **Signal Ingestion**
- Gen1: HR/HRV/GSR/RR + behavior.
- Gen2: EEG + biosignal + behavior.

5. **State Inference**
- Shared pipeline: filter -> normalize -> rules -> fusion -> confidence.
- Output unified state packet:
  - `state`
  - `confidence`
  - `risk`
  - `wellbeing`
  - `recommended_action`

6. **Book Adaptation Layer**
- Map state packet to book adaptation rules:
  - pacing
  - hint level
  - summarize/expand
  - grounding/break prompt
- Render adaptive content in reader UI.

7. **Persistence & Analytics**
- Save session/event stream to runtime store.
- Export analytics in central JSON for re-use by Gen3/Gen4.

## 4) Module Responsibility
- `Original/Base`: shared engine, JSON contract, governance, storage, orchestration.
- `Gen1`: wearable-first adaptation profile.
- `Gen2`: EEG-enhanced adaptation profile.
- `Gen3` (optional): wellness dashboard consuming same session packets.
- `Gen4` (optional): LLM orchestration over same standardized outputs.

## 5) Contract Stability Rules
- Never change schema fields without versioning.
- New Gen can add optional fields only.
- Required fields must remain backward compatible.
- Cross-Gen communication must happen only through central JSON.

## 6) Minimal Integration Checklist
- [ ] `phasa-tawan-foundation.json` loads successfully.
- [ ] Gen1 and Gen2 both emit the same required output fields.
- [ ] Reader can consume adaptation packet without Gen-specific branching.
- [ ] Session export/import works with one JSON format.
- [ ] Dashboard renders without runtime schema errors.

## 7) Practical Decision
If `Gen3` is health-check only:
- keep book pipeline in Gen1/Gen2 + base
- keep Gen3 independent (consume signals/session summaries only)
- no hard dependency from Gen3 to authoring modules

