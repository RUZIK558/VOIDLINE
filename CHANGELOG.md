## 1.0.7

- Restore exact 1.0.4 butterfly mesh and materials; calibrate forward-facing grip.
- Keep approved 1.0.6 animation module unchanged; preserve karambit mesh/grip.
- Test reference fingerprints, forward direction, sampled triangle surface clearance and interruptions.

## 1.0.6

- Two alternating, faster articulated knife inspections, double rolls, eased interruption handoffs.
- Butterfly grip shifted ahead of palm; curled fingers follow held handle rather than sleeve.
- Karambit reverse grip and outward blade curvature corrected.
- Added sampled palm/forearm clearance, interruption, mirror and package regression checks.

## 1.0.5 — восстановление запуска и ножи по референсам

- Приватная Chromium-сессия DIRECT, проверка HTTP-готовности, до трёх попыток загрузки, журнал и ручной повтор вместо мгновенного выхода.
- Изогнутый профиль клинка и фигурная рукоять керамбита; перфорированные металлические рукояти бабочки.
- Осмотр дополнен движением свободных пальцев, поворотом кисти и паузой показа клинка.

## 1.0.4 — шарниры ножей и компактные метки

- Бабочка: неподвижная безопасная рукоять, согласованные повороты свободной рукояти и лезвия вокруг Y-шарниров; лезвие помещается в закрытой рукояти.
- Керамбит: обратный хват и один направленный оборот вокруг кольца пальца.
- Кисть и нож связаны, четыре плавных клипа без накопления вращения при прерывании.
- Метки: маленький ромб, расстояние и только необходимая высота; без имени и текста команды.
- Текстовые команды: две строки на 3,2 секунды; обычные метки не дублируются в ленте.
- Меню V без размытия, яркого свечения и длинной подсказки; серверная приватность не менялась.

## 1.0.3 — метки и быстрые команды

- СКМ / короткое V: союзная метка под прицелом.
- Удержание V: круговое меню шести фраз, выбор мышью или 1–6, отправка при отпускании.
- Мировые и радарные метки с автором, расстоянием и высотой; отдельная лента команд и сигнал.
- Серверная изоляция по команде, проверка поверхности, TTL, ограничения частоты и очистка при смене раунда.
- Во время выбора камера и действия не управляются мышью, Linux XInput2 остаётся активным.

## 1.0.2 — звук и многоэтажные карты

- 47 оригинальных локальных звуков, отдельные выстрелы, шаги по четырём поверхностям, перезарядка и события матча.
- Пространственное затухание, стереопанорама, приглушение за стенами, компрессор и ограничение голосов.
- Перестроены все восемь оригинальных карт: уникальные укрытия и проходы, по два верхних помещения с балконами и двумя лестницами.
- Общая высотная физика игроков, ботов, гранат и пуль; выпадение/подбор предметов учитывает этаж.
- Навигация ботов по лестничным переходам, кэш безопасных рёбер наземной сетки.
- Настройка спавнов КТ/Т: защитники раньше выходят к A и B при одинаковой скорости, включая смену сторон.
- Сохранены исправления закупки, Linux XInput2 и уведомлений из 1.0.1.

# 1.0.1

Агент закупки учитывает сторону и смену ролей. Linux: предзапускной выбор X11/XWayland и относительный XInput2-помощник с остановкой при потере игрового захвата. Внутриигровые уведомления чата матча и P2P, счётчики непрочитанного, защита от повторного уведомления истории. Карты CS2 не заменены: нужны исходные ресурсы.

# 1.0.0 — стабилизация

Разные модели Т/КТ и единые названия сторон; LAN-обнаружение P2P; наблюдение от первого лица; исправленный прицел; привязка эффектов выстрела к дулу; усиленное ослепление; разные маршруты/роли ботов; общая валидация магазина с видимыми причинами; raw Pointer Lock с совместимым откатом; защита переноса экипировки и сброс очереди ввода при новом раунде.

Полный список и ограничения: RELEASE-1.0-RU.md.

## 0.10.1 — Input & Window Fix

- Remove Electron default menu/accelerators; prevent page shortcuts without swallowing gameplay key events.
- Preserve text-field Ctrl+A/C/V while suppressing interface selection, reload, close and page zoom.
- Require genuine pointer lock/focus for aiming; explicit Esc pause, blur/visibility input clearing, recoverable capture failures.
- Separate CSS canvas size and buffer resolution; viewport aspect on resize for game/lobby/inventory.
- Repair accidental temp dependency constraint in lock file. No protocol or Android build change.

## 0.10.0 — Round Events & Mouse Wheel

- Expanded events to 55 distinct scenarios: movement, combat, survival, arsenals, utility, economy, objectives and weather.
- Server-owned shuffled bag, no repeats until exhausted, classic cleanup, temporary affected gear restoration.
- Mouse wheel cycles actual available match slots in both directions, preserving chosen knife and modal/action guards.
- Event-aware HP bars, shop prices/previews, long-description mobile HUD and controls help.
- 150 automated tests plus live browser/server wheel and event checks. See QA-0.10.md.

# 0.9.0 — Expanded Maps & Knives

- Восемь новых больших планировок 70×128…110×76 м, реальные разные маршруты, новые точки, зоны закупки и размерная миникарта.
- Общая с сервером геометрия, BFS без старых границ, проверки проходимости сегментов, фасады и ориентиры.
- Единственный экран команды перед входом; убран предварительный селектор.
- Бабочка, керамбит, M9: бесплатный слот 3, осмотр F, собственные клипы, обычный/сильный серверный удар и 6 материалов.
- Настройка модели ножа и отдельный множитель чувствительности прицела, сохранение в профиле настроек.
- Удалено накопление поправки Spine/Elbow; снято постоянное смещение точки прицеливания бота вниз.
- Миграция десяти оружейных скинов 0.8 без сброса.

# 0.8.0 — Maps & Loadouts

- 7 новых карт (8 всего), общий каталог геометрии сервера/клиента и выбор хозяином.
- Независимые скины всех 10 оружий, профиль v2 и миграция v1, Android SharedPreferences.
- Отдельный экран КТ/Т/авто перед вступлением, актуальные места и отказ полной стороне.
- Очистка геометрии/материалов/скелетов моделей и старой карты, WebAudio disconnect и лимит32.
- Бюджет кадра, читаемый HUD, экран WebGL/JS-сбоя и локальный диагностический отчёт.
- Electron/Android recovery после завершения renderer-процесса. Причина пользовательского вылета пока не установлена.

# 0.6.0 — Motion & Control

- Weighted skeletal operator and 34-bone first-person hands, UV atlas with albedo/roughness/normal maps; editable animated GLB exports.
- Idle/walk/crouch/jump poses, first-person fire/equip/reload/inspect and grenade throw; model contours and reflection lighting updated.
- Five-category settings dialog with original SVG icons, local persistent preferences, hand position/side/FOV/gloves, rebindable keyboard actions with conflict swaps.
- Render resolution/scale, FPS cap, borderless/windowed mode, FOV, shadow/AA quality and image postprocessing.
- Native primary-display mode enumeration on Windows and X11, advertised-mode validation and 15-second confirmation/rollback; unsupported environments report limitations.
- Release now includes Windows Setup.exe, Windows portable.exe, Linux AppImage, source archive and SHA-256 checksums.
- Pre-alpha boundaries: no artist-complete AAA assets, motion capture, IK or ragdoll; target-OS desktop execution/monitor switching remain unverified in the build environment.

# Changelog

## 0.5.0 — utilities and loadout

- Server-authoritative swept-sphere grenades, strong/underhand throws, bounce/friction/gravity, fuses and finite inventory.
- HE blast with cover/armor, facing/LOS flash, smoke visibility, time-based fire patches and smoke extinguishing.
- Utility buying, capacity validation, held/world models, death drops, pickup, sounds and animated shader effects.
- Six free PBR finishes per firearm, real 3D preview, equipped/ground/captured skin replication and ownership preservation.
- Stable atomic Electron userData profile with IPC validation; browser localStorage fallback.
- Immediate input delivery and server click latching to avoid losing short clicks between rendered frames.
- Dedicated physics/effect/network/profile tests; previous Bomb Operation rules retained.

## 0.4.0 — combat and Bomb Operation

- Actual velocity, acceleration, counter-strafe braking, crouching, matching camera and remote silhouette; edge-triggered jumping.
- Separate server AABB head/body/legs, armor and helmet absorption, wall/floor occlusion, movement-derived accuracy.
- Inventory ownership, working gun drop/pickup with ammo preservation, death drops and bomb transfer on death/disconnect.
- Server-authorized shop with money/phase/zone/role validation, pistol start, round income, kill/plant/defuse rewards, capped loss streak and cash.
- A/B sites, plant/defuse hold actions and interruption, kits, planted-bomb overtime, explosion damage, explicit win reasons.
- Six-round halftime with equipment/economy reset; first seven wins, persistent match-end state, explicit host restart.
- Bots use objectives and their own economy, shared damage/armor. HUD, radar, world item models, carrier packs, buy menu and controls.
- Existing host/LAN and direct TLS P2P chat retained; packaged Electron includes match.mjs.

## 0.3.0

Procedural menu scene and operators, rifle/pistol models, recoil pattern, velocity-independent shooting spread (replaced in 0.4), server-authoritative LAN play, Windows portable and Linux AppImage packaging, direct TLS P2P chat. Unverified desktop compatibility caveat retained.

## 0.2.0

In-game hosting, LAN opening/closing, host-only bot management and restart.
