export class ActionProof {
  constructor({ url, apiKey }) {
    this.url = url.replace(/\/$/, "");
    this.apiKey = apiKey;
    const u = new URL(this.url);
    if (
      u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      )
    )
      throw new Error("Use HTTPS for a remote ActionProof service.");
  }
  async request(path, method = "GET", body) {
    const r = await fetch(this.url + "/api" + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const result = await r.json();
    if (!r.ok) {
      const e = new Error(result.error || "Request failed");
      e.status = r.status;
      throw e;
    }
    return result;
  }
  propose(input) {
    return this.request("/operations", "POST", input);
  }
  get(id) {
    return this.request("/operations/" + encodeURIComponent(id));
  }
  list() {
    return this.request("/operations");
  }
  execute(id) {
    return this.request(
      "/operations/" + encodeURIComponent(id) + "/execute",
      "POST",
      {},
    );
  }
  reconcile(id) {
    return this.request(
      "/operations/" + encodeURIComponent(id) + "/reconcile",
      "POST",
      {},
    );
  }
  receipt(id) {
    return this.request("/operations/" + encodeURIComponent(id) + "/receipt");
  }
}
