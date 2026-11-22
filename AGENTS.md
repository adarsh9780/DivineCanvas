This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Ask the user and wait for their explicit approval before starting, queuing, submitting, retrying, or triggering any build, including local native builds, EAS builds, and builds triggered through CI. Name the platform, profile, and artifact in the request. Approval applies to that specific build. Code changes, commits, and pushes are separate from build approval. EAS builds use the user's limited quota.

After dispatching an approved build, send the run link to the user and end the turn. Resume when the user reports the result.

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Change history and release notes

- After completing and verifying requested changes, commit them in coherent groups with descriptive conventional commit messages and push the branch, unless the user says otherwise or the action is blocked.
- Git commit messages are developer history, not store release notes. When preparing a store submission, separately describe meaningful user-facing changes and provide accurate review notes under the current Apple and Google requirements.

## Native platform conventions

- Prefer platform-native controls, navigation, gestures, menus, and system behavior where they meet the feature's needs on iOS, iPadOS, and Android. Use supported Expo/React Native platform APIs or platform-native components instead of recreating system UI by default.
- Proactively mention an applicable native alternative and its tradeoffs when discussing or implementing a custom interface, even if the user has not explicitly asked. Preserve accessibility, platform conventions, existing behavior, and cross-platform support; explain any necessary exception.
