import {sideLabel} from "./match-ui.mjs";
import {MAPS} from "./maps.mjs";
const $ = (id) => document.getElementById(id);
export function setupHostUI({ connect }) {
  const bridge = window.voidlineHost;
  let owns = false,
    busy = false,
    restartUntil = 0;
  const message = (text) => {
    $("hostMessage").textContent = text;
  };
  async function command(type, args = {}) {
    if (!bridge) throw Error("Создание сервера доступно в приложении Electron");
    const response = await bridge.invoke(type, args);
    if (!response?.ok) throw Error(response?.error || "Нет ответа от приложения");
    return response.result;
  }
  function show(status) {
    let ac=document.getElementById('serverGuardState');if(!ac){ac=document.createElement('p');ac.id='serverGuardState';$('rosterSummary').after(ac);}
    ac.textContent=status.antiCheat?`VSAC активен · отклонено ${status.antiCheat.rejected} · отключено ${status.antiCheat.disconnected}`:'VSAC: статус недоступен';
    $("lanState").textContent = status.lan ? "ОТКРЫТ ДЛЯ СЕТИ" : "ПРИВАТНЫЙ МАТЧ";
    $("lanState").classList.toggle("online", status.lan);
    $("openLAN").hidden = status.lan;
    $("closeLAN").hidden = !status.lan;
    $("lanPort").disabled = status.lan || busy;
    if (status.lan) $("lanPort").value = status.port;
    $("shareBlock").hidden = !status.lan;
    const select = $("shareAddress"),
      previous = select.value;
    const addresses = status.addresses || [];
    if (JSON.stringify(addresses) !== select.dataset.list) {
      select.replaceChildren();
      for (const address of addresses) {
        const o = document.createElement("option");
        o.value = o.textContent = address;
        select.append(o);
      }
      if (!addresses.length) {
        const o = document.createElement("option");
        o.textContent = "Сетевой IPv4 не найден";
        o.value = "";
        select.append(o);
      }
      if (addresses.includes(previous)) select.value = previous;
      select.dataset.list = JSON.stringify(addresses);
    }
    $("copyAddress").disabled = !select.value;
    $("rosterSummary").textContent =
      `${sideLabel(0,status.attackTeam)} ${status.players.filter((p) => p.team === 0).length}/5 · ${sideLabel(1,status.attackTeam)} ${status.players.filter((p) => p.team === 1).length}/5`;
    const bots = status.players.filter((p) => p.bot),
      host = $("botList");
    const signature = JSON.stringify(bots);
    if (host.dataset.signature !== signature) {
      host.replaceChildren();
      if (!bots.length) {
        const p = document.createElement("p");
        p.className = "emptyBots";
        p.textContent = "Ботов нет. Добавь соперников или играй с друзьями.";
        host.append(p);
      }
      for (const bot of bots) {
        const row = document.createElement("div");
        row.className = "botRow";
        const label = document.createElement("span");
        label.textContent = bot.name;
        const team = document.createElement("small");
        team.textContent = sideLabel(bot.team,status.attackTeam);
        team.className = bot.team === 0 ? "botCyan" : "botOrange";
        const remove = document.createElement("button");
        remove.textContent = "УБРАТЬ";
        remove.className = "removeBot";
        remove.title = `Удалить бота ${bot.name}`;
        remove.onclick = () => action("bot-remove", { id: bot.id }, "Бот удалён.");
        row.append(label, team, remove);
        host.append(row);
      }
      host.dataset.signature = signature;
    }
    $("addSpectre").textContent="＋ "+sideLabel(0,status.attackTeam);
    $("addEmber").textContent="＋ "+sideLabel(1,status.attackTeam);
    $("addSpectre").disabled = busy || status.players.filter((p) => p.team === 0).length >= 5;
    $("addEmber").disabled = busy || status.players.filter((p) => p.team === 1).length >= 5;
    $("clearBots").disabled = busy || !bots.length;
    $("botLevel").textContent = { easy: "ЛЁГКИЕ", normal: "ОБЫЧНЫЕ", hard: "СЛОЖНЫЕ" }[
      status.difficulty
    ];
  }
  async function action(type, args = {}, success = "Готово.") {
    if (busy) return;
    busy = true;
    message("Применяю…");
    $("hostPanel").setAttribute("aria-busy", "true");
    try {
      show(await command(type, args));
      message(success);
    } catch (error) {
      message(error.message);
    } finally {
      busy = false;
      $("hostPanel").removeAttribute("aria-busy");
      if (owns)
        try {
          show(await command("status"));
        } catch {}
    }
  }
  $("createOpen").disabled = !bridge;
  $("createOpen").title = bridge
    ? "Новый локальный матч"
    : "Эта функция доступна в приложении Electron";
  if (!bridge)
    $("hostHint").textContent = "Создание и управление сервером доступны в приложении Electron.";
  const modeRow=document.createElement("label");modeRow.textContent="РЕЖИМ";
  modeRow.innerHTML+='<select id="gameMode"><option value="classic">Классический · Бомба</option><option value="events">Рандомные ивенты · 55 видов</option></select>';
  $("createPlay").before(modeRow);
  const mapLabel=document.createElement("label");mapLabel.textContent="КАРТА";
  const maps=document.createElement("select");maps.id="mapChoice";
  for(const m of Object.values(MAPS)){const o=document.createElement("option");o.value=m.id;o.textContent=m.name+" — "+m.subtitle;maps.append(o);}
  mapLabel.append(maps);modeRow.before(mapLabel);
  $("createOpen").onclick = () => {
    $("createDialog").hidden = false;
    $("createMessage").textContent = "Сначала приватный матч. Затем Esc → «Открыть для сети».";
    $("createPlay").focus();
  };
  $("createCancel").onclick = () => {
    $("createDialog").hidden = true;
    $("createOpen").focus();
  };
  $("createDialog").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      $("createCancel").click();
    }
    if (event.key === "Tab") {
      const fields = [...$("createDialog").querySelectorAll("button,select")].filter(
        (el) => !el.disabled,
      );
      const first = fields[0],
        last = fields.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  $("createPlay").onclick = async () => {
    if (busy) return;
    busy = true;
    $("createPlay").disabled = true;
    $("createMessage").textContent = "Создаю сервер…";
    try {
      const status = await command("create", {
        bots: [Number($("botsA").value), Number($("botsB").value)],
        level: $("difficulty").value,
        mode: $("gameMode").value,
        mapId: $("mapChoice").value,
      });
      $("createDialog").hidden = true;
      connect(status.endpoint);
    } catch (error) {
      $("createMessage").textContent = error.message;
    } finally {
      busy = false;
      $("createPlay").disabled = false;
    }
  };
  $("openLAN").onclick = () =>
    action(
      "lan-open",
      { port: Number($("lanPort").value) },
      "Доступ открыт. Передай адрес другу в той же сети; разрешение брандмауэра может потребоваться.",
    );
  $("closeLAN").onclick = () =>
    action("lan-close", {}, "Доступ закрыт. Сетевые гости отключены, твой матч продолжается.");
  $("copyAddress").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("shareAddress").value);
      message("Адрес скопирован. Другу: «Войти в операцию» → этот адрес.");
    } catch {
      message("Не удалось скопировать. Перепиши выбранный адрес вручную.");
    }
  };
  $("addSpectre").onclick = () =>
    action(
      "bot-add",
      { team: 0 },
      "Бот добавлен. Во время боя он вступит со следующего раунда.",
    );
  $("addEmber").onclick = () =>
    action(
      "bot-add",
      { team: 1 },
      "Бот добавлен. Во время боя он вступит со следующего раунда.",
    );
  $("clearBots").onclick = () =>
    action("bot-clear", {}, "Все боты убраны. Автоматически добавляться они не будут.");
  $("restartMatch").onclick = () => {
    if (Date.now() > restartUntil) {
      restartUntil = Date.now() + 5000;
      $("restartMatch").textContent = "ЕЩЁ РАЗ — СБРОСИТЬ СЧЁТ";
      setTimeout(() => {
        $("restartMatch").textContent = "НАЧАТЬ МАТЧ ЗАНОВО";
      }, 5100);
      return;
    }
    restartUntil = 0;
    $("restartMatch").textContent = "НАЧАТЬ МАТЧ ЗАНОВО";
    action("restart", {}, "Новый матч. Счёт сброшен, боты и сетевой доступ сохранены.");
  };
  setInterval(async () => {
    if (owns && !busy && !$("pause").hidden)
      try {
        show(await command("status"));
      } catch (error) {
        message(error.message);
      }
  }, 1200);
  return {
    async onConnection(url) {
      owns = !!bridge && new URL(url).host === location.host;
      $("hostPanel").hidden = !owns;
      $("pause").classList.toggle("owner", owns);
      $("leave").textContent = owns ? "ЗАВЕРШИТЬ МАТЧ И ВЫЙТИ" : "ВЫЙТИ В МЕНЮ";
      $("pauseInfo").textContent = owns
        ? "Ты — хозяин матча. Выход завершит его для всех участников."
        : "Матч продолжается, даже когда открыта пауза.";
      if (owns)
        try {
          show(await command("status"));
          message("Изменения применяются сразу. Пауза не останавливает бой.");
        } catch (error) {
          message(error.message);
        }
    },
    async onLeave() {
      const wasOwner = owns;
      owns = false;
      $("hostPanel").hidden = true;
      $("pause").classList.remove("owner");
      if (wasOwner) await command("stop");
    },
  };
}
