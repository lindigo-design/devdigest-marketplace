# Claude Design prompt: catalog prototype

How to use it:

1. Open Claude Design → **Prototype**, Design system: **None**, Template: **None**.
2. Paste everything inside the fenced block below as the prompt.
3. If a result drifts from the tokens (other fonts, gradients, card grid), reply with: "Use only the tokens from the prompt; no other fonts or colors."
4. Current prototype: [Devdigest Catalog](https://claude.ai/artifact/HjK5N6inqcqDbPzDUH19Kq) (moved from Claude Design to claude.ai; private to the owner). Exported copy: [prototype/devdigest-catalog.dc.html](prototype/devdigest-catalog.dc.html) with its runtime `support.js`, exported 2026-11-09. It matches the tokens after review round 2: type sizes, 64px top space, live-search hint, stats in the left rail, no colors outside the palette. It loads Google Fonts directly, while the site self-hosts them (spec R7/AC-5).
5. After a new export, replace the files in `docs/design/prototype/` and note what changed against the [tokens](design-tokens.md). Token changes go back into `design-tokens.md` first; the prototype is never the source of truth.

````text
Design a clickable prototype of "lindigo-devdigest": a static catalog website for a Claude Code plugin marketplace (hosted on GitHub Pages, no backend). Users type a need in plain words, see matching plugins, skills, agents, hooks and commands, and copy an install command.

CONCEPT (approved, do not change)
Thesis: a plugin catalog is reference material, so it reads like a well-set technical index. The query is the headline; everything else stays quiet.
Direction: Editorial / Swiss. Asymmetric grid, oversized serif display, generous whitespace. Monospace only for commands, paths and versions.
Tone: precise, calm, trustworthy.
Memorable element: the search line is set in oversized serif as "I need a ___", and results run beneath it like entries in a printed index (ruled rows, not tiles).
Anti-goals: no app-store grid of identical tiles, no gradients or glassmorphism, no charts (stats are typeset numerals), no emoji or icon sets for kinds (use text labels), no Inter/Roboto/Arial, not a dark hacker terminal.

TOKENS (use exactly these, nothing else)
Fonts: Display "Source Serif 4"; body/UI "IBM Plex Sans"; mono "IBM Plex Mono".
Type: display-xl clamp(2rem,4vw,3.25rem)/1.05 tracking -0.015em (search line); display clamp(1.75rem,3.5vw,2.5rem)/1.08 (page titles); numeral clamp(1.75rem,3vw,2.5rem)/1 weight 300 tabular (stats); heading-1 2rem/1.1 serif 500; heading-2 1.375rem/1.2 sans 600; body-lg 1.125rem/1.55; body 1rem/1.55; label 0.75rem uppercase tracking 0.08em sans 600; caption 0.8125rem/1.4; mono 0.875rem/1.5. Text measure max 68ch.
Light colors: page #F5F3EE, raised #FFFFFF, sunken #ECE9E2, ink #17171B, secondary #54545C, whisper #8A8892 (large or decorative text only), hairline #D9D5CB, accent indigo #3340B5, indigo-soft #E4E6F6, caution #A84E17, positive #2D7A4D, rollback #7A3FA0.
Dark colors: page #111115, raised #1A1A20, sunken #0B0B0E, ink #EDEBE6, secondary #A9A7B1, whisper #6E6C77, hairline #2B2A32, indigo #8F9AFF, indigo-soft #22254A, caution #E38B57, positive #6CC594, rollback #C79BEB.
Indigo is the only hero color: links, focus ring, active filters, the search caret, match highlights (on indigo-soft).
Spacing scale 4/8/12/16/24/32/48/64/96/144. Radius 0 everywhere; 2px for inputs and badges; pill only for compatibility badges. No shadows: depth comes from 1px hairline rules, a 2px ink rule under the search line, and the raised surface. Focus ring: 2px indigo, 3px offset.
Grid: 8 columns, 24px gutter, 64px margin at >=1200px. Search line spans cols 1-7. A sticky left rail (cols 1-2) holds stats and filters; results sit in cols 3-8. 6 columns at 768-1199px (filters become a row). 4 columns, 16px margin below 768px (filters in a drawer). Must work at 360px with no horizontal scroll.
Motion: ease-settle cubic-bezier(0.16,1,0.3,1); ease-snap cubic-bezier(0.87,0,0.13,1); 120ms hover, 240ms state, 560ms reveal, 70ms stagger. Page load: search line reveals word by word with a clip-path wipe, then results stagger in. Hover/focus on a result: its top hairline redraws left to right in indigo. Copy button swaps to "Copied" (positive color, 2s) with ease-snap. Never fade-in-from-bottom. Respect prefers-reduced-motion.

SCREENS (light theme first, then dark versions of 1 and 2)
1. Home.
   - Search line "I need a ___" (empty state, blinking indigo caret).
   - Rail: stats as numerals linking to filtered search: 4 plugins, 0 skills, 0 agents, 0 commands, 0 hooks, 0 MCP servers, last release 2026-11-09. Show the zero state with the note "No components yet — plugins are being migrated".
   - "What's new": 4 items, each showing plugin, version 0.1.0, date 2026-11-09 and two lines of notes.
   - Plugin entries for the 4 plugins below.
   - Small links to "RSS" and "JSON feed".
2. Search results for the query "мені треба скіл для рев'ю безпеки" (Ukrainian; the serif must render Cyrillic).
   - The kind filter "Skill" is auto-applied and shown as a removable chip.
   - Results as ruled index rows. Each row shows:
     - a KIND label (SKILL, AGENT, HOOK, PLUGIN);
     - the name in heading-2;
     - "plugin · v0.1.0" as a caption;
     - a one-line description with matched words highlighted on indigo-soft;
     - up to 5 tags;
     - compatibility badges "Claude Code ≥ 2.1.110", "Windows", "macOS";
     - a "runs commands" marker in caution color for agents and hooks;
     - a mono copy field "/plugin install architecture-review@lindigo-devdigest" with a Copy button.
   - Use these sample results:
     - security (skill, engineering-paved-path);
     - pr-self-review (skill, architecture-review);
     - security-reviewer (agent, architecture-review, tools: Read, Grep, Glob, Bash);
     - architecture-reviewer (agent, architecture-review);
     - gate (hook, architecture-review, PreToolUse on Bash).
   - Filters in the rail: Kind, Plugin, Category, Tag, OS.
3. No results for "kubernetes helm": echo the query, offer "Clear filters" and "Show everything", plus a quiet link "Request a skill on GitHub".
4. Plugin page "sdd-engineering".
   - Title in display.
   - Description "Spec-driven development workflow: spec, plan, implement, test, verify and document, with scoped write hooks."
   - Version 0.1.0, category workflow, license MIT, tags (sdd, spec, planning, implementation, testing, agents), compatibility badges.
   - Install block (raised surface, mono):
     - "/plugin marketplace add lindigo-design/devdigest-marketplace";
     - "/plugin install sdd-engineering@lindigo-devdigest";
     - "Also installs: engineering-paved-path ^0.1, research-tools ^0.1, architecture-review ^0.1".
   - "Depends on": the 3 plugins as links with ranges.
   - "Used by": none.
   - Components: an empty "No components yet" state.
   - Latest changelog entry.
   - Rendered README excerpt with a code block on the sunken surface.
5. Component page for agent "security-reviewer".
   - Kind label, title, owning plugin link.
   - Frontmatter as a key/value table: tools, model, skills.
   - "Runs commands: Bash (read-only git, enforced by a hook)" in caution color.
   - Rendered body excerpt.
   - The install block of its plugin.
   - "View source on GitHub" link.

Plugin data for the home page:
- engineering-paved-path: Base layer with shared team guardrails, security rubric, engineering insights, workflow retros and Mermaid diagrams. Category engineering-standards. Depends on nothing.
- research-tools: Read-only researcher and brainstorm agents. Category research. Depends on engineering-paved-path ^0.1.
- architecture-review: Architecture and security reviewer agents, PR self-review skill with a pre-push gate. Category code-review. Depends on engineering-paved-path ^0.1.
- sdd-engineering: Spec-driven development workflow. Category workflow. Depends on engineering-paved-path, research-tools, architecture-review (^0.1).

Accessibility: WCAG 2.1 AA, visible focus on every interactive element, keyboard: "/" or Cmd/Ctrl+K focuses the search line. UI copy in English.
````
