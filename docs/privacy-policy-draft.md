# DivineCanvas privacy policy — draft

**Draft for review — do not publish until the app owner confirms the provisional contact address and verifies all release-build data practices and third-party terms.**

Last reviewed: 18 November 2026

DivineCanvas is an offline-first reading app. This policy describes the current version of the app and applies to its iPhone and Android versions. It should be updated before any change to data practices, such as introducing accounts, analytics, advertisements, purchases or cloud services.

## Information stored on your device

The app stores your reading position, saved passages and notes, preferences (including language and appearance), and information about downloads on your device. Books, the optional dictionary and voice files are stored on the device after download. If you choose images for reading backgrounds, the app creates local copies and thumbnails of the selected images. We do not receive your notes, reading progress or selected images through these features.

Your device's operating system or backup provider may include app data in device backups according to your settings. Those backups are governed by the provider's terms and your settings.

## Downloading content and external services

Books are downloaded from a DivineCanvas GitHub release. The optional English dictionary is downloaded from en-word.net. Optional voice files are downloaded from Hugging Face and GitHub. When you download these files, your device contacts the relevant service directly. Those services and their network providers may receive information needed to handle the request, such as your IP address, requested file, time of request and technical request details, and may retain logs under their own policies. Downloads can use mobile data. Once downloaded, these assets can be used offline.

You can choose to open external source and license links. The websites you open handle information according to their own policies.

## Photos, copying and sharing

If you choose a custom background, the app uses your device's image picker to access the images you select and saves local copies. Photo access is optional. If you use Copy, selected text is placed on the system clipboard. If you choose to share a passage image, the system share sheet gives you control over the destination; the receiving app handles anything you choose to share under its own privacy policy.

## Voice and dictionary

The downloaded voice model generates speech on your device. Dictionary lookup uses the downloaded dictionary on your device. The app does not send the passage being read aloud or the word being looked up to a remote AI or dictionary service for these functions.

## Accounts, advertising and analytics

The current version does not ask you to create a DivineCanvas account, and it does not include an advertising or analytics feature. We do not sell your personal information. This does not prevent a download host, operating system, backup provider or sharing destination from processing information under its own policies.

## Retention and deletion

Local information generally remains on your device until you remove it or uninstall the app. You can remove downloaded books, the dictionary and the voice model through their controls in the app. Removing a book download keeps its saved notes and reading progress. Uninstalling the app normally removes its local data from the device, subject to your operating system and any device or cloud backups. Manage or delete backups through your backup provider. Information held independently by third-party services is subject to those services' retention and deletion policies.

## Questions and changes

For privacy questions or requests, contact **tanyamaurya2001@gmail.com** (provisional; confirm before publication). We will update this policy as our practices change and update the date above. If the app begins collecting additional information or using advertising, analytics, accounts or cloud services, we will describe those changes and obtain consent where required.

---

# Release disclosure checklist — internal, not part of the published policy

- Add the operator's name or business name and confirm the provisional privacy contact; review wording against actual practices and applicable law.
- Publish the finished policy at a stable, publicly accessible URL; add a link in the app and enter the URL in App Store Connect and Google Play Console. Do not publish this draft with the placeholder.
- Complete App Store privacy questions and Google Play Data safety based on the release binary, network behavior, SDKs and actual provider practices. Do not assume “no data collected” solely because the app has no accounts. Apple's definition depends on what is transmitted and retained and the role of third-party partners.
- Review GitHub, Hugging Face and en-word.net request logging and any applicable terms, SDK privacy manifests, backup behavior and error reporting. Retain evidence; update the policy and store answers if needed.
- In the app, explain download source and size at the point of optional download, image access at the picker, and that sharing opens the system share sheet. Check each actual flow before claiming these disclosures are present.
- Explain locally stored data, deletion and backups in settings. Confirm exact effects of uninstall, restoring backups and removal of downloaded content on both platforms.
- Reassess disclosures and consent before introducing accounts, advertising, purchases, remote AI, analytics or crash reporting.
