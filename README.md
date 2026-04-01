# Nuengdeaw AI

Nuengdeaw AI is a source-visible emotional intelligence product ecosystem built around biosignal sensing, neurocognitive interpretation, wellness guidance, and orchestration experiences.

## Positioning

This repository is designed to support two goals at once:

- a premium presentation layer for the Nuengdeaw AI brand
- a structured source repository for the real Gen1-Gen4 product experiences

## Product Line

- Gen 1: BioSignal
- Gen 2: NeuroSignal
- Gen 3: Wellness
- Gen 4: LLM Hub
- Gen 999: Future concept horizon

## Repository Structure

- `landing/` - showcase and brand entry experience
- `products/hub/` - Human State Core dashboard experience
- `products/gen1/` to `products/gen4/` - product entry pages
- `products/gen999/` - reserved future concept page
- `products/shared/` - shared runtime, AI modules, and foundation data
- `assets/images/` - shared visual assets
- `docs/` - architecture, quality, and legal documentation
- `scripts/` - repository audit and utility scripts

## Rights and Usage

This repository is publicly viewable for reference and evaluation, but it is **not open source**.

- viewing and inspection are allowed
- any use, copying, modification, redistribution, integration, or commercialization is prohibited without prior written permission
- commercial use requires a direct written license from the copyright owner
- the Phasa Tawan Signal Language Standard included in this repository is also protected under the same permission-required model

See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for the governing terms.

## Quality Gate

Before merging future updates, run:

- `node scripts/repo-audit.js`
- `node --check products/hub/dashboard.js`
- `node --check products/shared/NuengdeawCore.js`
- `node --check products/shared/Nuengdeaw_Product_Runtime.js`

See [docs/QUALITY_CHECKLIST.md](docs/QUALITY_CHECKLIST.md) for the full review checklist.
