export class Uncertain extends Error {}
export class Rejected extends Error {}
export function githubProvider({
  token,
  repo,
  fetcher = fetch,
  base = "https://api.github.com",
}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ActionProof/0.1",
  };
  const marker = (id) => `<!-- actionproof:${id} -->`;
  async function request(path, options = {}) {
    return fetcher(base + path, {
      ...options,
      headers,
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
  }
  return {
    async execute(op) {
      let r;
      try {
        r = await request(`/repos/${repo}/issues`, {
          method: "POST",
          body: JSON.stringify({
            title: op.payload.title,
            body: op.payload.body + "\n\n" + marker(op.id),
          }),
        });
      } catch {
        throw new Uncertain(
          "The provider response was unavailable. The issue may have been created. Reconcile before taking further action.",
        );
      }
      if (r.status >= 400 && r.status < 500 && r.status !== 408)
        throw new Rejected(
          `GitHub rejected the request (HTTP ${r.status}). No automatic retry was made.`,
        );
      if (!r.ok)
        throw new Uncertain(
          `GitHub returned HTTP ${r.status}. The outcome needs reconciliation.`,
        );
      let data;
      try {
        data = await r.json();
      } catch {
        throw new Uncertain(
          "GitHub returned an unreadable response. Reconcile the outcome.",
        );
      }
      if (!data.number || !data.html_url)
        throw new Uncertain(
          "The provider receipt was incomplete. Reconcile the outcome.",
        );
      return {
        id: String(data.number),
        url: data.html_url,
        repo,
        evidence: "GitHub creation response",
        verifiedAt: new Date().toISOString(),
      };
    },
    async reconcile(op) {
      if (op.provider?.id) {
        const r = await request(
          `/repos/${repo}/issues/${encodeURIComponent(op.provider.id)}`,
        );
        if (r.ok) {
          const issue = await r.json();
          if (issue.body?.includes(marker(op.id)))
            return {
              id: String(issue.number),
              url: issue.html_url,
              repo,
              evidence: "GitHub issue read with operation marker",
              verifiedAt: new Date().toISOString(),
            };
        }
      }
      // Read the repository directly. Search indexing is not used as proof of absence.
      for (let page = 1; page <= 5; page++) {
        const r = await request(
          `/repos/${repo}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}&since=${encodeURIComponent(op.createdAt)}`,
        );
        if (!r.ok)
          throw new Error(
            `GitHub verification unavailable (HTTP ${r.status}).`,
          );
        const issues = await r.json();
        const matches = issues.filter(
          (x) => !x.pull_request && x.body?.includes(marker(op.id)),
        );
        if (matches.length > 1)
          throw new Error(
            "Multiple matching issues found. An operator must investigate.",
          );
        if (matches.length === 1) {
          const x = matches[0];
          return {
            id: String(x.number),
            url: x.html_url,
            repo,
            evidence: "GitHub issue read with operation marker",
            verifiedAt: new Date().toISOString(),
          };
        }
        if (issues.length < 100) break;
      }
      return null;
    },
    async check() {
      const r = await request(`/repos/${repo}`);
      if (!r.ok)
        throw new Error(
          `Cannot read the configured repository (HTTP ${r.status}).`,
        );
      const x = await r.json();
      if (x.has_issues === false)
        throw new Error("Issues are disabled for this repository.");
      return {
        repository: x.full_name,
        readable: true,
        issuesEnabled: true,
        note: "Repository access verified. Issue-write permission is established only when an approved action is attempted.",
      };
    },
  };
}
