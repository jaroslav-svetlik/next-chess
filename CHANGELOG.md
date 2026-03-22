# Changelog

All notable product and engineering changes for NextChess are tracked here.

Version source of truth:
- app/runtime version: [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json)
- human release history: this file

The project is still in `0.x`, so versions represent active alpha milestones and can change quickly.

## [0.6.14] - 2026-03-22

Production hotfix focused on stopping live-board selection resets during the opening move.

### Fixed

- updated [components/game/game-room-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/game/game-room-shell.tsx) so `currentPlayerColor` and `legalMoves` stay stable across benign presence/realtime updates, and the room-presence heartbeat no longer tears down and recreates itself on every game snapshot; this prevents first-move piece selection from being instantly cleared as if the board were constantly refreshing underneath the player

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.14`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.13] - 2026-03-22

Production hotfix focused on restoring move input for newly started live games.

### Fixed

- updated [components/game/game-room-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/game/game-room-shell.tsx) so the board now preserves and prefers the authenticated player's `currentPlayerColor` across initial loads, local action responses, and realtime full-snapshot replacements, preventing fresh live games from dropping into an accidental spectator state where pieces could not be moved

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.13`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.12] - 2026-03-22

Production hotfix focused on restoring lobby creation and quick pairing after the waiting-room lifecycle release.

### Fixed

- updated [lib/background-jobs.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/background-jobs.ts) so raw `BackgroundJob` inserts now explicitly write `createdAt` and `updatedAt`, fixing the production `23502 null value in column "updatedAt"` failure that was breaking both `New lobby` and `Quick pairing` as soon as a waiting-room expiry job was scheduled

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.12`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.11] - 2026-03-22

Patch release focused on strengthening the registration password flow and making the password UX more explicit.

### Added

- added [lib/password.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/password.ts) with shared strong-password validation, strength scoring, and secure password generation so the registration flow uses one consistent password policy end to end

### Changed

- updated [components/auth/auth-form.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/auth-form.tsx) and [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so registration now offers `Generate strong password`, a more colorful password-strength meter, clearer inline guidance, and an explicit confirmation step that requires the user to confirm the password has been saved before the account is created
- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.11`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

### Security

- updated [lib/auth.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/auth.ts) so the Better Auth sign-up endpoint now rejects weak passwords server-side too, preventing bypasses of the client-only registration UI

## [0.6.10] - 2026-03-22

Production hotfix focused on restoring the waiting-room worker after the `0.6.9` lifecycle release.

### Fixed

- updated [lib/games.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/games.ts) to use worker-safe relative imports internally, so the production `npm run worker` runtime can load the waiting-room expiry path without failing on unresolved `@/lib/...` aliases

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.10`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.9] - 2026-03-22

Patch release focused on making live lobby seeks ephemeral for both guest and registered users.

### Fixed

- updated [lib/games.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/games.ts), [lib/game-presence.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/game-presence.ts), [worker.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/worker.ts), [lib/background-jobs.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/background-jobs.ts), and [lib/game-timing.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/game-timing.ts) so waiting public tables now behave like ephemeral seeks: host presence is tracked server-side, stale hosts are removed from the lobby immediately, and disconnected waiting rooms are auto-cancelled after a short grace period instead of lingering as dead tables
- updated [components/game/game-room-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/game/game-room-shell.tsx) so waiting rooms send periodic presence heartbeats and show a clearer stale-host state while the backend is cleaning up an abandoned seek
- updated [app/api/games/route.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/api/games/route.ts) and [app/api/matchmaking/quick-pair/route.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/api/matchmaking/quick-pair/route.ts) so one actor can no longer accumulate multiple live open tables or queues at the same time; existing live rooms are reused and conflicting requests are rejected cleanly
- updated [prisma/schema.prisma](/Users/jaroslavsvetlik/Documents/NextJS/chess/prisma/schema.prisma) and added [scripts/sql/add_waiting_room_presence.sql](/Users/jaroslavsvetlik/Documents/NextJS/chess/scripts/sql/add_waiting_room_presence.sql) so player presence now persists `lastSeenAt`, giving the worker an authoritative signal for waiting-room expiry

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.9`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.8] - 2026-03-21

Production cache and realtime hotfix focused on preventing stale page shells and noisy websocket failures.

### Fixed

- updated [app/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/page.tsx) and [app/lobby/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/lobby/page.tsx) to `force-dynamic`, so the home and lobby shells are no longer served as long-lived static HTML and production can pick up fresh client bundles after deploys instead of holding on to stale guest-matchmaking code
- updated [lib/use-realtime-channel.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/use-realtime-channel.ts) so websocket errors no longer force `close()` during the initial connecting phase, removing the browser-side `WebSocket is closed before the connection is established` noise caused by the client itself

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.8`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.7] - 2026-03-21

Production guest-matchmaking hotfix focused on resilient guest identity transport.

### Fixed

- updated [lib/dev-auth.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/dev-auth.ts) with a shared guest-query helper, then wired [components/home/home-arena-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/home-arena-shell.tsx), [components/lobby/lobby-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/lobby/lobby-shell.tsx), [components/home/arena-chat-panel.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/arena-chat-panel.tsx), and [components/game/game-room-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/game/game-room-shell.tsx) so guest identity now travels in the request URL as well as headers, preventing production guest flows from failing when custom headers are stripped or dropped

### Changed

- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.7`, updated the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and refreshed the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md)

## [0.6.6] - 2026-03-21

Documentation release focused on making release docs consistent and English-only.

### Changed

- rewrote [docs/chess-platform-plan.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/docs/chess-platform-plan.md) so it reflects the real current NextChess product state, keeps the document entirely in English, and separates shipped scope from future phases
- rewrote [docs/release-process.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/docs/release-process.md) into English-only release guidance aligned with the current NextChess naming and release model
- synced release metadata by bumping [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.6`, updating the root package version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), refreshing the reported version in [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md), and keeping the changelog in latest-first order

## [0.6.5] - 2026-03-21

Patch release focused on removing Serbian UI copy from the app.

### Changed

- replaced remaining Serbian user-facing strings in [components/lobby/lobby-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/lobby/lobby-shell.tsx), [app/auth/login/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/auth/login/page.tsx), [app/auth/register/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/auth/register/page.tsx), and [app/game/[gameId]/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/game/[gameId]/page.tsx) with English-only copy
- synced release metadata by bumping [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to `0.6.5`, updating the root package identity/version in [package-lock.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package-lock.json), and recording this patch in the changelog

## [0.6.4] - 2026-03-21

Production guest-chat release focused on anonymous arena chat and admin guest-posting control.

### Changed

- added an `AppSetting` model in [prisma/schema.prisma](/Users/jaroslavsvetlik/Documents/NextJS/chess/prisma/schema.prisma), plus [lib/site-settings.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/site-settings.ts) and [scripts/sql/add_app_settings_schema.sql](/Users/jaroslavsvetlik/Documents/NextJS/chess/scripts/sql/add_app_settings_schema.sql), so runtime feature flags can be stored in the database instead of being hardcoded
- updated [app/api/chat/arena/route.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/api/chat/arena/route.ts) so arena chat now returns the guest-posting policy in its payload and blocks anonymous posting only when the admin toggle disables it
- updated [components/home/arena-chat-panel.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/arena-chat-panel.tsx) and [components/home/home-arena-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/home-arena-shell.tsx) so guests can post in arena chat during alpha, see a clear disabled state when anonymous posting is turned off, and receive live chat-settings updates
- added [app/api/admin/settings/guest-chat/route.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/api/admin/settings/guest-chat/route.ts) and [components/admin/guest-chat-controls.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/guest-chat-controls.tsx), then wired them into [app/admin/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/page.tsx), so admins can explicitly enable or disable guest arena chat without redeploying
- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) and refreshed [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md) to reflect production guest chat support and the admin override

## [0.6.3] - 2026-03-21

Production guest-play release focused on real anonymous matchmaking outside development.

### Changed

- changed guest identity transport in [lib/dev-auth.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/dev-auth.ts) from dev-only bypass headers to stable browser guest headers so guest requests work in production too
- updated [lib/request-actor.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/request-actor.ts) so anonymous guests are recognized in production through `GuestIdentity` instead of only through the old development bypass flow
- updated guest-facing copy in [components/lobby/lobby-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/lobby/lobby-shell.tsx) to describe real guest mode instead of development-only behavior
- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) and refreshed [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md) to reflect live guest matchmaking support

## [0.6.2] - 2026-03-21

Documentation release focused on clearer public demo visibility.

### Changed

- updated [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md) to call out the live demo URL `https://nextchess.org` near the top of the repository page
- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to reflect the public README refresh

## [0.6.1] - 2026-03-21

Production deployment release focused on the first live server rollout.

### Changed

- deployed NextChess live to `https://nextchess.org` with a PostgreSQL-backed production environment, systemd-managed web/worker services, and aaPanel nginx reverse proxy
- updated [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md) with the live-site link and production-status note
- bumped the runtime version in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) to reflect the first production deployment milestone

## [0.6.0] - 2026-03-21

Public repository preparation release focused on GitHub readiness and project presentation.

### Changed

- renamed the local package identity in [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) from `chess` to `nextchess` and bumped the app version for the public-repo milestone
- rewrote [README.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/README.md) into a public-facing overview with clearer product positioning, setup, architecture, roadmap, and sponsorship sections
- expanded [.gitignore](/Users/jaroslavsvetlik/Documents/NextJS/chess/.gitignore) to cover additional local-only environment files, build artifacts, editor files, and runtime clutter before publishing the repo

## [0.5.28] - 2026-03-21

Patch release focused on the home column balance.

### Changed

- adjusted the home arena layout in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) from an even split to a `60 / 40` ratio in favor of the pairing workspace

## [0.5.27] - 2026-03-21

Patch release focused on restoring a balanced home split.

### Changed

- changed the home arena layout in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) to a clean `50 / 50` split between the pairing workspace and the arena chat
- removed the extra right-bias on the left home panel in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so both columns sit evenly in the page shell

## [0.5.26] - 2026-03-21

Patch release focused on username-based public identity.

### Changed

- added explicit username validation helpers in [lib/username.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/username.ts) and a username availability endpoint in [app/api/auth/username/route.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/api/auth/username/route.ts)
- changed registration in [components/auth/auth-form.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/auth-form.tsx) to require a unique username, precheck availability, and show a clear error when the username is taken
- updated register copy in [app/auth/register/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/auth/register/page.tsx) to reflect username-first identity
- switched public player routing and public identity lookups to username-first slugs in [lib/public.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/public.ts), [app/players/[userId]/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/players/[userId]/page.tsx), [app/leaderboard/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/leaderboard/page.tsx), and [components/auth/header-auth-controls.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/header-auth-controls.tsx)
- updated arena chat payload/render in [lib/arena-chat.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/arena-chat.ts) and [components/home/arena-chat-panel.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/arena-chat-panel.tsx) so registered users link to username-based public profiles

## [0.5.25] - 2026-03-21

Patch release focused on arena chat profile linking.

### Changed

- made registered-account usernames in the arena chat clickable and routed them to public player profiles in [components/home/arena-chat-panel.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/arena-chat-panel.tsx)
- added a lightweight chat-author link treatment in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so profile links stay readable without looking noisy

## [0.5.24] - 2026-03-21

Patch release focused on a calmer home-page layout.

### Changed

- narrowed the left home workspace and expanded the live chat column in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so quick pairing and chat sit in a more balanced two-column layout
- reduced home tab copy and preset-card visual weight in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) for a more minimal front page
- made the arena chat panel taller and structurally steadier in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so the chat feed occupies more of the page instead of feeling cramped

## [0.5.23] - 2026-03-21

Patch release focused on unifying front-page CTA styling.

### Changed

- extended the clean translucent CTA treatment in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) so front-facing action buttons no longer depend on the stronger gradient primary style
- updated signed-in header and mobile lobby-entry actions in [components/auth/header-auth-controls.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/header-auth-controls.tsx) to match the quieter translucent CTA language
- switched public join/create/play entry actions in [components/lobby/lobby-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/lobby/lobby-shell.tsx), [components/lobby/open-games-list.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/lobby/open-games-list.tsx), [components/game/game-room-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/game/game-room-shell.tsx), and [components/home/home-arena-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/home-arena-shell.tsx) to the same minimal translucent look

## [0.5.22] - 2026-03-20

Patch release focused on the front-header primary CTA styling.

### Changed

- switched the signed-in `Play now` header action to the same cleaner translucent treatment as the auth CTA in [components/auth/header-auth-controls.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/header-auth-controls.tsx)

## [0.5.21] - 2026-03-20

Patch release focused on a cleaner admin workspace UI.

### Changed

- rebuilt the admin shell in [components/admin/admin-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/admin-shell.tsx) into a quieter, slimmer workspace with less visual noise and a clearer current-context treatment for explorer routes
- reworked the shared admin surface and dense row styling in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) to feel more like a compact operations tool than a glass-card marketing screen
- simplified the admin overview in [app/admin/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/page.tsx) with a tighter KPI strip and cleaner workspace shortcuts
- converted key admin workspaces to denser table-style layouts in [app/admin/search/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/search/page.tsx), [app/admin/moderation/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/moderation/page.tsx), [app/admin/anti-cheat/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/anti-cheat/page.tsx), [app/admin/activity/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/activity/page.tsx), and [components/admin/recommendation-queue.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/recommendation-queue.tsx)
- aligned competitive leaderboard cards with the new dense admin style in [components/admin/admin-primitives.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/admin-primitives.tsx) and [app/admin/competitive/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/competitive/page.tsx)

## [0.5.20] - 2026-03-20

Patch release focused on deeper admin minimalism.

### Changed

- narrowed the admin sidebar and removed descriptive copy from navigation items in [components/admin/admin-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/admin-shell.tsx)
- reduced the admin overview to a smaller KPI set and compact shortcut-focused layout in [app/admin/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/page.tsx)
- converted admin search and moderation result lists into denser row-based layouts in [app/admin/search/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/search/page.tsx) and [app/admin/moderation/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/moderation/page.tsx)
- tightened admin spacing and panel density in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css)

## [0.5.19] - 2026-03-20

Patch release focused on admin IA and minimalist layout.

### Changed

- split the admin workspace into dedicated routes for overview, search, competitive, moderation, anti-cheat and activity
- replaced the previous one-page admin dashboard flow with route-based navigation in [components/admin/admin-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/admin-shell.tsx)
- introduced a shared admin route shell in [app/admin/layout.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/layout.tsx)
- rebuilt the main admin overview in [app/admin/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/page.tsx) as a compact entry screen instead of a long section stack
- added dedicated pages for [app/admin/search/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/search/page.tsx), [app/admin/competitive/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/competitive/page.tsx), [app/admin/moderation/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/moderation/page.tsx), [app/admin/anti-cheat/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/anti-cheat/page.tsx), and [app/admin/activity/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/activity/page.tsx)
- tightened admin spacing, sidebar density and panel styling in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) for a more minimal tool-like feel

## [0.5.18] - 2026-03-20

Patch release focused on admin IA and navigation.

### Changed

- introduced a dedicated admin shell with grouped sidebar navigation in [app/admin/layout.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/layout.tsx) and [components/admin/admin-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/admin/admin-shell.tsx)
- regrouped the main dashboard into clearer search, overview, competitive, moderation, anti-cheat and activity sections on [app/admin/page.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/admin/page.tsx)
- aligned admin detail pages with the shared shell and cleaned up their page wrappers
- added a broader admin styling pass in [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css) for sidebar navigation, section headers and responsive layout behavior

## [0.5.17] - 2026-03-20

Patch release focused on header auth CTA styling.

### Changed

- replaced the gradient header `Get started` / account-creation CTA treatment with a cleaner translucent style in [components/auth/header-auth-controls.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/auth/header-auth-controls.tsx) and [app/globals.css](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/globals.css)

## [0.5.16] - 2026-03-20

Patch release focused on refreshing the bundled header logo asset.

### Changed

- replaced [public/branding/nextchess-logo.png](/Users/jaroslavsvetlik/Documents/NextJS/chess/public/branding/nextchess-logo.png) with the newer version provided in `Downloads`

## [0.5.15] - 2026-03-20

Patch release focused on using the full header logo asset.

### Changed

- switched the header brand presentation back to the full original `nextchess-logo.png` wordmark instead of the cropped icon treatment
- increased the header brand slot so the full logo displays at a readable size

## [0.5.14] - 2026-03-20

Patch release focused on header logo visibility.

### Changed

- reworked the header logo rendering so the full knight mark is visible and scaled larger without clipping

## [0.5.13] - 2026-03-20

Patch release focused on eliminating home chat hydration drift.

### Fixed

- delayed rendering of the live arena chat panel until client mount in [components/home/home-arena-shell.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/home-arena-shell.tsx), removing the remaining SSR hydration mismatch surface from the home page

## [0.5.12] - 2026-03-20

Patch release focused on home page hydration stability.

### Fixed

- resolved the home arena chat hydration mismatch by keeping the composer disabled until the client mount completes in [components/home/arena-chat-panel.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/components/home/arena-chat-panel.tsx)

## [0.5.11] - 2026-03-20

Patch release focused on header logo scale.

### Changed

- increased the compact header logo size so the NextChess knight mark reads more clearly in the top bar

## [0.5.10] - 2026-03-20

Patch release focused on header logo fit.

### Changed

- reduced the header branding to a compact knight-only mark instead of the full stretched logo wordmark
- adjusted header logo cropping and sizing so the brand icon no longer appears stretched

## [0.5.9] - 2026-03-20

Patch release focused on branding integration.

### Added

- bundled the provided `nextchess-logo.png` asset under [public/branding/nextchess-logo.png](/Users/jaroslavsvetlik/Documents/NextJS/chess/public/branding/nextchess-logo.png)

### Changed

- replaced the text-only header brand with the provided NextChess logo in [app/layout.tsx](/Users/jaroslavsvetlik/Documents/NextJS/chess/app/layout.tsx)
- updated visible app branding and player fallback labels from `Grandmate` to `NextChess`

## [0.5.8] - 2026-03-20

Patch release focused on local worker runtime compatibility.

### Fixed

- local `npm run worker` now starts again after the replay/profile changes by using worker-safe relative imports in [lib/realtime-snapshots.ts](/Users/jaroslavsvetlik/Documents/NextJS/chess/lib/realtime-snapshots.ts)

## [0.5.7] - 2026-03-20

Patch release focused on replay archive polish.

### Added

- replay autoplay controls in the public archive viewer
- PGN copy support and visible PGN block on archive pages
- current move indicator in the replay side panel

### Changed

- archive replay now behaves more like a real review board instead of a static move-step utility
- replay controls now support continuous playback in addition to manual stepping

## [0.5.6] - 2026-03-20

Patch release focused on public player history and replay archive UX.

### Added

- paginated public finished-game history on player profile pages with format and rated/casual filters
- dedicated public archive route at `/archive/[gameId]`
- step-by-step replay viewer with first/prev/next/last controls, keyboard navigation and flip-board support

### Changed

- public profile pages now link each finished game directly into a replay page instead of showing history as a dead-end list
- profile history entries now include move counts and proper archive navigation affordances

### Fixed

- registered users can now inspect past games move by move instead of only seeing result metadata
- profile history is no longer capped as a simple static recent list with no way to browse deeper pages

## [0.5.5] - 2026-03-20

Patch release focused on matchmaking queue hardening and queue observability.

### Changed

- quick pair now reuses an already-active public game for the same actor instead of attempting to open a second matchmaking flow
- quick pair now reuses the actor's matching waiting queue when the requested control is the same, and rejects conflicting public queue attempts when a different queue is already open
- pairing logs now include queue wait time so the time spent waiting before a match is visible in observability output

### Fixed

- one actor can no longer silently accumulate multiple public matchmaking queues with different controls
- duplicate quick-pair clicks now resolve back to the existing queue or active game instead of creating more room churn
- queue conflict cases now return a clear `409` response with a useful message instead of an opaque generic failure

## [0.5.4] - 2026-03-20

Patch release focused on lobby deltas and WebSocket stream observability.

### Changed

- lobby realtime updates now use `upsert/remove` patch operations for normal create/join/finish/cancel flows instead of shipping the full waiting-game list on every event
- WebSocket messages now carry per-process `serverId` and `seq` metadata, and browser clients now send ack packets back over the same socket
- server-side WS runtime now logs ack events so the stream can be traced end-to-end in development and ops logs

### Fixed

- home landing and lobby clients no longer depend on whole-list lobby snapshots for regular room churn
- regular lobby activity now produces much smaller WS payloads than the previous snapshot list fan-out
- realtime stream debugging no longer depends only on publish-side logs; delivery acknowledgements are now visible too

## [0.5.3] - 2026-03-20

Patch release focused on versioned game delta delivery and thinner system-event fan-out.

### Changed

- game snapshots now carry a version token so realtime clients can detect stale or out-of-order patches
- regular move broadcasts now use a `move_delta` patch instead of sending a full game snapshot on every move
- deadline and moderation state changes now publish a lightweight `state_patch` instead of relying on the generic fallback game snapshot fetch

### Fixed

- hot game traffic no longer ships a full board snapshot for every normal move when the client already has the previous version
- deadline abort/timeout and moderation enforcement no longer depend on the generic `publishGameUpdate()` snapshot read path to refresh the room
- game room now falls back to a targeted reload only when a patch version does not match the local version, instead of always refetching

## [0.5.2] - 2026-03-20

Patch release focused on removing the remaining avoidable realtime and move-path overhead.

### Changed

- home landing page now consumes lobby WebSocket snapshots directly instead of refetching `/api/lobby` on each `lobby_update`
- game presence updates now publish a small realtime patch payload so connection-state changes no longer force an extra game snapshot read
- `submitMove` now uses an optimistic turn/fen guard inside a lighter `ReadCommitted` transaction instead of relying on a full `Serializable` transaction per move

### Fixed

- landing traffic no longer keeps a separate stale refetch loop from the optimized lobby/game room clients
- player connect/disconnect transitions no longer trigger unnecessary snapshot fetches through the generic realtime publisher
- per-move write conflicts are now handled through guarded state transitions plus retry/conflict mapping rather than the heaviest transaction isolation level

## [0.5.1] - 2026-03-20

Patch release focused on reducing realtime refetch churn and trimming the hottest move path.

### Changed

- game WebSocket updates now carry a generic game snapshot so room clients no longer do a full `/api/games/[gameId]` refetch on every regular move/join/create update
- lobby WebSocket updates now carry the waiting-game snapshot list so lobby clients no longer re-request `/api/lobby` on every regular lobby event
- game room now derives actor-specific state such as `currentPlayerColor`, `canJoin`, `isHost` and legal moves on the client from the shared snapshot
- lobby view now derives `canJoin` on the client from actor state and generic lobby entries instead of requiring actor-specific server push payloads

### Fixed

- move creation no longer depends on `existing.moves.length` from a limited include when calculating the next `ply`
- `submitMove` now reads a lighter transaction-state shape before writing the authoritative update, instead of pulling the heavier detail snapshot into the serializable transaction

## [0.5.0] - 2026-03-20

Minor release focused on multi-process game infrastructure and ops resilience.

### Added

- PostgreSQL-backed background job system for deterministic game deadlines and deferred engine review
- dedicated `worker.ts` runtime and `npm run worker` entry for background processing
- local SQL schema script at `scripts/sql/add_background_jobs_schema.sql`
- structured observability logging for jobs, matchmaking, move latency, realtime transport and presence transitions
- player presence sync endpoint at `/api/games/[gameId]/presence`

### Changed

- shared realtime fan-out now uses PostgreSQL `LISTEN/NOTIFY` instead of in-memory-only broker state
- opening window enforcement now runs through the same persistent deadline scheduler used for game clocks
- rated engine analysis scheduling now persists into the job queue instead of relying on same-process `setTimeout`
- reconnect flow now updates server-side player presence and publishes live connection-state refreshes into the game room
- local dev/runtime instructions now require running both the app server and the background worker

### Fixed

- active games no longer depend on one Node process keeping timeout state in memory
- engine review no longer disappears after process restarts or when the finishing request process exits
- local worker runtime now resolves TypeScript server modules correctly with explicit `.ts` imports and strip-types execution

## [0.4.1] - 2026-03-20

Patch release focused on fully separating guest and registered matchmaking pools.

### Changed

- guest players can now join only guest-hosted games
- registered accounts can now join only registered-account games
- quick-pair matchmaking now searches only within the caller's own pool

### Fixed

- cross-pool guest-vs-account pairings are now blocked both in lobby join flow and in quick-pair matching

## [0.4.0] - 2026-03-20

Minor release focused on separating guest identities from the real account lifecycle.

### Added

- dedicated `GuestIdentity` data model for anonymous play
- local SQL migration script at `scripts/sql/add_guest_identity_schema.sql`
- dual game-participant support so games, seats and moves can belong to either a `User` or a `GuestIdentity`

### Changed

- anonymous play no longer creates `User` rows just to enter lobby, games and moves
- game serialization, matchmaking and move persistence now understand both registered and guest participants
- local PostgreSQL schema is now aligned with the new guest/account split

### Fixed

- guest users no longer open the same lifecycle, moderation surface or account analytics path as registered users

## [0.3.22] - 2026-03-20

Patch release focused on fully skipping anti-cheat and moderation for guest play.

### Changed

- guest games no longer create `anti_cheat_review` events
- guest games no longer enter engine-review scheduling or auto-observe moderation hooks
- guest accounts are now treated as casual runtime identities only, not moderation subjects

### Fixed

- anonymous play no longer generates moderation-side noise or background review work that should exist only for registered accounts

## [0.3.21] - 2026-03-20

Patch release focused on excluding guest accounts from persistent statistics.

### Changed

- public leaderboard now includes only registered accounts
- public player profiles are no longer available for guest identities
- admin user counts and top-player analytics now ignore guest accounts created by anonymous play

### Fixed

- temporary guest records no longer pollute persistent ladder and user-stat surfaces

## [0.3.20] - 2026-03-20

Patch release focused on stabilizing the public leaderboard layout.

### Fixed

- leaderboard table now renders inside its own responsive shell instead of breaking the full page layout
- public leaderboard grid now uses a softer main/sidebar split and avoids hard overflow from rating columns

### Changed

- leaderboard rows now keep a stable desktop table width with horizontal fallback instead of collapsing unpredictably
- profile and leaderboard panel containers now explicitly allow shrinking inside the content grid

## [0.3.19] - 2026-03-20

Patch release focused on public competitive surfaces.

### Added

- public `/leaderboard` page for bullet, blitz and rapid ladders
- public `/players/[userId]` profile page with rating snapshot and recent finished games
- direct leaderboard/profile navigation from the main header for signed-in users

### Changed

- Grandmate now exposes competitive and player-history surfaces outside the admin dashboard
- signed-in accounts can jump directly to their own public profile from the account menu

## [0.3.18] - 2026-03-20

Patch release focused on auth-session resilience in local development.

### Changed

- auth client now binds to the current browser origin instead of relying on implicit base-url behavior
- header and home session indicators now fall back gracefully instead of showing `Checking session...` indefinitely
- local Better Auth URL examples now match the dev server origin on `127.0.0.1`

### Fixed

- Chrome/dev cases where the UI could stay stuck on session-loading copy even though the rest of the app was available

## [0.3.17] - 2026-03-20

Patch release focused on pair-pattern abuse analytics.

### Added

- pair-pattern section on `/admin` for repeated opponents and fast-rematch clusters
- pair risk scoring based on repeated games, rated volume, reviewed games and short-gap rematches
- direct jump from suspicious pair cards to the head-to-head explorer

### Changed

- admin abuse review now has a pair-pattern overview above individual game and user inspections
- collusion-style investigation no longer depends only on manually discovering one pair at a time

## [0.3.16] - 2026-03-20

Patch release focused on pair-level moderation timeline.

### Added

- review-and-outcome timeline on head-to-head admin pages
- pair timeline entries for mutual-game anti-cheat reviews
- pair timeline entries for moderator outcomes affecting either account in the pair

### Changed

- head-to-head investigation now shows not just shared games, but also the sequence of flags and moderation decisions around that account pair
- moderators can jump from pair timeline entries directly to the related game or affected user

## [0.3.15] - 2026-03-20

Patch release focused on head-to-head admin investigation flow.

### Added

- `/admin/head-to-head/[leftUserId]/[rightUserId]` explorer page
- head-to-head summary stats for total games, rated games, wins, draws and reviewed matches
- direct head-to-head links from user reviewed-history cards and admin game explorer

### Changed

- moderators can now inspect the relationship between two accounts without manually piecing together their shared games
- user and game investigation flows now connect directly into opponent-pair history

## [0.3.14] - 2026-03-20

Patch release focused on admin game exploration.

### Added

- `/admin/games/[gameId]` explorer page for individual games
- game-level admin view for players, timing, result, moves, telemetry and recent game/review events
- direct `Open game` links from admin search results, suspicious review cards and recent finished games

### Changed

- moderators can now inspect a concrete game from the admin surface without switching to the public game route
- investigation workflow is now tighter between search, suspicious-game review and per-game inspection

## [0.3.13] - 2026-03-20

Patch release focused on admin search and filtering workflow.

### Added

- search form on `/admin` for users and games
- direct lookup by email, name, display name, user ID prefix, game ID prefix, invite code and result
- in-dashboard search result panels for matched accounts and matched games

### Changed

- moderators no longer need to rely only on top lists, queue cards or CSV exports to find a specific account or game
- admin dashboard now supports a practical query-driven workflow for investigations and support lookups

## [0.3.12] - 2026-03-20

Patch release focused on admin CSV exports.

### Added

- CSV export endpoint at `/api/admin/export/moderation`
- flagged-account export for the selected admin period
- moderation-outcomes export for the selected admin period
- direct export links on `/admin`

### Changed

- admin operations data can now be pulled out of the dashboard for external review, support workflows and moderation audits

## [0.3.11] - 2026-03-20

Patch release focused on time-window filtering for admin analytics.

### Added

- `7d / 30d / 90d` period filters on `/admin`
- selected-period filtering for registration trends, finished-game trends, format breakdown and result mix
- selected-period filtering for moderation funnel and outcome counters

### Changed

- admin dashboard KPI cards now show period-based new-user and finished-game counts instead of a hard-coded 7-day label
- admin analytics views now respond to a shared selected window instead of mixing fixed 7-day and 30-day slices

## [0.3.10] - 2026-03-20

Patch release focused on moderation analytics visibility.

### Added

- moderation funnel metrics on `/admin` for flagged accounts, queued recommendations, observe, watch/review and restricted states
- recent moderation outcomes feed on `/admin`
- 30-day moderation outcome counters for cleared accounts, false positives and confirmed cheats

### Changed

- admin operations dashboard now shows moderation flow progression instead of only raw risk and recommendation lists
- moderator outcomes are now visible from the main admin dashboard, not only inside per-user audit trails

## [0.3.9] - 2026-03-20

Patch release focused on making moderator outcomes suppress noisy repeat recommendations.

### Changed

- `account_cleared` and `false_positive_marked` now suppress fresh non-clean recommendations until newer flagged review signals arrive
- recommendation suppression logic is now shared between the admin dashboard and automatic observation policy
- user detail recommendation panel now explains when a recommendation is muted by a recent moderator outcome

### Fixed

- moderator resolutions previously still allowed the same recommendation to bounce back into the queue immediately
- queue suppression is no longer limited to `recommendation_dismissed` only

## [0.3.8] - 2026-03-20

Patch release focused on explicit moderator outcomes and faster case resolution.

### Added

- moderator quick actions for `Clear account`, `Mark false positive` and `Confirm cheat`
- dedicated moderation audit event types for account clearing, false-positive resolution and cheat confirmation
- stronger visual treatment for destructive moderation actions in the admin UI

### Changed

- `/admin/users/[userId]` no longer treats every moderation history row as a generic note or status update
- moderator resolution now has a direct workflow instead of forcing every case through the manual status dropdown

### Enforcement

- `Confirm cheat` now drives the same `RESTRICTED` enforcement flow as a manual restriction, including live waiting-game cancellation and active-game forfeiture when applicable

## [0.3.7] - 2026-03-20

Patch release focused on conservative auto-moderation from anti-cheat review signals.

### Added

- shared moderation policy module so admin recommendations and automatic moderation use the same scoring rules
- automatic `CLEAN -> OBSERVE` escalation for accounts that accumulate enough reviewed anti-cheat signals
- `system_auto_raised` audit events in user moderation history

### Changed

- telemetry review completion and engine review completion now both re-check whether the account should be auto-observed
- moderation history on `/admin/users/[userId]` now distinguishes manual updates, dismissals and system auto-observe actions

### Safeguards

- auto-raise is intentionally conservative and never jumps directly to `WATCH`, `REVIEW` or `RESTRICTED`
- dismissed recommendations still suppress automatic observation until new flagged signals arrive

## [0.3.6] - 2026-03-20

Patch release focused on completing the recommendation review loop with dismissal support.

### Added

- recommendation dismissal action from the admin moderation queue
- suppression of dismissed recommendations until fresh flagged signals arrive
- recommendation-dismissal audit events in the moderation event stream

### Changed

- recommendation queue is now triageable, not just apply-only
- admins can now keep the inbox clean without changing the underlying moderation status

## [0.3.5] - 2026-03-20

Patch release focused on turning moderation recommendations into a real admin queue instead of a passive hint.

### Added

- pending moderation recommendation queue on `/admin`
- one-click apply action for queued recommendations directly from the dashboard
- queue ordering by recommendation confidence and account risk

### Changed

- moderation recommendations now function as an inbox-style review flow, not just extra text on user profiles
- admin dashboard now surfaces which accounts most urgently differ from their recommended status

## [0.3.4] - 2026-03-20

Patch release focused on turning anti-cheat risk data into actionable moderation recommendations.

### Added

- system moderation recommendation engine derived from account risk, flagged games and recent review severity
- recommended status, confidence and rationale on admin risk profiles
- recommendation panel on admin user detail pages
- one-click “Use recommendation” action in moderation controls

### Changed

- high-risk account cards in `/admin` now show both current manual status and suggested next status
- moderator workflow no longer requires manually translating risk score numbers into a status decision

## [0.3.3] - 2026-03-20

Patch release focused on soft-limit moderation policy for accounts that are not fully restricted.

### Changed

- `WATCH` and `REVIEW` accounts are now limited to casual play only
- rated quick-pair eligibility now automatically downgrades to casual for moderated accounts under review
- rated lobby games are hidden or blocked for accounts that are currently limited to casual play
- home and lobby UI now explain when an account is under review and why rated play is disabled

### Fixed

- moderated accounts previously still looked fully eligible for rated flows until a join error happened
- lobby joinability state now reflects rated-play restrictions before the user clicks into a game

## [0.3.2] - 2026-03-20

Patch release focused on immediate moderation enforcement after an admin restricts an account.

### Added

- automatic moderation enforcement from admin actions
- instant cancellation of waiting games owned by newly restricted accounts
- instant forfeiture of active games involving newly restricted accounts
- admin success feedback showing how many waiting and active games were affected by a restriction

### Changed

- `RESTRICTED` no longer waits for the player to click again before taking effect
- moderation actions now propagate realtime updates to affected lobby and game rooms

## [0.3.1] - 2026-03-20

Patch release focused on moderation enforcement, so restricted accounts now affect actual gameplay and matchmaking behavior.

### Changed

- `RESTRICTED` accounts are now blocked server-side from creating games, entering quick-pair matchmaking, joining games, moving and resigning
- public lobby and quick-pair selection now exclude waiting tables created by restricted accounts
- lobby and home UI now surface a restricted-account warning before the user hits a server error

### Fixed

- moderation previously existed only as an admin status and audit layer; it now meaningfully affects the product itself
- joinability flags in open-game payloads now respect restricted accounts instead of allowing doomed join attempts

## [0.3.0] - 2026-03-20

Current alpha milestone focused on account-level anti-cheat profiling and persistent moderation tooling.

### Added

- account-level anti-cheat profiles aggregated across multiple reviewed games
- `/admin/users/[userId]` moderation page with per-account risk trend and reviewed game history
- high-risk account section on `/admin`
- manual moderation controls for admin status changes and notes
- persistent moderation audit log through `UserModerationEvent`
- moderation API route at `/api/admin/users/[userId]/moderation`

### Changed

- anti-cheat review payloads now carry per-side player risk instead of only game-level summary
- admin suspicious-game aggregation now identifies the primary flagged side and links directly to the relevant account
- admin account profiles now combine telemetry, engine review and manual moderation state

### Database

- `User` now stores `moderationStatus`, `moderationUpdatedAt` and `moderationUpdatedByEmail`
- added `UserModerationEvent` table and moderation indexes
- applied moderation schema updates directly to local PostgreSQL via SQL script because local Prisma schema push remains unreliable

### Admin / Ops

- admins can now move accounts between `CLEAN`, `OBSERVE`, `WATCH`, `REVIEW` and `RESTRICTED`
- moderation history is visible per account with who changed status, when, and why

## [0.2.0] - 2026-03-20

Current alpha milestone focused on real multiplayer gameplay, rating, admin analytics, and anti-cheat foundations.

### Added

- Next.js App Router multiplayer chess app shell with custom premium UI direction
- Better Auth email/password authentication
- anonymous guest quick-play flow for local/dev multiplayer
- PostgreSQL + Prisma data model for users, games, players, moves, events, sessions, accounts and verification
- create game, join game, quick-pair matchmaking, waiting room, cancel search and live game room flows
- server-authoritative chess logic with `chess.js`
- realtime updates over custom WebSocket server
- server-enforced clocks, turn logic and opening timeout rules
- drag-and-drop board interaction, click-to-move fallback and side-aware board orientation
- on-board promotion picker
- premove queue support up to 10 future moves
- right-click board annotations with arrows and marked squares
- sound effects for game start, moves, abort and checkmate
- Lichess-style local SVG chess piece set
- Elo rating updates for rated bullet, blitz and rapid games
- admin analytics dashboard at `/admin`
- telemetry-based anti-cheat review pipeline
- engine-based anti-cheat review pipeline using local Stockfish

### Changed

- homepage moved from marketing-style hero toward immediate play / quick-pair entry
- lobby and waiting flows became more anonymous-friendly and closer to real chess client behavior
- rated quick-pair now requires signed-in accounts; guest games stay casual
- move submission now retries transaction conflicts and auto-resyncs board state on failure
- promotion, check highlight, clocks and gameplay status UI were refined to feel more like a serious chess client
- admin dashboard queries now use dedicated database indexes

### Fixed

- hydration warning tolerance on root layout for extension-injected HTML attributes
- missing piece rendering and board SVG sizing issues
- promotion picker z-index / overlay clipping issues
- generic `Move submission failed` cases now map to clearer conflict/payload errors where possible
- premove line building now uses preview board state instead of stale current position

### Database

- added operational indexes for lobby, matchmaking, move history, sessions, account lookups and leaderboards
- applied missing indexes and anti-cheat move telemetry columns directly to local PostgreSQL where Prisma schema engine was unreliable

### Admin / Ops

- `/admin` now includes overview KPIs, trends, top rating lists, recent finished games and suspicious anti-cheat reviews
- admin access supports `ADMIN_EMAILS` allowlist, with development fallback when not configured

### Anti-Cheat

- stores per-move telemetry:
  - `clientThinkTimeMs`
  - `turnBlurCount`
  - `focusLossDurationMs`
- creates `anti_cheat_review` events from behavioral signals
- creates `engine_analysis_review` events from Stockfish analysis
- combines telemetry and engine signals into stronger suspicious-game rows in admin

## [0.1.0] - Initial Foundation

Initial scaffold milestone.

### Added

- Next.js project setup
- base premium visual direction
- auth pages
- initial Prisma schema
- first lobby and game room shells
