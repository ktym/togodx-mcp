const DEFAULT_STOP_WORDS = [
  "and",
  "or",
  "the",
  "a",
  "an",
  "with",
  "for",
  "of",
  "to",
  "by"
];

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function tokenize(text) {
  return normalize(text)
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !DEFAULT_STOP_WORDS.includes(token));
}

function countTokenOverlap(aTokens, bTokens) {
  const pool = new Set(bTokens);
  return aTokens.reduce((score, token) => score + (pool.has(token) ? 1 : 0), 0);
}

function searchableTexts(attribute) {
  return [
    attribute.id,
    attribute.label,
    attribute.description,
    ...(attribute.keywords || []),
    ...(attribute.synonyms || []),
    attribute.category,
    attribute.dataset,
    attribute.datamodel,
    ...(attribute.sourceLabels || [])
  ]
    .filter(Boolean)
    .map(normalize);
}

export function rankAttributes(query, attributes, limit = 8) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);

  const ranked = attributes
    .map((attribute) => {
      const texts = searchableTexts(attribute);
      const fullText = texts.join(" ");
      const attributeTokens = tokenize(fullText);
      let score = 0;

      if (!normalizedQuery) {
        return { attribute, score };
      }

      if (normalize(attribute.id) === normalizedQuery) {
        score += 120;
      }

      if (normalize(attribute.label) === normalizedQuery) {
        score += 100;
      }

      if (texts.some((text) => text.includes(normalizedQuery))) {
        score += 35;
      }

      if (queryTokens.length > 0) {
        score += countTokenOverlap(queryTokens, attributeTokens) * 12;
      }

      for (const keyword of attribute.keywords || []) {
        if (normalizedQuery.includes(normalize(keyword))) {
          score += 18;
        }
      }

      for (const synonym of attribute.synonyms || []) {
        if (normalizedQuery.includes(normalize(synonym))) {
          score += 24;
        }
      }

      return { attribute, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.attribute.label.localeCompare(right.attribute.label))
    .slice(0, limit);

  return ranked.map((entry, index) => ({
    rank: index + 1,
    score: entry.score,
    ...entry.attribute
  }));
}

export function findAttributeById(attributes, attributeId) {
  return attributes.find((attribute) => attribute.id === attributeId) || null;
}
