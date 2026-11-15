import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const run = promisify(execFile);
const helperPath = fileURLToPath(
  new URL("./build/native/display.ps1", import.meta.url),
).replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
export function parseXrandr(text) {
  const lines = text.split("\n");
  let output = null,
    current = null,
    modes = [],
    selected = false;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      selected = / connected primary /.test(line);
      if (selected) output = line.split(" ")[0];
      continue;
    }
    if (!selected) continue;
    const m = line.match(/^\s+(\d+)x(\d+)\s+(.+)$/);
    if (!m) continue;
    for (const rate of m[3].trim().split(/\s+/)) {
      const hz = parseFloat(rate);
      if (!Number.isFinite(hz) || hz <= 1) continue;
      const mode = { width: +m[1], height: +m[2], hz };
      modes.push(mode);
      if (rate.includes("*")) current = mode;
    }
  }
  return {
    supported: !!(output && current),
    output,
    current,
    modes,
    backend: "X11 / основной монитор",
  };
}
export function createDisplayController({
  platform = process.platform,
  env = process.env,
  execute = run,
  timeoutMs = 15000,
} = {}) {
  let pending = null,
    queue = Promise.resolve();
  async function info() {
    if (platform === "win32") {
      const { stdout } = await execute(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          helperPath,
          "-Command",
          "info",
        ],
        { timeout: 12000, maxBuffer: 2e6, windowsHide: true },
      );
      return JSON.parse(stdout.replace(/^\uFEFF/, ""));
    }
    if (platform === "linux" && env.DISPLAY && !env.WAYLAND_DISPLAY) {
      try {
        return parseXrandr(
          (await execute("xrandr", ["--query"], { timeout: 4000 })).stdout,
        );
      } catch {}
    }
    return {
      supported: false,
      modes: [],
      current: null,
      backend: "Управляется операционной системой",
      reason:
        "Переключение герцовки доступно на Windows и X11 с объявленным основным монитором. Для Wayland и браузера используй настройки ОС.",
    };
  }
  async function set(mode, output) {
    if (platform === "win32")
      await execute(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          helperPath,
          "-Command",
          "apply",
          "-Width",
          String(mode.width),
          "-Height",
          String(mode.height),
          "-Hz",
          String(mode.hz),
        ],
        { timeout: 12000, windowsHide: true },
      );
    else
      await execute(
        "xrandr",
        [
          "--output",
          output,
          "--mode",
          `${mode.width}x${mode.height}`,
          "--rate",
          String(mode.hz),
        ],
        { timeout: 6000 },
      );
  }
  async function revert() {
    if (!pending) return;
    const p = pending;
    clearTimeout(p.timer);
    await set(p.previous, p.output);
    if (pending === p) pending = null;
  }
  function serial(fn) {
    const task = queue.then(fn);
    queue = task.catch(() => {});
    return task;
  }
  return {
    info,
    apply: (mode) =>
      serial(async () => {
        if (pending) await revert();
        const data = await info();
        if (!data.supported || !data.current)
          throw Error(data.reason || "Недоступно");
        const valid = data.modes.find(
          (m) =>
            m.width === mode?.width &&
            m.height === mode?.height &&
            m.hz === mode?.hz,
        );
        if (!valid) throw Error("Режим не объявлен монитором");
        await set(valid, data.output);
        pending = {
          previous: data.current,
          output: data.output,
          timer: setTimeout(() => serial(revert).catch(() => {}), timeoutMs),
        };
        pending.timer.unref?.();
        return { pending: true, seconds: timeoutMs / 1000 };
      }),
    confirm: () =>
      serial(async () => {
        if (!pending) return { confirmed: false };
        clearTimeout(pending.timer);
        pending = null;
        return { confirmed: true };
      }),
    revert: () => serial(revert),
    close: () => serial(revert),
  };
}
