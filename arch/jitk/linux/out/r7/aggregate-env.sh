# Source from the original worktree root. A source-identical kit copy keeps all
# generated regression artifacts and dependency setup inside linux/.work/.
TASK_SUITE_COPY="$PWD/arch/jitk/linux/.work/mac-suite/arch/jitk"
export JITK_NODE=/tmp/jitk-09/node-real
export JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
export JITK_CANONICAL_VMM=/Users/noah/code/sofort/arch/jitk/linux/.work/jitk-vmm
export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
export HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker
export HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot
