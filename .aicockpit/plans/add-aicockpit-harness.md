# Plan: Adapt Codebase for AICockpit

## Objective
Introduce support for a new harness called `aicockpit` (a fork of kilocode) into the "one-core-many-harnesses" architecture of the `aidlc-workflows` codebase. This will allow the project to be built and projected properly for the AICockpit CLI/IDE, using the `.aicockpit` directory for the harness.

## 1. Registration in Runtime Paths (`core/tools/aidlc-runtime-paths.ts`)
- Update `HARNESS_PRECEDENCE` array to include `".aicockpit"`.
- Update `runtimeHarnessName` function to return `"aicockpit"` when `harnessDir === ".aicockpit"`.

## 2. Configuration & Settings (`core/tools/aidlc-settings.ts`)
- Add `"aicockpit"` to all relevant harness validation arrays (e.g., `["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode", "aicockpit"]`).

## 3. Harness Core Integrations (`core/tools/`)
Multiple core tools need to recognize `"aicockpit"` for behavior conditionally logic (replicating `opencode` or `kiro` behaviors depending on the exact requirements of AICockpit).
- `aidlc-model-policy.ts`: Add `aicockpit` to `Harness` union type and define its default model policy.
- `aidlc-plugin.ts`: Add `aicockpit` to `harness` types and relevant projection loop arrays.
- `aidlc-utility.ts`: Register diagnostic paths (e.g. `aicockpit.json` permissions) and repair routines.
- `aidlc-init.ts`: Handle initialization prompts and distributions for `aicockpit`.
- `aidlc-doctor.ts`: Map the `aicockpit` distribution to the appropriate checker.

## 4. Build Scripts & Types (`scripts/`)
- `scripts/manifest-types.ts`: Add `"aicockpit"` to `tierFlavor`.
- `scripts/package.ts` / `scripts/build-binaries.ts`: Ensure `aicockpit` is iterated during generation and build checks, matching the treatment for other harnesses.

## 5. Harness Directory Structure (`harness/aicockpit/`)
Create the new harness template structure at `harness/aicockpit/` to tell the packager (`scripts/package.ts`) how to emit the AICockpit projection.
- `harness/aicockpit/manifest.ts`: Declare the projection manifest (core dirs, harness files, plugins, etc.).
- `harness/aicockpit/onboarding.fills.ts`: Custom instructions for `AGENTS.md`.
- `harness/aicockpit/aicockpit.json`: Project root configuration.
- `harness/aicockpit/dot-gitignore`: Ignore file defaults.
- `harness/aicockpit/skills/aidlc/SKILL.md`: Orchestrator skill specific to AICockpit.

## 6. Testing (`tests/`)
- `tests/unit/t336-change-control-surfaces.test.ts`: Add `"aicockpit"` to `HARNESSES` array.
- Cover `aicockpit` in relevant integration tests matching other harnesses.

## Next Steps
Once the plan is approved, we will begin implementing these files starting with the types and core tools, then create the `harness/aicockpit` directory structure, and finally update the build and test scripts.
