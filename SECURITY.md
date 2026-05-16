# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Email or DM the repository owner with:

- A description of the issue and impact
- Steps to reproduce
- Your PoCWatch version and deployment setup (Docker / npm)

We will acknowledge reports as soon as possible and work on a fix or mitigation.

## Self-hosting expectations

PoCWatch is designed for **trusted, private networks** (homelab, team VPN, localhost). It does **not** ship authentication. Anyone who can reach the web UI can read and modify the asset inventory via Server Actions.

If you expose an instance to the internet, place it behind a reverse proxy with authentication (e.g. OAuth2 proxy, Authelia, Cloudflare Access) and restrict network access.
