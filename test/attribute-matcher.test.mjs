import test from "node:test";
import assert from "node:assert/strict";
import { rankAttributes, findAttributeById } from "../mcp/lib/attribute-matcher.mjs";

const attributes = [
  {
    id: "disease_diseases_nando",
    label: "Diseases",
    category: "Disease",
    description: "Disease attribute",
    keywords: ["disease", "disorder"],
    synonyms: ["NANDO"]
  },
  {
    id: "gene_genes_ncbigene",
    label: "Genes",
    category: "Gene",
    description: "Gene attribute",
    keywords: ["gene", "symbol"],
    synonyms: ["NCBI Gene"]
  }
];

test("rankAttributes matches Japanese keywords", () => {
  const ranked = rankAttributes("show disease annotations for Parkinson disease", attributes, 5);
  assert.equal(ranked[0].id, "disease_diseases_nando");
});

test("findAttributeById returns the requested attribute", () => {
  assert.equal(findAttributeById(attributes, "gene_genes_ncbigene").label, "Genes");
});
