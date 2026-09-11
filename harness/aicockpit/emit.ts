// harness/aicockpit/emit.ts — the aicockpit per-shell emission plugin.
//
// The unified packager copies core/ → dist/aicockpit/.aicockpit/ and runs graph
// compile + runner-gen there, then calls this emit() for the .aicockpit/ shell —
// the ONLY dir aicockpit itself reads (live-verified on 1.17.18):
//   - .aicockpit/agents/aidlc-*-agent.md — the 14 personas as native aicockpit
//     subagents: core frontmatter with the `tier:` line projected to the
//     aicockpit-native `model:`/`variant:` keys plus an added `mode: subagent`
//     (so none registers as a primary agent), body token-substituted → .aicockpit.
//   - .aicockpit/command/aidlc.md — the user-invoked /aidlc entry (authored).
//   - .aicockpit/plugin/aidlc-aicockpit-adapter.ts — the hook adapter (authored;
//     aicockpit auto-discovers plugins from .aicockpit/plugin/).
//
// WHY the engine is NOT inside .aicockpit/: aicockpit auto-imports every *.ts
// under .aicockpit/tools/ and .aicockpit/tool/ as custom tool definitions, and
// importing a CLI-style script (top-level argv dispatch, process.exit) crashes
// the session (live-reproduced). The engine tree therefore ships at .aicockpit/,
// which aicockpit never scans; the shipped aicockpit.json registers
// `skills.paths: [".aicockpit/skills"]` for skill discovery there.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import type { Tier } from "../../core/tools/aidlc-tiers.ts";
import {
  modelAgentName,
  resolveModelPolicy,
  writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";

// Rewrite a core persona .md into its aicockpit-native subagent twin. The
// frontmatter tier becomes model/variant plus mode, the core Task denial
// becomes aicockpit's native permission map, and a core `maxTurns:` cap is
// renamed to aicockpit's native `steps:` key (per-agent step cap, aicockpit
// >= 1.0.134; at the cap aicockpit forces a final TEXT-ONLY turn - the agent
// can return a summary but cannot make tool calls, so the persona's Turn
// Budget prose still carries the write-early instruction). Unknown disallowed
// tools fail the build instead of silently landing in aicockpit's inert
// options bag.
function emitSubagentMd(raw: string, srcPath: string, tierCap: EmitContext["tierCap"]): string {
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) throw new Error(`${srcPath}: agent .md has no closed frontmatter block.`);
  const fm = m[1];
  const tierMatch = fm.match(/^tier:\s*(\S+)\s*$/m);
  if (!tierMatch) throw new Error(`${srcPath}: agent frontmatter has no tier: line.`);
  const disallowedMatch = fm.match(/^disallowedTools:\s*(.*?)\s*$/m);
  if (disallowedMatch && !/\bTask\b/i.test(disallowedMatch[1])) {
    throw new Error(
      `${srcPath}: aicockpit emission cannot project disallowedTools: ${disallowedMatch[1]}.`,
    );
  }
  const effective = resolveModelPolicy(
    null,
    modelAgentName(srcPath),
    tierMatch[1] as Tier,
    "aicockpit",
    tierCap,
  );
  // Core's harness-neutral turn cap -> aicockpit's native per-agent key.
  const maxTurns = raw.match(/^maxTurns:\s*(\d+)\s*$/m);
  return writeMarkdownAgentSurface(raw, effective, {
    effortKey: "variant",
    removeKeys: ["disallowedTools", "maxTurns"],
    afterProjectionLines: [
      "mode: subagent",
      ...(maxTurns ? [`steps: ${maxTurns[1]}`] : []),
      ...(disallowedMatch ? ["permission:", "  task: deny"] : []),
    ],
  })
    // Keep persona prose consistent with the renamed frontmatter key: the
    // harness-neutral body cites its own cap as `maxTurns: <n>`; on this
    // roster that key is `steps: <n>`.
    .replace(/`maxTurns: (\d+)`/g, "`steps: $1`");
}

function projectActiveMemoryReferences(raw: string): string {
  return raw
    .replaceAll("aidlc/spaces/<active-space>/memory/", "aidlc/spaces/default/memory/")
    .replaceAll(".aicockpit/rules/aidlc-org.md", "aidlc/spaces/default/memory/org.md")
    .replaceAll(".aicockpit/rules/aidlc-team.md", "aidlc/spaces/default/memory/team.md")
    .replaceAll(".aicockpit/rules/aidlc-project.md", "aidlc/spaces/default/memory/project.md")
    .replaceAll(".aicockpit/rules/", "aidlc/spaces/default/memory/");
}

function embedShippedEntrypoints(raw: string, distRoot: string): string {
  const marker = "/* @aidlc-shipped-entrypoints@ */ []";
  const entries = ["hooks", "tools"]
    .flatMap((dir) =>
      readdirSync(join(distRoot, ".aicockpit", dir), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .map((entry) => `${dir}/${entry.name}`),
    )
    .sort();
  if (!raw.includes(marker)) {
    throw new Error("aicockpit adapter is missing its shipped-entrypoint emission marker.");
  }
  const rendered = JSON.stringify(entries, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join("\n");
  return raw.replace(marker, `/* @aidlc-shipped-entrypoints@ */ ${rendered}`);
}

export default function emit(ctx: EmitContext): void {
  const { coreRoot, harnessRoot, distRoot, harnessDir, substituteToken, tierCap } = ctx;
  const SHELL = join(distRoot, ".aicockpit");
  const ACTIVE_MEMORY = join(distRoot, "aidlc", "spaces", "default", "memory");
  if (!existsSync(ACTIVE_MEMORY)) {
    throw new Error(`aicockpit emission requires the shipped memory tree at ${ACTIVE_MEMORY}.`);
  }

  const emissions: Array<{ path: string; content: () => string }> = [];

  // Persona subagents from core/agents/*.md (tier-projected, body → .aicockpit).
  const agentsDir = join(coreRoot, "agents");
  for (const f of readdirSync(agentsDir).filter((x) => x.endsWith(".md")).sort()) {
    emissions.push({
      path: join(SHELL, "agents", f),
      content: () => {
        // Reviewer knowledge absorption (scripts/agent-knowledge.ts) on the
        // raw core text - this emission reads core/agents/*.md directly, so
        // the packager's transform (which absorbs for the .aicockpit twins)
        // never runs on it.
        const agentName = f.replace(/\.md$/, "");
        const raw = injectDelegatedKnowledgePreflight(
          absorbReviewerKnowledge(
            readFileSync(join(agentsDir, f), "utf-8"),
            agentName,
            coreRoot,
          ),
          agentName,
          harnessDir,
        );
        const projected = substituteToken(
          emitSubagentMd(raw, join(agentsDir, f), tierCap),
        );
        return projectActiveMemoryReferences(projected);
      },
    });
    // The conductor reads this core-projected copy for inline persona framing.
    // It needs the same valid method path as the native subagent twin.
    const inlinePath = join(distRoot, ".aicockpit", "agents", f);
    emissions.push({
      path: inlinePath,
      content: () => projectActiveMemoryReferences(readFileSync(inlinePath, "utf-8")),
    });
  }

  // Authored shell surfaces, copied with token substitution on the .md.
  emissions.push({
    path: join(SHELL, "command", "aidlc.md"),
    content: () => substituteToken(readFileSync(join(harnessRoot, "command", "aidlc.md"), "utf-8")),
  });
  emissions.push({
    path: join(SHELL, "plugin", "aidlc-aicockpit-adapter.ts"),
    content: () =>
      substituteToken(
        embedShippedEntrypoints(
          readFileSync(join(harnessRoot, "plugin", "aidlc-aicockpit-adapter.ts"), "utf-8"),
          distRoot,
        ),
      ),
  });

  // In --check mode the packager supplies an isolated distRoot, then compares the
  // complete generated tree with the independently generated counterpart.
  // rmSync(SHELL, { recursive: true, force: true }); // Removed for aicockpit because SHELL === harnessDir
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
}
