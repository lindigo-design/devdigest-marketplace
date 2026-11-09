# Automated layer check (dependency-cruiser)

Read this when the consuming repository has no import-rule checker yet and the user agrees to add
one, or when you extend an existing one. Adding tooling is a separate change; don't add it as a side
effect of a feature.

## Sample rule set

A starting point for [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), written for
the sample layout (`src/modules/<name>/`, `src/adapters/`, `src/db/`, composition root
`src/bootstrap/container.ts`, shared contracts vendored at `src/vendor/contracts/`). Replace every path
pattern with the paths you discovered (see `SKILL.md` § 0) and the package list with the project's
framework, ORM and SDK packages.

```js
// .dependency-cruiser.cjs (in the backend package root)
const DOMAIN = '^src/modules/[^/]+/(domain\\.ts$|domain/|ports\\.ts$)';
const ROUTES = '^src/modules/[^/]+/routes\\.ts$';
const INFRA_IN_MODULE = '^src/modules/[^/]+/(repository\\.ts$|repository/|.+\\.repo\\.ts$)';
const ORM = '^node_modules/(drizzle-orm|postgres)(/|$)';
const DB = '^src/db/';
const ADAPTERS = '^src/adapters/';
const COMPOSITION_ROOT = '^src/bootstrap/container\\.ts$';
const APPLICATION = { path: '^src/modules/', pathNot: [ROUTES, INFRA_IN_MODULE, DOMAIN] };

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'Core (domain.ts / ports.ts) must not depend on frameworks, DB, adapters, platform or the container.',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: [DB, ADAPTERS, '^src/platform/', '^src/bootstrap/', '^src/modules/[^/]+/(routes|service|repository)\\.ts$',
        '^node_modules/(fastify|@fastify|drizzle-orm|postgres|zod|openai|@anthropic-ai|p-queue)(/|$)'] },
    },
    {
      name: 'domain-shared-type-only',
      comment: 'Core may use the shared contracts only via `import type` (no Zod runtime in the core).',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: '^src/vendor/contracts/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'routes-no-data-access',
      comment: 'Presentation must call a service; never the ORM, db/schema or a repository directly.',
      severity: 'error',
      from: { path: ROUTES },
      to: { path: [ORM, DB, INFRA_IN_MODULE] },
    },
    {
      name: 'routes-no-adapters',
      comment: 'Presentation must not import concrete adapters; the service gets ports via the composition root.',
      severity: 'error',
      from: { path: ROUTES },
      to: { path: ADAPTERS },
    },
    {
      name: 'application-no-orm',
      comment: 'Application code must not use the ORM or db schema; go through a repository port.',
      severity: 'error',
      from: APPLICATION,
      to: { path: [ORM, '^src/db/(schema|client)'] },
    },
    {
      name: 'application-no-db-rows',
      comment: 'Application code works with domain types, not persistence rows. Map in the repository.',
      severity: 'warn',
      from: APPLICATION,
      to: { path: '^src/db/rows' },
    },
    {
      name: 'application-no-adapters',
      comment: 'Application code depends on ports, never on adapter implementations.',
      severity: 'error',
      // routes → routes-no-adapters, domain → domain-is-pure: one violation = one rule.
      from: APPLICATION,
      to: { path: ADAPTERS },
    },
    {
      name: 'no-cross-module-imports',
      comment: 'A module must not import another module folder; cross-module data goes through the composition root. _shared/ is allowed.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', pathNot: '^src/modules/index\\.ts$' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
    },
    {
      name: 'adapters-are-outer-ring',
      comment: 'Adapters implement ports; they must not depend on modules or the composition root.',
      severity: 'error',
      from: { path: ADAPTERS },
      to: { path: ['^src/modules/', COMPOSITION_ROOT] },
    },
    {
      name: 'no-circular',
      comment: 'Cycles break the inward-only rule. Cycles through the composition root (imported as a type) are excluded.',
      severity: 'warn',
      from: {},
      to: { circular: true, viaNot: COMPOSITION_ROOT },
    },
  ],
  options: {
    // doNotFollow, NOT exclude: exclude removes a module AND every edge to it, which silently
    // disables rules that target it (for example domain-shared-type-only).
    doNotFollow: { path: ['node_modules', '^src/vendor/'] },
    exclude: { path: ['^src/db/migrations/'] },
    // Keeps pnpm symlink paths (node_modules/<pkg>/… instead of node_modules/.pnpm/<pkg>@<ver>/…).
    preserveSymlinks: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
```

## Baseline for legacy violations

On an existing codebase the first run will report violations. Don't fix them all in one change, and
don't use dependency-cruiser's own `--ignore-known`: it matches resolved paths, which under pnpm
contain the package version and entry file, so a dependency bump turns known violations into "new"
ones. Instead, a small check script (written in the consuming repository, for example
`scripts/check-architecture.mjs`) should:

1. Run dependency-cruiser with JSON output and collect error-level violations.
2. Reduce each to a stable key `rule|from|to`, with an npm target shortened to
   `node_modules/<package>`.
3. Compare against a committed baseline (for example `architecture-baseline.json`) and fail only on
   keys that are not in it.
4. Offer an `--update` mode that rewrites the baseline, used **only after fixing** violations.
5. Offer a `--self-test` mode that cruises one probe file per rule and fails if a rule has no probe,
   if a rule doesn't fire, or if one probe triggers two rules.

In CI, also fail a PR whose baseline contains a key the base branch's baseline doesn't have, so the
baseline can only shrink.

## Alternatives

- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) or
  `import/no-restricted-paths` express the same element-to-element rules inside ESLint.
- In a monorepo, package boundaries (separate `package.json` per ring) make some rules structural.
