import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import { rankAttributes, findAttributeById } from "./lib/attribute-matcher.mjs";
import { normalizeAttributeCatalog } from "./lib/attribute-catalog.mjs";
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
    attributes: normalizeAttributeCatalog(readJson(attributesPath))
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
      description: "Rank attribute candidates from a natural-language request and start a TogoDX exploration session.",
      inputSchema: {
        type: "object",
        properties: {
          request: { type: "string", description: "Natural-language request describing what to explore." },
          dataset: { type: "string", description: "Dataset ID. Uses the configured default when omitted." }
        },
        required: ["request"]
      }
    },
    {
      name: "show_session",
      description: "Return the currently selected attributes, intermediate nodes, and leaf-node counts.",
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
      description: "Search for attribute candidates from a natural-language query.",
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
      description: "Run /suggest for the selected attribute and return matching intermediate-node candidates.",
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
      description: "Run /breakdown for the selected attribute and inspect its hierarchy or counts.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          attributeId: { type: "string" },
          nodes: {
            type: "array",
            items: { type: "string" },
            description: "Intermediate node IDs to use as the starting point for the breakdown."
          }
        },
        required: ["sessionId", "attributeId"]
      }
    },
    {
      name: "locate_ids",
      description: "Send a user-provided ID list to /locate and return matching intermediate-node candidates.",
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
      description: "Apply selected intermediate nodes to the session and refresh the leaf-node set through /aggregate.",
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
      description: "Run /dataframe from the current session state and return the resulting table.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          annotations: {
            type: "array",
            items: { type: "string" },
            description: "Attribute IDs to include in the output. Uses selected attributes when omitted."
          },
          queries: {
            type: "array",
            items: { type: "string" },
            description: "Leaf-node IDs to use explicitly. Uses the aggregate result when omitted."
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
        nextStep: "Use search_attribute_values to look for intermediate-node candidates, or use locate_ids to map your own IDs."
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

function createResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function createError(id, error) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error.message
    }
  };
}

async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        return createResult(id, {
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
      case "notifications/initialized":
        return null;
      case "tools/list":
        return createResult(id, {
          tools: getToolDefinitions()
        });
      case "tools/call":
        return createResult(id, await callTool(params.name, params.arguments || {}));
      default:
        return createError(id, new Error(`Unsupported method: ${method}`));
    }
  } catch (error) {
    return createError(id, error);
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
  Promise.resolve(handleRequest(JSON.parse(payload)))
    .then((response) => {
      if (response) {
        writeMessage(response);
      }
    })
    .catch((error) => {
      writeMessage(createError(null, error));
    });
  return true;
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (tryConsumeMessage()) {
  }
});

function getPort() {
  const flagIndex = process.argv.findIndex((arg) => arg === "--port");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return Number(process.argv[flagIndex + 1]);
  }

  if (process.env.TOGODX_MCP_PORT) {
    return Number(process.env.TOGODX_MCP_PORT);
  }

  return null;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function handleHttpRequest(request, response) {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      name: "togodx-natural-language",
      version: "0.1.0"
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/mcp") {
    sendJson(response, 404, {
      error: "Not found",
      supported: {
        health: "GET /health",
        mcp: "POST /mcp"
      }
    });
    return;
  }

  try {
    const rawBody = await readBody(request);
    const rpcRequest = JSON.parse(rawBody);
    const rpcResponse = await handleRequest(rpcRequest);

    if (!rpcResponse) {
      response.writeHead(204);
      response.end();
      return;
    }

    sendJson(response, 200, rpcResponse);
  } catch (error) {
    sendJson(response, 400, createError(null, error));
  }
}

const port = getPort();

if (port) {
  const server = http.createServer((request, response) => {
    handleHttpRequest(request, response);
  });

  server.listen(port, "127.0.0.1", () => {
    console.error(`TogoDX MCP server listening on http://127.0.0.1:${port}`);
  });
}
