import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAttributeCatalog } from "../mcp/lib/attribute-catalog.mjs";

test("normalizeAttributeCatalog supports dx-server config and merges docs text", () => {
  const rawCatalog = {
    categories: [
      {
        id: "gene",
        label: "Gene",
        attributes: ["gene_evolutionary_conservation_homologene"]
      }
    ],
    attributes: {
      gene_evolutionary_conservation_homologene: {
        label: "Evolutionary divergence",
        description: "Fallback description",
        api: "https://togodx.dbcls.jp/human/breakdown/gene_evolutionary_conservation_homologene",
        dataset: "ncbigene",
        datamodel: "classification",
        source: [{ label: "HomoloGene" }]
      }
    }
  };

  const markdown = `
## Subject: Gene

### Evolutionary divergence

The most distant organisms from human that have orthologous genes in HomoloGene

- Identifier: ncbigene
* Data sources
  * HomoloGene Release 68
`;

  const [attribute] = normalizeAttributeCatalog(rawCatalog, { dataSourcesMarkdown: markdown });
  assert.equal(attribute.id, "gene_evolutionary_conservation_homologene");
  assert.equal(attribute.category, "Gene");
  assert.equal(attribute.description, "The most distant organisms from human that have orthologous genes in HomoloGene");
  assert.match(attribute.synonyms.join(" "), /gene_evolutionary_conservation_homologene/);
  assert.match(attribute.keywords.join(" "), /HomoloGene/);
});
