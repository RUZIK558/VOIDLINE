# VOIDLINE 0.8 — checks and limits

## Functional tests
- 75 Node tests passed: baseline combat/economy/bomb/utility/network/profile/settings plus maps/loadouts.
- Eight maps have unique collision layouts. All ten spawn positions on each map can reach A and B on a grid, and each spawn/site center is clear.
- Collision context is explicit for server movement, client prediction, hitscan, bot navigation/visibility, grenade bounce, flash, HE and fire. Multiple server instances do not share mutable map state.
- Server validates map id; prejoin match-info returns map and side occupancy without allocating a player. Explicit CT join appears on defender side in the snapshot.
- v1 profile migrates to ten ids; each weapon gets independent paint. Server purchase, next-round repaint, stolen/drop paint, corrupt files and atomic queued persistence are tested.

## Chromium UI
- Create-match map dropdown has eight entries; host creates Frost, explicit team screen opens before joining, CT joins current defense.
- All ten weapon choices accept separate skins; values survive reload. AK Ember and AWP Arctic remain distinct.
- Landscape touch client shows team screen and enters Oasis, with joystick/fire controls visible.
- Simulated WEBGL_lose_context opens recovery/report overlay. This is deliberate fault injection, not proof of real device recovery.
- No pageerrors during desktop/mobile UI scenario.
- All eight map overview captures inspected individually; desktop and landscape team, skin, gameplay and recovery screens inspected. Contrast panels added to light-map HUD.

## Resource tests
- 24 map changes return to 19 geometries / 8 textures on Terminal, same as warm state. Only the active map is allocated.
- 30 create/render/remove operator + gun cycles return to 0 instance geometries; skin cache stabilizes at 6 textures. Shared materials are kept, skeletons and owned materials are disposed.
- One-shot audio chains disconnect after playback; polyphony limited to32. These code changes are not a measured reproduction of the reported crash.
- Offscreen budget capped at8.3MP desktop /2.1MP touch and4096px per axis; tested extreme display sizes.

## Build verification
- Windows Setup and portable, Linux AppImage, Android APK built from0.8 source.
- Release verifier compares packaged app.asar application files against source and runs extracted HTTP/WebSocket join, round and skin smoke test.
- APK signature, package version8/0.8.0, minSDK26, target35, sensorLandscape and staged web resources checked.

## Explicitly unverified
- No crash log, OS, device or reproduction steps from the reporting user were supplied. The cause of that crash is UNKNOWN. No claim that all crashes are fixed.
- No real Android device install/play session, native Windows run/install, or native Linux/Wayland desktop play session available here.
- Long-session endurance, full5v5 gameplay balance and performance across actual GPUs/phones remain unverified.
- Maps are small original stylized arenas, not finished CS2 maps. No automatic map voting/rotation.
- APK is LAN/VPN client, requires PC server; Android cannot host Node matches. Desktop binaries unsigned, APK development-signed with same local certificate as0.7.
