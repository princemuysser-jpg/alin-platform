# ALIN v2.0.1 — Modular maintenance update

## Actual changes
- Removed the two large shared JavaScript bundles.
- Split runtime code into 41 ordered domain modules under `modules/`.
- Added separate groups for core, store, admin, teacher, library and courier.
- Updated desktop and mobile pages to load the new module files.
- Updated the service worker to cache all 41 module files.
- Added a module-structure guide for future maintenance.
- Added release checks that fail if old bundle references return or module paths are missing.

## Validation
- 41 modules discovered.
- 0 missing local references in the main pages.
- 0 old shared-bundle references.
- 0 classic JavaScript syntax failures.
- Service worker contains all module paths.

## Maintenance rule
New features must be placed in the correct domain module. Do not add new code to `modules/core/platform.js`; it remains only as a compatibility layer until later cleanup.
