# Repository Overview

Nuengdeaw AI is a source-visible emotional intelligence product ecosystem designed to combine sensing, interpretation, wellness guidance, and orchestration into a single brand narrative.

## What Visitors See

The repository is structured to support both presentation and source review.

- `index.html` redirects to the main landing experience
- `landing/` introduces the brand, product line, and strategic positioning
- `products/hub/` presents the Human State Core dashboard layer
- `products/gen1/` to `products/gen4/` expose the current product entry points
- `products/gen999/` preserves the future-facing concept horizon

## Product Stack

- `Gen 1 BioSignal` focuses on physiological sensing and state awareness
- `Gen 2 NeuroSignal` extends interpretation into cognitive and neural signal space
- `Gen 3 Wellness` translates analysis into guidance and human-centered communication
- `Gen 4 LLM Hub` expands the system into orchestration and high-level assistance
- `Gen 999` holds the reserved narrative space for future evolution

## Source-Visible Model

This repository is visible for inspection, evaluation, and discussion, but it is not open source.
Any use, copying, modification, redistribution, integration, or commercial deployment requires prior written permission from the copyright owner.
The same restriction applies to the Phasa Tawan Signal Language Standard included in this repository.

## Review Path

For a strong first pass, review in this order:

1. `landing/index.html`
2. `products/hub/index.html`
3. `products/gen1/` to `products/gen4/`
4. `products/shared/`
5. `docs/` and `docs/legal/`

## Quality Gate

The repository includes a lightweight audit flow:

- `node scripts/repo-audit.js`
- `node --check products/hub/dashboard.js`
- `node --check products/shared/NuengdeawCore.js`
- `node --check products/shared/Nuengdeaw_Product_Runtime.js`

See `docs/QUALITY_CHECKLIST.md` for the full merge checklist.
