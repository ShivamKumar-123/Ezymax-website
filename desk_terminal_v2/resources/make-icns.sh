#!/usr/bin/env bash
# Builds resources/ezymex.icns — the macOS app icon — from a square PNG master.
#
# macOS will not take the .ico (that is a Windows container) and CMake needs a
# real .icns to drop into Contents/Resources, so this is the mac equivalent of
# what app.rc does on Windows.
#
# Source preference:
#   1. resources/ezymex-1024.png   (what the repo ships — every slot is a
#                                   true downscale)
#   2. resources/ezymex-256.png    (fallback; 512/1024 would be upscaled)
#
# Both are the Ezymex emblem — the circled CX monogram — on a TRANSPARENT
# background, cut from the master logo. macOS renders that fine, but the
# platform convention for a Dock icon is an opaque rounded-square tile with
# the mark inset. If the Dock icon ever needs to match that convention,
# composite the emblem onto a tile and drop the result in as
# ezymex-1024.png; this script needs no other change.
#
# Only sips + iconutil are used, both of which ship with macOS — no Homebrew,
# no ImageMagick.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/ezymex.icns"

src=""
for cand in "$here/ezymex-1024.png" "$here/ezymex-256.png"; do
    if [[ -f "$cand" ]]; then src="$cand"; break; fi
done
[[ -n "$src" ]] || { echo "error: no icon master found in $here" >&2; exit 1; }

master_px="$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')"
echo "==> icon master: $(basename "$src") (${master_px}px)"
if (( master_px < 1024 )); then
    echo "    note: slots above ${master_px}px are upscaled. Add a 1024x1024"
    echo "          resources/ezymex-1024.png for a sharper Dock icon."
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
set="$work/ezymex.iconset"
mkdir -p "$set"

# iconutil requires exactly these names; the @2x entries are what Retina Macs
# actually display, so 32/64/256/512/1024 do most of the visible work.
emit() { # px  filename
    sips -s format png -z "$1" "$1" "$src" --out "$set/$2" >/dev/null
}
emit 16   icon_16x16.png
emit 32   icon_16x16@2x.png
emit 32   icon_32x32.png
emit 64   icon_32x32@2x.png
emit 128  icon_128x128.png
emit 256  icon_128x128@2x.png
emit 256  icon_256x256.png
emit 512  icon_256x256@2x.png
emit 512  icon_512x512.png
emit 1024 icon_512x512@2x.png

iconutil -c icns "$set" -o "$out"
echo "==> wrote $out ($(du -h "$out" | cut -f1))"
