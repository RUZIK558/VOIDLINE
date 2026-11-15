#!/bin/sh
# Select Ozone BEFORE Electron starts. JS main-process flags can be too late.
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
explicit=0
for arg in "$@"; do case "$arg" in --ozone-platform|--ozone-platform=*) explicit=1;; esac; done
if [ "$explicit" = 1 ]; then exec "$HERE/voidline-arena.bin" "$@"; fi
case "${VOIDLINE_OZONE_PLATFORM:-}" in
 x11|wayland) backend=$VOIDLINE_OZONE_PLATFORM;;
 *) if [ -n "${DISPLAY:-}" ]; then backend=x11; elif [ -n "${WAYLAND_DISPLAY:-}" ]; then backend=wayland; else backend=; fi;;
esac
if [ -n "$backend" ]; then exec "$HERE/voidline-arena.bin" "--ozone-platform=$backend" "$@"; fi
exec "$HERE/voidline-arena.bin" "$@"
