function joinUrl(baseUrl, path) {
  const trimmedBase = String(baseUrl || "").replace(/\/+$/, "");
  const trimmedPath = String(path || "").replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

async function requestJson(baseUrl, path, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(joinUrl(baseUrl, path), {
    headers: {
      "accept": "application/json",
      ...(options.body ? { "content-type": "application/json" } : {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TogoDX API request failed (${response.status} ${response.statusText}): ${body}`);
  }

  return response.json();
}

export class TogoDxClient {
  constructor({ baseUrl, dataset, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.dataset = dataset;
    this.fetchImpl = fetchImpl;
  }

  async breakdown(attributeId, body = {}) {
    return requestJson(this.baseUrl, `breakdown/${attributeId}`, {
      method: "POST",
      body: JSON.stringify({
        dataset: this.dataset,
        ...body
      })
    }, this.fetchImpl);
  }

  async suggest(attributeId, keyword, limit = 20) {
    const url = new URL(joinUrl(this.baseUrl, `suggest/${attributeId}`));
    url.searchParams.set("dataset", this.dataset);
    url.searchParams.set("term", keyword);
    url.searchParams.set("limit", String(limit));

    const response = await this.fetchImpl(url, {
      headers: {
        "accept": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TogoDX API request failed (${response.status} ${response.statusText}): ${body}`);
    }

    return response.json();
  }

  async locate(attributeId, queries) {
    return requestJson(this.baseUrl, `locate/${attributeId}`, {
      method: "POST",
      body: JSON.stringify({
        dataset: this.dataset,
        queries
      })
    }, this.fetchImpl);
  }

  async aggregate(filters) {
    return requestJson(this.baseUrl, "aggregate", {
      method: "POST",
      body: JSON.stringify({
        dataset: this.dataset,
        filters: filters.map((filter) => ({
          attribute: filter.attributeId || filter.attribute,
          nodes: filter.nodes
        }))
      })
    }, this.fetchImpl);
  }

  async dataframe({ queries, annotations }) {
    return requestJson(this.baseUrl, "dataframe", {
      method: "POST",
      body: JSON.stringify({
        dataset: this.dataset,
        queries,
        annotations
      })
    }, this.fetchImpl);
  }
}
