# DivineCanvas

A small offline-first iOS and Android reading app built with Expo and React Native. The current local preview uses a user-provided copy of the 1972 Bhagavad-gita As It Is. Its English translation is copyrighted; do not distribute it without permission.

## Run locally

Use a supported Node version (Node 24 LTS is recommended), then run:

```sh
npm install
npx expo start
```

Scan the QR code using a compatible Expo Go version, or press `i` / `a` for an installed iOS simulator / Android emulator. Expo SDK 58 currently requires a compatible development build until Expo Go supports it. See https://docs.expo.dev/get-started/start-developing/.

## Foundation

- The reader presents short passages with vertical paging, chapter navigation, language selection, saved passages and notes.
- SQLite stores saves, notes, reading position and language on the device. Uninstalling the app may remove them.
- `src/book.ts` maps locally prepared content into stable passage IDs. Preserve IDs across updates to retain saves.
- EPUB import, general text pagination, source parsing, accounts and syncing are future work. The extracted verse entries are pre-divided, not automatic 4–5 line pagination.
- Test offline behavior and layout on actual iOS and Android devices before release.

## Local book preview

The EPUB and extracted data are ignored by Git. Place the original 1972 edition EPUB in `books/`, then generate the local data before starting the app:

```sh
python3 scripts/prepare_gita.py "books/Bhagavad-Gita As It Is (Original 1972 Edition).epub" src/data/gita.local.json
```

The EPUB provides Sanskrit and English, not Hindi. Its grouped translations remain grouped; commentary is not included. Extraction is tailored to this EPUB, and its results need editorial review. Confirm rights before distribution.

## iPhone preview build

The `preview` EAS profile produces a standalone internal build, not an Expo Go development build. It requires an Expo account, an Apple Developer Program membership, a unique iOS bundle identifier, and registration of the iPhone. See https://docs.expo.dev/tutorial/eas/internal-distribution-builds/.

EAS uploads `src/data/gita.local.json` to Expo's build service so the book is included offline. `.easignore` excludes the original EPUB in `books/`. The current book is a personal prototype; resolve redistribution permissions before sharing the build. Do not use the EAS preview profile as-is for a public release.

## Chapter progress

Each chapter remembers its last opened passage offline. The chapter list shows where it will resume. Progress is stored by book edition, chapter and stable passage ID; opening a saved passage also updates that chapter. Older installations retain their last overall position, which seeds that chapter on upgrade. Earlier positions in other chapters cannot be recovered retroactively. Run `npm run test:progress` to check database persistence and chapter selection. A fresh native build must be installed to update the standalone iPhone app.

## Reading appearance

The profile-style button opens local reading settings, without an account. Readers can choose Small (22), Default (26), or Large (32) passage text, and Paper, White, Sage, or Night backgrounds. Both settings persist in SQLite across restarts. Palettes adjust the reader, navigation, notes and controls together for contrast. The app name is reserved for a future home screen and is omitted from the current in-app header.

## App and build versions

`expo.version` in `app.json` is the shared, user-facing semantic version for iOS and Android (currently `1.0.0`). Update it deliberately when releasing an app version; keep `package.json` aligned. EAS uses its remote version source and increments Android's integer `versionCode` and iOS's `buildNumber` independently for each preview or production build. The initial local values are `1`. Locally built Xcode or Android Studio binaries do not automatically receive those EAS numbers; synchronize them with `npx eas-cli@latest build:version:sync` when needed.

The `preview` profile produces an installable APK for Android. `production` is configured for store builds, which use an Android App Bundle by default.

## Media attribution

“Krishna Flute Music” by Alex Morgan is included under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Source and license information](https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/). The bundled reading images were supplied by the project owner; verify their distribution rights before release. The included MIT license covers source code and does not grant rights to third-party books, music, or images.
