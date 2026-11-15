// Original 24px line icons. No fonts, emoji glyphs or remote icon dependency.
const paths = {
  settings:
    "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  hands:
    "M7 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-3 6-7 6-2 0-4-1-5-3l-3-5a1.5 1.5 0 0 1 2-2Z",
  mouse: "M12 3c4 0 6 2 6 6v6c0 4-2 6-6 6s-6-2-6-6V9c0-4 2-6 6-6Zm0 0v7",
  display: "M3 4h18v13H3ZM8 21h8m-4-4v4",
  image: "M3 4h18v16H3Zm0 12 5-5 4 4 3-3 6 6M16 8h.01",
  audio: "M4 9h4l5-5v16l-5-5H4Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  reset: "M4 8a8 8 0 1 1-1 8M4 3v5h5",
  play: "m8 4 12 8-12 8Z",
  inventory: "M4 6h16v15H4ZM8 6V3h8v3M4 11h16m-10 0v4h4v-4",
  equipment: "M8 3h8l1 5 4 2-2 11H5L3 10l4-2Z",
  weapon: "M3 8h13V6h4v4h-7l-2 4H8v6H4v-9H3Zm5 2v4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  save: "M4 3h13l3 3v15H4Zm4 0v7h8V3M8 21v-7h8v7",
};
export function icon(name) {
  return `<svg class="uiIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.settings}"/></svg>`;
}
