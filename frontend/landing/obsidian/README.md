---
tags: [moc, home]
updated: 2026-07-24
---

# 🧠 next16-claude-starter — Project Brain

This vault is the **single source of truth** for the `next16-claude-starter` project. It documents
how the project is built, why decisions were made, and how to extend it — for both
humans and AI agents (Claude Code, Cursor).

> [!info] What is this project?
> `next16-claude-starter` (package name `next16-claude-starter`) is a **Next.js 16 starter template**
> built by [Textura](https://textura.agency) for animation-heavy marketing & landing
> sites. Every motion is spring-based; there is no backend yet.

## 🗺️ Map of Content

### 00 — Meta
- [[meta/README|Meta overview]] — how to use and maintain this vault
- [[changelog]] — chronological log of notable project changes
- [[decisions-log]] — Architecture Decision Records (ADRs)

### 01 — Architecture
- [[system-overview]] — the big picture, request lifecycle, mental model
- [[tech-stack]] — every dependency and why it is here
- [[folder-structure]] — where everything lives and what belongs where
- [[data-flow]] — how state, scroll, and animation data move through the app
- [[environment-variables]] — config & secrets handling

### 02 — Frontend
- [[design-system]] — Tailwind v4 tokens, CSS layers, styling rules
- [[html-semantics]] — semantic, accessible, SEO-correct markup rules
- [[seo-metadata]] — metadata generation & bot detection
- [[routing]] — App Router conventions ⚠️ *predates ADR-0016; there is no
  `src/views/` layer any more*

> **October 2026 — this app was rebuilt.** The notes on the spring animation
> system, `spring-text-engine`, Lenis smooth scroll, and the component, hook
> and util catalogs described code that no longer exists, and were deleted
> rather than left to mislead. Start from [[tech-stack]] and
> [[folder-structure]], and read ADR-0016 in [[decisions-log]] for what
> changed and why. `AGENTS.md` at the app root is the current rulebook.

### 03 — Backend
- [[backend/README|Backend overview]] — API layer; no DB/auth yet
- [[api-architecture]] — `app/api` route-handler convention & secret handling

### 04 — Workflows
- [[new-page]] — playbook for implementing a new page/section
- [[generic-layout-prompt]] — fill-in prompt template for a new page/section
- [[optimize-3d-scene]] — the `optimize-3d-scene` skill: performance work on a three.js/WebGL scene
- [[superdesign]] — the `superdesign` skill: explore/compare design versions on the Superdesign canvas
- [[ai-agent-guide]] — rules of engagement for AI agents working in this repo

### Templates
- [[templates/component-note|Component note template]]
- [[templates/hook-note|Hook note template]]
- [[templates/adr-note|ADR template]]

## 🏷️ Tag legend

| Tag | Meaning |
|-----|---------|
| `#stable` | Documented and reliable — safe to depend on |
| `#wip` | Work in progress / partially documented |
| `#todo` | Needs attention or is unfinished |
| `#decision` | Records or relates to an architectural decision |
| `#do-not-modify` | Code that must not be edited (animation engine) |

## 🔌 Obsidian setup

Open this folder (`obsidian/`) as an Obsidian vault. Recommended:
- **Graph view** — see how specs, components, and hooks connect
- **Dataview plugin** — query notes (e.g. list all `#wip` pages)
- **Templates core plugin** — point it at the `templates/` folder
