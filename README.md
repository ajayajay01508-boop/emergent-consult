# Consult — Decision Governance Platform

[![Quality Gates](https://github.com/ajayajay01508-boop/emergent-consult/actions/workflows/quality.yml/badge.svg)](https://github.com/ajayajay01508-boop/emergent-consult/actions/workflows/quality.yml)

An interactive, browser-based decision-operations workspace for routing high-impact requests through explicit approval gates and preserving a cryptographically verifiable audit history.

**Live:** [workflow-manager-287.emergent.host](https://workflow-manager-287.emergent.host)

## What it demonstrates

- Conditional, sequential approval gates that cannot be skipped
- Requester, reviewer, auditor and administrator permission previews
- Approval and change-request workflows with decision notes
- Search and status filtering across an operational decision queue
- SHA-256 hash-linked audit events with in-product integrity verification
- Responsive, accessible interface with no build step or external runtime dependency

## Run locally

Serve the repository from any static web server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. The demo uses in-memory sample records and makes no network requests for decision data.

## Test

```bash
npm test
```

The Node test suite verifies role enforcement, sequential gate transitions, rejection behavior and tamper detection. GitHub Actions runs the suite on every push and pull request.

## Architecture

- `index.html` — semantic application shell and request dialog
- `styles.css` — responsive product interface
- `app.js` — UI state, filtering and workflow interactions
- `src/governance.mjs` — reusable decision and audit-chain rules
- `tests/governance.test.mjs` — deterministic governance tests

This portfolio implementation is a client-side reference architecture. A production deployment would persist requests and audit records in a database, enforce RBAC on the server and store signing keys in managed infrastructure.

## License

MIT
