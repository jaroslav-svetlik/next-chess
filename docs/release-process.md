# Release Process

This document defines how versioning and release notes are handled for NextChess while the project remains in the alpha stage.

## 1. Sources of Truth

- runtime/app version: [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json)
- release history: [CHANGELOG.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/CHANGELOG.md)
- long-term platform direction: [docs/chess-platform-plan.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/docs/chess-platform-plan.md)

## 2. Current Versioning Model

While the project is still in `0.x`, use a practical semver-style approach:

- `0.x.0`
  - major milestone within alpha
  - meaningful new product capabilities
  - significant UX or architectural shift
- `0.x.y`
  - smaller release
  - bug fix
  - polish
  - smaller backend or UI improvement

Examples:

- `0.2.0` = ratings, admin, and anti-cheat foundation
- `0.2.1` = matchmaking, build, or UI regression fix
- `0.3.0` = next major milestone, such as public profiles, leaderboard, and game-history polish

## 3. When to Bump the Version

Increase the version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) when:

- a larger feature milestone is completed
- user-visible behavior changes
- schema or data flow changes in a release-relevant way
- a meaningful group of fixes is ready to be shipped together

Do not bump the version for every small local change before it is ready to be part of a meaningful milestone.

## 4. How to Update the Changelog

Every release should get a new section in [CHANGELOG.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/CHANGELOG.md).

Minimum structure:

- version and date
- short milestone summary
- `Added`
- `Changed`
- `Fixed`
- optional sections:
  - `Database`
  - `Admin / Ops`
  - `Anti-Cheat`
  - `Security`

Rules:

- write only the changes that actually matter
- group by outcome, not by every touched file
- do not use the changelog as a raw diary of commits
- if a fix is small and internal, fold it into the broader milestone

## 5. Suggested Release Rhythm

Recommended milestone bands:

- `0.2.x`
  - gameplay stabilization
  - anti-cheat foundation
  - admin analytics
- `0.3.x`
  - profile pages
  - leaderboard
  - richer game history
- `0.4.x`
  - moderation tools
  - stronger anti-cheat review
  - spectator / rematch / draw-controls polish
- `0.5.x`
  - realtime infrastructure hardening
  - background workers
  - deterministic clocks and reconnect reliability
- `0.6.x`
  - public alpha and beta-readiness preparation

## 6. Pre-Release Checklist

Before marking a new release:

1. update the version in `package.json`
2. update `CHANGELOG.md`
3. run `npm run build`
4. run `npm run typecheck`
5. if there are database changes:
   - confirm the schema and local database state are aligned
   - record important migration or index changes in the changelog
6. if the release touches admin, ops, moderation, or anti-cheat:
   - verify the `/admin` surface

## 7. Later, When Git Release Flow Is Formalized

Once the repository adopts a fuller Git-based release workflow, this document should be expanded with:

- branch strategy
- tag naming rules
- release tagging step
- deployment checklist
- rollback procedure

