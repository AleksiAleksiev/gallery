#!/usr/bin/env bash
# Deploy the gallery to the Oracle VM: build the static export, then rsync
# out/ (site + image tiers, ~2 GB first run, delta afterwards) to
# /var/www/gallery, which Caddy serves as gallery.lokset.dev.
#
#   npm run deploy        (or: bash scripts/deploy.sh)
#   npm run deploy -- --no-build   to push without rebuilding
#
# rsync runs inside WSL — Windows has no native rsync. ssh inside WSL refuses
# private keys on /mnt/c (permissions always read 777 there), so on first run
# the oracle key is copied into the WSL home and chmod 600.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--no-build" ]]; then
  npm run build
fi

MSYS_NO_PATHCONV=1 wsl bash -c '
  set -euo pipefail
  if [ ! -f ~/.ssh/oracle.key ]; then
    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    cp /mnt/c/Users/aleks/.ssh/oracle.key ~/.ssh/oracle.key
    chmod 600 ~/.ssh/oracle.key
  fi
  rsync -az --delete --info=stats1,progress2 \
    -e "ssh -i ~/.ssh/oracle.key -o StrictHostKeyChecking=accept-new" \
    /mnt/d/Misc/Gallery/out/ ubuntu@140.86.213.122:/var/www/gallery/
'

echo "deployed -> https://gallery.lokset.dev"
