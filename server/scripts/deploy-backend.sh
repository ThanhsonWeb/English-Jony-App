#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# This script is sent by the approved workflow. It never fetches Git or uses sudo.
# Fixed labels only: never log commands, arguments, paths or environment values.
operation=preparation
stage=arguments
mark_stage() {
  stage=$1
  printf 'deployment operation=%s stage=%s status=started\n' "$operation" "$stage" >&2 || :
}
mark_stage arguments

sha=${1:?Missing revision}
incoming=${2:?Missing upload directory}
checksum=${3:?Missing artifact checksum}
export DEPLOY_HEALTH_URL=${4:?Missing verified loopback health URL}
[[ "$sha" =~ ^[a-f0-9]{40}$ && "$checksum" =~ ^[a-f0-9]{64}$ ]]
[[ "$(id -u)" != 0 && "$(id -un)" == "${DEPLOY_USER:-studyjony}" ]]
mark_stage paths
base=$(realpath -e "${DEPLOY_BASE:-/var/www/studyjony}")
[[ -d "$base/releases" && -d "$base/shared" && -d "$base/incoming" ]]
[[ ! -L "$incoming" ]]
incoming=$(realpath -e "$incoming")
[[ "$(dirname "$incoming")" == "$base/incoming" && ! -L "$incoming" ]]
mark_stage tools
for command in node npm pm2 flock; do command -v "$command" > /dev/null; done
export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"
mark_stage lock
exec 9> "$base/deploy.lock"
flock -n 9 || { echo "Another backend deployment holds the lock." >&2; exit 1; }

tool="$incoming/release-artifact.js"
guard="$incoming/check-deployment.js"
config="$incoming/ecosystem.config.cjs"
mark_stage runtime
node "$guard" --runtime
mark_stage health_url
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
  mark_stage release_integrity
  node "$guard" --release "$base" "$selected" || return 1
  mark_stage pm2_inspect
  present=$(pm2 jlist | node -e '
    const list = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    if (!Array.isArray(list)) process.exit(1);
    console.log(list.some(app => app.name === "studyjony-api") ? "yes" : "no");
  ') || return 1
  mark_stage pm2_replace
  if [[ "$present" == yes ]]; then pm2 delete studyjony-api > /dev/null || return 1; fi
  # Do not inherit production secrets or arbitrary SSH-shell overrides into PM2.
  mark_stage pm2_start
  env -i HOME="$HOME" PATH="$PATH" PM2_HOME="$PM2_HOME" NODE_ENV=production \
    STUDYJONY_RELEASE="$selected" pm2 start "$config" --only studyjony-api > /dev/null || return 1
  mark_stage pm2_verify
  pm2 jlist | node "$guard" --pm2 "$selected" || return 1
  mark_stage health
  node "$guard" --health || return 1
  mark_stage database
  node "$guard" --database "$base" "$selected" || return 1
  mark_stage private_api
  node "$guard" --private-api || return 1
  mark_stage public_api
  node "$guard" --public-api "$base" "$selected" || return 1
}

restore_previous() {
  operation=rollback
  start_release "$previous" || return 1
  mark_stage pointer_cleanup
  rm -f "$base/.current-next" "$base/.previous-next" || return 1
  mark_stage current_pointer
  set_link current "$previous" || return 1
  mark_stage save
  pm2 save > /dev/null || return 1
  mark_stage journal_clear
  rm -f "$state" || return 1
}

fail() {
  local code=$1 failed_operation="$operation" failed_stage="$stage"
  trap - ERR INT TERM HUP
  set +e
  printf 'deployment operation=%s stage=%s status=failed exit_code=%s\n' "$failed_operation" "$failed_stage" "$code" >&2 || :
  if [[ "$switch_started" == 1 ]]; then
    if restore_previous; then
      echo "Deployment failed; previous release restored and verified." >&2
    else
      local rollback_code=$?
      printf 'deployment operation=%s stage=%s status=failed exit_code=%s\n' "$operation" "$stage" "$rollback_code" >&2 || :
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
mark_stage journal_inspect
if [[ -e "$state" ]]; then
  previous=$(node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (state.version !== 1 || typeof state.previous !== "string") process.exit(1);
    console.log(state.previous);
  ' "$state")
  mark_stage previous_integrity
  node "$guard" --release "$base" "$previous"
  switch_started=1
  restore_previous
  switch_started=0
  echo "Recovered an interrupted deployment; rerun explicitly to deploy the requested revision." >&2
  exit 1
fi

mark_stage current_pointer
[[ -L "$base/current" ]]
previous=$(readlink -f "$base/current")
mark_stage previous_integrity
node "$guard" --release "$base" "$previous"
mark_stage current_pm2
pm2 jlist | node "$guard" --pm2 "$previous"

mark_stage extract
candidate=$(mktemp -d "$base/releases/$sha.XXXXXXXX")
node "$tool" extract "$incoming/release.json" "$checksum" "$sha" "$candidate"
mark_stage candidate_integrity
node "$guard" --release "$base" "$candidate"
cd "$candidate/server"
mark_stage install
npm ci --omit=dev --engine-strict --no-audit --no-fund
mark_stage dependency_tree
npm ls --omit=dev
mark_stage native_dependencies
node "$guard" --dependencies "$candidate"
mark_stage syntax
node --check server.js
node --check app.js
find controllers middleware models routes services utils scripts -type f -name '*.js' -print0 | xargs -0 -r -n 1 node --check
mark_stage catalogue
npm run dialogue:catalogue:check
mark_stage post_catalogue_integrity
node "$guard" --release "$base" "$candidate"

# Link configuration only after dependency lifecycle scripts have finished.
mark_stage config
node "$guard" --config "$base" "$candidate"
mark_stage environment_link
ln -s "$base/shared/backend.env" "$candidate/server/.env"
mark_stage avatar_link
if [[ -d "$base/shared/local-avatars" ]]; then ln -s "$base/shared/local-avatars" "$candidate/server/local-avatars"; fi
mark_stage database
node "$guard" --database "$base" "$candidate"

# Write durable intent before touching the named process. No release is deleted.
mark_stage journal_write
node -e '
  require("node:fs").writeFileSync(process.argv[1], JSON.stringify({
    version: 1, previous: process.argv[2], candidate: process.argv[3]
  }) + "\n", { mode: 0o600 });
' "$state.next" "$previous" "$candidate"
mv "$state.next" "$state"
switch_started=1
operation=activation
start_release "$candidate"
mark_stage previous_pointer
set_link previous "$previous"
mark_stage current_pointer
set_link current "$candidate"
mark_stage save
pm2 save > /dev/null
mark_stage journal_clear
rm -f "$state"
switch_started=0
echo "Backend release $sha deployed and verified. Previous release retained."
