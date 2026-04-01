# Quality Checklist

## Repository Audit
- [ ] No duplicate files remain for active product routes
- [ ] No broken relative links, assets, or route references remain
- [ ] Root entry and landing entry resolve to the intended experience

## Content Polish
- [ ] README is concise, professional, and aligned with the current repository scope
- [ ] Landing and hub copy use product language rather than internal development language
- [ ] Legal wording is consistent across README, landing, hub, LICENSE, and NOTICE

## Visual Consistency
- [ ] Landing and hub share a coherent premium visual direction
- [ ] Typography, spacing, and color hierarchy feel intentional on desktop and mobile
- [ ] Product entry points preserve a consistent brand tone

## Technical Hygiene
- [ ] `.gitignore` covers editor clutter, temp files, logs, and dependency folders
- [ ] Source files are saved as UTF-8
- [ ] Dead paths, duplicate routes, and obsolete references are removed
- [ ] JavaScript files pass syntax checks

## Navigation Integrity
- [ ] Product links from landing resolve correctly
- [ ] Hub links resolve correctly
- [ ] Asset paths resolve correctly from every HTML entry point
- [ ] Legal notice links resolve correctly

## Pre-Merge Gate
- [ ] `node scripts/repo-audit.js`
- [ ] `node --check products/hub/dashboard.js`
- [ ] `node --check products/shared/NuengdeawCore.js`
- [ ] `node --check products/shared/Nuengdeaw_Product_Runtime.js`
- [ ] Manual visual pass on landing, hub, and Gen1-Gen4 entry pages
