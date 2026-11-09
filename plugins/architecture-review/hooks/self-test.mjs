#!/usr/bin/env node
// Self-test for bash-guard.mjs.
//   node hooks/self-test.mjs        (from the plugin dir, the repo root or anywhere)
// Builds a throwaway fixture repository in the OS temp dir (its name has spaces on purpose), spawns the
// guard with fake agent names and checks the exit code of every case.
// Exit 0: "bash-guard self-test: <n> cases passed", exit 1: a summary + one line per failure.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bash-guard.mjs');
const ALLOW = 0;
const BLOCK = 2;

// ---------- fixture repo ----------
const ROOT = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'bash guard fixture ')));
const mk = (rel, file) => {
  const p = path.join(ROOT, ...rel.split('/'));
  if (file) {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, file);
  } else mkdirSync(p, { recursive: true });
};
mk('.git');
mk('app/package.json', '{}\n');
mk('app/src/lib');
mk('app/test');
mk('app/node_modules');
mk('lib/package.json', '{}\n');
mk('lib/src');
mk('docs');
mk('vendor/other/.git'); // a nested repository
mk('vendor/other/package.json', '{}\n');

// ---------- cases ----------
const AGENTS = { review: 'test-plugin:reader', other: 'test-plugin:checker' };
const MAP = [`${AGENTS.review}=review`, `${AGENTS.other}=review`];
const B = (command, agent, extra = {}) =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: ROOT, ...(agent ? { agent_type: agent } : {}), ...extra });

const cases = [];
const add = (profile, commands, expected) => {
  for (const c of commands) cases.push({ label: `${profile}: ${c}`, args: MAP, input: B(c, AGENTS[profile]), expected, profile });
};
const PROFILES = ['review'];
const APP_ABS = path.join(ROOT, 'app'); // absolute, OS-native separators

// every profile: cd inside the repo + git status|diff|log|show with the flag allowlist
for (const profile of PROFILES) {
  add(profile, [
    'git diff --name-status main...HEAD',
    'git diff --name-status origin/main',
    'git diff -U0 origin/main -- app/src',
    'git diff --cached --stat',
    'git status --porcelain 2>&1',
    'git status --short 2>/dev/null',
    'git --no-pager log --oneline -5',
    'git log --oneline -n 3 -- app/src/app.ts',
    'git log -1 --oneline origin/main || git log -1 --oneline main',
    'git log --follow -p -- app/src/lib/urls.ts',
    'git show 0e4375c:app/src/usage.ts',
    'git show --stat HEAD',
    'git log --oneline 9eb3e14..HEAD -- app/src/app.ts docs/README.md',
    "git log --oneline -- 'app/src/routes/[id]/page.tsx'",
    'cd app && git log --oneline -3',
    `cd "${APP_ABS}" && git status --short`,
    'cd app/src && cd ../.. && git status',
    'cd vendor && git status', // the parent of a nested repo is still this repo
  ], ALLOW);
}

// every profile: everything else
const EVERYWHERE_BLOCKED = [
  // file-reading / text commands (use Read/Grep/Glob)
  'cat README.md', 'cat .env', 'cat .env.example', 'head -5 README.md', 'tail -n 20 app/src/app.ts',
  'less README.md', 'grep -n x README.md', 'rg token', 'sed -n 1,5p README.md', 'awk 1 README.md',
  'sort README.md', 'wc -l README.md', 'find app/src -name x', 'ls docs', 'echo hi', 'pwd',
  'git diff --stat | head -5',
  // globs / braces / expansion
  'cat app/.e*', 'cat app/.[e]nv', 'cat app/.{e,x}nv', 'cat app/.e$X\\nv', 'cat "app/.e${X}nv"', 'cat $HOME/x',
  // nested repositories, node_modules, .git
  'cd vendor/other && git status',
  'cd vendor/other/.git && git status',
  'git diff vendor/other/package.json README.md',
  'git log -- vendor/other',
  'cd app/node_modules',
  'cd .git',
  'git diff --no-index vendor/other/.git/config README.md',
  'git diff --no-ind a b',
  'git -C vendor/other log',
  // $'...' / $"..." quoting, implicit --no-index via paths outside the repo
  "git diff $'--no-index' app/.env README.md",
  'git diff $"--output=x" main',
  'cd .. && git diff x y',
  'git diff ../outside.txt README.md',
  'git diff app/.env README.md',
  'git show HEAD:../x',
  // tilde expansion, Windows 8.3 short names
  'git diff ~root/x README.md', 'git diff ~/x README.md', 'cd ~someone', 'cd ~+', 'cd ~-',
  'git log -- a=~/x', 'cd vendor/OTHER~1', 'git diff app/ENV~1 README.md', 'cd GIT~1',
  // git: subcommands / flags outside the allowlist
  'git diff --output=x.patch', 'git diff --out=x.patch', 'git log -p --output x.patch', 'git diff --ext-diff',
  'git diff --textconv', 'git diff -O.env', 'git diff --orderfile=.env', 'git log --format=%H', 'git log -n x',
  'git -C app log', 'git -c core.pager=sh log', 'git --git-dir=vendor/other/.git log',
  'git rev-parse --verify origin/main', 'git merge-base origin/main HEAD', 'git branch --show-current',
  'git blame README.md', 'git grep -n token', 'git ls-files', 'git checkout main', 'git stash', 'git add -A',
  'git commit -m x', 'git push', 'git remote -v', 'git config --list', 'git constructor', 'git __proto__',
  // cd outside the repo
  'cd ..', 'cd /', 'cd ~', 'cd -', 'cd', 'cd app lib',
  // shell syntax
  'git log > a.txt', 'git log >> a.txt', 'git log &> a.txt', 'git log 1>a.txt', 'git log $(pwd)',
  'git log `pwd`', 'git log "$(id)"', 'git log $HOME', 'git diff -- app/*.ts', 'sleep 1 &',
  'FOO=1 git status', 'git log < /etc/passwd', 'diff <(ls a) <(ls b)', '(cd app && git log)',
  'git log "unterminated', 'git status; touch x.txt', 'git status && touch x.txt',
  // other programs
  'touch x.txt', 'rm -rf x', 'node -e "1"', 'node scripts/x.mjs', 'npx vitest run', 'npx tsc --noEmit',
  'pnpm test', 'npm test', 'npm run lint', 'yarn test', 'bun run test',
];
for (const profile of PROFILES) add(profile, EVERYWHERE_BLOCKED, BLOCK);

// review: no tests, type checks or package scripts, not even through node_modules
add('review', [
  'cd app && node node_modules/vitest/vitest.mjs run',
  'cd app && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json',
  'cd app && node node_modules/eslint/bin/eslint.js .',
], BLOCK);

// agent selection and fail-closed behaviour
const special = (label, args, input, expected, mustSay) => cases.push({ label, args, input, expected, mustSay });
special('no agent_type (main session) -> allow', MAP, B('touch x.txt'), ALLOW);
special('empty agent_type -> allow', MAP, B('touch x.txt', ''), ALLOW);
special('unmapped agent -> allow', MAP, B('touch x.txt', 'other-plugin:writer'), ALLOW);
special('prefix of a mapped name -> allow', MAP, B('touch x.txt', 'test-plugin'), ALLOW);
special('bare agent name without plugin scope -> allow', MAP, B('touch x.txt', 'reader'), ALLOW);
special('no args, subagent -> allow', [], B('touch x.txt', AGENTS.review), ALLOW);
special('unknown profile for the mapped agent -> block', [`${AGENTS.review}=nope`], B('git status', AGENTS.review), BLOCK, `${AGENTS.review}=nope`);
special('verify profile is gone -> block mapped agent', [`${AGENTS.review}=verify`], B('git status', AGENTS.review), BLOCK, 'verify');
special('unknown profile for another agent -> allow', [`${AGENTS.other}=nope`, `${AGENTS.review}=review`], B('git status', AGENTS.review), ALLOW);
special('malformed arg, subagent -> block', ['review', ...MAP], B('git status', AGENTS.review), BLOCK, '"review"');
special('malformed arg, main session -> allow', ['review'], B('touch x.txt'), ALLOW);
special('malformed JSON -> block', MAP, '{not json', BLOCK, 'unreadable');
special('empty stdin -> block', MAP, '', BLOCK, 'unreadable');
special('JSON null -> block', MAP, 'null', BLOCK, 'unreadable');
special('JSON string -> block', MAP, '"git status"', BLOCK, 'unreadable');
special('mapped agent, no command -> block', MAP, JSON.stringify({ agent_type: AGENTS.review, tool_input: {}, cwd: ROOT }), BLOCK, 'no command');
special('mapped agent, blank command -> block', MAP, B('   ', AGENTS.review), BLOCK, 'no command');
special('mapped agent, cwd outside the repo -> block', MAP, B('git status', AGENTS.review, { cwd: path.dirname(ROOT) }), BLOCK);
special('mapped agent, cwd in a nested repo -> block', MAP, B('git status', AGENTS.review, { cwd: path.join(ROOT, 'vendor', 'other') }), BLOCK);
special('mapped agent, cwd in a subdir -> allow', MAP, B('git status', AGENTS.review, { cwd: path.join(ROOT, 'app', 'src') }), ALLOW);

// ---------- run ----------
const failures = [];
try {
  for (const c of cases) {
    const r = spawnSync(process.execPath, [GUARD, ...c.args], {
      input: c.input,
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
      encoding: 'utf8',
    });
    const err = (r.stderr || '').trim();
    if (r.status !== c.expected) {
      failures.push(`"${c.label}": expected exit ${c.expected}, got ${r.status} ${err.slice(0, 160)}`);
    } else if (r.status === BLOCK && c.profile && !err.includes(`bash-guard ${c.profile} for ${AGENTS[c.profile]}`)) {
      failures.push(`"${c.label}": block message does not name the profile and agent`);
    } else if (r.status === BLOCK && c.mustSay && !err.includes(c.mustSay)) {
      failures.push(`"${c.label}": block message does not contain ${c.mustSay}: ${err.slice(0, 160)}`);
    } else if (r.status === ALLOW && (r.stdout || err)) {
      failures.push(`"${c.label}": allow must be silent, got output ${(r.stdout + err).slice(0, 160)}`);
    }
  }
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`bash-guard self-test: ${failures.length} of ${cases.length} case(s) FAILED`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`bash-guard self-test: ${cases.length} cases passed`);
