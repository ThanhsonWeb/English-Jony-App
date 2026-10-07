#!/usr/bin/env bash
set -euo pipefail

deploy_sha=${1:?Missing deployment revision}
export DEPLOY_HEALTH_URL=${2:?Missing verified loopback health URL}
[[ "$deploy_sha" =~ ^[a-f0-9]{40}$ ]]
# Keep the existing workflow's repository path. The override is for local tests.
cd "${DEPLOY_REPO_DIR:-/var/www/English-Jony-App}"

# Reject an unsupported CLI before changing the checkout or dependencies.
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 22 || minor < 14) process.exit(1);'
command -v npm > /dev/null
command -v pm2 > /dev/null
# Watch mode could restart the app while Git/npm changes files, before checks pass.
pm2 jlist | node -e '
  let data; try { data = JSON.parse(require("node:fs").readFileSync(0, "utf8")); } catch { process.exit(1); }
  if (!Array.isArray(data)) process.exit(1);
  const apps = data.filter(app => app && app.name === "studyjony-api");
  if (!apps.length || apps.some(app => !app.pm2_env || app.pm2_env.watch)) process.exit(1);
'
git diff --quiet
git diff --cached --quiet
git fetch --no-tags origin main
git merge --ff-only "$deploy_sha"
[[ "$(git rev-parse HEAD)" == "$deploy_sha" ]]
[[ -z "$(git ls-files server/node_modules)" ]]

cd server
node scripts/check-deployment.js --runtime
node scripts/check-deployment.js --health-url
pm2 jlist | node scripts/check-deployment.js --pm2
npm ci --omit=dev --engine-strict --no-audit --no-fund
npm ls --omit=dev
node scripts/check-deployment.js --dependencies
node --check server.js
node --check app.js
find controllers middleware models routes services utils scripts -type f -name '*.js' -print0 | xargs -0 -r -n 1 node --check
npm run dialogue:catalogue:check

# No restart occurs until every preceding step has succeeded.
pm2 restart studyjony-api --update-env
pm2 jlist | node scripts/check-deployment.js --pm2
node scripts/check-deployment.js --health
pm2 save
