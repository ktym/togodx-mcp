import test from "node:test";
import assert from "node:assert/strict";
import { rankAttributes, findAttributeById } from "../mcp/lib/attribute-matcher.mjs";

const attributes = [
  {
    id: "disease_diseases_nando",
    label: "Diseases",
    category: "Disease",
    description: "疾患属性",
    keywords: ["disease", "疾患"],
    synonyms: ["NANDO"]
  },
  {
    id: "gene_genes_ncbigene",
    label: "Genes",
    category: "Gene",
    description: "遺伝子属性",
    keywords: ["gene", "遺伝子"],
    synonyms: ["NCBI Gene"]
  }
];

test("rankAttributes matches Japanese keywords", () => {
  const ranked = rankAttributes("パーキンソン病の疾患を見たい", attributes, 5);
  assert.equal(ranked[0].id, "disease_diseases_nando");
});

test("findAttributeById returns the requested attribute", () => {
  assert.equal(findAttributeById(attributes, "gene_genes_ncbigene").label, "Genes");
});
