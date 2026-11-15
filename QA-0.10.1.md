# QA — VOIDLINE 0.10.1

## Scope
Desktop input/window hotfix. Protocol remains compatible with 0.10.0; Android was not rebuilt.

## Automated checks
- 161/161 regression tests passed (tests/regression-0.10.1.txt).
- 11/11 targeted input/window tests passed (tests/input-0.10.1.txt).
- Native Electron Linux check passed (tests/native-0.10.1.txt): Ctrl+W/A remain crouch/movement, no window close or page selection; editing fields retain Ctrl+A; reload/zoom shortcuts blocked; Ctrl+wheel cycles slots without zoom.
- Real pointer capture verified with native mouse movement beyond window bounds. Esc explicitly unlocks and pauses; blur clears held input and releases capture; typing does not control gameplay. Simulated capture refusal pauses without unhandled rejection and allows explicit retry.
- Resize checked at large and narrow window sizes: canvas fills viewport; camera aspect follows viewport, independently of internal render resolution.

- Packaged Linux and Windows app archives match all 60 application source files; extracted Linux package serves 14 routes and passes a real WebSocket join/live-event smoke check (tests/release-0.10.1.txt).

## Limitations
Native interactive checks ran on Linux, not Windows. Windows packages are cross-built and their application contents checked against source; Windows installation and OS-specific pointer behavior still require testing on a Windows machine. This does not establish absence of every possible crash or graphics-driver issue.
