#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const origin = process.env.ACTIONPROOF_URL,
  key = process.env.ACTIONPROOF_API_KEY;
if (!origin || !key)
  throw new Error("Set ACTIONPROOF_URL and ACTIONPROOF_API_KEY.");
const parsed = new URL(origin);
if (
  !["http:", "https:"].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password
)
  throw new Error(
    "ACTIONPROOF_URL must be an HTTP(S) origin without embedded credentials.",
  );
if (
  parsed.protocol !== "https:" &&
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
)
  throw new Error("Remote ActionProof servers require HTTPS.");
const server = new McpServer({ name: "actionproof", version: "0.1.0" });
async function call(path, method = "GET", body) {
  try {
    const r = await fetch(origin.replace(/\/$/, "") + "/api" + path, {
      method,
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    const result = await r.json();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !r.ok,
    };
  } catch {
    return {
      content: [
        {
          type: "text",
          text: "ActionProof request unavailable. If execution was dispatched, inspect and reconcile the operation before retrying.",
        },
      ],
      isError: true,
    };
  }
}
server.registerTool(
  "list_operations",
  {
    description:
      "Read recent operation outcomes and evidence. Requires operations:read.",
    inputSchema: {},
  },
  () => call("/operations"),
);
server.registerTool(
  "get_operation",
  {
    description: "Read the durable status and evidence for a known operation.",
    inputSchema: { id: z.string().uuid() },
  },
  ({ id }) => call("/operations/" + id),
);
server.registerTool(
  "propose_issue",
  {
    description:
      "Record an issue-creation intent without executing it. A human team member must approve the immutable intent in ActionProof. Reuse the same idempotency key only for the same logical intent.",
    inputSchema: {
      connector: z.enum(["sandbox", "github"]),
      repo: z.string(),
      title: z.string().max(200),
      body: z.string().max(20000).default(""),
      idempotencyKey: z.string().min(8).max(160),
    },
  },
  (args) => call("/operations", "POST", args),
);
server.registerTool(
  "execute_approved_operation",
  {
    description:
      "Execute an already human-approved operation. Requires operations:execute. Never use a new intent to bypass an unknown outcome.",
    inputSchema: { id: z.string().uuid() },
  },
  ({ id }) => call("/operations/" + id + "/execute", "POST", {}),
);
server.registerTool(
  "reconcile_operation",
  {
    description:
      "Read the external provider to verify an uncertain outcome. Does not repeat the external write. A missing match remains unresolved.",
    inputSchema: { id: z.string().uuid() },
  },
  ({ id }) => call("/operations/" + id + "/reconcile", "POST", {}),
);
server.registerTool(
  "export_receipt",
  {
    description:
      "Export the operation intent, outcome, approval hash and event history as JSON. Requires operations:read.",
    inputSchema: { id: z.string().uuid() },
  },
  ({ id }) => call("/operations/" + id + "/receipt"),
);
await server.connect(new StdioServerTransport());
