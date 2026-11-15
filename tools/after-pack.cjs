// Generate an exact file manifest for the per-user NSIS installer/uninstaller.
// No recursive user-directory deletion and no Wine-dependent uninstaller extraction.
const fs = require("node:fs"),
  path = require("node:path");
module.exports = async (context) => {
  if(context.electronPlatformName==='linux'){
    const base=context.appOutDir,exe=path.join(base,'voidline-arena');
    fs.renameSync(exe,exe+'.bin');
    fs.copyFileSync(path.join(context.packager.projectDir,'build/native/linux-launcher.sh'),exe);
    fs.chmodSync(exe,0o755);return;
  }
  if (context.electronPlatformName !== "win32") return;
  const base = context.appOutDir,
    root = context.packager.projectDir;
  const files = [];
  function walk(dir) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else files.push(p);
    }
  }
  walk(base);
  const esc = (s) => s.replace(/\$/g, () => "$$").replace(/"/g, '$\\"');
  const directories = [
    ...new Set(files.map((f) => path.dirname(path.relative(base, f)))),
  ].sort();
  const lines = [
    "; Generated at packaging time. Exact application files only.",
    "!macro InstallVoidlineFiles",
  ];
  for (const dir of directories) {
    lines.push(
      `  SetOutPath "$INSTDIR${dir === "." ? "" : "\\" + esc(dir.replace(/\//g, "\\"))}"`,
    );
    for (const f of files.filter(
      (f) => path.dirname(path.relative(base, f)) === dir,
    ))
      lines.push(`  File "${esc(f)}"`);
  }
  lines.push("!macroend", "!macro RemoveVoidlineFiles");
  for (const f of files)
    lines.push(
      `  Delete "$INSTDIR\\${esc(path.relative(base, f).replace(/\//g, "\\"))}"`,
    );
  const allDirs = new Set();
  for (const dir of directories) {
    let d = dir;
    while (d !== ".") {
      allDirs.add(d);
      d = path.dirname(d);
    }
  }
  for (const d of [...allDirs].sort((a, b) => b.length - a.length))
    lines.push(`  RMDir "$INSTDIR\\${esc(d.replace(/\//g, "\\"))}"`);
  lines.push("!macroend");
  fs.writeFileSync(
    path.join(root, "build/windows-files.nsh"),
    lines.join("\n") + "\n",
  );
};
