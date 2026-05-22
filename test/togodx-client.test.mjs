import test from "node:test";
import assert from "node:assert/strict";
import { TogoDxClient } from "../mcp/lib/togodx-client.mjs";

test("aggregate sends dataset and filters", async () => {
  const calls = [];
  const client = new TogoDxClient({
    baseUrl: "https://example.org/api",
    dataset: "human",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({ queries: ["A", "B"] })
      };
    }
  });

  const response = await client.aggregate([
    {
      attributeId: "gene_genes_ncbigene",
      nodes: ["1017"]
    }
  ]);

  assert.deepEqual(response, { queries: ["A", "B"] });
  assert.equal(calls[0].url, "https://example.org/api/aggregate");
  assert.match(calls[0].options.body, /"dataset":"human"/);
  assert.match(calls[0].options.body, /"attribute":"gene_genes_ncbigene"/);
});

test("suggest sends dataset and term query parameter", async () => {
  const calls = [];
  const client = new TogoDxClient({
    baseUrl: "https://example.org/api",
    dataset: "ensembl_gene",
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({ nodes: [] })
      };
    }
  });

  const response = await client.suggest("disease_mesh_filter", "Parkinson Disease", 10);

  assert.deepEqual(response, { nodes: [] });
  assert.equal(
    calls[0],
    "https://example.org/api/suggest/disease_mesh_filter?dataset=ensembl_gene&term=Parkinson+Disease&limit=10"
  );
});
