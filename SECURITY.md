# Security Policy

## Scope

This repository contains a static Vite + React application for precinct-level voter analysis. The application runs entirely client-side and is published through GitHub Pages.

## Supported Versions

Security fixes are applied to the `main` branch and current GitHub Pages deployment.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits/releases | No |

## Reporting a Vulnerability

If you discover a security issue, do not open a public issue with exploit details.

Preferred reporting path:

1. Contact the repository maintainers privately.
2. Include a clear description of the issue, affected files or workflow, reproduction steps, and estimated impact.
3. If relevant, include recommended remediation guidance.

Requested response expectations:

1. Initial acknowledgement within 5 business days.
2. Triage and severity review as quickly as practical.
3. Remediation plan or mitigation guidance after validation.

## Security Posture Notes

Current hardening measures include:

1. Browser-side Content Security Policy for the static app shell.
2. Client-side upload validation for type and file size.
3. Timeout-based loading for built-in JSON and GeoJSON assets.
4. Sanitized CSV export filenames.
5. Automated security checks in GitHub Actions.

## Operational Guidance

1. Keep dependencies current through Dependabot and scheduled audits.
2. Review pull requests for dependency changes before merge.
3. Avoid placing secrets, credentials, or private voter data in this repository.
4. Treat uploaded files as untrusted input even though parsing occurs client-side.

## Ownership

This tool is developed by JBPTV Consultancy Group.