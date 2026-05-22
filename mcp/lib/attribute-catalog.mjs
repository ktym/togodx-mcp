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

function englishOnly(values) {
  return values.filter((value) => isMostlyEnglish(value));
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryToSubject(category) {
  const normalized = normalizeText(category);
  switch (normalized) {
    case "structure":
      return "protein structure";
    case "compound":
      return "chemical compound";
    default:
      return normalized;
  }
}

function categoryAliases(category) {
  const normalized = normalizeText(category);
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
      return [category];
  }
}

function isMostlyEnglish(text) {
  return !/[\u3040-\u30ff\u3400-\u9fff]/u.test(String(text || ""));
}

export function parseDataSourcesMarkdown(markdown) {
  const sectionChunks = String(markdown || "").split(/^## Subject:\s*/m).slice(1);
  const entries = [];

  for (const chunk of sectionChunks) {
    const [subjectLine, ...restLines] = chunk.split("\n");
    const subject = stripMarkdown(subjectLine);
    const attributeChunks = restLines.join("\n").split(/^###\s+/m).slice(1);

    for (const attributeChunk of attributeChunks) {
      const [labelLine, ...bodyLines] = attributeChunk.split("\n");
      const label = stripMarkdown(labelLine);
      const body = bodyLines.map((line) => line.replace(/\r$/, ""));

      let summary = "";
      let mode = null;
      const supplementary = [];
      const sourceLabels = [];
      const identifierHints = [];

      for (const line of body) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (!summary && !/^[*-]\s+/.test(trimmed)) {
          summary = stripMarkdown(trimmed);
          continue;
        }

        if (/^[*-]\s+Supplementary information/i.test(trimmed)) {
          mode = "supplementary";
          continue;
        }

        if (/^[*-]\s+Data sources/i.test(trimmed)) {
          mode = "sources";
          continue;
        }

        if (/^[*-]\s+Identifier:/i.test(trimmed)) {
          identifierHints.push(stripMarkdown(trimmed.replace(/^[*-]\s+Identifier:\s*/i, "")));
          continue;
        }

        if (/^[*-]\s+(Input\/Output|Query|Input|Output)\b/i.test(trimmed)) {
          mode = null;
          continue;
        }

        if (mode === "supplementary" && /^[*-]\s+/.test(trimmed)) {
          const value = stripMarkdown(trimmed.replace(/^[*-]\s+/, ""));
          if (isMostlyEnglish(value)) {
            supplementary.push(value);
          }
          continue;
        }

        if (mode === "sources" && /^[*-]\s+/.test(trimmed)) {
          sourceLabels.push(stripMarkdown(trimmed.replace(/^[*-]\s+/, "")));
        }
      }

      entries.push({
        subject,
        label,
        summary,
        supplementary,
        sourceLabels,
        identifierHints
      });
    }
  }

  return entries;
}

function buildDocsIndex(entries) {
  return new Map(entries.map((entry) => [
    `${normalizeText(entry.subject)}::${normalizeText(entry.label)}`,
    entry
  ]));
}

function docsLookup(docsIndex, categoryLabel, attributeLabel) {
  return docsIndex.get(`${categoryToSubject(categoryLabel)}::${normalizeText(attributeLabel)}`) || null;
}

export function normalizeAttributeCatalog(rawCatalog, options = {}) {
  if (Array.isArray(rawCatalog?.attributes)) {
    return rawCatalog.attributes;
  }

  if (!rawCatalog?.attributes || !Array.isArray(rawCatalog?.categories)) {
    throw new Error("Unsupported attribute catalog format.");
  }

  const docsIndex = buildDocsIndex(parseDataSourcesMarkdown(options.dataSourcesMarkdown || ""));
  const categoryByAttributeId = new Map();

  for (const category of rawCatalog.categories) {
    for (const attributeId of category.attributes || []) {
      categoryByAttributeId.set(attributeId, category.label || category.id);
    }
  }

  return Object.entries(rawCatalog.attributes).map(([id, attribute]) => {
    const category = categoryByAttributeId.get(id) || "";
    const docsEntry = docsLookup(docsIndex, category, attribute.label);
    const docsText = uniqueStrings([
      docsEntry?.summary,
      docsEntry?.supplementary || []
    ]);

    return {
      id,
      label: attribute.label,
      category,
      description: docsText[0] || attribute.description || "",
      keywords: uniqueStrings([
        attribute.dataset,
        attribute.datamodel,
        category,
        categoryAliases(category),
        docsEntry?.identifierHints || [],
        englishOnly(docsEntry?.sourceLabels || []),
        englishOnly((attribute.source || []).map((source) => source.label))
      ]),
      synonyms: uniqueStrings([
        docsText.slice(1),
        attribute.api ? [attribute.api.split("/").pop()] : [],
        attribute.dataset,
        englishOnly((attribute.source || []).map((source) => source.label))
      ]),
      dataset: attribute.dataset || null,
      datamodel: attribute.datamodel || null,
      api: attribute.api || null,
      sourceLabels: uniqueStrings(englishOnly((attribute.source || []).map((source) => source.label)))
    };
  });
}
