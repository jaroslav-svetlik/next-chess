# Multiplayer Chess Platform Plan

## 1. Vizija proizvoda

Cilj je da napravimo ozbiljnu multiplayer chess aplikaciju u Next.js-u gde registrovani korisnici mogu:

- da naprave nalog i imaju svoj profil
- da kreiraju novu partiju i cekaju protivnika
- da se pridruze otvorenoj partiji iz lobbya
- da igraju realtime 1v1 sah sa validacijom poteza na serveru
- da biraju format: bullet, blitz, rapid ili custom
- da vide istek vremena, rezultat i istoriju partija

Prva verzija treba da izgleda premium, brzo i “takmicarski”, a ne kao demo projekat.

## 2. Produktni scope

### MVP

- email/password registracija i login
- osnovni user profil: username, avatar, rating placeholder
- lobby sa listom otvorenih partija
- create game flow
- join game flow
- realtime sahovska tabla za 2 igraca
- server-side validacija poteza
- server-authoritative sat
- rezultat partije: checkmate, resign, timeout, draw
- istorija partija na profilu
- preset time controls:
  - bullet: `1+0`, `2+1`
  - blitz: `3+0`, `3+2`, `5+0`
  - rapid: `10+0`, `10+5`, `15+10`
- custom game setup:
  - initial time u sekundama/minutima
  - increment u sekundama
  - public ili private invite
  - rated ostaviti kao disabled/coming soon u MVP-u

### V1.1

- chat tokom partije
- friend invite link
- rematch
- spectate mode
- reconnect recovery
- premove
- sound effects i move animations

### V2

- rating / ELO
- matchmaking queue po formatu
- anti-cheat signals i suspicious behavior flags
- tournaments / arenas
- analysis board i PGN export
- puzzles / bot

## 3. Preporuceni stack

### Frontend / app shell

- `Next.js` sa `App Router` pristupom
- `TypeScript`
- `Tailwind CSS`
- custom component system umesto generickog UI kita kao glavnog vizuelnog jezika

Zasto:

- Next.js App Router je i dalje recommended pravac u zvanicnoj dokumentaciji i daje dobar osnov za server rendering, layouts, server actions i route handlers.

### Auth

- `Better Auth`
- email/password kao osnovni login
- social login opciono kasnije

Zasto:

- Better Auth ima eksplicitnu Next.js integraciju preko route handlera i dobro lezi uz App Router.

### Database

- `PostgreSQL`
- `Prisma ORM`

Zasto:

- trebaju nam jasni relacijski modeli za users, games, players, moves, events i istoriju
- Prisma ima aktuelnu Next.js + Postgres dokumentaciju i ubrzava razvoj admin/debug sloja

### Realtime

Preporuka za ozbiljan start:

- `Ably` za realtime evente i presence

Alternativa:

- `Liveblocks` ako hocemo jaci collaboration/presence toolkit iz kutije

Zasto Ably kao primarna preporuka:

- chess je event-driven proizvod: lobby updates, join, move, resign, draw offer, clock sync
- Ably ima presence i ordering primitives koji odgovaraju multiplayer igri
- izbegavamo da prvu verziju pravimo oko custom websocket servera zalepljenog uz Next deploy

Napomena:

- i uz Ably, game state i validacija ostaju na serveru i u bazi
- client nikad nije source of truth za potez ili sat

### Chess engine / rules

- `chess.js`

Zasto:

- stabilan i fokusiran na pravila saha: move validation, FEN, PGN, draw/checkmate/stalemate

### Optional supporting infra

- `Upstash Redis` ili klasicni Redis za ephemeral state, reconnect windows i queue/signaling cache
- `Sentry` za error monitoring
- `Vercel` za app deploy + managed Postgres provider po izboru

## 4. Arhitektura sistema

## 4.1 Princip

Sistem mora da bude server-authoritative.

To znaci:

- klijent salje nameru: “zelim da pomerim figuru sa e2 na e4”
- server proverava:
  - da li je igrac clan te partije
  - da li je na potezu
  - da li je potez legalan
  - da li igrac jos ima vreme
- server upisuje potez, izracunava novo stanje table i vremena
- tek onda broadcast-uje potvrden event svim klijentima

Ako pustimo da klijent sam “vodi partiju”, dobicemo sync bugove, cheating rupe i clock drift.

## 4.2 Glavni moduli

### Auth module

- signup
- login
- session handling
- protected routes

### Lobby module

- prikaz otvorenih partija
- create/cancel game
- public/private room status
- online/presence info

### Game module

- authoritative game lifecycle
- move submission
- turn enforcement
- draw/resign/timeout
- reconnect state restore

### Time-control module

- preset i custom kontrole
- authoritative countdown
- increment after valid move
- timeout resolution

### History/Profile module

- lista zavrsenih partija
- osnovna statistika
- PGN/FEN storage

## 5. Predlog route strukture

```text
/
/auth/login
/auth/register
/lobby
/game/[gameId]
/profile/[username]
/settings/profile
```

API / server endpoints:

```text
/api/auth/[...all]
/api/games
/api/games/[gameId]
/api/games/[gameId]/join
/api/games/[gameId]/move
/api/games/[gameId]/resign
/api/games/[gameId]/draw-offer
/api/games/[gameId]/draw-response
/api/lobby
/api/realtime/auth
```

Napomena:

- move/resign/draw akcije mogu ici preko server actions ili route handlera
- realtime kanal sluzi za push, ali autorizacija i finalna validacija ostaju na backend-u

## 6. Model podataka

## 6.1 User

- `id`
- `email`
- `username`
- `displayName`
- `avatarUrl`
- `ratingRapid`
- `ratingBlitz`
- `ratingBullet`
- `createdAt`
- `updatedAt`

## 6.2 Game

- `id`
- `status`
  - `waiting`
  - `active`
  - `finished`
  - `cancelled`
- `visibility`
  - `public`
  - `private`
- `timeCategory`
  - `bullet`
  - `blitz`
  - `rapid`
  - `custom`
- `initialTimeMs`
- `incrementMs`
- `rated`
- `fen`
- `pgn`
- `result`
- `winnerUserId`
- `createdByUserId`
- `startedAt`
- `endedAt`
- `createdAt`
- `updatedAt`

## 6.3 GamePlayer

- `id`
- `gameId`
- `userId`
- `color`
  - `white`
  - `black`
- `timeRemainingMs`
- `isConnected`
- `joinedAt`

## 6.4 Move

- `id`
- `gameId`
- `ply`
- `san`
- `uci`
- `fenAfter`
- `movedByUserId`
- `spentTimeMs`
- `createdAt`

## 6.5 GameEvent

- `id`
- `gameId`
- `type`
  - `game_created`
  - `player_joined`
  - `game_started`
  - `move_made`
  - `draw_offered`
  - `draw_accepted`
  - `resigned`
  - `timeout`
  - `player_disconnected`
  - `player_reconnected`
- `payload`
- `createdAt`

## 7. Realtime tokovi

## 7.1 Create game

1. User kreira partiju iz lobbya.
2. Server pravi `Game` status `waiting`.
3. Lobby broadcast-uje novu otvorenu partiju.
4. Creator ide u waiting room ekran.

## 7.2 Join game

1. Drugi user klikne join.
2. Server radi transaction:
   - proverava da partija jos ceka
   - upisuje drugog igraca
   - dodeljuje boju
   - menja status u `active`
3. Server salje `game_started` event obema stranama.
4. Oba klijenta prelaze u `/game/[gameId]`.

## 7.3 Move flow

1. Klijent lokalno prikaze optimistic drag.
2. Salje move intent serveru.
3. Server validira preko `chess.js`.
4. Server racuna clock delta.
5. Server cuva `Move` i update-uje `Game` + `GamePlayer`.
6. Server push-uje canonical state svim subscriberima.
7. Klijenti uskladjuju prikaz sa canonical state-om.

## 7.4 Reconnect

1. Igrac pukne sa mreze.
2. Presence oznaci disconnect.
3. Partija ostaje aktivna, sat nastavlja ako je njegov potez.
4. Reconnect fetch-uje poslednji canonical snapshot.

## 8. Pravila za sat

Clock mora da bude backend-authoritative.

Predlog:

- u bazi cuvamo preostalo vreme po igracu
- cuvamo `lastMoveAt` ili `turnStartedAt`
- pri svakom potezu server racuna koliko je vremena stvarno potroseno
- increment se dodaje tek posle validnog poteza
- klijent renderuje lokalni countdown radi UX-a, ali se povremeno resync-uje sa serverom

Ovo je bitno jer je clock najosetljiviji deo multiplayer saha.

## 9. UI/UX pravac

Ne praviti “developer dashboard” izgled.

Vizuelni pravac za premium sah proizvod:

- tema: `ivory`, `graphite`, `forest`, `brass`
- atmosfera: luksuzni klub / turnirska sala / moderni sportski UI
- figura i tabla:
  - elegantna 2D ili blago textured 2.5D tabla
  - jaka kontrastna polja
  - citljive figure bez kica
- tipografija:
  - display serif za hero i identitet
  - cist sans za UI
- motion:
  - suptilan fade/slide pri ulasku u lobby
  - ozbiljne, brze animacije poteza
  - clock urgency states sa decent glow efektom

### Kljucni ekrani

- Landing
  - jak hero sa “Play serious chess in real time”
  - CTA za register / enter lobby
- Lobby
  - cards za otvorene partije
  - create game panel koji izgleda kao control desk, ne kao obican form
- Waiting Room
  - status “waiting for opponent”
  - share invite link
  - cancel game
- Game Screen
  - tabla kao centralni fokus
  - player cards gore/dole ili levo/desno
  - clock, move list, action buttons
- Profile
  - recent games
  - format breakdown
  - basic stats

## 10. Bezbednost i integritet

- svaki move mora proci backend validaciju
- join endpoint mora biti transactional da spreci dupli join
- private games koriste secure invite token
- rate limiting na auth i create/join akcijama
- audit trail kroz `GameEvent`
- sanitizacija user input-a za username/chat

## 11. Test strategija

### Unit

- chess move validation wrapper
- clock calculation
- game state transitions
- result resolution

### Integration

- create -> join -> start flow
- valid move -> state persisted
- invalid move rejected
- timeout handling
- resign / draw flow

### E2E

- register dva korisnika
- user A napravi partiju
- user B udje u lobby i pridruzi se
- odigrati nekoliko poteza
- potvrditi istoriju partije

## 12. Faze izrade

### Faza 1: Foundation

- bootstrap Next.js app
- setup Tailwind + design tokens
- setup Better Auth
- setup Prisma + Postgres
- user/profile schema

### Faza 2: Lobby

- create game modal/panel
- open games list
- waiting room
- public/private invite logic

### Faza 3: Core gameplay

- chess board UI
- authoritative move API
- realtime subscriptions
- clocks
- finish states

### Faza 4: History + polish

- profile page
- game archive
- move list
- reconnect UX
- sound/motion/premium visual pass

### Faza 5: Competitive systems

- ratings
- matchmaking queue
- spectating
- moderation / abuse controls

## 13. Konkretna preporuka za prvi build

Ako hocemo brz ali ozbiljan start, ja bih izabrao:

- `Next.js App Router`
- `TypeScript`
- `Tailwind CSS` + custom design system
- `Better Auth`
- `PostgreSQL`
- `Prisma`
- `Ably`
- `chess.js`

To daje:

- moderan full-stack app shell
- jednostavniji auth setup
- relacijsku bazu za istoriju i profile
- managed realtime bez improvizovanog websocket hostinga
- proverenu sah logiku

## 14. Rizici koje treba resiti rano

- clock drift i authoritative timing
- reconnect logika
- race condition pri join-u
- optimistic UI koji se razilazi od server stanja
- deploy model za realtime auth i server validation

## 15. Sledeci konkretan korak

Najracionalnije je da odmah uradimo:

1. inicijalizaciju projekta
2. bazni dizajn sistem i layout
3. auth + baza
4. lobby i create/join flow

Tek nakon toga sah tabla i realtime gameplay.

Tako dobijamo proizvod koji izgleda ozbiljno od prvog dana i ima cvrst backend temelj.
