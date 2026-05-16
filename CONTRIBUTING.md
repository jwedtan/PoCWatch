# Contributing

Thanks for your interest in PoCWatch.

## Development setup

```bash
git clone https://github.com/jwedtan/PoCWatch.git
cd PoCWatch
npm install
cp .env.example .env.local
npm run dev
```

Optional: set `GITHUB_TOKEN` and `NVD_API_KEY` in `.env.local` for faster, more reliable upstream API access.

## Pull requests

1. Branch from `main`.
2. Run `npm run lint` and `npm run build` before opening a PR.
3. Keep changes focused; describe **why** in the PR body.
4. Update [CHANGELOG.md](CHANGELOG.md) under **Unreleased** for user-visible changes.

## Releases

Maintainers tag releases as `v0.x.y` on GitHub and publish notes from [CHANGELOG.md](CHANGELOG.md).
