import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { normalizeSettings } from "./public/settings-schema.mjs";
export function createSettingsStore(directory) {
  const file = path.join(directory, "settings.json");
  let queue = Promise.resolve();
  return {
    async load() {
      try {
        return normalizeSettings(JSON.parse(await readFile(file, "utf8")));
      } catch (e) {
        if (e.code === "ENOENT" || e instanceof SyntaxError)
          return normalizeSettings(null);
        throw e;
      }
    },
    save(value) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return Promise.reject(Error("Некорректные настройки"));
      const data = normalizeSettings(value);
      const task = queue.then(async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(file + ".tmp", JSON.stringify(data, null, 2), {
          mode: 0o600,
        });
        await rename(file + ".tmp", file);
        return data;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
