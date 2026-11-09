# Catalog site: design tokens (Lindigo, Phase 2)

| | |
| :- | :- |
| Brief | [concept-brief.md](concept-brief.md) (approved) |
| Spec | [CAT-01](../specs/marketplace-catalog.md), R7/AC-6: every value in the site comes from these tokens |
| Status | approved 2026-11-09 (after 2 prototype review rounds) |
| Direction | Editorial / Swiss |

The Lindigo skill defines the direction but ships no token file for it, so this document is the source of truth. Once approved, the CSS block in section 8 is copied verbatim into the site as the vendored token file and pasted into the Claude Design prompt.

## 1. Typography

| Role | Family | Why |
| :- | :- | :- |
| Display | **Source Serif 4** (optical size axis, display cut) | High-contrast editorial serif; covers Cyrillic, so a Ukrainian query typed into the oversized search line renders in the same face |
| Body / UI | **IBM Plex Sans** | Neutral grotesque with Swiss discipline; covers Cyrillic; not Inter/Roboto |
| Mono | **IBM Plex Mono** | The second voice for commands, paths and versions; same skeleton as Plex Sans, so the two sit on one baseline |

All three are OFL fonts on Google Fonts and are self-hosted at build time (spec R7/AC-5: no third-party requests). Cyrillic coverage is re-checked when the fonts are subset.

| Token | Size / line-height | Font, weight | Use |
| :- | :- | :- | :- |
| `type/display-xl` | `clamp(2rem, 4vw, 3.25rem)` / 1.05 | Display 400, tracking −0.015em | the search line ("I need a ___"); reduced 6rem → 4rem → 3.25rem in prototype reviews (2026-11-09) |
| `type/display` | `clamp(1.75rem, 3.5vw, 2.5rem)` / 1.08 | Display 400 | plugin and component page titles |
| `type/numeral` | `clamp(1.75rem, 3vw, 2.5rem)` / 1 | Display 300, tabular figures | home stats |
| `type/heading-1` | 2rem / 1.1 | Display 500 | section titles ("What's new") |
| `type/heading-2` | 1.375rem / 1.2 | Sans 600 | result entry names, block titles |
| `type/body-lg` | 1.125rem / 1.55 | Sans 400 | descriptions on pages, rendered README |
| `type/body` | 1rem / 1.55 | Sans 400 | default UI text |
| `type/label` | 0.75rem / 1.3, uppercase, tracking +0.08em | Sans 600 | kind badge, filter group titles, stat captions |
| `type/caption` | 0.8125rem / 1.4 | Sans 400 | dates, plugin name under entries |
| `type/mono` | 0.875rem / 1.5 | Mono 400 | install commands, paths, versions, ranges |

Measure for running text: max `68ch`.

## 2. Color

One dominant pair (paper + ink) and one hero color: **Lindigo indigo**. Everything else is a signal used sparingly.

| Token | Light | Dark | Use |
| :- | :- | :- | :- |
| `surface/page` | `#F5F3EE` | `#111115` | page background (warm paper / ink black) |
| `surface/raised` | `#FFFFFF` | `#1A1A20` | install block, command fields |
| `surface/sunken` | `#ECE9E2` | `#0B0B0E` | code blocks in rendered README |
| `ink/primary` | `#17171B` | `#EDEBE6` | headings, body text |
| `ink/secondary` | `#54545C` | `#A9A7B1` | descriptions, captions |
| `ink/whisper` | `#8A8892` | `#6E6C77` | placeholders, rule labels (≥ 18px or non-essential only) |
| `rule/hairline` | `#D9D5CB` | `#2B2A32` | 1px rules between index entries, column dividers |
| `accent/indigo` | `#3340B5` | `#8F9AFF` | the hero color: links, focus ring, active filter, caret in the search line |
| `accent/indigo-soft` | `#E4E6F6` | `#22254A` | match highlight background, selected filter fill |
| `signal/caution` | `#A84E17` | `#E38B57` | "runs commands" marker, unsatisfied dependency warning |
| `signal/positive` | `#2D7A4D` | `#6CC594` | "Copied" confirmation |
| `signal/rollback` | `#7A3FA0` | `#C79BEB` | "Rollback" label in What's new |

Contrast (WCAG 2.1 AA, spec R7/AC-1), computed 2026-11-09 on `surface/page` / `surface/raised`:

| Token | Light | Dark |
| :- | :- | :- |
| `ink/primary` | 16.1 / 17.9 | 15.8 / 14.5 |
| `ink/secondary` | 6.8 / 7.5 | 7.9 / 7.3 |
| `accent/indigo` | 7.5 / 8.3 (6.7 on `indigo-soft`) | 7.4 / 6.8 (5.8 on `indigo-soft`) |
| `signal/caution` | 5.0 / 5.6 | 7.3 / 6.7 |
| `signal/positive` | 4.7 / 5.3 | 9.0 / 8.3 |
| `signal/rollback` | 6.2 / 6.9 | 8.4 / 7.7 |
| `ink/whisper` | 3.2 / 3.5 | 3.7 / 3.4 |

Every text token passes 4.5:1 except `ink/whisper`, which passes only 3:1. It is therefore limited to text ≥ 18px or non-essential text (placeholders, decorative labels).

## 3. Spacing, radius, elevation

| Token set | Values |
| :- | :- |
| `space/*` | `1` 4px · `2` 8px · `3` 12px · `4` 16px · `5` 24px · `6` 32px · `7` 48px · `8` 64px · `9` 96px · `10` 144px |
| `radius/*` | `none` 0 (default everywhere) · `s` 2px (inputs, badges) · `pill` 999px (only for the OS/compat badges) |
| `rule/*` | `thin` 1px hairline · `strong` 2px ink rule under the search line |
| Elevation | No shadows. Depth comes from rules, whitespace and `surface/raised`. Only token: `focus/ring` = 2px `accent/indigo`, 3px offset |

## 4. Grid

Not a 12-column default: an **8-column asymmetric grid** that reads like an index page.

| Breakpoint | Columns | Gutter | Margin | Layout |
| :- | :- | :- | :- | :- |
| ≥ 1200px | 8 | 24px | 64px | search line cols 1–7; filters + stats rail cols 1–2 (sticky); results cols 3–8 |
| 768–1199px | 6 | 20px | 40px | search line cols 1–6; filters collapse to a row above results; results cols 1–6 |
| < 768px | 4 | 16px | 16px | single column; filters in a drawer; meets spec R7/AC-3 (360px, no horizontal scroll) |

Baseline: 8px. Vertical rhythm uses `space/*` only.

## 5. Components and states

| Component | States |
| :- | :- |
| **SearchLine**: the display-xl input with the prefix "I need a" | empty (placeholder `___` in `ink/whisper`, blinking indigo caret) · focus · typing · has-query · no-results |
| **ResultEntry**: one index row (spec R3 "card"): kind label, name, plugin + version, description, tags, badges, copy action | default · hover (hairline draws in indigo) · focus-visible · active |
| **KindLabel**: `SKILL` / `AGENT` / `HOOK` / `COMMAND` / `MCP` / `PLUGIN` in `type/label` | default only (text, no icon) |
| **CompatBadge**: "Claude Code ≥ 2.1.110", "Windows", "macOS" | declared · not declared (`ink/secondary` text, dashed `ink/whisper` outline; whisper text would fail AA at badge size, see §2) |
| **RunsCommandsMarker** | default (`signal/caution` text + tool list on hover/focus) |
| **CopyCommand**: mono command + button | default · hover · copied (2s, `signal/positive`) · error (clipboard blocked: select the text instead) |
| **FilterGroup**: checkboxes per kind / plugin / category / tag / OS | unchecked · checked · disabled (zero results) · focus |
| **StatNumeral**: number + label, links to a filtered search | default · hover · zero ("0 skills", with the migration note) |
| **WhatsNewItem**: plugin, version, date, 2 lines of notes | default · rollback (`signal/rollback` label) |
| **InstallBlock**: marketplace add + install commands + auto-installed dependencies | default · copied |
| **DependencyLink**: name + range | satisfied · unsatisfied (`signal/caution` warning) |
| **EmptyState** | no results (echoes the query, "clear filters", "show all") · no components yet |
| **Prose**: rendered README / SKILL.md | headings, lists, tables, code blocks on `surface/sunken` |

## 6. Motion

Things move like a page being typeset: deliberate, never bouncy, and never fade-in-from-bottom.

| Token | Value | Use |
| :- | :- | :- |
| `ease/settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | page-load reveals |
| `ease/snap` | `cubic-bezier(0.87, 0, 0.13, 1)` | state changes (copied, filter toggle) |
| `duration/quick` | 120ms | hover color, focus |
| `duration/base` | 240ms | rule drawing, copied swap |
| `duration/reveal` | 560ms | page-load reveal |
| `stagger/step` | 70ms | between revealed lines/entries |

Signature moments (3 layers, the skill requires at least 2):

1. **Page load:** the search line reveals word by word with a `clip-path` wipe, then the first results follow at `stagger/step`.
2. **Microinteraction:** on hover/focus a ResultEntry's top hairline redraws left-to-right in indigo. The copy button swaps its label to "Copied" with `ease/snap`.
3. **Live results:** while typing, entries that leave collapse their height instead of jumping; new ones wipe in.

`prefers-reduced-motion: reduce` turns every animation into an instant state change (spec R7/AC-7).

## 7. Concept strength checklist (Lindigo)

| # | Check | How this design meets it |
| :- | :- | :- |
| 1 | Has a thesis | "Reads like a well-set technical index; the query is the headline" |
| 2 | Intentional grid | 8-col asymmetric, results offset from a sticky rail |
| 3 | Type does work | The search line is display type; stats are typeset numerals |
| 4 | Committed color | Paper + ink, one indigo hero; signals only for meaning |
| 5 | One exaggerated element | The oversized search line; everything else is quiet |
| 6 | Purposeful motion | Reveal sets hierarchy; rule-draw rewards focus; copy signals state |
| 7 | Dies if made generic | Swap in Inter, a 12-col card grid and a gradient, and it becomes an app store: the index concept is gone |

## 8. CSS custom properties (copy verbatim)

```css
:root {
  /* type */
  --font-display: "Source Serif 4", "Source Serif Pro", Georgia, serif;
  --font-sans: "IBM Plex Sans", "Helvetica Neue", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", monospace;
  --type-display-xl: clamp(2rem, 4vw, 3.25rem);
  --type-display: clamp(1.75rem, 3.5vw, 2.5rem);
  --type-numeral: clamp(1.75rem, 3vw, 2.5rem);
  --type-heading-1: 2rem;
  --type-heading-2: 1.375rem;
  --type-body-lg: 1.125rem;
  --type-body: 1rem;
  --type-label: 0.75rem;
  --type-caption: 0.8125rem;
  --type-mono: 0.875rem;
  --measure: 68ch;

  /* color: light */
  --surface-page: #F5F3EE;
  --surface-raised: #FFFFFF;
  --surface-sunken: #ECE9E2;
  --ink-primary: #17171B;
  --ink-secondary: #54545C;
  --ink-whisper: #8A8892;
  --rule-hairline: #D9D5CB;
  --accent-indigo: #3340B5;
  --accent-indigo-soft: #E4E6F6;
  --signal-caution: #A84E17;
  --signal-positive: #2D7A4D;
  --signal-rollback: #7A3FA0;

  /* space */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px; --space-10: 144px;

  /* shape */
  --radius-none: 0;
  --radius-s: 2px;
  --radius-pill: 999px;
  --rule-thin: 1px;
  --rule-strong: 2px;
  --focus-ring: 2px solid var(--accent-indigo);
  --focus-offset: 3px;

  /* motion */
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-snap: cubic-bezier(0.87, 0, 0.13, 1);
  --duration-quick: 120ms;
  --duration-base: 240ms;
  --duration-reveal: 560ms;
  --stagger-step: 70ms;

  /* type details from §1 (added 2026-11-09, plan T5: values unchanged, now addressable) */
  --leading-display-xl: 1.05;
  --leading-display: 1.08;
  --leading-numeral: 1;
  --leading-heading-1: 1.1;
  --leading-heading-2: 1.2;
  --leading-body: 1.55;
  --leading-label: 1.3;
  --leading-caption: 1.4;
  --leading-mono: 1.5;
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --tracking-display-xl: -0.015em;
  --tracking-label: 0.08em;

  /* grid from §4 (added 2026-11-09, plan T5); ≥ 1200px values, overridden below */
  --grid-columns: 8;
  --grid-gutter: 24px;
  --grid-margin: 64px;
}

@media (max-width: 1199px) {
  :root {
    --grid-columns: 6;
    --grid-gutter: 20px;
    --grid-margin: 40px;
  }
}

@media (max-width: 767px) {
  :root {
    --grid-columns: 4;
    --grid-gutter: 16px;
    --grid-margin: 16px;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-page: #111115;
    --surface-raised: #1A1A20;
    --surface-sunken: #0B0B0E;
    --ink-primary: #EDEBE6;
    --ink-secondary: #A9A7B1;
    --ink-whisper: #6E6C77;
    --rule-hairline: #2B2A32;
    --accent-indigo: #8F9AFF;
    --accent-indigo-soft: #22254A;
    --signal-caution: #E38B57;
    --signal-positive: #6CC594;
    --signal-rollback: #C79BEB;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-quick: 0ms;
    --duration-base: 0ms;
    --duration-reveal: 0ms;
    --stagger-step: 0ms;
  }
}
```
