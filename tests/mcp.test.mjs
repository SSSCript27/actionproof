import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createApp } from "../server/index.mjs";
import { openStore } from "../server/store.mjs";
test("official MCP client completes propose, human approval, execution and receipt workflow", async (t) => {
  const origin = "http://127.0.0.1:4310",
    app = createApp({
      db: openStore(":memory:"),
      origin,
      secret: "synthetic-secret-with-more-than-32-characters",
      bootstrapToken: "mcp-test-bootstrap",
    });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(() => app.close());
  const url = "http://127.0.0.1:" + app.server.address().port;
  let cookie;
  async function post(path, body) {
    const r = await fetch(url + "/api" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    assert.ok(r.ok);
    return r.json();
  }
  await post("/setup", {
    name: "MCP test owner",
    email: "mcp@example.test",
    password: "synthetic-test-password-long",
    workspace: "MCP integration",
    bootstrapToken: "mcp-test-bootstrap",
  });
  const key = await post("/keys", {
    name: "MCP test agent",
    scopes: ["operations:read", "operations:write", "operations:execute"],
  });
  const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("mcp/index.mjs")],
      env: {
        ...process.env,
        ACTIONPROOF_URL: url,
        ACTIONPROOF_API_KEY: key.token,
      },
    }),
    client = new Client({ name: "actionproof-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 6);
  assert.ok(
    !tools.tools.some(
      (x) => x.name.includes("approve") && !x.name.includes("approved"),
    ),
  );
  const proposed = await client.callTool({
    name: "propose_issue",
    arguments: {
      connector: "sandbox",
      repo: "test/repo",
      title: "MCP integration intent",
      body: "Synthetic data",
      idempotencyKey: "mcp-integration-001",
    },
  });
  assert.ok(!proposed.isError);
  const id = JSON.parse(proposed.content[0].text).operation.id;
  const denied = await client.callTool({
    name: "execute_approved_operation",
    arguments: { id },
  });
  assert.equal(denied.isError, true);
  await post("/operations/" + id + "/approve", {});
  const executed = await client.callTool({
    name: "execute_approved_operation",
    arguments: { id },
  });
  assert.equal(
    JSON.parse(executed.content[0].text).operation.status,
    "verified",
  );
  const receipt = await client.callTool({
    name: "export_receipt",
    arguments: { id },
  });
  assert.equal(
    JSON.parse(receipt.content[0].text).operation.status,
    "verified",
  );
});
