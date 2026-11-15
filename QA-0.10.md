# VOIDLINE 0.10 — Round Events & Mouse Wheel

## Implemented
- 55 nonstandard round events, 8 categories; server-shuffled deck without repeats until exhausted and no immediate repeat at deck boundary.
- Server applies movement, health, combat, arsenal, grenade, economy, objective and weather rules. Classic mode resets modifiers.
- Temporary affected gear restored only for survivors; forced guns cannot be laundered through drop/pickup/purchases. Unaffected guns/ammo are not restored by armor or utility events.
- Mouse wheel cycles owned primary/secondary, selected knife and available HE/FLASH/SMOKE/FIRE. Both directions wrap; empty slots skipped. Number-key bindings preserved.
- Guards for not-active/disconnected/unlocked/dead, chat, settings, buy/pause, reload/action, Ctrl/Meta zoom.
- Discounts shown consistently on buttons and preview; HP bar normalized to event max HP.

## Executed checks
- `npm test`: 150/150 passed. Logs: tests/regression-0.10.txt; event-focused tests/events-0.10.txt (68 tests).
- Browser automation: tools/qa-v010.cjs, tests/ui-0.10.txt. Real authoritative match and browser wheel events traverse AK → USP → M9 → HE → FLASH → SMOKE → FIRE → AK and reverse. Reload/chat/unlocked guards verified.
- Browser forced server rounds confirm Tanks 200 HP, Snipers AWP/no pistol and blocked gun purchase, Whiteout fog, discounted shop and knife-only wheel.
- Mobile landscape 915×412 and settings 390×844 rendered and inspected; event text clears touch fire button. Six screenshots in previews/10-*.png inspected individually.
- Server game access used for QA exists only in a temporary test copy deleted after the test. No QA endpoint shipped.
- verify-release.mjs confirms Linux/Windows app.asar match 58 current application files, version0.10.0, 12 extracted HTTP routes and actual WebSocket event/HP/knife/cosmetic state.

## Boundaries
- Native Windows setup/portable UI and native Linux Wayland session have not been run on physical target systems here.
- Android APK signature/structure and packaged resources checked; no physical Android installation/playtest claimed. Android remains a LAN/VPN network client, not a Node host.
- Rendering tests use headless Chromium/software graphics, not performance benchmarks.
- Existing prototype limitations in README remain. Events are shared server rules, not a public-service anti-cheat or networking infrastructure upgrade.
