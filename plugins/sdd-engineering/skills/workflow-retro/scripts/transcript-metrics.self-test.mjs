#!/usr/bin/env node
// Self-test for transcript-metrics.mjs (run by CI with the hook self-tests). Builds a tiny fake session in a temp
// directory and checks the numbers, including usage counted once per message.id.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { measure, sessionMetrics } from "./transcript-metrics.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "transcript-metrics.mjs");
const dir = mkdtempSync(join(tmpdir(), "retro-"));
const line = (o) => JSON.stringify(o);
const usage = (i, o, r, c) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: r, cache_creation_input_tokens: c, server_tool_use: { web_search_requests: 0, web_fetch_requests: 1 } });
const assistant = (id, ts, content, u = usage(10, 20, 300, 40), model = "model-a") =>
  line({ type: "assistant", timestamp: ts, message: { id, model, content, usage: u } });

try {
  const session = join(dir, "s1.jsonl");
  writeFileSync(session, [
    line({ type: "user", timestamp: "2026-11-11T10:00:00Z", message: { content: "SECRET-PROMPT-TEXT" } }),
    // one response written as two lines (text + tool_use) with the same usage: counted once
    assistant("m1", "2026-11-11T10:00:01Z", [{ type: "text", text: "SECRET-ANSWER" }]),
    assistant("m1", "2026-11-11T10:00:01Z", [{ type: "tool_use", id: "tu1", name: "Agent", input: { subagent_type: "x:planner" } }]),
    assistant("m2", "2026-11-11T10:01:40Z", [{ type: "tool_use", id: "tu2", name: "Agent", input: { subagent_type: "x:verifier" } }]),
    "{partly written",
  ].join("\n"));
  const sub = join(dir, "s1", "subagents");
  mkdirSync(sub, { recursive: true });
  for (const [id, type, start, end] of [["aaaaaaaa1111", "x:planner", "10:00:05", "10:01:05"], ["bbbbbbbb2222", "x:verifier", "10:01:45", "10:02:15"]]) {
    writeFileSync(join(sub, `agent-${id}.meta.json`), line({ agentType: type, description: "d", toolUseId: "tu" }));
    writeFileSync(join(sub, `agent-${id}.jsonl`), [
      assistant(`${id}-1`, `2026-11-11T${start}Z`, [{ type: "tool_use", id: "r", name: "Read", input: { file_path: "docs/arch.md" } }]),
      assistant(`${id}-2`, `2026-11-11T${end}Z`, [{ type: "tool_use", id: "g", name: "Grep", input: { pattern: "x", path: "src" } }]),
    ].join("\n"));
  }
  // an interrupted agent: no usage at all
  writeFileSync(join(sub, "agent-cccccccc3333.jsonl"), line({ type: "user", timestamp: "2026-11-11T10:02:00Z", message: { content: "go" } }));

  const one = measure([session]);
  assert.equal(one.responses, 2, "usage once per message.id");
  assert.deepEqual(one.tokens, { in: 20, out: 40, cacheRead: 600, cacheCreation: 80 });
  assert.equal(one.hitPercent, 86); // 600 / (600 + 80 + 20)
  assert.equal(one.spanSeconds, 100);
  assert.deepEqual(one.agentCalls.map((a) => a.subagentType), ["x:planner", "x:verifier"]);
  assert.deepEqual(one.web, { search: 0, fetch: 2 });

  const s = sessionMetrics([session], { "model-a": { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 } });
  assert.equal(s.agents.length, 3);
  assert.equal(s.totals.interrupted, 1);
  assert.deepEqual(s.agents.map((a) => a.agent), ["aaaaaaaa", "bbbbbbbb", "cccccccc"]);
  assert.equal(s.totals.parallelism, 0.9); // (60 + 30) / 100
  assert.deepEqual(s.totals.criticalPath, { agent: "aaaaaaaa", agentType: "x:planner", percentOfWall: 60 });
  assert.deepEqual(s.duplications.map((d) => d.file), ["docs/arch.md", "src"]);
  assert.equal(s.agents[0].costUsd, 0); // 0.00078 rounds to 0.00
  assert.equal(s.session.costUsd, 0);

  const out = execFileSync(process.execPath, [SCRIPT, session], { encoding: "utf8" });
  assert.ok(!/SECRET/.test(out), "never prints transcript text");
  assert.equal(JSON.parse(out).totals.agents, 3);
  const priced = JSON.parse(execFileSync(process.execPath, [SCRIPT, session, "--prices", '{"model-a":{"input":1000,"output":1000,"cacheRead":100,"cacheCreation":1000}}'], { encoding: "utf8" }));
  assert.equal(priced.session.costUsd, 0.2); // (20 + 40 + 80) × 1000 + 600 × 100 = 200000 / 1e6
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, join(dir, "missing.jsonl")], { stdio: "pipe" }), (e) => e.status === 1);
  console.log("transcript-metrics self-test: ok");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
