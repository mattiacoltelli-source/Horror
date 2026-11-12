#!/usr/bin/env bash
# Aggiorna sw.js con l'hash del contenuto (shell e asset) e con gli elenchi dei file da mettere in cache.
# Va lanciato prima di ogni commit che cambia il gioco: se il contenuto non cambia, l'hash resta uguale e non compare nessun banner.
set -euo pipefail
cd "$(dirname "$0")/.."
shell_files=$(find index.html manifest.webmanifest css js vendor icons -type f | LC_ALL=C sort)
asset_files=$(find assets -type f | LC_ALL=C sort)
sh=$(for f in $shell_files; do sha1sum "$f"; done | sha1sum | cut -c1-10)
as=$(for f in $asset_files; do sha1sum "$f"; done | sha1sum | cut -c1-10)
arr() { printf "["; local first=1; for f in $1; do [ $first = 1 ] || printf ','; first=0; printf "'./%s'" "$f"; done; printf "]"; }
python3 - "$sh" "$as" "$(arr "$shell_files" | sed "s/^\\[/['.\/',/")" "$(arr "$asset_files")" <<'PY'
import re,sys
sh,as_,sf,af=sys.argv[1:5]
s=open('sw.js').read()
s=re.sub(r"const SHELL_VERSION = '.*?';   // @shell","const SHELL_VERSION = '%s';   // @shell"%sh,s)
s=re.sub(r"const ASSET_VERSION = '.*?';   // @assets","const ASSET_VERSION = '%s';   // @assets"%as_,s)
s=re.sub(r"const SHELL_FILES = .*?; // @shellfiles","const SHELL_FILES = %s; // @shellfiles"%sf.replace('\\','\\\\'),s)
s=re.sub(r"const ASSET_FILES = .*?; // @assetfiles","const ASSET_FILES = %s; // @assetfiles"%af.replace('\\','\\\\'),s)
open('sw.js','w').write(s)
PY
echo "sw.js -> shell=$sh assets=$as"
