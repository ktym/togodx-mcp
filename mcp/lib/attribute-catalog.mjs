function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(
    values
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
}

function categoryAliases(categoryId, categoryLabel) {
  const normalized = normalizeText(categoryId || categoryLabel);
  switch (normalized) {
    case "gene":
      return ["gene", "genes", "genetic"];
    case "protein":
      return ["protein", "proteins"];
    case "structure":
      return ["structure", "protein structure", "3d structure"];
    case "interaction":
      return ["interaction", "interactions", "pathway", "pathways"];
    case "compound":
      return ["compound", "compounds", "drug", "drugs"];
    case "glycan":
      return ["glycan", "glycans"];
    case "disease":
      return ["disease", "diseases", "disorder", "disorders"];
    case "variant":
      return ["variant", "variants", "mutation", "mutations"];
    default:
      return uniqueStrings([categoryId, categoryLabel]);
  }
}

function englishOnly(values) {
  return values.filter((value) => !/[\u3040-\u30ff\u3400-\u9fff]/u.test(String(value || "")));
}

function normalizeConversionTargets(conversionValue) {
  if (!conversionValue) {
    return [];
  }

  if (Array.isArray(conversionValue)) {
    return uniqueStrings(conversionValue.map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      return entry?.target || entry?.dataset || entry?.id || entry?.name || null;
    }));
  }

  if (typeof conversionValue === "object") {
    return Object.keys(conversionValue);
  }

  return [];
}

function mergeConversionTargets(datasetValue, topLevelConversionValue) {
  return uniqueStrings([
    normalizeConversionTargets(topLevelConversionValue),
    normalizeConversionTargets(datasetValue?.conversion)
  ]);
}

function normalizeDatasetExamples(datasetValue) {
  const examples = datasetValue?.examples || datasetValue?.exampleIds || datasetValue?.ids || [];
  if (Array.isArray(examples)) {
    return examples;
  }
  if (typeof examples === "object" && examples !== null) {
    return Object.values(examples).flatMap((value) => Array.isArray(value) ? value : [value]);
  }
  return [];
}

export function extractCatalogMetadata(rawCatalog) {
  if (rawCatalog?.catalog) {
    return {
      ...rawCatalog.catalog,
      categories: Array.isArray(rawCatalog.catalog.categories) ? rawCatalog.catalog.categories : [],
      datasets: Array.isArray(rawCatalog.catalog.datasets)
        ? rawCatalog.catalog.datasets.map((dataset) => ({
          ...dataset,
          conversionTargets: mergeConversionTargets(dataset.details, dataset.conversionTargets)
        }))
        : [],
      conversion: rawCatalog.catalog.conversion || {}
    };
  }

  if (Array.isArray(rawCatalog?.attributes)) {
    const attributes = rawCatalog.attributes;
    const categoryMap = new Map();
    const datasetMap = new Map();

    for (const attribute of attributes) {
      const categoryId = attribute.categoryId || normalizeText(attribute.category || "").replace(/\s+/g, "_");
      if (attribute.category && !categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          id: categoryId || null,
          label: attribute.category,
          attributes: [],
          attributeCount: 0
        });
      }
      if (attribute.category && categoryMap.has(categoryId)) {
        categoryMap.get(categoryId).attributes.push(attribute.id);
      }

      if (attribute.dataset && !datasetMap.has(attribute.dataset)) {
        datasetMap.set(attribute.dataset, {
          id: attribute.dataset,
          label: attribute.dataset,
          examples: [],
          conversionTargets: [],
          details: {}
        });
      }
    }

    for (const category of categoryMap.values()) {
      category.attributeCount = category.attributes.length;
    }

    return {
      categories: Array.from(categoryMap.values()),
      datasets: Array.from(datasetMap.values()),
      conversion: {}
    };
  }

  if (!rawCatalog?.attributes || !Array.isArray(rawCatalog?.categories)) {
    throw new Error("Unsupported attribute catalog format.");
  }

  const rawDatasets = rawCatalog.datasets || {};
  const rawConversion = rawCatalog.conversion || rawCatalog.conversions || {};

  return {
    categories: rawCatalog.categories.map((category) => ({
      id: category.id || null,
      label: category.label || category.id || "",
      attributes: Array.isArray(category.attributes) ? category.attributes : [],
      attributeCount: Array.isArray(category.attributes) ? category.attributes.length : 0
    })),
    datasets: Object.entries(rawDatasets).map(([id, dataset]) => ({
      id,
      label: dataset?.label || dataset?.name || id,
      examples: normalizeDatasetExamples(dataset),
      conversionTargets: mergeConversionTargets(dataset, rawConversion[id]),
      details: dataset
    })),
    conversion: rawConversion
  };
}

export function normalizeAttributeCatalog(rawCatalog) {
  if (Array.isArray(rawCatalog?.attributes)) {
    return rawCatalog.attributes;
  }

  if (!rawCatalog?.attributes || !Array.isArray(rawCatalog?.categories)) {
    throw new Error("Unsupported attribute catalog format.");
  }

  const categoryByAttributeId = new Map();

  for (const category of rawCatalog.categories) {
    for (const attributeId of category.attributes || []) {
      categoryByAttributeId.set(attributeId, {
        id: category.id || null,
        label: category.label || category.id || ""
      });
    }
  }

  return Object.entries(rawCatalog.attributes).map(([id, attribute]) => {
    const category = categoryByAttributeId.get(id) || { id: null, label: "" };
    const sourceLabels = uniqueStrings(englishOnly((attribute.source || []).map((source) => source.label)));

    return {
      id,
      label: attribute.label,
      category: category.label,
      categoryId: category.id,
      description: attribute.description || "",
      keywords: uniqueStrings([
        attribute.dataset,
        attribute.datamodel,
        category.id,
        category.label,
        categoryAliases(category.id, category.label),
        sourceLabels
      ]),
      synonyms: uniqueStrings([
        attribute.api ? [attribute.api.split("/").pop()] : [],
        attribute.dataset,
        sourceLabels
      ]),
      dataset: attribute.dataset || null,
      datamodel: attribute.datamodel || null,
      api: attribute.api || null,
      sourceLabels
    };
  });
}
