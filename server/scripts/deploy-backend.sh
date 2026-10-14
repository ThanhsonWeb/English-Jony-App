#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# This script is sent by the approved workflow. It never fetches Git or uses sudo.
sha=${1:?Missing revision}
incoming=${2:?Missing upload directory}
checksum=${3:?Missing artifact checksum}
export DEPLOY_HEALTH_URL=${4:?Missing verified loopback health URL}
[[ "$sha" =~ ^[a-f0-9]{40}$ && "$checksum" =~ ^[a-f0-9]{64}$ ]]
[[ "$(id -u)" != 0 && "$(id -un)" == "${DEPLOY_USER:-studyjony}" ]]
base=$(realpath -e "${DEPLOY_BASE:-/var/www/studyjony}")
[[ -d "$base/releases" && -d "$base/shared" && -d "$base/incoming" ]]
[[ ! -L "$incoming" ]]
incoming=$(realpath -e "$incoming")
[[ "$(dirname "$incoming")" == "$base/incoming" && ! -L "$incoming" ]]
for command in node npm pm2 flock; do command -v "$command" > /dev/null; done
export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"
exec 9> "$base/deploy.lock"
flock -n 9 || { echo "Another backend deployment holds the lock." >&2; exit 1; }

tool="$incoming/release-artifact.js"
guard="$incoming/check-deployment.js"
config="$incoming/ecosystem.config.cjs"
node "$guard" --runtime
node "$guard" --health-url

state="$base/deploy-state.json"
previous=""
candidate=""
switch_started=0

set_link() {
  local name=$1 target=$2
  ln -s "$target" "$base/.$name-next" || return 1
  mv -Tf "$base/.$name-next" "$base/$name" || return 1
}

start_release() {
  local selected=$1 present
  node "$guard" --release "$base" "$selected" || return 1
  present=$(pm2 jlist | node -e '
    const list = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    if (!Array.isArray(list)) process.exit(1);
    console.log(list.some(app => app.name === "studyjony-api") ? "yes" : "no");
  ') || return 1
  if [[ "$present" == yes ]]; then pm2 delete studyjony-api > /dev/null || return 1; fi
  # Do not inherit production secrets or arbitrary SSH-shell overrides into PM2.
  env -i HOME="$HOME" PATH="$PATH" PM2_HOME="$PM2_HOME" NODE_ENV=production \
    STUDYJONY_RELEASE="$selected" pm2 start "$config" --only studyjony-api > /dev/null || return 1
  pm2 jlist | node "$guard" --pm2 "$selected" || return 1
  node "$guard" --health || return 1
  node "$guard" --database "$base" "$selected" || return 1
  node "$guard" --private-api || return 1
  node "$guard" --public-api "$base" "$selected" || return 1
}

restore_previous() {
  start_release "$previous" || return 1
  rm -f "$base/.current-next" "$base/.previous-next" || return 1
  set_link current "$previous" || return 1
  pm2 save > /dev/null || return 1
  rm -f "$state" || return 1
}

fail() {
  local code=$1
  trap - ERR INT TERM HUP
  set +e
  if [[ "$switch_started" == 1 ]]; then
    if restore_previous; then
      echo "Deployment failed; previous release restored and verified." >&2
    else
      echo "DEPLOYMENT AND ROLLBACK FAILED. Journal and both releases retained; operator recovery required." >&2
    fi
  else
    echo "Deployment preparation failed; running release was not changed." >&2
  fi
  exit "$code"
}
trap 'fail $?' ERR
trap 'fail 130' INT
trap 'fail 143' TERM
trap 'fail 129' HUP

# A killed process may leave a journal. Restore the recorded release before any
# new install. Validate paths instead of sourcing a state file as shell code.
if [[ -e "$state" ]]; then
  previous=$(node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (state.version !== 1 || typeof state.previous !== "string") process.exit(1);
    console.log(state.previous);
  ' "$state")
  node "$guard" --release "$base" "$previous"
  switch_started=1
  restore_previous
  switch_started=0
  echo "Recovered an interrupted deployment; rerun explicitly to deploy the requested revision." >&2
  exit 1
fi

[[ -L "$base/current" ]]
previous=$(readlink -f "$base/current")
node "$guard" --release "$base" "$previous"
pm2 jlist | node "$guard" --pm2 "$previous"

candidate=$(mktemp -d "$base/releases/$sha.XXXXXXXX")
node "$tool" extract "$incoming/release.json" "$checksum" "$sha" "$candidate"
node "$guard" --release "$base" "$candidate"
cd "$candidate/server"
npm ci --omit=dev --engine-strict --no-audit --no-fund
npm ls --omit=dev
node "$guard" --dependencies "$candidate"
node --check server.js
node --check app.js
find controllers middleware models routes services utils scripts -type f -name '*.js' -print0 | xargs -0 -r -n 1 node --check
npm run dialogue:catalogue:check
node "$guard" --release "$base" "$candidate"

# Link configuration only after dependency lifecycle scripts have finished.
node "$guard" --config "$base" "$candidate"
ln -s "$base/shared/backend.env" "$candidate/server/.env"
if [[ -d "$base/shared/local-avatars" ]]; then ln -s "$base/shared/local-avatars" "$candidate/server/local-avatars"; fi
node "$guard" --database "$base" "$candidate"

# Write durable intent before touching the named process. No release is deleted.
node -e '
  require("node:fs").writeFileSync(process.argv[1], JSON.stringify({
    version: 1, previous: process.argv[2], candidate: process.argv[3]
  }) + "\n", { mode: 0o600 });
' "$state.next" "$previous" "$candidate"
mv "$state.next" "$state"
switch_started=1
start_release "$candidate"
set_link previous "$previous"
set_link current "$candidate"
pm2 save > /dev/null
rm -f "$state"
switch_started=0
echo "Backend release $sha deployed and verified. Previous release retained."
