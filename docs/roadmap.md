# DivineCanvas: product context and roadmap

Updated: 17 November 2026

## Purpose

DivineCanvas is an offline-first reading app for iPhone and Android. It presents sacred books as short passages that readers swipe through vertically. The experience should be calm and easy to read, with a choice of language, text size, background and optional audio.

## Current experience

- The Books view is the entry point and lists locally available books; Bhagavad Gita, Ramayana and Mahabharata are included as local previews. Open a book to resume its last passage. Reader controls open chapters, a book menu with saved verses and settings, and return to Books; there is no bottom navigation bar.
- The Gita has 700 Sanskrit verses with Hindi and English translations from Hansi Gita Bhawan Trust. Hindi is the default; the selected language is remembered.
- Readers can navigate chapters, see chapter progress, save passages, add notes and share passage images. SQLite keeps reading positions, notes and preferences on the device. Positions are scoped by book and chapter; migration retains existing Gita progress and notes.
- Readers can customize the appearance, choose chapter backgrounds, play instrumental music, use timed auto-scroll, and optionally download a modular offline voice for continuous read aloud.
- The bundled book works offline. Voice and dictionary assets require a one-time download. The original Gita dataset is excluded from Git while included in internal EAS preview builds.
- A book registry in `src/book.ts` defines each book's stable ID, chapter list and passages; `src/readingProgress.ts` defines book-scoped position keys and legacy migration. `src/ReaderApp.tsx` contains the reader and navigation.

## Content and rights

The Trust says its Hindi and English translations may be built on with attribution. Obtain explicit confirmation for full offline redistribution in an app with paid features before public release. Check the provenance and rights of every future edition and each translation separately. Do not assume that a repository license clears third-party content. Images supplied by the project owner also require a rights check before release.

A Shiv Mahapuran candidate is at https://huggingface.co/datasets/snskrt/Shiv_Mahapuran. Its card describes Sanskrit-only CSV and claims Apache-2.0, but does not identify the precise source edition; its dataset viewer currently reports a schema error. The pinned data file has 24,489 non-empty Sanskrit rows across seven samhitas and 457 distinct chapter keys, with no duplicate samhita/khanda/chapter/verse keys in the inspected file; it uses `adhyaya`, not the card’s `adhyay` field. These structural checks do not establish textual accuracy or rights. Verify provenance, completeness, accuracy and redistribution rights, and secure an authorized Hindi translation before adding it to the library. Do not invent or silently substitute religious text.

## Future direction

The Gita is intended to remain free. Other books may be sold as individual one-time purchases. The user is considering paid features such as simplified translations, importing personal EPUBs and customizable images for sharing. Payments, accounts, syncing and importing books are not implemented. Verify scope and permissions before implementing them.

Stable book and passage IDs must survive formatting and pagination changes. Preserve user data across updates, verify the book's language availability, and test playback, navigation, offline reading, progress and accessibility on real iOS and Android devices before release.

## Monetization and offline access — ideas for discussion

The user wants to earn revenue without requiring a DivineCanvas account. The Bhagavad Gita should remain free and available offline. Other books were previously proposed as separate one-time purchases. Paid features may include simplified explanations/translations, importing personal EPUBs, and customizable images for sharing. These are product ideas, not implemented or finalized.

Options to evaluate include one-time book purchases with a free chapter preview, a one-time premium feature bundle, a voluntary one-time tip, and limited advertising in non-reading areas. Ads are an additional possible revenue source, not a reason to make all books free or require ads for Gita access. Avoid interrupting verses, narration or immersive reading with ads. Offline users cannot fetch new ads, so decide deliberately what the free offline experience includes; do not remove content readers already purchased or promise ads will always be available. If trying rewarded ads or temporary chapter access, ensure rewards are optional, disclose expiry, account for no-fill/offline cases, and check current Apple, Google Play and ad network policies first.

Apple and Google Play accounts may be needed to pay for and restore in-app purchases, but these are separate from creating an app account. Paid books and features should be restorable via the appropriate store account and remain available offline after a successful purchase and download, including an explicit offline-access policy for later verification, reinstalls and refunds. App Store and Play Store purchases do not automatically transfer between platforms. Store purchases, entitlements, trusted verification, refunds and any optional account/sync are not implemented. Confirm store rules, commission, tax, pricing and content rights before launch. Local-only entitlement checks and files are not tamper-proof; do not promise perfect protection or no-backend purchase security.

References (check current rules at implementation): https://developer.apple.com/app-store/review/guidelines/ and https://support.google.com/googleplay/android-developer/answer/10281818 .

## Future AI integration — optional and provider-independent

Potential future AI features include simplified, verse-aware explanations and translations. Keep the AI interface modular so on-device models, app-funded APIs and user-provided provider access can be evaluated separately. Preserve the original text, identify AI-generated explanations clearly, review quality and religious accuracy, and distinguish offline on-device features from online services. Do not add AI, payments or accounts solely based on this roadmap.

OpenAI's Sign in with ChatGPT can allow eligible users to consent to using their plan allowance in supported applications. Its documentation describes open-source/local integrations; paid or remotely hosted apps should use the commercial interest form and confirm eligibility, including for iOS/Android. Standard OpenAI API billing is separate. Signing in for AI must be optional; the core reader should not require a DivineCanvas account. Users without an eligible plan or consent need a clear alternative if AI is offered. Claude subscriptions and the Gemini API have separate access/billing arrangements; do not assume consumer plans grant third-party app access. Recheck all provider terms, availability, security and pricing when designing the feature.

References: https://developers.openai.com/siwc/token-sharing-open-source and https://openai.com/form/sign-in-with-chatgpt-interest/ .

## Itihasa preview — November 2026

The ordered Itihasa source at https://github.com/rahular/itihasa/tree/gh-pages/res was inspected at commit `a9e3807cdd20d46a0757f6d94760b92eefd46464` for the Ramayana and Mahabharata. The corpus is Sanskrit and English only; do not label English as Hindi. Ordered JSON has 642 and 2,110 chapter entries, with 19,371 and 73,659 aligned passage pairs respectively. Entries may contain multiple verses; numbering/structure and OCR require editorial review. The linked GitHub branch has no explicit license; the author's Hugging Face version is marked Apache-2.0, but application to these exact raw files and underlying works must be confirmed before redistribution or sale. Data is locally prepared and ignored by Git, included in EAS internal previews, and attributed to the corpus authors and M. N. Dutt. Approved generated book covers are bundled in their book asset directories.


## Separate book downloads — November 2026

The preview library offers per-book downloads from the public GitHub `book-data-v1` release. Each book has its own verified SQLite package and publicly downloadable source JSON. Downloaded books work offline; passage text is fetched in a seven-passage window, while chapter metadata remains bundled. Removing a download keeps local notes and reading progress. The initial version uses public URLs and has no purchases or access control. The Gita, Ramayana and Mahabharata source rights still require confirmation for public app distribution. EPUB import and payments remain future work.


## Ram Shalaka Prashnavali

Offline devotional section accessible from the Books section selector. The traditional 225 cells map to nine answer lines by row-major index modulo 9. Passages are from WirelessAlien/Ramcharitmanas, sourced from IIT Kanpur; the board was checked against Chalisa Sangrah. English and Hindi explanations are original summaries and still need editorial review. Source permission for redistribution remains to be independently confirmed. Haptics use cell and edge feedback on iOS/Android; validate real hardware and screen-reader behavior before publication.


## Interface language and credits

Settings → App language selects English or Hindi for the app interface. This preference is stored locally under `app-language`, independently from the selected reading language. Settings → Credits contains book, Prashnavali, voice, music, dictionary and icon sources and their relevant notices. Original text, English dictionary definitions and legal license texts retain their source languages.


## Offline spiritual learning and practice — ideas for future work

These are discussion ideas, not implemented or finalized. The longer-term goal is a broad, respectful Hindu spiritual companion that remains useful offline, with modular content and practices.

### Sanskrit word and compound learning

- Let readers tap annotated Sanskrit words or compounds to see their component forms, dictionary forms and literal meanings, and optionally how they relate to the existing translation. Start with a small, expert-reviewed Gita pilot and expand to other texts and languages as quality permits.
- Bundle or download versioned annotations for offline use, indexed by stable book, passage and token identifiers. Preserve the original verse and cite the source. Check linguistic data, translation and dictionary licensing separately, including commercial redistribution and attribution.
- Sanskrit sandhi, inflection and compounds can have multiple analyses; automatic splitting is not always reliable. Show uncertainty or alternative analyses when appropriate, and leave unannotated words without an invented explanation. Investigate offline dictionaries and segmentation tools as editorial aids, with review by Sanskrit experts.

#### Research: downloadable Sanskrit analysis pack

- Sanskrit Heritage Reader combines finite-state sandhi segmentation and morphological analysis with lexicons; its English interface uses Monier-Williams, while the original Heritage dictionary is Sanskrit–French. Its documented installation targets a workstation/server, so an iOS/Android integration would require an evaluated native port or another approach, not just a downloaded website. See https://sanskrit.uohyd.ac.in/SKT/manual.html and https://sanskrit.uohyd.ac.in/SKT/DICO/index.en.html.
- Compare an offline native prototype against Vidyut (Rust; segmentation and morphology, with separately sourced data): https://github.com/ambuda-org/vidyut and https://github.com/ambuda-org/vidyut/blob/main/vidyut-cheda/README.md. A third approach is to precompute analyses of the app's fixed book verses and ship reviewed annotations with book downloads. Test ambiguous compounds, word-to-verse mapping, speed, memory, accessibility and accuracy against expert-reviewed samples on real iOS and Android devices.
- An optional download should clearly show measured compressed and installed sizes, source, language coverage and removal controls, then work offline. An analysis engine identifies candidate forms; dictionary senses do not by themselves establish the contextual meaning or alignment with an existing translation. Hindi meanings require an appropriately licensed source.
- Review licenses for each exact engine, dictionary, model, corpus and generated data, plus mobile-store compatibility. The Heritage dictionary distribution at https://scl.samsaadhanii.in/SKT/goldendict.html states CC BY-NC 4.0; do not assume permission for a commercial app. The Zen library is LGPL, which does not settle the separate data rights. Evaluate the Cologne digital Monier-Williams edition and its CC BY-SA 4.0 terms as another English dictionary source: https://github.com/sanskrit-lexicon/MWS. A user-initiated download does not itself resolve redistribution or commercial-use rights.

### Japa mala and meditation

- Explore a local 108-bead counter with an accessible large tap target, visual progress, optional haptics, a completion chime and optional ambient tanpura or flute. Consider Om and other mantra recordings, repeat rounds, and locally saved progress. Keep sound and haptics independently controllable and respect system settings and devices without haptic hardware.
- The counter must work without internet; bundle small licensed sounds or let users download and retain audio for offline use. Verify composition, performance and recording rights separately, including commercial use. Clearly distinguish spoken synthesis from authentic chant recordings.
- Explore accessible external switches and platform-supported input. Do not rely on volume buttons: Apple's App Review rules restrict altering standard volume controls; Android behavior and device support also need investigation. Avoid promising background counting or screen-off input without platform-specific validation.

### Verse or thought of the day

- Select a passage once per local calendar day from an editorially reviewed pool, using stable passage IDs and a locally stored choice or deterministic selection. Open that exact passage in its book. Decide how to handle time zone changes, missing downloads, unavailable languages and paid books; do not assume all passage text is installed.
- A small bundled catalog or eligible downloaded books can support an offline daily selection. Optional reminders could use local notifications with permission, subject to operating-system scheduling limits. A future server-curated shared selection can use the same IDs, cache data for offline access and fall back locally when unavailable.
- Keep scriptural verses distinct from separately authored thoughts, review attribution and accuracy, and verify rights for every source.


## Accounts and understanding adoption — proposal, November 2026

The owner wants to understand who is downloading DivineCanvas and is considering login. The app is intended to stay free and ad-free for now. This is a proposal for investigation, not an implemented login, analytics system, privacy policy or change to the offline reader.

### Immediate measurement and optional accounts

- Start with aggregated App Store Connect and Google Play Console download/acquisition metrics; these do not reveal named downloaders and do not capture all sideloaded installs. Metrics, privacy thresholds and opt-in availability differ by store. TestFlight provides beta tester and install metrics separately. A login only counts people who register, not every downloader, and one person may use multiple devices.
- Apple guideline 5.1.1(v) says apps without significant account-based features must allow use without login. Keep guest reading and previously downloaded books available offline. Consider optional accounts when they offer an actual user benefit, such as explicit cross-device backup and sync of chosen data. Signing in and initial account creation require connectivity; define offline session expiration, sign-out, recovery and conflict behavior before building.
- Explore email-based passwordless login or passkeys via a managed authentication provider; evaluate Apple and Google sign-in and privacy requirements, provider pricing, export, data residency, account recovery and vendor dependence. Under Apple 4.8, applicable third-party primary login services require an equivalent privacy-preserving option unless an exception applies. User consent to download assets is separate from privacy disclosures and legal bases for personal data.

### Data minimization and design

- If an account is needed, consider a random account ID, verified email or provider identifier, account creation date and necessary security/session records. Email addresses may be relay addresses; do not assume a name or real email is available. Set justified retention limits and avoid collecting phone numbers, location, contacts, advertising identifiers or demographic details by default. Do not add analytics SDKs or identifiers without a documented need and disclosure.
- Reading history, notes, favorites, chapter selection and religious practice can be sensitive or reveal beliefs in context. Keep these local by default. Any future cloud sync should be separately explained and explicitly enabled, limited to the user's selections, and designed after a jurisdiction-specific legal/privacy review. Do not infer or profile religion. User-linked identifiers and pseudonymous identifiers can still be personal data.
- Use a reputable identity service, encrypted transport and encrypted storage, OS-protected session tokens, least-privilege database rules, server-side authorization, narrowly restricted administrator access, MFA for administrators, audit logs, backups, documented retention and deletion workflows. Do not store plaintext passwords. Avoid promising end-to-end encryption unless its key management, account recovery and limitations are actually designed and verified. App analytics must not collect verse-level religious usage or notes by default.
- Test deletion across the identity provider, application database and vendors; document backup expiry, any legally required retention and whether local data remains. Let users know what happens before deletion. Determine separately whether a deletion request should also offer deletion of locally stored material.

### Store requirements and legal review before launch

- Apple requires an accessible privacy policy in app and store metadata, accurate App Privacy disclosures including third-party SDKs, data minimization, and in-app account deletion initiation when account creation exists. Apply login-services guideline 4.8 where relevant and revoke Sign in with Apple tokens on deletion. Supply review access or a suitable demo.
- Google Play requires an accessible privacy policy in the store listing and app, accurate Data safety declarations including SDKs, secure handling, and in-app plus web-based account-deletion requests for accounts created in the app. Delete associated account data, subject to disclosed legitimate retention; provide prominent disclosure and affirmative consent when its policy requires them.
- Review applicable privacy laws, target regions, children and age policies, legal basis and potentially sensitive religious information with qualified counsel before collecting or syncing data. Specify controller, providers, purposes, sharing, retention, access/correction/deletion, contact and cross-border transfers in the policy. No implementation is authorized solely by this proposal.

References: https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/app-store/app-privacy-details/ ; https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/ ; https://developer.apple.com/app-store-connect/analytics/ ; https://developer.apple.com/help/app-store-connect/test-a-beta-version/view-build-status-and-metrics/ ; https://support.google.com/googleplay/android-developer/answer/10144311 ; https://support.google.com/googleplay/android-developer/answer/13327111 ; https://support.google.com/googleplay/android-developer/answer/10787469 ; https://support.google.com/googleplay/android-developer/answer/139628 ; https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en .
