import {incomingMessages} from "./chat-notices.mjs";
const $ = (id) => document.getElementById(id);
export function setupMenuTabs() {
  for (const button of document.querySelectorAll("[data-pane]"))
    button.onclick = () => {
      if (button.dataset.pane === "settings") {
        window.dispatchEvent(new Event("voidline-open-settings"));
        return;
      }
      for (const pane of document.querySelectorAll(".menuPane"))
        pane.hidden = pane.id !== "pane-" + button.dataset.pane;
      for (const b of document.querySelectorAll("[data-pane]"))
        b.classList.toggle("selected", b === button);
    };
  document.querySelector(".lobbyLogo").onclick = (e) => {
    e.preventDefault();
    document.querySelector('[data-pane="play"]').click();
  };
}
export function setupSocialUI() {
  const bridge = window.voidlineSocial;
  let selected = null,
    current = null,
    busy = false,
    renderKey = "";
  const status = (text) => ($("socialStatus").textContent = text);
  async function call(command, args = {}) {
    if (!bridge)
      throw Error("Друзья и P2P-переписка доступны в приложении Electron");
    const r = await bridge.invoke(command, args);
    if (!r?.ok) throw Error(r?.error || "Нет ответа от P2P");
    return r.result;
  }
  function rowFriend(f, onClick) {
    const button = document.createElement("button");
    button.className = "friendEntry" + (selected === f.id ? " active" : "");
    const avatar = document.createElement("span");
    avatar.className = "friendAvatar";
    avatar.textContent = f.name.slice(0, 2).toUpperCase();
    const text = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = f.name;
    const online = document.createElement("small");
    online.textContent = f.online ? "● В СЕТИ" : "○ НЕТ СОЕДИНЕНИЯ";
    online.className = f.online ? "peerOnline" : "";
    text.append(name, online);
    button.append(avatar, text);
    button.onclick = onClick;
    return button;
  }
  function show(s) {
    const previous=current;
    for(const f of s.friends){
      const old=previous?.friends.find(p=>p.id===f.id);
      for(const m of incomingMessages(previous?(old?.messages||[]):null,f.messages||[]))
        window.dispatchEvent(new CustomEvent('voidline-chat-message',{detail:{scope:'p2p',senderId:f.id,name:f.name,text:m.text,visible:!$('socialDialog').hidden&&selected===f.id}}));
    }
    current = s;
    const nearby=$('nearbyPeers');
    const nearbyKey=JSON.stringify((s.nearby||[]).map(p=>[p.id,p.host,p.port,p.name]));
    if(nearby.dataset.key!==nearbyKey){
      nearby.replaceChildren();
      for(const p of s.nearby||[]){
        const b=document.createElement('button');b.className='secondary';
        b.textContent=p.name+' · '+p.host+':'+p.port+' · ДОБАВИТЬ ПО КОДУ';
        b.onclick=()=>{$('friendCode').value=p.code;status('Найден '+p.name+'. Проверь, что это нужный игрок, затем нажми «Добавить». Он тоже должен добавить тебя.');};
        nearby.append(b);
      }
      if(!s.nearby?.length)nearby.textContent='Игроков рядом пока нет. Оба откройте P2P; UDP 3091 должен быть разрешён. VPN должен поддерживать multicast.';
      nearby.dataset.key=nearbyKey;
    }
    if(s.discoveryError)$('discoveryStatus').textContent=s.discoveryError;

    $("friendCount").textContent = s.friends.length;
    $("openPeer").hidden = s.listening;
    $("closePeer").hidden = !s.listening;
    $("peerPort").disabled = s.listening;
    if (s.port) $("peerPort").value = s.port;
    if (document.activeElement !== $("peerName")) $("peerName").value = s.name;
    const invites = $("peerInvite"),
      key = JSON.stringify(s.invites);
    if (invites.dataset.key !== key) {
      invites.replaceChildren();
      for (const item of s.invites) {
        const option = document.createElement("option");
        option.textContent = item.address;
        option.value = item.code;
        invites.append(option);
      }
      if (!s.invites.length) {
        const o = document.createElement("option");
        o.textContent = "Сначала открой P2P-порт";
        o.value = "";
        invites.append(o);
      }
      invites.dataset.key = key;
    }
    $("copyPeerCode").disabled = !invites.value;
    const listKey = JSON.stringify(
      s.friends.map((f) => [f.id, f.name, f.online]),
    );
    if ($("railFriends").dataset.key !== listKey) {
      $("railFriends").replaceChildren();
      for (const f of s.friends)
        $("railFriends").append(
          rowFriend(f, () => {
            selected = f.id;
            open();
            show(current);
          }),
        );
      if (!s.friends.length) {
        const p = document.createElement("p");
        p.className = "friendsEmpty";
        p.textContent =
          "Друзей пока нет. Обменяйтесь кодами, чтобы начать переписку.";
        $("railFriends").append(p);
      }
      $("railFriends").dataset.key = listKey;
    }
    const signature = listKey + selected;
    if ($("peerList").dataset.key !== signature) {
      $("peerList").replaceChildren();
      for (const f of s.friends)
        $("peerList").append(
          rowFriend(f, () => {
            selected = f.id;
            renderKey = "";
            show(current);
          }),
        );
      $("peerList").dataset.key = signature;
    }
    const f = s.friends.find((f) => f.id === selected);
    if(f&&!$('socialDialog').hidden&&!document.hidden&&document.hasFocus())window.dispatchEvent(new CustomEvent('voidline-chat-read',{detail:{scope:'p2p',id:f.id}}));
    $("chatName").textContent = f
      ? f.name + (f.online ? " · В СЕТИ" : " · НЕ ПОДКЛЮЧЁН")
      : "Выбери друга";
    $("connectPeer").disabled = !f || busy || f.online;
    $("sendPeer").disabled = !f || busy;
    $("chatText").disabled = !f;
    const messagesKey = JSON.stringify(f?.messages || []);
    if (renderKey !== messagesKey + selected) {
      const host = $("chatMessages");
      host.replaceChildren();
      for (const m of f?.messages || []) {
        const item = document.createElement("div");
        item.className = "chatBubble" + (m.mine ? " mine" : "");
        const p = document.createElement("p");
        p.textContent = m.text;
        const small = document.createElement("small");
        small.textContent =
          new Date(m.at).toLocaleTimeString("ru", {
            hour: "2-digit",
            minute: "2-digit",
          }) +
          " · " +
          ({
            sending: "отправляется",
            delivered: "доставлено",
            unconfirmed: "не подтверждено",
            received: "получено",
          }[m.delivery] || "");
        item.append(p, small);
        host.append(item);
      }
      if (!f?.messages.length) {
        const p = document.createElement("p");
        p.className = "friendsEmpty";
        p.textContent = f
          ? "Начни переписку. Для связи оба друга должны добавить коды друг друга."
          : "Выбери друга слева или добавь его по коду.";
        host.append(p);
      }
      host.scrollTop = host.scrollHeight;
      renderKey = messagesKey + selected;
    }
  }
  async function action(command, args = {}, success) {
    if (busy) return;
    busy = true;
    status("Выполняю…");
    try {
      show(await call(command, args));
      if (success) status(success);
    } catch (error) {
      status(error.message);
    } finally {
      busy = false;
      if (current) show(current);
    }
  }
  async function open() {
    $("socialDialog").hidden = false;
    if (bridge)
      try {
        show(await call("status"));
        status("Прямое соединение · TLS 1.3 · без центрального сервера");
      } catch (error) {
        status(error.message);
      }
    else
      status(
        "Открой игру в Electron: браузерная версия не может слушать P2P-порт.",
      );
  }
  const scan=document.createElement('section');scan.className='peerDiscovery';
  scan.innerHTML='<button id="scanPeers" class="secondary">НАЙТИ ИГРОКОВ В LAN</button><small id="discoveryStatus">Автообновление каждые 3 секунды при открытом P2P. Интернет-подбор не поддерживается.</small><div id="nearbyPeers"></div>';
  $('socialDialog').querySelector('.socialBody').before(scan);
  $('scanPeers').onclick=()=>action('scan',{port:Number($('peerPort').value)},'Поиск LAN включён. Найденных игроков можно добавить по коду.');
  window.addEventListener('voidline-open-peer',e=>{selected=e.detail?.id||selected;open();if(current)show(current);});
  $("openSocial").onclick = open;
  $("pauseSocial").onclick = open;
  $("closeSocial").onclick = () => {
    $("socialDialog").hidden = true;
  };
  $("socialDialog").onkeydown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      $("closeSocial").click();
    }
  };
  $("savePeerName").onclick = () =>
    action(
      "name",
      { name: $("peerName").value },
      "Имя сохранено. После изменения имени обменивайтесь новым кодом.",
    );
  $("openPeer").onclick = () =>
    action(
      "open",
      { port: Number($("peerPort").value) },
      "P2P-порт открыт. Обменяйтесь кодами. Может потребоваться разрешение брандмауэра.",
    );
  $("closePeer").onclick = () =>
    action("close", {}, "P2P закрыт, соединения с друзьями отключены.");
  $("copyPeerCode").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("peerInvite").value);
      status("Код скопирован. Передай другу через доверенный канал.");
    } catch {
      status("Копирование недоступно. Выбери код через поле приглашения.");
    }
  };
  $("addPeer").onclick = () =>
    action(
      "add",
      { code: $("friendCode").value.trim() },
      "Друг добавлен. Убедись, что он тоже добавил твой код.",
    );
  $("connectPeer").onclick = () =>
    action(
      "connect",
      { id: selected },
      "Соединение установлено. Доставка подтверждается ответом приложения друга.",
    );
  $("chatForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("chatText").value;
    if (!selected || !text.trim()) return;
    await action(
      "send",
      { id: selected, text },
      "Сообщение передано в P2P-канал. Ожидается подтверждение.",
    );
    if (
      current?.friends.find((f) => f.id === selected)?.messages.at(-1)?.text ===
      text.trim()
    )
      $("chatText").value = "";
  };
  if (bridge) {
    call("status")
      .then(show)
      .catch(() => {});
    setInterval(async () => {
      if (!busy)
        try {
          show(await call("status"));
        } catch {}
    }, 1200);
  }
}
