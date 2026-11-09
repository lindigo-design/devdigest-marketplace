// Atom feed of plugin releases (spec CAT-01 R9/AC-1).
import { buildAtom } from "../../lib/feeds.mjs";
import { config, getCatalog } from "../data/site.mjs";

export function GET() {
  return new Response(buildAtom(getCatalog(), config), { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
}
