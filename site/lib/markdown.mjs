// Markdown → sanitized HTML for READMEs, SKILL.md and agent bodies, CHANGELOG notes (spec CAT-01 R5/AC-6).
// Raw HTML in markdown is parsed and then sanitized with GitHub's schema, tightened: no <script>, no
// inline event handlers or style, only http(s)/mailto or relative URLs. Relative links point to GitHub.
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const SAFE_HREF = ["http", "https", "mailto"];

/** GitHub schema with URL protocols narrowed; no `style` or event attributes are allowed by it at all. */
export const SCHEMA = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: SAFE_HREF, src: ["http", "https"], cite: ["http", "https"] },
};

const isRelative = (u) => !/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith("//") && !u.startsWith("#");

/** Resolves "../x/y.md" against a repo-relative directory; null if it escapes the repository. */
export function resolveRepoPath(dir, target) {
  const parts = dir ? dir.split("/") : [];
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join("/");
}

/** Rewrites relative links to GitHub blob URLs and relative images to raw file URLs. */
function rehypeGithubLinks({ repo, ref, dir }) {
  const slug = repo.replace(/^https:\/\/github\.com\//, "");
  return (tree) => {
    visit(tree, "element", (node) => {
      const attr = node.tagName === "a" ? "href" : node.tagName === "img" ? "src" : null;
      const value = attr && node.properties?.[attr];
      if (typeof value !== "string" || !isRelative(value)) return;
      const [path, hash = ""] = value.split("#");
      const resolved = path ? resolveRepoPath(dir, decodeURI(path.split("?")[0])) : null;
      if (resolved === null) { delete node.properties[attr]; return; }
      const enc = resolved.split("/").map(encodeURIComponent).join("/");
      node.properties[attr] = attr === "src"
        ? `https://raw.githubusercontent.com/${slug}/${encodeURIComponent(ref)}/${enc}`
        : `${repo}/blob/${encodeURIComponent(ref)}/${enc}${hash ? `#${hash}` : ""}`;
    });
  };
}

/** h1 → h2 … h5 → h6: the page title is the only h1 (R7/AC-1 heading order). */
function rehypeShiftHeadings() {
  return (tree) => {
    visit(tree, "element", (node) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (m) node.tagName = `h${Math.min(6, +m[1] + 1)}`;
    });
  };
}

/** External links open in place but carry no referrer or opener. */
function rehypeExternalRel() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "a" && /^https?:/.test(node.properties?.href ?? "")) node.properties.rel = ["noopener", "noreferrer"];
    });
  };
}

/**
 * @param {string} markdown
 * @param {{ repo: string, ref: string, dir?: string }} ctx dir: repo-relative directory of the source file
 * @returns {string} sanitized HTML
 */
export function renderMarkdown(markdown, { repo, ref, dir = "" }) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeGithubLinks, { repo, ref, dir })
      .use(rehypeShiftHeadings)
      .use(rehypeSanitize, SCHEMA)
      .use(rehypeExternalRel)
      .use(rehypeStringify)
      .processSync(markdown ?? ""),
  );
}
