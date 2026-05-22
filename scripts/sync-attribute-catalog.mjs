import fs from "node:fs";
import path from "node:path";
import { extractCatalogMetadata, normalizeAttributeCatalog } from "../mcp/lib/attribute-catalog.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const UPSTREAM_ATTRIBUTES_URL = "https://raw.githubusercontent.com/togodx/togodx-config-human/develop/config/attributes.dx-server.json";
const OUTPUT_PATH = path.join(ROOT, "config", "togodx-human.attributes.json");

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

const rawCatalog = await fetchJson(UPSTREAM_ATTRIBUTES_URL);
const catalog = extractCatalogMetadata(rawCatalog);
const attributes = normalizeAttributeCatalog(rawCatalog);

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceUrls: {
    attributes: UPSTREAM_ATTRIBUTES_URL
  },
  catalog,
  attributes
}, null, 2)}\n`);

console.log(`Wrote ${attributes.length} attributes, ${catalog.categories.length} categories, and ${catalog.datasets.length} datasets to ${OUTPUT_PATH}`);
