// Markdown rendering and sanitizing (spec CAT-01 R5/AC-6).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderMarkdown, resolveRepoPath } from "../../lib/markdown.mjs";

const CTX = { repo: "https://github.com/lindigo-design/devdigest-marketplace", ref: "main", dir: "plugins/sdd-engineering" };
const md = (text, ctx = CTX) => renderMarkdown(text, ctx);

describe("R5/AC-6: nothing executable reaches the page", () => {
  const payloads = {
    "script tag": "<script>alert(1)</script>",
    "script in a paragraph": "Hi <script src=\"https://evil.example/x.js\"></script>",
    "inline event handler": "<img src=\"https://x.example/a.png\" onerror=\"alert(1)\">",
    "event handler on a div": "<div onclick=\"alert(1)\">x</div>",
    "javascript: link (markdown)": "[x](javascript:alert(1))",
    "javascript: link (html)": "<a href=\"javascript:alert(1)\">x</a>",
    "javascript: with entities": "<a href=\"jav&#x09;ascript:alert(1)\">x</a>",
    "data: link": "<a href=\"data:text/html;base64,PHNjcmlwdD4=\">x</a>",
    "data: image": "![x](data:image/svg+xml;base64,PHN2Zz4=)",
    "svg with script": "<svg><script>alert(1)</script></svg>",
    "iframe": "<iframe src=\"https://evil.example\"></iframe>",
    "style attribute": "<p style=\"background:url(javascript:alert(1))\">x</p>",
    "style element": "<style>body{display:none}</style>",
    "form": "<form action=\"https://evil.example\"><input name=q></form>",
    "object/embed": "<object data=\"x.swf\"></object><embed src=\"x.swf\">",
    "meta refresh": "<meta http-equiv=\"refresh\" content=\"0;url=https://evil.example\">",
  };
  for (const [name, payload] of Object.entries(payloads)) {
    test(name, () => {
      const html = md(payload);
      assert.doesNotMatch(html, /<script|<iframe|<style|<form|<object|<embed|<meta|<svg/i);
      assert.doesNotMatch(html, /\son[a-z]+=/i);
      assert.doesNotMatch(html, /\sstyle=/i);
      assert.doesNotMatch(html, /(href|src)="\s*(javascript|data|vbscript):/i);
    });
  }
});

describe("safe content survives", () => {
  test("GFM tables, code, lists, emphasis", () => {
    const html = md("| a | b |\n| - | - |\n| `x` | **y** |\n\n- one\n- two\n\n```bash\nnpm test\n```");
    assert.match(html, /<table>/);
    assert.match(html, /<code>x<\/code>/);
    assert.match(html, /<strong>y<\/strong>/);
    assert.match(html, /<li>one<\/li>/);
    assert.match(html, /<pre><code class="language-bash">npm test\n<\/code><\/pre>/);
  });

  test("safe raw HTML (details) is kept", () => {
    assert.match(md("<details><summary>More</summary>\n\nHidden text.\n\n</details>"), /<details><summary>More<\/summary>/);
  });

  test("headings shift one level so the page title stays the only h1", () => {
    assert.match(md("# Title\n\n## Sub\n\n###### Deep"), /<h2>Title<\/h2>[\s\S]*<h3>Sub<\/h3>[\s\S]*<h6>Deep<\/h6>/);
  });
});

describe("links", () => {
  test("relative links resolve to GitHub at the configured ref", () => {
    assert.match(md("[s](skills/write-spec/SKILL.md)"),
      /href="https:\/\/github\.com\/lindigo-design\/devdigest-marketplace\/blob\/main\/plugins\/sdd-engineering\/skills\/write-spec\/SKILL\.md"/);
    assert.match(md("[c](../../CONTRIBUTING.md#rules)"),
      /href="https:\/\/github\.com\/lindigo-design\/devdigest-marketplace\/blob\/main\/CONTRIBUTING\.md#rules"/);
  });

  test("relative images use raw.githubusercontent.com", () => {
    assert.match(md("![d](docs/flow.png)"),
      /src="https:\/\/raw\.githubusercontent\.com\/lindigo-design\/devdigest-marketplace\/main\/plugins\/sdd-engineering\/docs\/flow\.png"/);
  });

  test("links escaping the repository are dropped", () => {
    assert.doesNotMatch(md("[x](../../../outside.md)"), /href=/);
  });

  test("absolute links get rel=noopener noreferrer; anchors stay", () => {
    assert.match(md("[d](https://example.com)"), /href="https:\/\/example\.com" rel="noopener noreferrer"/);
    assert.match(md("[top](#usage)"), /href="#usage"/);
  });

  test("resolveRepoPath", () => {
    assert.equal(resolveRepoPath("plugins/a", "./b/../c.md"), "plugins/a/c.md");
    assert.equal(resolveRepoPath("", "../x"), null);
  });
});
