import test from "node:test";
import assert from "node:assert/strict";
import { extractCatalogMetadata, normalizeAttributeCatalog } from "../mcp/lib/attribute-catalog.mjs";

test("normalizeAttributeCatalog supports dx-server config from attributes.dx-server.json", () => {
  const rawCatalog = {
    categories: [
      {
        id: "disease",
        label: "Disease",
        attributes: ["disease_diseases_mesh"]
      }
    ],
    datasets: {
      ensembl_gene: {
        label: "Ensembl Gene",
        examples: ["ENSG00000141510"]
      }
    },
    conversion: {
      ensembl_gene: {
        ncbigene: {}
      }
    },
    attributes: {
      disease_diseases_mesh: {
        label: "Diseases in MeSH",
        description: "Disease concepts from MeSH for filtering TogoDX entities",
        api: "https://togodx.dbcls.jp/human/breakdown/disease_diseases_mesh",
        dataset: "mesh",
        datamodel: "classification",
        source: [{ label: "Medical Subject Headings (MeSH)" }]
      }
    }
  };

  const [attribute] = normalizeAttributeCatalog(rawCatalog);
  assert.equal(attribute.id, "disease_diseases_mesh");
  assert.equal(attribute.category, "Disease");
  assert.equal(attribute.categoryId, "disease");
  assert.equal(attribute.description, "Disease concepts from MeSH for filtering TogoDX entities");
  assert.match(attribute.synonyms.join(" "), /disease_diseases_mesh/);
  assert.match(attribute.keywords.join(" "), /Medical Subject Headings/);
});

test("extractCatalogMetadata preserves categories, datasets, and conversion targets", () => {
  const rawCatalog = {
    categories: [
      {
        id: "gene",
        label: "Gene",
        attributes: ["gene_biotype_ensembl", "gene_chromosome_ensembl"]
      }
    ],
    datasets: {
      ensembl_gene: {
        label: "Ensembl Gene",
        examples: ["ENSG00000141510"],
        conversion: {
          hgnc: "https://example.org/ensembl_gene,hgnc"
        }
      }
    },
    conversion: {
      ensembl_gene: {
        ncbigene: {},
        uniprot: {}
      }
    },
    attributes: {}
  };

  const metadata = extractCatalogMetadata(rawCatalog);
  assert.equal(metadata.categories[0].attributeCount, 2);
  assert.equal(metadata.datasets[0].id, "ensembl_gene");
  assert.deepEqual(metadata.datasets[0].examples, ["ENSG00000141510"]);
  assert.deepEqual(metadata.datasets[0].conversionTargets, ["ncbigene", "uniprot", "hgnc"]);
});

test("extractCatalogMetadata supports generated attribute arrays", () => {
  const metadata = extractCatalogMetadata({
    attributes: [
      {
        id: "gene_biotype_ensembl",
        category: "Gene",
        categoryId: "gene",
        dataset: "ensembl_gene"
      }
    ]
  });

  assert.equal(metadata.categories[0].id, "gene");
  assert.deepEqual(metadata.categories[0].attributes, ["gene_biotype_ensembl"]);
  assert.equal(metadata.datasets[0].id, "ensembl_gene");
});
