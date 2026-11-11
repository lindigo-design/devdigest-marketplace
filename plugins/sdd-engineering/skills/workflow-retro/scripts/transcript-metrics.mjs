#!/usr/bin/env node
// Metrics for workflow-retro, read from Claude Code session transcripts (JSONL). Read-only; prints JSON.
// It never prints transcript text: only counts, model names, agent types, timestamps and file paths.
//
//   node "${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs" --latest
//   node "${CLAUDE_SKILL_DIR}/scripts/transcript-metrics.mjs" <session.jsonl> [<more.jsonl> ...] [--prices '<json>' | <file>]
//
// <session.jsonl> is a main-session transcript; its subagents are read from <session-id>/subagents/agent-*.jsonl
// (+ agent-*.meta.json). A session continued after context compaction may span several files: pass all of them.
// --latest picks the newest transcript under $CLAUDE_CONFIG_DIR/projects (default ~/.claude/projects).
// --prices: {"<model>": {"input": n, "output": n, "cacheRead": n, "cacheCreation": n}} in USD per million tokens;
// without it, cost fields are null (the skill fetches prices; this script never guesses them).
// Node >= 22, no dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);

function* jsonl(file) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch { /* a partly written last line */ }
  }
}

/** Token, tool and time metrics of one transcript file (or several of one agent). Usage counted once per message.id. */
export function measure(files, prices = null) {
  const seen = new Set();
  const t = { in: 0, out: 0, cacheRead: 0, cacheCreation: 0 };
  const byModel = {};
  const tools = {};
  const agentCalls = [];
  const filesRead = new Set();
  let web = { search: 0, fetch: 0 };
  let first = null, last = null, responses = 0;
  for (const file of files) {
    for (const e of jsonl(file)) {
      if (e.timestamp) {
        const ts = Date.parse(e.timestamp);
        if (!Number.isNaN(ts)) { first = first === null ? ts : Math.min(first, ts); last = last === null ? ts : Math.max(last, ts); }
      }
      if (e.type !== "assistant" || !e.message) continue;
      const m = e.message;
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c?.type !== "tool_use") continue;
        tools[c.name] = (tools[c.name] ?? 0) + 1;
        if (c.name === "Agent" || c.name === "Task") {
          agentCalls.push({ toolUseId: c.id, subagentType: c.input?.subagent_type ?? null });
        }
        if (READ_TOOLS.has(c.name)) {
          const p = c.input?.file_path ?? c.input?.path ?? c.input?.pattern;
          if (typeof p === "string") filesRead.add(p);
        }
      }
      if (!m.usage || !m.id || seen.has(m.id)) continue; // one response = several lines with the same usage
      seen.add(m.id);
      responses++;
      const u = m.usage;
      const row = (byModel[m.model ?? "unknown"] ??= { in: 0, out: 0, cacheRead: 0, cacheCreation: 0 });
      for (const [k, v] of [["in", u.input_tokens], ["out", u.output_tokens], ["cacheRead", u.cache_read_input_tokens], ["cacheCreation", u.cache_creation_input_tokens]]) {
        t[k] += v ?? 0;
        row[k] += v ?? 0;
      }
      web = { search: web.search + (u.server_tool_use?.web_search_requests ?? 0), fetch: web.fetch + (u.server_tool_use?.web_fetch_requests ?? 0) };
    }
  }
  const denom = t.cacheRead + t.cacheCreation + t.in;
  let cost = null, savings = null;
  if (prices && responses) {
    cost = 0; savings = 0;
    for (const [model, r] of Object.entries(byModel)) {
      const p = prices[model];
      if (!p) { cost = null; savings = null; break; }
      cost += (r.in * p.input + r.out * p.output + r.cacheRead * p.cacheRead + r.cacheCreation * p.cacheCreation) / 1e6;
      savings += (r.cacheRead * (p.input - p.cacheRead)) / 1e6;
    }
  }
  return {
    interrupted: responses === 0,
    responses,
    tokens: t,
    byModel,
    hitPercent: denom ? Math.round((t.cacheRead / denom) * 100) : null,
    tools,
    toolCalls: Object.values(tools).reduce((a, b) => a + b, 0),
    agentCalls,
    filesRead: [...filesRead].sort(),
    web,
    start: first === null ? null : new Date(first).toISOString(),
    end: last === null ? null : new Date(last).toISOString(),
    spanSeconds: first === null ? null : Math.round((last - first) / 1000),
    costUsd: cost === null ? null : Math.round(cost * 100) / 100,
    savingsUsd: savings === null ? null : Math.round(savings * 100) / 100,
  };
}

/** The main session and all its subagents. */
export function sessionMetrics(sessionFiles, prices = null) {
  const main = measure(sessionFiles, prices);
  const agents = [];
  for (const file of sessionFiles) {
    const dir = join(dirname(file), basename(file, ".jsonl"), "subagents");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => /^agent-.+\.jsonl$/.test(n)).sort()) {
      const id = name.slice("agent-".length, -".jsonl".length);
      const metaFile = join(dir, `agent-${id}.meta.json`);
      let meta = {};
      try { meta = JSON.parse(readFileSync(metaFile, "utf8")); } catch { /* no meta: unknown type */ }
      const m = measure([join(dir, name)], prices);
      agents.push({ agent: id.slice(0, 8), agentType: meta.agentType ?? null, description: meta.description ?? null, toolUseId: meta.toolUseId ?? null, ...m });
    }
  }
  const spans = agents.map((a) => a.spanSeconds ?? 0);
  const wall = main.spanSeconds;
  const shared = {};
  for (const a of agents) for (const f of a.filesRead) (shared[f] ??= []).push(a.agent);
  const critical = agents.filter((a) => a.spanSeconds !== null).sort((a, b) => b.spanSeconds - a.spanSeconds)[0] ?? null;
  return {
    session: { files: sessionFiles.map((f) => basename(f)), ...main },
    agents,
    totals: {
      agents: agents.length,
      interrupted: agents.filter((a) => a.interrupted).length,
      wallSeconds: wall,
      parallelism: wall ? Math.round((spans.reduce((a, b) => a + b, 0) / wall) * 100) / 100 : null,
      criticalPath: critical && wall ? { agent: critical.agent, agentType: critical.agentType, percentOfWall: Math.round((critical.spanSeconds / wall) * 100) } : null,
    },
    duplications: Object.entries(shared).filter(([, ids]) => ids.length > 1).map(([file, ids]) => ({ file, agents: ids })),
  };
}

export function latestTranscript(env = process.env) {
  const root = join(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
  if (!existsSync(root)) return null;
  let best = null;
  for (const project of readdirSync(root)) {
    const dir = join(root, project);
    if (!statSync(dir).isDirectory()) continue;
    for (const n of readdirSync(dir)) {
      if (!/^[0-9a-f-]+\.jsonl$/.test(n)) continue;
      const f = join(dir, n);
      const mtime = statSync(f).mtimeMs;
      if (!best || mtime > best.mtime) best = { file: f, mtime };
    }
  }
  return best?.file ?? null;
}

function main(argv) {
  const i = argv.indexOf("--prices");
  const raw = i > -1 ? argv[i + 1] ?? "" : null;
  const prices = raw === null ? null : JSON.parse(raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8"));
  const rest = argv.filter((a, k) => a !== "--prices" && (i < 0 || k !== i + 1));
  let files = rest.filter((a) => !a.startsWith("--"));
  if (rest.includes("--latest")) {
    const f = latestTranscript();
    if (!f) { console.error("transcript not found"); process.exitCode = 1; return; }
    files = [f];
  }
  if (!files.length) {
    console.error('usage: transcript-metrics.mjs --latest | <session.jsonl> [...] [--prices <prices.json>]');
    process.exitCode = 2;
    return;
  }
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) { console.error(`transcript not found: ${missing.join(", ")}`); process.exitCode = 1; return; }
  console.log(JSON.stringify(sessionMetrics(files, prices), null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
