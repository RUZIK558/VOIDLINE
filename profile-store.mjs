import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { normalizeProfile, validLoadout } from "./public/cosmetics.mjs";
// Stable Electron userData storage: independent of the random HTTP port.
export function createProfileStore(directory) {
  const file = path.join(directory, "loadout.json");
  let queue = Promise.resolve();
  return {
    async load() {
      try {
        return normalizeProfile(JSON.parse(await readFile(file, "utf8")));
      } catch (e) {
        if (e.code === "ENOENT" || e instanceof SyntaxError) return normalizeProfile(null);
        throw e;
      }
    },
    save(value) {
      if (!validLoadout(value?.loadout)) return Promise.reject(Error("Некорректный профиль"));
      const data = normalizeProfile(value);
      const task = queue.then(async () => {
        await mkdir(directory, { recursive: true });
        const tmp = file + ".tmp";
        await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
        await rename(tmp, file);
        return data;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
