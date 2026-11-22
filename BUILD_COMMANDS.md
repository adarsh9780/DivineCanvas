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

## 2. iPadOS Build & Testing (Universal App)

In `app.json`, `"supportsTablet": true` is enabled, and Xcode builds DivineCanvas as a universal app (`TARGETED_DEVICE_FAMILY = "1,2"`). The standard Release binary (`generic/platform=iOS`) natively supports both iPhone and iPad.

### A. Run on a Connected Physical iPad
Expo will prompt you to select your iPad (or you can pass its name directly):
```bash
# Prompt device selector:
npx expo run:ios --device

# Or target directly:
npx expo run:ios --device "Your iPad Name"
```

### B. Install Pre-built App on Connected iPad
If you already built the Release bundle with `xcodebuild`:
```bash
xcrun devicectl device install app --device "Your iPad Name" /tmp/divinecanvas-build/Build/Products/Release-iphoneos/DivineCanvas.app
```
*(Or drag and drop `DivineCanvas.app` into your iPad under **Xcode > Window > Devices and Simulators**).*

### C. Run on iPad Simulator
```bash
# Run on an iPad Simulator via Expo CLI:
npx expo run:ios --device "iPad Pro 11-inch (M4)"
# or:
npx expo run:ios --device "iPad Air 11-inch (M2)"
```

### D. Direct Xcode CLI Build for iPad Simulator
```bash
xcodebuild -workspace ios/DivineCanvas.xcworkspace \
  -scheme DivineCanvas \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M4)' \
  -derivedDataPath /tmp/divinecanvas-build build
```

---

## 3. Cloud Builds via EAS (Expo Application Services)

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

## 4. Android APK via GitHub Actions

Run these commands in Terminal from the project directory:

```bash
cd ~/Downloads/Projects/DivineCanvas
```

The GitHub CLI (`gh`) must be installed and signed in to an account with access to the repository. Check your login with `gh auth status`, or sign in with `gh auth login`.

### A. Start an ARM64 APK build

Push the changes you want to build to `main` first. The workflow builds the committed code on GitHub, not uncommitted files on your Mac. Check and push with:

```bash
git status
git push origin main
```

Start the workflow from the latest commit on `main`:

```bash
gh workflow run android-apk.yml --ref main
```

The command returns a link to the run. You can also open **GitHub → Actions → Android APK → Run workflow**, choose `main`, and select **Run workflow**. Each run uses GitHub Actions minutes. EAS cloud builds have a separate quota.

### B. Check the status and result

List recent Android APK runs and find the run ID in the output:

```bash
gh run list --workflow android-apk.yml --limit 5
```

Replace `RUN_ID` in these commands with that number. View the run's status and job details:

```bash
gh run view RUN_ID
```

Open the run in your browser, where the individual steps and artifact are visible:

```bash
gh run view RUN_ID --web
```

After a failure, show the failed step logs:

```bash
gh run view RUN_ID --log-failed
```

### C. Download and install the APK

Once the run succeeds, download and extract its artifact into a local folder:

```bash
gh run download RUN_ID --name DivineCanvas-android-arm64 --dir ./downloaded-apk
```

GitHub retains the artifact for seven days. Install the APK on a running emulator or connected, authorized Android phone:

```bash
adb devices
adb install -r ./downloaded-apk/app-release.apk
```

If `adb` is not in your PATH, use the full path to `adb` in your Android SDK's `platform-tools` directory. The APK supports ARM64 devices and ARM64 emulators. The workflow is configured to sign with the EAS key stored in GitHub Actions secrets. Android accepts an update when its application ID and signing certificate match the installed app and its version code is equal or higher. A previously installed debug-signed APK may need to be uninstalled first. Uninstalling removes that app's local data.

### D. Signing and version codes

The workflow requires the GitHub Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Keep the keystore and passwords private and out of the repository. The workflow assigns version codes from `100000 +` the GitHub Actions run number. Coordinate future EAS or Play Store version codes with this sequence so updates can be installed in the intended order.

When an AI assistant is operating this project, `AGENTS.md` requires your explicit approval for each build, including retries.

---

## 5. Pre-Commit Verification & Sanity Checks

Run verification checks before committing changes:
```bash
# Test music download and queue logic
npm run test:music

# Typecheck
npm run typecheck

# Linting
npm run lint
```
