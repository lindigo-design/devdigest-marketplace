// Atom and JSON Feed 1.1 of plugin releases (spec CAT-01 R9/AC-1–5; §7 corrected items, rollback).
// Built from the same sorted release list as "What's new" (R8/AC-3), at most 50 items.
import { absUrl, repoSlug } from "./config.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { t } from "../src/i18n/t.mjs";

export const MAX_ITEMS = 50;

/**
 * Item ids stay `<plugin>--v<version>` (R9/AC-2). Atom needs an IRI, so its id wraps that in a tag: URI
 * whose authority is the GitHub repository, not the site host: moving the site to another domain
 * (R6/AC-5) must not make readers see every item again.
 */
export const itemId = (r) => `${r.plugin}--v${r.version}`;
export const atomId = (config, suffix) => `tag:github.com,2026:${repoSlug(config)}/${suffix}`;

const xml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    // Characters that are not allowed in XML 1.0 at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");

/** Feed items, shared by both formats. */
export function feedItems(catalog, config) {
  const plugins = new Map(catalog.plugins.map((p) => [p.name, p]));
  return catalog.releases.slice(0, MAX_ITEMS).map((r) => {
    const p = plugins.get(r.plugin);
    return {
      id: itemId(r),
      title: `${r.plugin} ${r.version}`,
      url: absUrl(config, `${r.plugin}/`),
      published: `${r.date}T00:00:00Z`,
      updated: r.updated,
      html: renderMarkdown(r.notes, { repo: config.repo, ref: config.ref, dir: p?.source ?? "" }),
      summary: r.excerpt.join(" "),
      rollback: r.rollback,
    };
  });
}

/** Newest `updated` among items; `now` for an empty feed. */
const feedUpdated = (items, now) => items.reduce((max, i) => (i.updated > max ? i.updated : max), items[0]?.updated ?? now.toISOString().replace(/\.\d+Z$/, "Z"));

/** Atom 1.0 (RFC 4287). */
export function buildAtom(catalog, config, { now = new Date() } = {}) {
  const items = feedItems(catalog, config);
  const mk = catalog.marketplace;
  const self = absUrl(config, "feed.xml");
  const entries = items.map((i) => [
    "  <entry>",
    `    <id>${xml(atomId(config, i.id))}</id>`,
    `    <title>${xml(i.title)}</title>`,
    `    <link rel="alternate" type="text/html" href="${xml(i.url)}"/>`,
    `    <published>${i.published}</published>`,
    `    <updated>${i.updated}</updated>`,
    i.rollback ? `    <category term="rollback" label="${xml(t("release.rollback"))}"/>` : null,
    `    <summary>${xml(i.summary)}</summary>`,
    `    <content type="html">${xml(i.html)}</content>`,
    "  </entry>",
  ].filter(Boolean).join("\n"));
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
    `  <id>${xml(atomId(config, "releases"))}</id>`,
    `  <title>${xml(t("feed.title", { marketplace: mk.name }))}</title>`,
    mk.description ? `  <subtitle>${xml(mk.description)}</subtitle>` : null,
    `  <updated>${feedUpdated(items, now)}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(absUrl(config, ""))}"/>`,
    `  <author><name>${xml(mk.owner?.name ?? mk.name)}</name>${mk.owner?.url ? `<uri>${xml(mk.owner.url)}</uri>` : ""}</author>`,
    `  <generator>${xml(t("feed.generator", { marketplace: mk.name }))}</generator>`,
    ...entries,
    "</feed>",
    "",
  ].filter((l) => l !== null).join("\n");
}

/** JSON Feed 1.1 (https://jsonfeed.org/version/1.1). */
export function buildJsonFeed(catalog, config) {
  const mk = catalog.marketplace;
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: t("feed.title", { marketplace: mk.name }),
    home_page_url: absUrl(config, ""),
    feed_url: absUrl(config, "feed.json"),
    description: mk.description ?? undefined,
    language: "en",
    authors: [{ name: mk.owner?.name ?? mk.name, ...(mk.owner?.url ? { url: mk.owner.url } : {}) }],
    items: feedItems(catalog, config).map((i) => ({
      id: i.id,
      url: i.url,
      title: i.title,
      summary: i.summary,
      content_html: i.html,
      date_published: i.published,
      date_modified: i.updated,
      tags: i.rollback ? ["rollback"] : [],
    })),
  };
}
