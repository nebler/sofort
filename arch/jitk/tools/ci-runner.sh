#!/bin/sh
# Installs, removes or reports a GitHub Actions self-hosted runner for this
# repository on the host it runs on. kvm-dev (Linux arm64, nested KVM) runs
# the `kvm` job of .github/workflows/jitk-ci.yml; a Mac can run the optional
# `mac` job. Run it on the runner host as the user the jobs should run as:
#
#   Linux (kvm-dev, from the Mac):
#     RUNNER_TOKEN=$(gh api -X POST repos/nebler/sofort/actions/runners/registration-token --jq .token)
#     kvm-dev/ssh.sh "RUNNER_TOKEN=$RUNNER_TOKEN RUNNER_LABELS=kvm sh -s install" <arch/jitk/tools/ci-runner.sh
#   macOS (on the Mac itself):
#     RUNNER_TOKEN=$(gh api -X POST repos/nebler/sofort/actions/runners/registration-token --jq .token) \
#       RUNNER_LABELS=hvf sh arch/jitk/tools/ci-runner.sh install
#   Remove (either host): RUNNER_TOKEN from .../actions/runners/remove-token, then `... remove`.
#   Status: `sh ci-runner.sh status`.
#
# Linux: a systemd user service (jitk-ci-runner.service) with lingering
# enabled for the user, so it starts at boot without a login. macOS: the
# runner's own launchd agent (svc.sh). GitHub adds the labels self-hosted,
# the OS and the architecture; RUNNER_LABELS adds more (comma-separated).
#   RUNNER_DIR   install directory (default $HOME/actions-runner); jobs work
#                in $RUNNER_DIR/_work
#   RUNNER_NAME  default: the host name
#   RUNNER_REPO  default: nebler/sofort
# Jobs serialise their KVM suites with other users of the host through the
# bench lock (tools/ci.sh `locked`), not through the runner.
set -eu
VERSION=2.338.2
SHA256_LINUX_ARM64=670adb2f268fe21dcbb58b3db0e0aa9d5b3bddfe2c651481336e561ff86de945
SHA256_OSX_ARM64=25a065af409ffa317ab4d5a3b614dd15fc9c40f2172bc1b35a1b1258e919a388
SERVICE=jitk-ci-runner.service
RUNNER_DIR=${RUNNER_DIR:-$HOME/actions-runner}
RUNNER_REPO=${RUNNER_REPO:-nebler/sofort}
RUNNER_NAME=${RUNNER_NAME:-$(uname -n)}
UNIT=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$SERVICE

case "$(uname -s)-$(uname -m)" in
  Linux-aarch64) platform=linux-arm64 sha=$SHA256_LINUX_ARM64 ;;
  Darwin-arm64) platform=osx-arm64 sha=$SHA256_OSX_ARM64 ;;
  *) echo "ci-runner: unsupported host $(uname -s) $(uname -m)" >&2; exit 2 ;;
esac

need_token() {
  [ -n "${RUNNER_TOKEN:-}" ] || { echo "ci-runner: set RUNNER_TOKEN (gh api -X POST repos/$RUNNER_REPO/actions/runners/$1 --jq .token)" >&2; exit 2; }
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

install_runner() {
  need_token registration-token
  if [ -f "$RUNNER_DIR/.runner" ]; then
    echo "ci-runner: $RUNNER_DIR is already configured; run remove first" >&2
    exit 1
  fi
  mkdir -p "$RUNNER_DIR"
  tarball=$RUNNER_DIR/actions-runner-$platform-$VERSION.tar.gz
  curl -fsSL -o "$tarball" "https://github.com/actions/runner/releases/download/v$VERSION/actions-runner-$platform-$VERSION.tar.gz"
  got=$(sha256 "$tarball")
  [ "$got" = "$sha" ] || { echo "ci-runner: sha256 mismatch for $tarball: $got != $sha" >&2; rm -f "$tarball"; exit 1; }
  tar -xzf "$tarball" -C "$RUNNER_DIR"
  rm -f "$tarball"
  (cd "$RUNNER_DIR" && ./config.sh --unattended --replace --url "https://github.com/$RUNNER_REPO" \
    --token "$RUNNER_TOKEN" --name "$RUNNER_NAME" --labels "${RUNNER_LABELS:-}" --work _work)
  case $platform in
    linux-*)
      mkdir -p "$(dirname "$UNIT")"
      cat >"$UNIT" <<EOF
[Unit]
Description=GitHub Actions runner for $RUNNER_REPO ($RUNNER_NAME)
After=network-online.target

[Service]
WorkingDirectory=$RUNNER_DIR
ExecStart=$RUNNER_DIR/run.sh
Environment=PATH=$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin
Restart=always
RestartSec=10
KillMode=process
KillSignal=SIGINT
TimeoutStopSec=5min

[Install]
WantedBy=default.target
EOF
      # Lingering starts the user manager, and so the runner, at boot.
      loginctl enable-linger "$(id -un)" 2>/dev/null || sudo -n loginctl enable-linger "$(id -un)"
      systemctl --user daemon-reload
      systemctl --user enable --now "$SERVICE"
      ;;
    osx-*) (cd "$RUNNER_DIR" && ./svc.sh install && ./svc.sh start) ;;
  esac
  status_runner
}

remove_runner() {
  need_token remove-token
  case $platform in
    linux-*)
      systemctl --user disable --now "$SERVICE" 2>/dev/null || true
      rm -f "$UNIT"
      systemctl --user daemon-reload
      ;;
    osx-*) (cd "$RUNNER_DIR" && { ./svc.sh stop || true; } && { ./svc.sh uninstall || true; }) ;;
  esac
  (cd "$RUNNER_DIR" && ./config.sh remove --token "$RUNNER_TOKEN")
  echo "ci-runner: unregistered; delete $RUNNER_DIR to drop the files"
}

status_runner() {
  [ -f "$RUNNER_DIR/.runner" ] || { echo "ci-runner: no runner configured in $RUNNER_DIR"; return 0; }
  echo "ci-runner: configured in $RUNNER_DIR"
  case $platform in
    linux-*) systemctl --user --no-pager status "$SERVICE" | head -5 ;;
    osx-*) (cd "$RUNNER_DIR" && ./svc.sh status) ;;
  esac
}

case "${1:-}" in
  install) install_runner ;;
  remove) remove_runner ;;
  status) status_runner ;;
  *) echo 'usage: ci-runner.sh install|remove|status (see the header)' >&2; exit 2 ;;
esac
