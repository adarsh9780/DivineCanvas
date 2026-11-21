# DivineCanvas Build & Deployment Commands

Reference guide for building, testing, installing, and deploying the iOS and Android versions of DivineCanvas.

---

## 1. Local iOS Build & Installation

### A. Run Local Release Build (Xcode CLI)
Runs a Release build for iOS devices using the local Xcode project:
```bash
xcodebuild -workspace ios/DivineCanvas.xcworkspace \
  -scheme DivineCanvas \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/divinecanvas-build \
  -allowProvisioningUpdates build
```
*Output bundle location:*
```text
/tmp/divinecanvas-build/Build/Products/Release-iphoneos/DivineCanvas.app
```

---

### B. Push & Install the Built App onto Connected iPhone

#### Method 1: Xcode Devices Window (Recommended)
1. Open Xcode and press **`Shift + Cmd + 2`** (or menu: **Window > Devices and Simulators**).
2. Select your connected iPhone under **Connected** in the left sidebar.
3. Under the **Installed Apps** section, click **`+`** (or drag and drop `DivineCanvas.app` directly into the list).
   > *Tip: In the file picker, press `Cmd + Shift + G`, paste `/tmp/divinecanvas-build/Build/Products/Release-iphoneos`, and select `DivineCanvas.app`.*
4. This pushes the update directly to the device without clearing saved reading progress, preferences, or downloads.

#### Method 2: Apple `devicectl` CLI (Xcode 15+)
Find your connected device name or UUID:
```bash
xcrun devicectl list devices
```
Install the app onto your phone:
```bash
xcrun devicectl device install app --device "Your iPhone Name" /tmp/divinecanvas-build/Build/Products/Release-iphoneos/DivineCanvas.app
```

---

### C. Direct Run via Expo CLI
Alternatively, Expo can build and deploy directly to a connected device in one step:
```bash
# Debug build on iOS Simulator
npx expo run:ios

# Release build on connected physical device
npx expo run:ios --configuration Release --device
```

---

## 2. Cloud Builds via EAS (Expo Application Services)

Per project conventions in `AGENTS.md` and `eas.json`, always run EAS CLI with `npx eas-cli@latest`.

### Android Builds

#### A. Internal Testing APK (Direct Installation)
Produces a standalone `.apk` to download and install directly on Android phones or distribute to testers:
```bash
npx eas-cli@latest build --platform android --profile preview
```

#### B. Production Google Play Store Bundle (AAB)
Produces an `.aab` (Android App Bundle) ready to upload to the Google Play Console:
```bash
npx eas-cli@latest build --platform android --profile production
```

---

### iOS Builds (For Reference)

#### Internal Preview Build (Ad-Hoc / Internal Testers)
```bash
npx eas-cli@latest build --platform ios --profile preview
```

#### Production App Store / TestFlight Build
```bash
npx eas-cli@latest build --platform ios --profile production
```

---

## 3. Pre-Commit Verification & Sanity Checks

Run verification checks before committing changes:
```bash
# Test music download and queue logic
npm run test:music

# Typecheck
npm run typecheck

# Linting
npm run lint
```
