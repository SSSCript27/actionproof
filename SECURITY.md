# Security boundaries

ActionProof is an early self-hosted release, not a guarantee of safe agent behavior. Authorization checks, an approval, or a valid receipt cannot establish that an action was appropriate for the business.

- Only actions routed through the service are governed.
- API keys cannot approve actions. Interactive administrators/operators can approve their own proposals; there is no dual-control requirement.
- Credentials are encrypted in SQLite with a key derived from APP_SECRET. Protect both, and keep secrets out of logs, exports, and source repositories.
- Use HTTPS for remote access. Session cookies become Secure when PUBLIC_ORIGIN is HTTPS, and state-changing session requests require that exact Origin.
- Place the service behind an appropriately configured reverse proxy. In-process request limits are not a substitute for edge protection.
- A timeout is unknown unless there is sufficient provider evidence. Do not bypass uncertainty by minting a new business intent.
- Reconciliation is bounded and can fail to find an existing action. No universal exactly-once claim is made.
- Event history is an ordinary database record, not a cryptographically immutable or third-party-attested ledger.
- The public sandbox is simulated, browser-local, and cannot issue production credentials.

Use non-sensitive evaluation data and obtain independent security review before sensitive production deployment. Contact the maintainer privately through https://www.linkedin.com/in/sumanthst/ to discuss security issues; never include live credentials in public reports.
