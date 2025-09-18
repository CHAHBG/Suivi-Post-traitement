Audit & Local checks
====================

Quick steps to run audits locally (requires Node.js and Chrome installed):

1) Start a local static server from the project root:

```powershell
python -m http.server 8000
```

2) Run Lighthouse (headless) with npx (creates a JSON report):

```powershell
npx -y lighthouse http://localhost:8000 --output=json --output-path=./lighthouse_report.json --only-categories=accessibility,performance,best-practices --chrome-flags="--headless --no-sandbox"
```

3) For an interactive run, open Chrome DevTools → Lighthouse and audit the page.

4) Use the axe browser extension for a deeper accessibility scan.

Notes:
- The environment used to prepare this repository could not run headless Lighthouse here; run the commands locally (they require Chrome).  
- For CI automation, see `.github/workflows/lighthouse.yml` which runs Lighthouse on the repository root via the public Pages URL or the runner-hosted server.
