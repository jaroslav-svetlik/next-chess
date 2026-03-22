# NextChess

NextChess is a real-time multiplayer chess platform built with Next.js for players who want fast pairing, clean UX, public profiles, rated play, and serious operational tooling behind the game.

This repository is the public alpha codebase behind the project. The goal is not just a chessboard demo, but a complete chess product with matchmaking, replay archive, moderation, anti-cheat signals, and infrastructure that can keep growing.

- Repository: [jaroslav-svetlik/next-chess](https://github.com/jaroslav-svetlik/next-chess)
- Live site: [nextchess.org](https://nextchess.org)
- Current version: `0.6.15`
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Platform plan: [docs/chess-platform-plan.md](./docs/chess-platform-plan.md)
- Release process: [docs/release-process.md](./docs/release-process.md)

## Live Demo

You can try the current public alpha here:

- Demo URL: [https://nextchess.org](https://nextchess.org)

What you can already test there:

- quick pair and lobby flow
- guest and registered account play, including live guest matchmaking on production
- arena chat for both guests and registered users during alpha, with admin guest-chat override
- public leaderboard and player profiles
- replay archive and PGN review
- admin and moderation tooling once admin access is configured

## Why This Project

Many chess side projects stop at "move pieces on a board." NextChess is being built around the full product surface:

- instant play from the home screen
- separate guest and registered ecosystems
- guest arena chat during alpha with admin-controlled anonymous posting
- server-authoritative gameplay and clock rules
- public usernames, profiles, ladders, and replay pages
- moderation and anti-cheat foundations
- admin tooling for analytics, investigations, and operations

## Highlights

### Gameplay

- Bullet, blitz, rapid, and custom time controls
- Drag-and-drop board with on-board promotion
- Premoves, arrows, square marks, and check indicators
- Opening timeout handling for dead-start games
- Replay archive with move-by-move review and autoplay

### Competitive Layer

- Rated and casual flows
- Elo ratings for bullet, blitz, and rapid
- Public leaderboard
- Username-based public profiles
- Paginated player game history
- PGN review and replay archive pages

### Realtime and Infrastructure

- WebSocket live updates for lobby and games
- Shared PostgreSQL notify broker
- Background worker for deadlines and engine-review jobs
- Versioned game patches and lighter lobby deltas
- Structured observability for game lifecycle, matchmaking, reconnects, and move latency

### Trust, Safety, and Admin

- Telemetry-based anti-cheat signals
- Stockfish-backed post-game review pipeline
- Account-level moderation states and recommendation queue
- Admin search, game explorer, head-to-head explorer, and abuse-pattern tooling
- CSV exports and period-based analytics

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Better Auth
- Prisma + PostgreSQL
- `ws` WebSocket server
- `chess.js` for authoritative move validation
- Stockfish for engine analysis

## Local Development

### Requirements

- Node.js 24+
- PostgreSQL
- npm

### Environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Core variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `ADMIN_EMAILS`

Optional/local-only variables:

- `DEV_AUTH_BYPASS`
- `NEXT_PUBLIC_DEV_AUTH_BYPASS`
- `ABLY_API_KEY`

### Setup

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

Start the background worker in a second terminal:

```bash
npm run worker
```

Useful commands:

```bash
npm run typecheck
npm run build
```

Prisma v7 note: CLI datasource config lives in `prisma.config.ts`.

## Project Structure

```text
app/            Next.js routes, public pages, admin pages, API routes
components/     UI components for gameplay, home, auth, admin, and replay
lib/            Domain logic: games, realtime, moderation, anti-cheat, public data
prisma/         Prisma schema
public/         Static branding and chess assets
scripts/sql/    SQL patches for schema evolution
docs/           Product planning and release process notes
```

## Current Scope

The public alpha already includes:

- quick pair, lobby, and waiting-room flow
- guest play and registered account play
- shared arena chat for guests and registered users, with admin guest-posting toggle
- separate matchmaking pools for guests and registered users
- public usernames, profiles, leaderboard, and archive replay
- WebSocket live sync
- deterministic background deadline jobs
- Elo ratings
- anti-cheat and moderation foundations
- admin analytics and investigation tooling

## Roadmap

Near-term priorities:

- stronger replay and analysis UX
- deeper player statistics and rating history
- stronger production-grade broker and queue infrastructure
- more mature moderation automation
- public beta polish across mobile, onboarding, and game feel

## Sponsorship

NextChess is being built as a serious open product, not a throwaway prototype. Sponsorship would directly accelerate:

- infrastructure and scaling work
- stronger anti-cheat and review systems
- better game and replay UX
- public beta readiness

If you want to support the project, collaborate, or sponsor development:

- watch the repository: [github.com/jaroslav-svetlik/next-chess](https://github.com/jaroslav-svetlik/next-chess)
- open an issue with ideas or feedback
- reach out through the maintainer profile: [github.com/jaroslav-svetlik](https://github.com/jaroslav-svetlik)

## Status

NextChess is currently in public alpha and now running live at [nextchess.org](https://nextchess.org). The codebase is active and moving fast while the gameplay, platform, and infrastructure layers are being hardened together.
