import fs from "node:fs";
import path from "node:path";
import { normalizeAttributeCatalog } from "../mcp/lib/attribute-catalog.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const UPSTREAM_ATTRIBUTES_URL = "https://raw.githubusercontent.com/togodx/togodx-config-human/develop/config/attributes.dx-server.json";
const UPSTREAM_DOCS_URL = "https://raw.githubusercontent.com/togodx/togodx-config-human/develop/docs/data-sources.md";
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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/plain"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

const [rawCatalog, dataSourcesMarkdown] = await Promise.all([
  fetchJson(UPSTREAM_ATTRIBUTES_URL),
  fetchText(UPSTREAM_DOCS_URL)
]);

const attributes = normalizeAttributeCatalog(rawCatalog, { dataSourcesMarkdown });

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceUrls: {
    attributes: UPSTREAM_ATTRIBUTES_URL,
    dataSources: UPSTREAM_DOCS_URL
  },
  attributes
}, null, 2)}\n`);

console.log(`Wrote ${attributes.length} attributes to ${OUTPUT_PATH}`);
