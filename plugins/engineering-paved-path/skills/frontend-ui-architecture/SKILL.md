---
name: frontend-ui-architecture
description: >-
  Frontend UI architecture and code organization for React apps, with first-class rules for the
  Next.js App Router (React 19, TanStack Query or a similar server-state library): where a new
  component, hook, helper, constant, type or piece of business logic goes; how to split a component;
  how routes, route-private `_components/`, shared `components/` and `lib/` depend on each other;
  where state lives; where the `'use client'` boundary sits. Use this skill whenever you add or move
  files in the frontend, build a new screen, route or feature, extract code out of a growing
  component, review a PR for structure, or the user asks "where should this go?", "how to structure
  this?", "split this component", "this page is too big", "frontend architecture", "folder
  structure" — even if they don't say "architecture". Organization only: hook anti-patterns,
  performance, framework file conventions and testing technique are out of scope.
---

# Frontend UI architecture

This skill decides **where code lives and which way dependencies point** in the frontend. It does
not cover how to write a hook well, how to make it fast, Next.js file-convention details, or how to
test it. Framework-specific best practices for React, Next.js and testing are out of scope for this
skill.

The one idea behind everything below: **put code as close as possible to where it is used, and
promote it only when a second, unrelated owner needs it.** Code that changes together stays
together, so a feature can be read, changed and deleted in one folder.

## 0. Discover the layout first

The paths below use a **neutral sample layout**: a Next.js app whose UI source root is `src/`, with
routes in `src/app/`. Before applying any rule, map each role to the consuming repository:

| Role | Sample path | How to find it |
|---|---|---|
| UI source root | `src/` (or `apps/web/src/`, `web/`, the package root) | the package with `next.config.*` / `vite.config.*` and the `app/` or `pages/` folder |
| Routes | `src/app/<route>/page.tsx` | App Router segment folders |
| Shared UI | `src/components/<kebab>/` | components imported by several routes |
| Server-state hooks | `src/lib/hooks/<domain>.ts` | files calling `useQuery` / `useMutation` (or SWR, RTK Query) |
| API client | `src/lib/api.ts` | the one module that calls `fetch` / axios against the backend |
| App-wide non-UI | `src/lib/*.ts` | providers, pure modules, contexts |
| Design system | a UI package (for example `@acme/ui`) or `src/components/ui/` | primitives, tokens |
| Shared contracts | a contracts package (for example `@acme/contracts`) re-exported via `src/lib/types.ts` | API types / Zod schemas shared with the backend |
| i18n messages | `messages/<locale>/<namespace>.json` (next-intl) or the project's equivalent | translation catalogs |
| Path alias | `@/…` → UI source root | `tsconfig.json` `paths` |

Use Glob/Grep to find them. Also read the frontend's own conventions file (a `CLAUDE.md`,
`CONTRIBUTING.md`, ADRs, an `INSIGHTS.md` or similar): this skill codifies such conventions and never
overrides them. If a role has no clear home in the repository (for example no shared hooks folder,
no i18n), follow what the codebase already does, and **ask the user** before introducing a new
top-level folder or library. Use the discovered paths in your output, not the sample ones. Without
the App Router (Vite, Remix, Pages Router), the same layers apply with that router's route files in
place of `page.tsx`.

## 1. The layers and the import direction

```
src/app/<route>/page.tsx            routing: params → hooks → compose          (thinnest)
src/app/<route>/_components/<Name>/ screen/feature UI owned by ONE route
src/components/<kebab>/             UI shared by 2+ routes (app-shell, order-status-badge…)
src/lib/hooks/<domain>.ts           server state: every API call = a TanStack Query hook
src/lib/*.ts                        app-wide non-UI: api.ts, providers, pure modules
design system · shared contracts    UI primitives/tokens · API types (often vendored, read-only)
```

Imports go **down this list only**:

- A route may import its own `_components`, `src/components`, `src/lib`, the design system and the
  contracts.
- `src/components` and `src/lib` never import from `src/app/**`. Shared code must not depend on a
  screen, or it stops being shared.
- Never import from a **sibling route's** `_components`. If two routes need the same component,
  promote it to `src/components/` (see §3).
- From another component's folder, import only its `index.ts`. Never import its `helpers.ts`,
  `styles.ts` or private `_components/`. Those are its internals.

## 2. Where does this piece of code go?

Ask these questions in order and stop at the first "yes":

| # | The code… | Goes to |
|---|---|---|
| 1 | calls the server (read or write) | a hook in `src/lib/hooks/<domain>.ts` that calls `api.*`. Never `fetch` in a component. |
| 2 | is a pure function of data (no React, no hooks) | `helpers.ts` of the component that owns it |
| 3 | is a fixed value: threshold, sort order, key map, option list, skeleton count | `constants.ts` of the owner |
| 4 | is user-visible text | the i18n message catalog (for example `messages/en/<namespace>.json` via next-intl). Not `constants.ts`, not literals. |
| 5 | is a color, spacing or other visual token | CSS variables / design-system tokens. Not constants. |
| 6 | is stateful UI logic that is reused, or that clutters the component (3+ hooks working together) | `hooks/use<Name>.ts` next to the component |
| 7 | is a type that mirrors the API | already in the shared contracts (for example via `src/lib/types.ts`). Don't redefine it. |
| 8 | is a local view type (props, view model) | the component file, or `types.ts` in the folder if shared by its siblings |
| 9 | renders JSX | a component (see §4 for when to split) |

"The owner" is the closest component or route that uses the code. Start there, and move the code
only through §3.

## 3. Promotion: when code moves up

Code starts private and moves **one step at a time**, only when a second consumer actually exists.
Don't promote for a hypothetical consumer, because shared code outlives its users and gets harder
to change.

| Consumers | Location |
|---|---|
| one component | inside that component's folder (`helpers.ts`, `constants.ts`, `_components/<Child>/`) |
| several components of one route | the route folder (`app/.../orders/helpers.ts`, `constants.ts`) or the nearest common parent component |
| 2+ routes, UI | `src/components/<kebab-name>/<PascalName>.tsx` (+ add it to the component catalog, such as Storybook or a showcase page, if the project has one) |
| 2+ routes, non-UI | `src/lib/<kebab-name>.ts` |
| would be useful in the design system | stop and ask. The design system is often vendored or owned by another team. |

When you promote, move the tests with the code and update every import. Don't leave a re-export
shim behind.

## 4. Splitting components

Split when a part has **its own reason to change**. Line count is only a hint. Signals:

- It owns state that the rest of the component doesn't need ("push state down").
- It is the body of a `.map()`. A list item becomes `<ItemName>`.
- It is a nested `renderSomething()` function or a large conditional block of JSX.
- The component passes 5–7+ props through, or mixes data loading, interaction and layout.
- The file grows past ~200 lines.

Where the child goes: `<Parent>/_components/<Child>/<Child>.tsx`, with the same folder shape as any
component. Prefer composition (`children`, slot props) over threading props through layers that
don't use them.

**Page / View split.** A `page.tsx` reads route params and search params, calls hooks and composes
`_components`. Filtering, sorting, counting and formatting belong in `helpers.ts`, not in the page
body. When a screen has real UI logic, put it in a `<Name>View` component in `_components/`
(e.g. `OrdersListView`) and keep `page.tsx` a few lines long.

## 5. Component folder shape

```
<Name>/
  <Name>.tsx         component (named export + default)
  index.ts           export { Name, Name as default } from "./Name"   ← the only public entry
  styles.ts          one object `s`, inline styles keyed off CSS variables (or the project's styling convention)
  constants.ts       SCREAMING_SNAKE module constants
  helpers.ts         camelCase pure functions (data in → data out)
  hooks/use<X>.ts    component-private hooks, one per file
  _components/<Child>/   private sub-components, same shape
  <Name>.test.tsx · helpers.test.ts
```

Create only the files you need. An empty `constants.ts` is noise. If the project already has its
own folder shape (for example CSS Modules instead of `styles.ts`), keep it; the rules about the
public entry, helpers and constants still apply.

## 6. Business logic: three layers

Based on Fowler/Qiu, "Modularizing React apps":

1. **Domain rules: pure TypeScript** in `helpers.ts` (or `src/lib/<kebab>.ts` once shared).
   Filtering, sorting, grouping, counting, thresholds and status derivation live here.
   No React imports, so they are trivially unit-tested (`helpers.test.ts`).
2. **Hooks orchestrate.** They fetch (TanStack Query), hold UI state and call domain helpers.
   They don't contain the rules themselves.
3. **Components render.** They receive ready-to-show data and call handlers.

Derive, don't store. Values computable from props, query data or URL params are computed during
render (via a helper), not copied into `useState` or synchronized with `useEffect`.

## 7. Where state lives

Choose the lowest level that works:

1. **Local `useState`** in the component that uses it.
2. **Lifted** to the nearest common parent when siblings need it.
3. **URL search params** when the state should survive reload or be shareable (filters, sort,
   active tab). A list filter such as `?status=` is the reference pattern; if the codebase already
   has one, copy its shape.
4. **Scoped context provider** (`src/lib/*-context.tsx`) for app-wide client state such as the
   active account or theme. Wrap as deep in the tree as possible.

**Server data lives only in the server-state library (TanStack Query).** Never copy query results
into `useState`, context or a store. Read them through the hook and derive. Query keys are
`[<kebab-string>, id]`; reuse the exact string when invalidating.

## 8. Next.js App Router rules

- **Data model: pick one and don't mix.** Find which model the app uses today. The common one for an
  app with a separate backend is "HTTP APIs": the frontend talks to the backend only through `api.ts`
  + hooks, and has no Server Actions, Route Handlers or DB access. Don't introduce them silently:
  mixing data models is the thing the Next.js security guide warns against. If the user wants a
  server layer, read `references/nextjs-app-router.md` first.
- `app/` is for routing. Folders = URL segments, `_components/` = private (non-routable), and
  `(group)` organizes routes or shares a layout without changing the URL.
- **`'use client'` is a module-graph boundary**: everything the file imports ships to the browser.
  For new code, put it on the component that actually needs state, effects or browser APIs, not on
  a wrapper that could stay server-rendered. If existing pages are client components, don't convert
  them as a side effect of an unrelated task.
- Providers live in one module (for example `src/lib/providers.tsx`) and wrap `{children}`.

Details, plus the server-layer rules (DAL, DTO, `server-only`): `references/nextjs-app-router.md`.

## 9. Imports and barrels

- Use the path alias (for example `@/…`) for anything outside the current route subtree, and
  relative paths inside it.
- `index.ts` that re-exports **one** component is the allowed entry point.
- Don't add new **aggregate** barrels (index files re-exporting many modules). They cause import
  cycles and load every module behind them. Existing aggregate barrels that the project deliberately
  keeps (typically the design-system package entry and a `src/lib/hooks/index.ts`) are the
  sanctioned exceptions; import the design system only from its barrel.

## 10. Anti-patterns to flag in review

- `fetch` / `api.*` called directly in a component → hook in `src/lib/hooks`.
- Business rules (filter/sort/count) inline in `page.tsx` or JSX → `helpers.ts`.
- A static array or object defined inside the component body → module-level constant.
- `utils.ts` or `common/` dumping grounds → name modules by what they do (`currency-format.ts`).
- Importing another route's `_components`, or `src/components` importing from `src/app`.
- Copying query data into `useState` or context.
- Promoting to `src/components` or `src/lib` with only one consumer.
- A new aggregate barrel, or a deep import into another component's internals.
- `'use client'` added high in the tree just to make one child interactive.
- User-visible strings in `constants.ts`, or hard-coded colors.

## 11. Scope: what you may change without asking

Architecture decisions are cheap to make and expensive to undo, so keep each change inside the
boundary the user asked for.

- **Missing data means stop and ask.** If the task needs data the frontend doesn't have yet (a new
  hook, endpoint, contract type, or field on a shared type), don't add it silently. The data model
  belongs to the backend and to the shared contracts, so it is the user's call. Describe what is
  missing, offer 2–3 options (e.g. "derive from an existing endpoint", "add `GET …` on the
  backend", "drop that part"), and implement only the part that needs no new data.
- **Existing code that predates these rules** (e.g. filtering inline in an existing list
  `page.tsx`): apply the rules to **code you add or touch**. Leave unrelated files, sibling
  components' internals, prop types and the project's notes files (`INSIGHTS.md` and similar) alone.
  Also don't generalise existing helpers "while you're there". List the deviations as follow-ups and
  offer them as a separate change. A smaller diff is easier to review and keeps behaviour unchanged.

More examples (good/bad side by side, a worked "new feature" walkthrough):
`references/examples.md`.
