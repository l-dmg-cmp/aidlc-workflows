# AI-DLC on AICockpit

The AICockpit runtime is one of the framework's harness distributions, for the
open-source **AICockpit** harness (aicockpit.ai). One deterministic core, many
harnesses: the engine, state machine, audit log, graph, swarm referee, and
learnings gate are byte-identical across every distribution — only the shell
differs. The source/development tree is **generated** into ignored local
`dist/aicockpit/` from `core/` + `harness/aicockpit/` by
`bun scripts/package.ts aicockpit`; never hand-edit it.

## Layout: two dot-dirs, on purpose

AICockpit auto-imports every `*.ts` under `.aicockpit/tools/` and
`.aicockpit/tool/` as custom tool definitions, and importing a CLI-style engine
script (top-level dispatch, `process.exit`) crashes the session
(live-reproduced on AICockpit 2.x). So this distribution splits:

- **`.aicockpit/` (Engine)** — the AIDLC engine tree (tools, hooks, skills, agents,
  knowledge, scopes, sensors, aidlc-common). 
- **`.aicockpit/` (Surface)** — natively-consumed surfaces: the 14 persona
  subagents (`agents/*.md`, `mode: subagent`), the `/aidlc` command
  (`command/aidlc.md`), and the hook-adapter plugin
  (`plugin/aidlc-aicockpit-adapter.ts`, auto-discovered by AICockpit).
  
> **Note**: Because AICockpit uses `.aicockpit` for everything, both the framework internals and the harness surfaces are merged into the same `.aicockpit` folder for this distribution.

## Prerequisites

- **AICockpit** — the plugin hook surface this install relies on
  (`tool.execute.before`, `tool.execute.after`, `chat.message`, `session.idle`,
  `experimental.session.compacting`) and project-local skill/agent discovery.
- **bun** only when generating or running the source/development `dist/`
  projection. Native installs and versioned release runtimes dispatch through
  the installed `aidlc` executable.
- **A model provider** — the shipped project `aicockpit.json` pins no session
  model; your global AICockpit config supplies it. Tiered personas pin
  `amazon-bedrock/global.anthropic.claude-sonnet-4-6` — override per agent in
  the project `aicockpit.json` if your provider differs.

## Install

### Native channel (recommended)

```bash
tmp="$(mktemp -d)"
curl -fsSL \
  https://github.com/l-dmg-cmp/aidlc-workflows/releases/latest/download/install.sh \
  -o "$tmp/install.sh"
sh "$tmp/install.sh"
rm -rf "$tmp"
cd your-project
aidlc config --harness aicockpit
aidlc doctor
aicockpit
```

The installer verifies the release metadata, executable, and all-harness runtime archive against the published SHA-256 checksums. The installed runtime does not require Bun, Node.js, or Git. Harness selection happens in `aidlc config`.

On Windows, download `install.ps1` and run
`& $installer`. An interactive run may omit the flag;
redirected input, `pwsh -NonInteractive`, `--yes`, `--json`, and `--quiet`
require it. For an air-gapped package, use
`install.sh --from <release-directory> --offline` on Unix or
`& $installer -From <release-directory> -Offline` on Windows.

`aidlc config --harness aicockpit` projects `.aicockpit/`, the workspace shell,
`AGENTS.md`, the managed `.gitignore` block, and `aicockpit.json`. The generated
config discovers the skill and method files and allows direct `aidlc engine *`
commands; other shell commands still prompt. Start aicockpit in the project and
run `/aidlc --doctor`, then `/aidlc` followed by what you want to build.

### Versioned manual-copy alternative

Download and extract a specific release's `aidlc-runtime-X.Y.Z.tar.gz` as described in
[Install and Lifecycle: Copy Channel](../18-install-and-lifecycle.md#copy-channel),
then set `RUNTIME_ROOT` to the extracted `runtime/` directory.

1. Copy the distribution into your project:

   ```bash
   cp -r "$RUNTIME_ROOT/aicockpit/.aicockpit/" your-project/.aicockpit/
   cp -r "$RUNTIME_ROOT/aicockpit/aidlc/"      your-project/aidlc/      # the workspace shell
   cp "$RUNTIME_ROOT/aicockpit/aicockpit.json" your-project/aicockpit.json  # or merge into yours
   cp "$RUNTIME_ROOT/aicockpit/AGENTS.md"      your-project/AGENTS.md      # or merge into yours
   ```

   `aicockpit.json` carries three load-bearing blocks: `skills.paths` (skill
   discovery from `.aicockpit/skills`), `instructions` (the method-tree include —
   `/aidlc space <name>` re-points it), and permission rules for AIDLC bash
   entrypoints plus edits under `.aicockpit/tools/` and `.aicockpit/hooks/`. If you
   merge into an existing `aicockpit.json`, keep all three.
   The adapter enforces the permission boundary: the target must be an entrypoint
   embedded from the packaged tree, invoked as one direct command with no
   chaining, redirection, expansion, or command substitution. Engine-code edits
   prompt for approval.

2. Apply the `.gitignore` entries from the shipped `AGENTS.md` § "Git
   Integration" before starting a workflow (per-clone audit shards are
   committed deliberately; cursors and machine-local runtime stay ignored).

3. Start aicockpit in the project and run `/aidlc --doctor`, then `/aidlc`
   followed by what you want to build.

Because AICockpit has no channel for the session-start hook's injected context,
the `/aidlc` skill performs one read-only status probe on a bare invocation. An
existing workflow gets the standard Resume / Redo / Jump / Start Fresh menu;
`/aidlc --resume` skips both the probe and menu and continues directly.

The versioned runtime uses the native `aidlc` command. Framework developers who
need the Bun-shaped projection can clone the repository, run
`bun install --frozen-lockfile` and `bun scripts/package.ts`, then use the
ignored local `dist/aicockpit/` output.

## Refresh and version skew

`aidlc update` updates the machine runtime without rewriting projects.
`aidlc doctor` reports a project stamp that differs from the selected engine.
Between workflows, preview and apply a refresh:

```bash
aidlc config --dry-run
aidlc config
```

Config preserves managed root blocks and user-owned files, and reports local
framework edits as conflicts. Because `aicockpit.json` is a whole-file
integration, a local edit is preserved as a conflict rather than overwritten.
Config refuses refresh while any workflow is active; complete the workflow first.
Upgrade and rollback remain safe during a workflow because they do not touch
the project.

## What's different on this harness

- **Questions render as numbered prose options** (no structured-question
  widget); the questions FILE with `[Answer]:` tags remains the source of
  truth.
- **Hooks ride the adapter plugin.** AICockpit uses `.aicockpit/plugin/aidlc-aicockpit-adapter.ts` to map the
  plugin hook moments onto the core hook bodies in `.aicockpit/hooks/` (run as bun
  subprocesses): reviewer read-scope and the AIDLC bash boundary before tool
  execution; audit + sensors on write/edit/apply_patch; rebuild-stage-graph on
  bash; statusline sync on todowrite; subagent logging on task; presence
  minting on each human turn; state validation before compaction.
- **Forwarding-loop enforcement is advisory.** The Stop seam is the
  `session.idle` event — reactive, not blocking. When the core stop hook
  answers `block`, the plugin re-engages the loop by injecting a nudge prompt
  (marked with a sentinel so it never mints human presence). A chatting or
  pausing human is released by the hook's interactive cap.
- **Personas are native subagents** (`mode: subagent`); the conductor adopts
  them inline for most stages and delegates via the `task` tool for the two
  subagent stages (2.1 reverse-engineering, 3.5 code-generation). Their native
  permission map denies `task`, so delegated agents cannot delegate again.
  Plugin composition emits the same `.aicockpit/agents/` twin for plugin personas.
- **Space switches preserve JSONC.** `/aidlc space <name>` updates the method
  glob in `aicockpit.json` without stripping comments
  or trailing commas, and keeps explicit persona memory paths aligned.
- **Construction swarm runs as task-tool fan-out only** (`AIDLC_USE_SWARM=1`
  is a loud no-op — no Workflow tool exists).
- **No session-end moment** — `SESSION_ENDED` audit events are not emitted.
  Pre-compaction validation DOES fire (`experimental.session.compacting`).
- **No statusline / welcome message** — use `/aidlc --status` and the progress
  lines at gates.
- **MCP servers**: none ship; configure your own under `mcp:` in
  `aicockpit.json` if needed.

## Verifying an install

```bash
aidlc doctor                               # native install
bun .aicockpit/tools/aidlc-utility.ts doctor   # source/development copy
```

The doctor's AICockpit-specific checks: the adapter plugin present at
`.aicockpit/plugin/`, a project-root `aicockpit.json`
present, and `.aicockpit/command/aidlc.md` present.