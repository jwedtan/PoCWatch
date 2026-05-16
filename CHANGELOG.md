# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-16

### Added

- CVE dashboard with last-30-days NVD feed (up to 200 CVEs), EPSS scores, and GitHub PoC discovery.
- Severity tabs, reference-tag filters, on-demand CVE lookup, and collapsible detail cards.
- Asset inventory on `/assets` with SQLite persistence (`data/pocwatch.db`, optional `SQLITE_PATH`).
- Asset-aware matching on the dashboard (`exact` / `likely` / `possible`) and **My assets** tab.
- JSON import/export for assets; Docker Compose deploy with persistent volume for `data/`.
- Light / dark theme toggle.

### Security

- Self-hosted deployment model: no built-in authentication. See [README — Security](README.md#security--self-hosting).

[0.1.0]: https://github.com/jwedtan/PoCWatch/releases/tag/v0.1.0
