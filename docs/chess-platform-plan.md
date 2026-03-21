# NextChess Platform Plan

## 1. Document Purpose

This document is no longer a pre-build MVP plan. It is the working platform plan for a product that is already live in public alpha.

Its purpose is to:

- describe the real current state of the application
- separate what is already shipped from what is still planned
- guide the next development phases without mixing wishlist items with existing features

The reference point for current state is `CHANGELOG.md`, together with the live codebase.

## 2. Current Platform Status

Status as of `2026-03-21`:

- public alpha is live on `nextchess.org`
- current runtime version is `0.6.5`
- the application is no longer a concept plan, but a functional multiplayer chess platform with admin and trust/safety foundations

## 3. What Is Already Implemented

### 3.1 Core Gameplay

- registration and login through `Better Auth`
- guest play and registered-account play in production
- separate guest and account matchmaking pools
- quick pair with preset time controls
- full lobby with create and join flow
- public and private game creation
- server-authoritative game lifecycle
- server-side move validation through `chess.js`
- backend-authoritative clock and timeout handling
- resign flow
- waiting, active, finished, and cancelled game states
- reconnect and presence signaling in the game room

### 3.2 In-Game UX

- drag-and-drop board
- on-board promotion flow
- premove queue
- arrows and marked squares
- last-move highlight
- check indicator
- captured-piece display
- move list inside the game room
- gameplay sound effects

### 3.3 Home, Lobby, and Discovery Surface

- home arena shell with quick pair and live lobby preview
- live open-games list with realtime updates
- quick entry into games from the home screen
- dedicated `/lobby` screen for deeper create/join control
- correspondence tab placeholder exists in the UI, but the feature is not implemented yet

### 3.4 Public Competitive Surface

- username-first public identity
- public leaderboard
- public player pages
- finished-game history with filters
- replay/archive pages for finished games
- PGN and move-by-move replay review
- rating snapshot for bullet, blitz, and rapid

### 3.5 Chat, Moderation, and Admin

- arena chat on the home screen
- guest arena chat enabled during alpha
- admin toggle for enabling or disabling guest chat posting
- account moderation statuses (`CLEAN`, `OBSERVE`, `WATCH`, `REVIEW`, `RESTRICTED`)
- rated/casual access restrictions based on moderation state
- admin overview, search, competitive, moderation, anti-cheat, and activity workspaces
- moderation history and user detail pages
- CSV export for moderation data

### 3.6 Anti-Cheat and Review Pipeline

- per-move client telemetry signals
- focus-loss and blur telemetry
- heuristic anti-cheat scoring
- per-game review summary payloads
- background jobs for engine review and deadline handling
- Stockfish-backed post-game analysis pipeline

### 3.7 Realtime and Infrastructure

- custom WebSocket transport through `/ws`
- shared realtime broker through PostgreSQL `LISTEN/NOTIFY`
- realtime updates for the lobby and game room
- background worker model for asynchronous jobs
- observability layer for lifecycle and failure logging

## 4. What Is Still Missing

These are important product boundaries that the plan needs to state clearly:

- correspondence chess is not implemented yet
- dedicated settings/profile management does not exist yet
- rematch flow is not shipped yet
- draw offer / draw response flow is not shipped yet
- in-game chat is not shipped yet
- a full spectator product is not complete as a dedicated feature set
- tournament / arena competition systems are not shipped yet
- friends, parties, clans, and broader social graph features do not exist
- puzzles and bot play do not exist
- deeper analysis UX and rating-history visualizations are not complete

## 5. Product Positioning Today

NextChess is not "an MVP that still needs a chessboard."

A more accurate description is:

- a public alpha multiplayer chess product
- with working realtime gameplay
- with separate guest and account onboarding paths
- with a public competitive surface
- with admin and anti-cheat foundations
- with infrastructure that already runs in production

Because of that, the next phases should not be planned as "foundation work," but as:

- hardening the existing system
- deepening gameplay and replay quality
- expanding retention and social value
- strengthening production operations

## 6. Architectural Principles That Stay Fixed

### 6.1 Server-Authoritative Gameplay

This remains non-negotiable:

- the client sends intent
- the server validates move legality and actor permissions
- the server computes canonical game state and time
- only then is state broadcast to clients

The client is never the source of truth for:

- move legality
- turn ownership
- the clock
- game result

### 6.2 Realtime Direction

The active stack is no longer an Ably-oriented plan.

The current direction is:

- `ws` WebSocket server for browser connections
- PostgreSQL `LISTEN/NOTIFY` as the shared cross-process signaling layer
- server snapshot plus patch update flow for lobby and game state

Future realtime work should improve this model, not document the product as if the base transport is still undecided.

### 6.3 Trust and Safety by Default

New features should not be added without answering these questions:

- how they will be moderated
- how they will be audited
- how abuse will be limited
- how they change guest onboarding and spam surface area

This is especially important for:

- chat features
- social features
- spectator and correspondence flows
- rematch and invite mechanics

## 7. Current Route and Module Map

### 7.1 Public Routes

```text
/
/auth/login
/auth/register
/lobby
/game/[gameId]
/archive/[gameId]
/leaderboard
/players/[userId]
```

### 7.2 Admin Routes

```text
/admin
/admin/search
/admin/competitive
/admin/moderation
/admin/anti-cheat
/admin/activity
/admin/users/[userId]
/admin/games/[gameId]
/admin/head-to-head/[leftUserId]/[rightUserId]
```

### 7.3 Active API Surface

```text
/api/auth/[...all]
/api/auth/username
/api/lobby
/api/games
/api/games/[gameId]
/api/games/[gameId]/join
/api/games/[gameId]/move
/api/games/[gameId]/resign
/api/games/[gameId]/presence
/api/matchmaking/quick-pair
/api/chat/arena
/api/events/lobby
/api/events/games/[gameId]
/api/admin/settings/guest-chat
/api/admin/users/[userId]/moderation
/api/admin/export/moderation
/api/health
```

## 8. Actual Technical Stack

- `Next.js` App Router
- `TypeScript`
- `Tailwind CSS`
- `Better Auth`
- `Prisma`
- `PostgreSQL`
- `ws`
- `chess.js`
- `Stockfish`

Note:

- the previous version of this document proposed `Ably` as the primary realtime direction
- that no longer matches the real codebase
- documentation should follow the current implementation, not an outdated architecture evaluation

## 9. Next Development Phases

### Phase A: Public Beta Hardening

Goal:

- make the existing alpha product more stable, clearer, and more ready for broader traffic

Scope:

- additional copy cleanup, onboarding clarity, and empty-state UX polish
- stronger mobile polish across home, lobby, game, and archive surfaces
- clearer failure states for reconnect, join conflict, and timeout scenarios
- replay and game-result presentation polish
- README, docs, and release discipline aligned with the real state of the app

### Phase B: Gameplay Completeness

Goal:

- close the most visible gaps in the live game experience

Planned features:

- draw offer / accept / decline flow
- rematch flow after finished games
- better spectator behavior and spectator-specific UI states
- stronger private invite flow and sharing UX
- additional waiting-room and post-game action polish

### Phase C: Replay and Analysis Depth

Goal:

- make finished games more valuable after the live session ends

Planned features:

- richer replay controls
- engine-review presentation in both public and admin contexts
- move-quality breakdown
- openings, accuracy, and critical-moment surface
- export and analysis affordances that are useful to serious players

### Phase D: Player Progression

Goal:

- make profiles and the competitive layer more valuable over time

Planned features:

- rating-history charts
- deeper statistics by format and time range
- streaks, volume, activity, and result breakdowns
- profile polish and eventual settings/profile management
- stronger public identity surface around username, avatar, and profile presentation

### Phase E: Trust, Safety, and Moderation Automation

Goal:

- reduce manual admin burden as the user base grows

Planned features:

- stronger anti-cheat heuristics
- better review queue prioritization
- broader audit trail for critical actions
- moderation automation and recommendation-quality improvements
- expanded chat-safety controls if guest arena chat remains open

### Phase F: Correspondence and Asynchronous Play

Goal:

- open a new retention mode without weakening the live gameplay core

Planned features:

- correspondence game lifecycle
- separate clock and turn-window rules
- inbox and waiting states for slower games
- profile and history integration for asynchronous play

Note:

- correspondence is not a small add-on
- it should be built as its own lifecycle, not as a minor extension of the live queue

## 10. Medium-Term Backlog

These items make sense after the phases above, but are not on the immediate critical path:

- in-game chat
- friends / follow / lightweight social graph
- notifications
- tournament / arena systems
- clubs or seasonal competition structures
- bot play
- puzzles and training mode
- stronger deploy and queue infrastructure beyond the current alpha scope

## 11. Priority Order

If priorities conflict, the order should be:

1. live gameplay stability and data integrity
2. public beta polish and onboarding clarity
3. replay / analysis / player-value improvements
4. moderation and anti-cheat strengthening
5. new modes and social expansion

## 12. Practical Definition of "Real State"

The next time this document is updated, changes should be driven by:

- `CHANGELOG.md`
- real routes and APIs
- the Prisma model and background job layer
- features that users can actually click and use

This document should not drift back into pre-implementation product ideation.

