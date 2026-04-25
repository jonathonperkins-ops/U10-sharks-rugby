# RugbyApp — Claude Project Notes

## Project
U10 Whitetip Sharks rugby team management app. Vanilla Node.js (`server.js`) serving a static HTML page (`whitetip-sharks-v5.html`) plus an `api/` folder.

## Coding standards
When working in this repo, follow the standards under [.claude/rules/](.claude/rules/):
- [.claude/rules/common/](.claude/rules/common/) — general code-review, testing, security, git workflow
- [.claude/rules/web/](.claude/rules/web/) — frontend/web style, performance, security
- [.claude/rules/typescript/](.claude/rules/typescript/) — apply the JS-applicable subset (this project is vanilla JS, not TS)

## Tooling
Everything Claude Code (ECC) plugin is installed at project scope. Use `/ecc:plan`, `/code-review`, `/security-scan`, `/build-fix` as the primary commands.
