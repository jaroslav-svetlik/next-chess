# Release Process

Ovaj dokument definise kako vodimo verzije i changelog za Grandmate dok je projekat jos u alpha fazi.

## 1. Source of truth

- runtime/app verzija: [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json)
- istorija promena: [CHANGELOG.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/CHANGELOG.md)
- dugorocni plan: [docs/chess-platform-plan.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/docs/chess-platform-plan.md)

## 2. Trenutni model verzionisanja

Dok je projekat u `0.x`, koristimo praktican semver stil:

- `0.x.0`
  - veci milestone
  - znacajne nove funkcije
  - veci UX ili arhitekturni pomak
- `0.x.y`
  - manji release
  - bugfix
  - polish
  - manje backend ili UI unapredjenje

Primer:

- `0.2.0` = rating, admin i anti-cheat foundation
- `0.2.1` = fix za matchmaking, build ili UI regression
- `0.3.0` = sledeci veliki milestone, npr. profile + leaderboard + game history polish

## 3. Kada povecavamo verziju

Povecaj verziju u [package.json](/Users/jaroslavsvetlik/Documents/NextJS/chess/package.json) kada:

- zavrsimo veci feature milestone
- menjamo korisnicki vidljivo ponasanje
- menjamo schema/data flow na nacin koji je bitan za release
- zatvaramo grupu bitnih fixeva koje vredi posebno oznaciti

Nemoj dizati verziju za svaku sitnu lokalnu izmenu dok nije spremna da bude deo smislenog milestone-a.

## 4. Kako azuriramo changelog

Svaki release treba da dobije novu sekciju u [CHANGELOG.md](/Users/jaroslavsvetlik/Documents/NextJS/chess/CHANGELOG.md).

Minimalna struktura:

- verzija i datum
- kratak opis milestone-a
- `Added`
- `Changed`
- `Fixed`
- opciono:
  - `Database`
  - `Admin / Ops`
  - `Anti-Cheat`
  - `Security`

Pravila:

- pisi samo stvari koje su stvarno bitne
- grupisi po ishodu, ne po svakom fajlu
- ne koristi changelog kao sirovi dnevnik svih commitova
- ako je fix mali i interni, spoji ga pod siri milestone

## 5. Predlog release ritma

Preporuceni milestone-i:

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
  - spectator / rematch / draw controls polish
- `0.5.x`
  - realtime infra hardening
  - background workers
  - deterministic clocks / reconnect reliability
- `0.6.x`
  - beta-quality public release prep

## 6. Pre-release checklist

Pre nego sto oznacimo novi release:

1. update `package.json` version
2. update `CHANGELOG.md`
3. proveri `npm run build`
4. proveri `npm run typecheck`
5. ako ima db promena:
   - potvrdi da su schema i lokalna baza uskladjene
   - zabelezi bitne migration/index izmene u changelog-u
6. ako je feature ops/admin/anti-cheat relevantan:
   - proveri `/admin`

## 7. Kasnije, kada uvedemo Git release flow

Kada repo bude pod punim Git release procesom, ovaj dokument treba prosiriti sa:

- branch strategijom
- tag naming pravilima
- release tag korakom
- deployment checklist-om
- rollback procedurom
