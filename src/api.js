import { sandboxApi } from "./sandbox.js";
export async function api(path, method = "GET", body) {
  if (__SANDBOX__) return sandboxApi(path, method, body);
  let response;
  try {
    response = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Connection interrupted. If an action was executing, check its recorded status before trying again.",
    );
  }
  const value = await response.json();
  if (!response.ok) {
    const e = new Error(value.error || "Request failed.");
    e.status = response.status;
    throw e;
  }
  return value;
}
export function download(name, text) {
  const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
