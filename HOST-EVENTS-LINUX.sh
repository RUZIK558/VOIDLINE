#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
VOIDLINE_MODE=events exec node server.mjs
