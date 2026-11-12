#!/usr/bin/env bash
set -euo pipefail
# This script owns only the ProofBill service and directory on the existing host.
app=/opt/proofbill
if ! id -u proofbill >/dev/null 2>&1; then
  useradd --system --home-dir "$app" --shell /usr/sbin/nologin proofbill
fi
if [ ! -d "$app/.git" ]; then
  git clone https://github.com/EndPx/proofbill.git "$app"
fi
git -C "$app" fetch origin main
git -C "$app" merge --ff-only origin/main
cd "$app"
pnpm install --filter '@proofbill/agent...' --prod --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check -r workers/inference/requirements.txt
install -d -m 700 -o proofbill -g proofbill .runtime
test -f .env.local
chown root:proofbill .env.local
chmod 640 .env.local
install -m 644 infra/systemd/proofbill-worker.service /etc/systemd/system/proofbill-worker.service
systemctl daemon-reload
systemctl enable proofbill-worker
systemctl restart proofbill-worker
systemctl is-active proofbill-worker
