# Screenopps — Expo / NativeWind mobile app

Port of the web streaming app to React Native (Expo) + NativeWind, with a
bottom tab navigator (Profile pinned as the right-most tab) and a redesigned
dark UI.

## Design direction

Kept the same dark palette family as the web app but rebuilt the layout
around one idea: a **cinema marquee / ticket stub**, since the subject is
literally "what's showing." Concretely:

- **Trending row gets numbered rank badges** (large outlined numerals) —
  order is real information there, unlike a decorative 01/02/03.
- **Section headers** use a small lit "marquee bulb" dot instead of a plain
  label.
- **The hero banner** reads like a marquee sign: `NOW SHOWING` eyebrow in
  the ticket-red accent, an oversized condensed title (Bebas Neue), a
  ticket-style info strip (rating · language · year).
- **Signature element:** a perforated "ticket tear" divider between the
  hero and the content below, with two notches cut into the edges like a
  torn stub.
- Type system: Bebas Neue (display/titles), Inter (UI/body), JetBrains
  Mono (ratings, runtimes, episode badges — anything "printed" and numeric).
- Accent color is a single marquee amber (`#F2B705`) plus a ticket
  red-orange (`#E4572E`) used only for the Play CTA / trailer badge —
  everything else stays in the near-black/graphite family.

## Setup

```bash
cd screenopps-mobile
npm install
cp .env.example .env   # fill in your TMDB bearer token
npx expo start
```

Requires the Expo Go app (or a dev build) to run on device/simulator.

## What ported 1:1 vs. what changed

**Kept from the web app's logic (same fixes preserved):**
- `HomeScreen`'s `ROWS` config array + `Promise.allSettled` parallel-fetch
  pattern from `Home.jsx` — one broken category can't take down the rest.
- `ApiCore.js`'s "don't swallow errors in `.get()`" design — callers decide
  how to degrade.
- `PosterCard`'s dual-mode (`details` vs `continue`) logic, including the
  telenovela custom-source branch.
- `TrailerSpotlight`'s "pick a random index only once we know the array
  length" fix from `Upcoming.jsx`.
- `LibraryScreen`'s defensive `JSON.parse` + wipe-on-corruption from
  `Recent.jsx` (now against `AsyncStorage` instead of `localStorage`).

**Changed for the RN/mobile context:**
- The web navbar's hamburger menu + separate `Navbar.jsx` auth-check effect
  is gone — sign-in state now lives on the `Profile` tab.
- `ApiCore`'s 404/403 `window.location` redirects are removed (no
  equivalent in a tab/stack app without a nav ref); errors are just typed
  and left to the screen.
- Web's `<Top/>` hero → `HeroBanner` (auto-rotating, ticket-styled).
- No dedicated Stream backend was in the code you shared, so `StreamScreen`
  / `TelestreamScreen` are shells wired to the right route params —
  plug your source resolver into `playerUri`.

## Structure

```
App.js                        entry: fonts, providers, NavigationContainer
src/
  api/ApiCore.js               axios client (RN port)
  components/
    HeroBanner.js               marquee hero
    TicketDivider.js            signature perforation divider
    SectionHeader.js            marquee-bulb section label
    ContentRow.js                horizontal poster row
    PosterCard.js                poster tile (+ rank badge)
    TrailerSpotlight.js          embedded trailer (WebView)
  navigation/
    AppNavigator.js               stack: Tabs + Details/Stream/Telestream
    RootNavigator.js               bottom tabs (Profile pinned right)
  screens/
    HomeScreen.js, SearchScreen.js, LibraryScreen.js, ProfileScreen.js,
    DetailsScreen.js, StreamScreen.js, TelestreamScreen.js
  store/state.js                valtio auth state
  constants/theme.js             color tokens + React Navigation theme
```
