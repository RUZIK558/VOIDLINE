# VOIDLINE 0.9 — verification scope

## Implemented
- 8 redesigned map layouts, 76×100, 92×84, 110×76, 84×104, 108×92, 70×128, 100×100, 96×112 metres. No shared scaled-layout template.
- Shared server/client map boxes and sites; per-map spawns and buy zones; dimension-aware radar, floor, scenery and bot routing.
- One team chooser, shown only after server match info. No preliminary main-menu/multiplayer selector.
- Butterfly, karambit, M9: own meshes, equip/inspect/slash/thrust animation clips, free key-3 slot, model setting, six skins each, mouse/touch controls.
- Authoritative knife range/wall/team/cadence checks, front/back damage, no ammo consumption or drop/reload.
- Mouse/touch scope multiplier .1–3; only while actually scoped with a scoped weapon; independent persisted value.
- Non-accumulating Spine/Elbow procedural animation layer, level bot eye aim.
- Existing ten-gun profiles migrate with their individual paints retained.

## Reproducible checks
- `npm test` — 82 tests including 7 new knife/settings/migration tests. Mechanics tests that rely on the old tiny arena explicitly use `tests/legacy-fixture.mjs`; current-map traversal is tested separately against all 160 spawn-to-site pairs, with no fixture substitution.
- `node tools/qa-v09.cjs` — actual browser UI, scope delta ratio on both axes, server-selected three knives and melee events, desktop/mobile/narrow layouts.
- `node tools/knives-visual-v09.cjs` — 15 animation frames; 3600-frame moving/reloading operator pose at constant pitch and neutral return (no drift).
- `node tools/maps-visual-v09.cjs` — all eight maps; repeated map switches and bounded geometry/texture counts.
- `node verify-release.mjs` — both app.asar contents match final application sources; extracted Linux package HTTP routes and real WebSocket live round/skin.
- Android: aapt version/orientation manifest checks; zipalign; apksigner v2/v3 verification. APK assets checked byte-for-byte against final game modules.

## Limitations
- Linux software-WebGL browser testing is not a physical Windows/Android performance test. Real native installers/device launching were not exercised.
- Maps remain stylised solid-building blockout levels; no interiors, climbing or vertical routes. Competitive map balance is unproven.
- Knife animations are original procedural clips, not mocap or commercial-game assets. Simplified hit volumes, no full melee lag compensation.
- Android needs the PC server in the same LAN/VPN, with matching 0.9 game sources. Development APK 0.9 has a different signing certificate from 0.8: Android can reject in-place updating. Uninstalling an old APK erases local app data; save needed data before considering that.

## Final observed result

82/82 unit/integration tests passed after the short-right-click latch fix. Browser mouse scope deltas: normal (-0.04,-0.02), scoped (-0.026,-0.013), ratio 0.65 on both axes. Three knife selections and primary/heavy events passed in the live WebSocket client. Desktop, landscape touch, narrow settings states rendered without JS errors. All eight maps and 15 knife frames were visually inspected; GPU resources remained bounded across repeated map switches. Both packaged archives match all 56 application source files; extracted package HTTP/WebSocket smoke passed. Physical target-device installation and performance remain untested.
