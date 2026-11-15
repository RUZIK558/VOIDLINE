import {createPeerDiscovery} from "./peer-discovery.mjs";
import tls from "node:tls";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";
import selfsigned from "selfsigned";
const fingerprint = (raw) => createHash("sha256").update(raw).digest("hex");
const cleanName = (v) =>
  String(v || "OPERATOR")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim()
    .slice(0, 24) || "OPERATOR";
export async function createPeerService({ directory }) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "social.json");
  let data;
  try {
    data = JSON.parse(await readFile(file, "utf8"));
    if (!data.identity?.cert || !data.identity?.private) throw Error("bad identity");
  } catch (error) {
    if (error.code !== "ENOENT")
      throw Error("Не удалось прочитать профиль P2P. Сохрани social.json перед восстановлением.");
    const keys = selfsigned.generate([{ name: "commonName", value: "VOIDLINE peer" }], {
      days: 3650,
      keySize: 2048,
      algorithm: "sha256",
    });
    data = {
      identity: { cert: keys.cert, private: keys.private },
      name: "OPERATOR",
      friends: [],
      messages: {},
    };
  }
  data.friends ||= [];
  data.messages ||= {};
  const myId = fingerprint(
    new (await import("node:crypto")).X509Certificate(data.identity.cert).raw,
  );
  for (const list of Object.values(data.messages))
    for (const m of list) if (m.delivery === "sending") m.delivery = "unconfirmed";
  let discovery=null,discoveryError="";
  let listener = null,
    port = null,
    closing = false,
    persistQueue = Promise.resolve();
  const sockets = new Set(),
    sessions = new Map(),
    errors = new Map(),
    pending = new Map();
  async function persist() {
    const content = JSON.stringify(data);
    persistQueue = persistQueue
      .catch(() => {})
      .then(async () => {
        const tmp = file + ".tmp";
        await writeFile(tmp, content, { mode: 0o600 });
        await rename(tmp, file);
      });
    return persistQueue;
  }
  await persist();
  const friend = (id) => data.friends.find((f) => f.id === id);
  function sendFrame(socket, value) {
    if (socket.destroyed || !socket.writable || socket.writableLength > 65536)
      throw Error("Соединение недоступно");
    socket.write(JSON.stringify(value) + "\n");
  }
  function history(id) {
    return (data.messages[id] ||= []);
  }
  function store(id, message) {
    const list = history(id);
    if (list.some((m) => m.id === message.id)) return false;
    list.push(message);
    if (list.length > 200) list.splice(0, list.length - 200);
    persist().catch(() => errors.set(id, "Не удалось сохранить историю"));
    return true;
  }
  function attach(socket, expected) {
    const certificate = socket.getPeerCertificate();
    if (!certificate?.raw) {
      socket.destroy();
      throw Error("Друг не предоставил сертификат");
    }
    const id = fingerprint(certificate.raw);
    if ((expected && id !== expected) || !friend(id)) {
      socket.destroy();
      throw Error("Сертификат не совпал. Сначала обменяйтесь кодами друзей.");
    }
    socket.on("error", () => errors.set(id, "Соединение с другом прервано"));
    let set = sessions.get(id);
    if (!set) sessions.set(id, (set = new Set()));
    if (set.size >= 4) {
      socket.destroy();
      return;
    }
    set.add(socket);
    errors.delete(id);
    let buffer = "",
      rate = 0,
      rateAt = Date.now();
    socket.setEncoding("utf8");
    socket.setTimeout(45000, () => socket.destroy());
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 65536) {
        socket.destroy();
        return;
      }
      let n;
      while ((n = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, n);
        buffer = buffer.slice(n + 1);
        if (Date.now() - rateAt > 1000) {
          rate = 0;
          rateAt = Date.now();
        }
        if (++rate > 30) {
          socket.destroy();
          return;
        }
        let m;
        try {
          m = JSON.parse(raw);
        } catch {
          socket.destroy();
          return;
        }
        if (!m || typeof m !== "object") continue;
        if (m.type === "ping") {
          try {
            sendFrame(socket, { type: "pong" });
          } catch {}
        }
        if (
          m.type === "message" &&
          typeof m.id === "string" &&
          /^[a-f0-9-]{36}$/.test(m.id) &&
          typeof m.text === "string" &&
          m.text.trim() &&
          m.text.length <= 2000
        ) {
          store(id, { id: m.id, text: m.text, at: Date.now(), mine: false, delivery: "received" });
          try {
            sendFrame(socket, { type: "ack", id: m.id });
          } catch {}
        }
        if (m.type === "ack" && typeof m.id === "string") {
          const local = history(id).find((q) => q.id === m.id && q.mine);
          if (local) {
            local.delivery = "delivered";
            clearTimeout(pending.get(m.id));
            pending.delete(m.id);
            persist().catch(() => {});
          }
        }
      }
    });
    socket.on("close", () => {
      set.delete(socket);
      if (!set.size) sessions.delete(id);
    });
    return id;
  }
  function track(socket) {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    return socket;
  }
  async function open(selected = 3090) {
    if (!Number.isInteger(selected) || selected < 1024 || selected > 65535)
      throw Error("Порт P2P: от 1024 до 65535");
    if (listener) {
      if (selected !== port) throw Error("Сначала закрой текущий P2P-порт");
      return snapshot();
    }
    const server = tls.createServer(
      {
        key: data.identity.private,
        cert: data.identity.cert,
        requestCert: true,
        rejectUnauthorized: false,
        minVersion: "TLSv1.3",
        handshakeTimeout: 10000,
      },
      (socket) => {
        try {
          attach(socket);
        } catch {
          socket.destroy();
        }
      },
    );
    server.on("connection", (socket) => {
      track(socket);
      if (sockets.size > 32) socket.destroy();
    });
    server.on("tlsClientError", () => {});
    try {
      await new Promise((r, j) => {
        server.once("error", j);
        server.listen(selected, "0.0.0.0", r);
      });
    } catch (e) {
      server.close();
      throw Error(e.code === "EADDRINUSE" ? "Порт P2P занят. Выбери другой." : e.message);
    }
    listener = server;
    port = server.address().port;
    try{discovery=await createPeerDiscovery({identity:()=>({id:myId,name:data.name,port})});discoveryError='';}
    catch(e){discoveryError='LAN-поиск недоступен: '+(e.code||e.message);}

    return snapshot();
  }
  async function close() {
    discovery?.close();discovery=null;
    const server = listener;
    listener = null;
    port = null;
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise((r) => server.close(r));
    return snapshot();
  }
  async function connect(id) {
    const f = friend(id);
    if (!f) throw Error("Друг не найден");
    if (sessions.get(id)?.size) return;
    await new Promise((resolve, reject) => {
      const socket = track(
        tls.connect({
          host: f.host,
          port: f.port,
          key: data.identity.private,
          cert: data.identity.cert,
          rejectUnauthorized: false,
          minVersion: "TLSv1.3",
          servername: undefined,
        }),
      );
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(Error("Друг недоступен. Проверь адрес, P2P-порт и обмен кодами."));
      }, 7000);
      socket.once("secureConnect", () => {
        try {
          attach(socket, id);
          clearTimeout(timeout);
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(Error("Не удалось подключиться: " + error.code));
      });
      socket.once("close", () => {
        clearTimeout(timeout);
        if (!sessions.get(id)?.size)
          reject(Error("Друг закрыл соединение или ещё не добавил твой код"));
      });
    }).catch((e) => {
      errors.set(id, e.message);
      throw e;
    });
  }
  function snapshot() {
    const addresses = [];
    if (listener)
      for (const list of Object.values(networkInterfaces()))
        for (const net of list || [])
          if (net.family === "IPv4" && !net.internal) addresses.push(net.address);
    return {
      id: myId,
      name: data.name,
      nearby: [],discoveryError,
      ...discovery?.snapshot(),
      listening: !!listener,
      port,
      invites: [...new Set(addresses)].map((host) => ({
        address: `${host}:${port}`,
        code:
          "VLF1." +
          Buffer.from(JSON.stringify({ v: 1, id: myId, name: data.name, host, port })).toString(
            "base64url",
          ),
      })),
      friends: data.friends.map((f) => ({
        ...f,
        online: !!sessions.get(f.id)?.size,
        error: errors.get(f.id) || "",
        messages: history(f.id).map((m) => ({ ...m })),
      })),
    };
  }
  async function invoke(command, args = {}) {
    try {
      if (!args || typeof args !== "object") throw Error("Некорректные параметры");
      switch (command) {
        case "scan":
          if(!listener)await open(args.port??3090);
          discovery?.announce();
          await new Promise(resolve=>setTimeout(resolve,1200));
          break;
        case "status":
          break;
        case "open":
          await open(args.port);
          break;
        case "close":
          await close();
          break;
        case "name":
          data.name = cleanName(args.name);
          await persist();
          break;
        case "add": {
          if (
            typeof args.code !== "string" ||
            args.code.length > 2048 ||
            !args.code.startsWith("VLF1.")
          )
            throw Error("Нужен код VLF1, полученный от друга");
          let f;
          try {
            f = JSON.parse(Buffer.from(args.code.slice(5), "base64url").toString("utf8"));
          } catch {
            throw Error("Код повреждён");
          }
          if (
            f.v !== 1 ||
            typeof f.id !== "string" ||
            !/^[a-f0-9]{64}$/.test(f.id) ||
            typeof f.host !== "string" ||
            !/^[a-zA-Z0-9.-]{1,253}$/.test(f.host) ||
            !Number.isInteger(f.port) ||
            f.port < 1024 ||
            f.port > 65535
          )
            throw Error("Некорректный код друга");
          if (f.id === myId) throw Error("Это твой собственный код");
          if (!friend(f.id) && data.friends.length >= 50) throw Error("Лимит: 50 друзей");
          const entry = { id: f.id, name: cleanName(f.name), host: f.host, port: f.port };
          const old = friend(f.id);
          if (old) Object.assign(old, entry);
          else data.friends.push(entry);
          await persist();
          break;
        }
        case "connect":
          await connect(args.id);
          break;
        case "disconnect":
          for (const socket of sessions.get(args.id) || []) socket.destroy();
          break;
        case "send": {
          if (typeof args.text !== "string" || !args.text.trim() || args.text.length > 2000)
            throw Error("Сообщение: от 1 до 2000 символов");
          await connect(args.id);
          const socket = [...(sessions.get(args.id) || [])][0];
          if (!socket) throw Error("Друг не подключён");
          const m = {
            id: randomUUID(),
            text: args.text.trim(),
            at: Date.now(),
            mine: true,
            delivery: "sending",
          };
          store(args.id, m);
          sendFrame(socket, { type: "message", id: m.id, text: m.text });
          const timer = setTimeout(() => {
            if (m.delivery === "sending") {
              m.delivery = "unconfirmed";
              persist().catch(() => {});
            }
            pending.delete(m.id);
          }, 10000);
          pending.set(m.id, timer);
          break;
        }
        case "remove": {
          for (const socket of sessions.get(args.id) || []) socket.destroy();
          data.friends = data.friends.filter((f) => f.id !== args.id);
          delete data.messages[args.id];
          await persist();
          break;
        }
        default:
          throw Error("Команда не разрешена");
      }
      return { ok: true, result: snapshot() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  const heartbeat = setInterval(() => {
    for (const set of sessions.values())
      for (const socket of set)
        try {
          sendFrame(socket, { type: "ping" });
        } catch {
          socket.destroy();
        }
  }, 15000);
  return {
    invoke,
    close: async () => {
      closing = true;
      clearInterval(heartbeat);
      for (const timer of pending.values()) clearTimeout(timer);
      await close();
      await persistQueue.catch(() => {});
    },
  };
}
