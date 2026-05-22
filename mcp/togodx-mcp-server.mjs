import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { rankAttributes, findAttributeById } from "./lib/attribute-matcher.mjs";
import { TogoDxClient } from "./lib/togodx-client.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEFAULT_CONFIG_PATH = process.env.TOGODX_MCP_CONFIG || path.join(ROOT, "config", "togodx-mcp.example.json");
const SUPPORTED_PROTOCOL_VERSION = "2025-03-26";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadConfig() {
  const config = readJson(DEFAULT_CONFIG_PATH);
  const attributesPath = path.isAbsolute(config.attributesPath)
    ? config.attributesPath
    : path.join(ROOT, config.attributesPath);

  return {
    ...config,
    attributes: readJson(attributesPath).attributes
  };
}

function textResponse(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function getToolDefinitions() {
  return [
    {
      name: "start_session",
      description: "自然言語の探索リクエストから属性候補をランキングし、TogoDX の探索セッションを開始します。",
      inputSchema: {
        type: "object",
        properties: {
          request: { type: "string", description: "探索したい自然言語の条件。" },
          dataset: { type: "string", description: "データセット ID。省略時は設定値を使います。" }
        },
        required: ["request"]
      }
    },
    {
      name: "show_session",
      description: "現在の選択済み属性、中間ノード、リーフノード数を返します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" }
        },
        required: ["sessionId"]
      }
    },
    {
      name: "search_attributes",
      description: "自然言語クエリから属性候補を探します。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["query"]
      }
    },
    {
      name: "search_attribute_values",
      description: "指定属性に対して /suggest を実行し、中間ノード候補を検索します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          attributeId: { type: "string" },
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 }
        },
        required: ["sessionId", "attributeId", "query"]
      }
    },
    {
      name: "browse_attribute",
      description: "指定属性に対して /breakdown を実行し、内訳や階層を確認します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          attributeId: { type: "string" },
          nodes: {
            type: "array",
            items: { type: "string" },
            description: "ブレークダウンの起点にする中間ノード ID 一覧。"
          }
        },
        required: ["sessionId", "attributeId"]
      }
    },
    {
      name: "locate_ids",
      description: "ユーザーの ID リストを /locate に渡し、対応する中間ノード候補を取得します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          attributeId: { type: "string" },
          queries: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["sessionId", "attributeId", "queries"]
      }
    },
    {
      name: "apply_filters",
      description: "選んだ中間ノードをセッションへ反映し、/aggregate でリーフノード集合を更新します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                attributeId: { type: "string" },
                nodes: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["attributeId", "nodes"]
            }
          },
          replace: { type: "boolean" }
        },
        required: ["sessionId", "filters"]
      }
    },
    {
      name: "get_dataframe",
      description: "現在のセッション状態から /dataframe を実行し、結果表を返します。",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          annotations: {
            type: "array",
            items: { type: "string" },
            description: "表示したい属性 ID。省略時は選択済み属性を使います。"
          },
          queries: {
            type: "array",
            items: { type: "string" },
            description: "明示的に使いたいリーフノード ID。省略時は aggregate 結果を使います。"
          }
        },
        required: ["sessionId"]
      }
    }
  ];
}

const config = loadConfig();
const sessions = new Map();

function getDataset(sessionDataset) {
  return sessionDataset || config.dataset;
}

function getClient(dataset) {
  return new TogoDxClient({
    baseUrl: config.baseUrl,
    dataset: getDataset(dataset)
  });
}

function createSession(request, dataset) {
  const sessionId = crypto.randomUUID();
  const attributeMatches = rankAttributes(request, config.attributes, 8);
  const session = {
    id: sessionId,
    dataset: getDataset(dataset),
    request,
    filters: [],
    leafNodes: [],
    attributeMatches,
    createdAt: new Date().toISOString()
  };
  sessions.set(sessionId, session);
  return session;
}

function requireSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Unknown sessionId: ${sessionId}`);
  }
  return session;
}

function mergeFilters(existingFilters, nextFilters, replace = false) {
  if (replace) {
    return nextFilters.map((filter) => ({
      attributeId: filter.attributeId,
      nodes: [...new Set(filter.nodes)]
    }));
  }

  const merged = new Map(existingFilters.map((filter) => [filter.attributeId, new Set(filter.nodes)]));
  for (const filter of nextFilters) {
    const nodeSet = merged.get(filter.attributeId) || new Set();
    for (const node of filter.nodes) {
      nodeSet.add(node);
    }
    merged.set(filter.attributeId, nodeSet);
  }

  return Array.from(merged.entries()).map(([attributeId, nodes]) => ({
    attributeId,
    nodes: Array.from(nodes)
  }));
}

function annotateFilters(filters) {
  return filters.map((filter) => ({
    ...filter,
    attribute: findAttributeById(config.attributes, filter.attributeId)
  }));
}

async function callTool(name, args) {
  switch (name) {
    case "start_session": {
      const session = createSession(args.request, args.dataset);
      return textResponse({
        sessionId: session.id,
        dataset: session.dataset,
        request: session.request,
        attributeCandidates: session.attributeMatches,
        nextStep: "search_attribute_values で中間ノード候補を探すか、locate_ids で手元の ID を対応付けてください。"
      });
    }
    case "show_session": {
      const session = requireSession(args.sessionId);
      return textResponse({
        sessionId: session.id,
        dataset: session.dataset,
        request: session.request,
        filters: annotateFilters(session.filters),
        leafNodeCount: session.leafNodes.length,
        leafNodesPreview: session.leafNodes.slice(0, 20),
        attributeCandidates: session.attributeMatches
      });
    }
    case "search_attributes": {
      return textResponse({
        query: args.query,
        matches: rankAttributes(args.query, config.attributes, args.limit || 8)
      });
    }
    case "search_attribute_values": {
      const session = requireSession(args.sessionId);
      const client = getClient(session.dataset);
      const suggestions = await client.suggest(args.attributeId, args.query, args.limit || 20);
      return textResponse({
        sessionId: session.id,
        attribute: findAttributeById(config.attributes, args.attributeId),
        query: args.query,
        suggestions
      });
    }
    case "browse_attribute": {
      const session = requireSession(args.sessionId);
      const client = getClient(session.dataset);
      const breakdown = await client.breakdown(args.attributeId, {
        nodes: args.nodes || [],
        filters: session.filters
      });
      return textResponse({
        sessionId: session.id,
        attribute: findAttributeById(config.attributes, args.attributeId),
        breakdown
      });
    }
    case "locate_ids": {
      const session = requireSession(args.sessionId);
      const client = getClient(session.dataset);
      const located = await client.locate(args.attributeId, args.queries);
      return textResponse({
        sessionId: session.id,
        attribute: findAttributeById(config.attributes, args.attributeId),
        queries: args.queries,
        located
      });
    }
    case "apply_filters": {
      const session = requireSession(args.sessionId);
      const client = getClient(session.dataset);
      session.filters = mergeFilters(session.filters, args.filters, args.replace);
      const aggregate = await client.aggregate(session.filters);
      session.leafNodes = Array.isArray(aggregate) ? aggregate : (aggregate.nodes || aggregate.queries || []);

      return textResponse({
        sessionId: session.id,
        filters: annotateFilters(session.filters),
        leafNodeCount: session.leafNodes.length,
        leafNodesPreview: session.leafNodes.slice(0, 20),
        aggregate
      });
    }
    case "get_dataframe": {
      const session = requireSession(args.sessionId);
      const client = getClient(session.dataset);
      const annotations = args.annotations && args.annotations.length > 0
        ? args.annotations
        : session.filters.map((filter) => filter.attributeId);
      const queries = args.queries && args.queries.length > 0
        ? args.queries
        : session.leafNodes;

      if (queries.length === 0) {
        throw new Error("No leaf node queries are available. Apply filters first or pass queries explicitly.");
      }

      if (annotations.length === 0) {
        throw new Error("No annotations selected. Pass annotations or apply at least one filter.");
      }

      const dataframe = await client.dataframe({ queries, annotations });
      return textResponse({
        sessionId: session.id,
        queryCount: queries.length,
        annotations,
        dataframe
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function writeMessage(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function writeResult(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result
  });
}

function writeError(id, error) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error.message
    }
  });
}

async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        writeResult(id, {
          protocolVersion: SUPPORTED_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          serverInfo: {
            name: "togodx-natural-language",
            version: "0.1.0"
          }
        });
        return;
      case "notifications/initialized":
        return;
      case "tools/list":
        writeResult(id, {
          tools: getToolDefinitions()
        });
        return;
      case "tools/call":
        writeResult(id, await callTool(params.name, params.arguments || {}));
        return;
      default:
        writeError(id, new Error(`Unsupported method: ${method}`));
    }
  } catch (error) {
    writeError(id, error);
  }
}

let buffer = Buffer.alloc(0);

function tryConsumeMessage() {
  const separator = buffer.indexOf("\r\n\r\n");
  if (separator === -1) {
    return false;
  }

  const headerText = buffer.subarray(0, separator).toString("utf8");
  const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
  if (!contentLengthMatch) {
    throw new Error("Missing Content-Length header.");
  }

  const contentLength = Number(contentLengthMatch[1]);
  const messageStart = separator + 4;
  const messageEnd = messageStart + contentLength;

  if (buffer.length < messageEnd) {
    return false;
  }

  const payload = buffer.subarray(messageStart, messageEnd).toString("utf8");
  buffer = buffer.subarray(messageEnd);
  handleRequest(JSON.parse(payload));
  return true;
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (tryConsumeMessage()) {
  }
});
