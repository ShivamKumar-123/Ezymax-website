---
tags: [workflow, design, tooling, wip]
updated: 2026-08-01
---

# Superdesign — design-version exploration

External design tool used to generate and compare multiple UI design versions
on an infinite canvas before committing one to code. Adopted 2026-08-01 at the
user's request for the horizontal ticker-tape text section.

## Install state

- **Skill:** `superdesigndev/superdesign-skill`, installed **globally** at
  `~/.claude/skills/superdesign/` (via `npx skills add … -g -a claude-code`) —
  user-level, not in this repo's `.claude/skills/`.
- **CLI:** `@superdesign/cli` v0.9.0, installed globally via npm — **not** a
  project dependency (no `package.json` change).
- **Auth:** `superdesign login` (browser flow) — per-user session.
- **Repo artifacts:** `superdesign init` writes analysis context to
  `.superdesign/init/` in this repo (one-time, regenerable).

## How to use

Invoke the `superdesign` skill (it self-documents its SOP). Typical flow:
init → define target → generate versions → review on the canvas preview URL →
implement the chosen version by hand following this vault's rules.

**State:** login + repo init complete (`.superdesign/init/`, six files;
`.superdesign/design-system.md` written — Obsidian & Lime). First round
(2026-08-01): project *FX Artha — Ticker Text Section*, three drafts (base /
minimalist / layered); the base draft was implemented as the home
`TickerBand` section — see [[changelog]].

> [!warning] Designs are references, not code drops
> Whatever Superdesign produces is a *visual target*. Implementation in this
> repo still follows the hard rules — spring-based motion (no GSAP, no
> keyframes — ADR-0002), tokens-first styling ([[design-system]]), route→view
> structure ([[routing]]). E.g. the ticker-tape reference's GSAP ScrollTrigger
> maps to `<ProgressTrigger>`/`<SpringTrigger mode="scrub">` here.

## Related

[[ai-agent-guide]] · [[design-system]] · [[animation-system]]
