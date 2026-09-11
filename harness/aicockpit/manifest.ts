// harness/aicockpit/manifest.ts — the aicockpit distribution row.

import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import onboardingFills from "./onboarding.fills.ts";
import emit from "./emit.ts";

const manifest: HarnessManifest = {
  name: "aicockpit",
  productName: "AICockpit",
  configNextStep: "run `aicockpit`, then `/aidlc --doctor`",
  harnessDir: ".aicockpit",
  orchestratorSkillPath: ".aicockpit/skills/aidlc/SKILL.md",
  tierFlavor: "aicockpit",
  rootIntegrations: [
    { path: ".gitignore", policy: "managed-block", marker: "gitignore" },
    { path: "AGENTS.md", policy: "managed-block", marker: "agents" },
    { path: "aicockpit.json", policy: "whole-file" },
  ],

  // Same core projection as claude, into .aicockpit/. The persona .md files ARE
  // core (the conductor adopts them inline from .aicockpit/agents/); the
  // aicockpit-native subagent copies in .aicockpit/agents/ are emitted.
  coreDirs: [
    { src: "tools", dst: "tools" },
    { src: "aidlc-common", dst: "aidlc-common" },
    { src: "knowledge", dst: "knowledge" },
    { src: "sensors", dst: "sensors" },
    { src: "scopes", dst: "scopes" },
    { src: "agents", dst: "agents" },
    { src: "hooks", dst: "hooks" },
    { src: "skills/aidlc-session-cost", dst: "skills/aidlc-session-cost" },
    { src: "skills/aidlc-replay", dst: "skills/aidlc-replay" },
    { src: "skills/aidlc-outcomes-pack", dst: "skills/aidlc-outcomes-pack" },
    { src: "skills/aidlc-knowledge", dst: "skills/aidlc-knowledge" },
  ],

  harnessFiles: [
    // The orchestrator skill, inside .aicockpit/skills/ (discovered via the
    // aicockpit.json skills.paths glob, like every generated runner).
    { src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md" },
    { src: "skills/aidlc/question-rendering.md", dst: "skills/aidlc/question-rendering.md" },
    // Project config at the dist ROOT (aicockpit reads ./aicockpit.json):
    // skills.paths (skill discovery), instructions glob (the method include),
    // and the native aidlc command permissions.
    { src: "aicockpit.json", dst: "aicockpit.json", projectRoot: true },
    { src: "dot-gitignore", dst: ".gitignore", projectRoot: true },
  ],

  // AGENTS.md at the project root — aicockpit auto-reads it (its primary rules
  // file), the same skeleton + fills mechanism as Kiro/Claude.
  onboarding: { dst: "AGENTS.md", projectRoot: true, fills: onboardingFills },

  // .aicockpit/ is AIDLC's own dir; core's rules/ name has nothing to collide with.
  rulesRename: null,

  emit,

  plugin: {
    manifestDir: ".aicockpit-plugin",
    kind: "store",
    installRoots: [".aicockpit"],
  },
};

export default manifest;
