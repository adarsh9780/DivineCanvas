# TestFlight rights and release preparation

Research date: 19 November 2026. This records source statements and unresolved questions, not legal advice or a claim of cleared distribution. Permission emails below are drafts; none have been sent.

## Distribution decision

The current app is a free, ad-free beta. Confirm rights for all included or downloadable assets before inviting people to a beta; TestFlight is distribution too. Existing book packages and source JSON are already publicly hosted at the `book-data-v1` GitHub release, independently of TestFlight. Record the scope and date of each permission, including rights for beta, public release, offline copies, redistribution, territory, future monetization and attribution. Do not characterize a beta as private merely because invitations are limited.

## Book source research

### Bhagavad Gita — Hansi Gita Bhawan Trust

The Trust's [research page](https://gitabhawan.org.in/gita/research) offers all 700 verses in JSON, CSV and plain text. It says the Sanskrit is public domain, that the Trust owns its own English and Hindi translations, and that these translations may be quoted, taught from and built on freely with attribution and a link. The app's Credits identifies the Trust and links to that page. This is substantial evidence of intended reuse, but the public wording does not specifically spell out distributing all translations as offline mobile app databases, hosting public copies or future paid app features. Request clarification covering those uses; do not represent it as an express refusal or as a named open-source license. Trust contact: [contact page](https://gitabhawan.org.in/contact), info@gitabhawan.org.in.

### Ramayana and Mahabharata — Itihasa ordered corpus

The authors' [Hugging Face dataset card](https://huggingface.co/datasets/rahular/itihasa/blob/main/README.md) identifies Apache-2.0 and describes 93,000 Sanskrit–English pairs from M. N. Dutt's editions. It says that its files are randomized splits and links to [the original ordered JSON](https://github.com/rahular/itihasa/tree/gh-pages/res), which DivineCanvas processes from pinned commit `a9e3807cdd20d46a0757f6d94760b92eefd46464`. The Apache label is encouraging, but the linked ordered branch does not independently make its license clear; it should not automatically be treated as a grant for every upstream edition, scan, extraction, or modification. Ask the corpus authors to confirm the exact files and rights, including offline commercial and noncommercial redistribution. Record provenance of each Dutt edition and the applicable rights in the intended markets; the underlying old works and the modern digitization are separate considerations. Do not claim international public-domain status without verification. Citation: [Aralikatte et al., 2021](https://aclanthology.org/2021.wat-1.22/).

### Prashnavali

[WirelessAlien/Ramcharitmanas](https://github.com/WirelessAlien/Ramcharitmanas) identifies the repository as Unlicense, explicitly allows app use, contains no translation or commentary, and credits the IIT Kanpur Ramcharitmanas project as its source. Verify that the exact board passages and transcription can be reused, including upstream rights; the board was checked against Chalisa Sangrah, which is a separate reference. The app's Hindi and English explanation summaries are original but require editorial review. The original poem, transcription, board selection and explanatory text have distinct provenance.

## Other assets that ship or are offered

- The owner confirmed that the 14 reading backgrounds were generated using ChatGPT. OpenAI’s [consumer terms](https://openai.com/policies/terms-of-use/) state that, as between the user and OpenAI and to the extent permitted by law, the user owns output; OpenAI also describes commercial use as permitted subject to its terms and policies: https://help.openai.com/en/articles/6783457-chatgpt-privacy-and-data-security. This does not independently resolve rights in any third-party reference inputs or other legal questions. The separate cover assets still need provenance.
- [Krishna Flute Music](https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/) is stated as CC BY 4.0. Ensure the app's credit includes author, title, source, license link and whether the file was changed. The source page identifies it as partly or wholly AI-generated.
- [Paradee 8M v1.3](https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3) is labelled Apache-2.0. Verify the pinned files and accompanying G2P assets separately, retain required notices, and confirm host terms. Hindi speech is experimental for Sanskrit, not a Sanskrit voice.
- [Open English Wordnet 2025](https://en-word.net/downloads) says CC BY 4.0 and derives from Princeton WordNet. Check attribution and notices against the exact downloaded 2025 artifact: the current embedded notice names 2023.
- Review icon, font, sound, dependency and model notices, exact sources, app privacy disclosures, and host terms in the actual build.

## Draft: permission / clarification for Hansi Gita Bhawan Trust

To: info@gitabhawan.org.in

Subject: Permission to distribute your Gita translations in a free offline reading app

Namaste,

I am preparing DivineCanvas, a free and ad-free reading app for iPhone, iPad and Android. We use your 700-verse dataset, including the Trust's Hindi and English translations, downloaded from your research page. We credit Hansi Gita Bhawan Trust and link to that page in the app.

Your page says the translations may be quoted, taught from and built on freely with attribution. Could you please confirm whether we may distribute all 700 translations in a downloadable, locally stored database for offline reading, including hosting copies for app users and distributing them to TestFlight beta testers and, later, the public worldwide? Please also let us know your preferred attribution and whether optional future paid app features or paid books would change that permission. We will keep the Gita free.

Thank you for making this work available.

[Name and contact]

## Draft: clarification for Itihasa corpus authors

Contact: author via the [Itihasa paper](https://aclanthology.org/2021.wat-1.22/) or [project repository](https://github.com/rahular/itihasa). Verify the current contact method before sending.

Subject: License clarification for ordered Itihasa JSON in an offline app

Hello,

I am preparing DivineCanvas, a free, ad-free offline reading app. We have used the ordered Ramayana and Mahabharata JSON from the `gh-pages/res` branch of the Itihasa repository at commit `a9e3807cdd20d46a0757f6d94760b92eefd46464`. We convert the Sanskrit–English text into downloadable SQLite databases while retaining source attribution, and would like to distribute those databases to TestFlight testers and later to public app users.

Your Hugging Face dataset card identifies Apache-2.0 for the randomized corpus and links to the ordered JSON. Could you confirm whether the same license covers these exact ordered JSON files and whether you know of any source-edition, digitization, or third-party restrictions on offline redistribution? Please let us know any required attribution or notices. We would also like to understand whether the same permission would apply if the app later included optional paid features.

Thank you for your work and guidance.

[Name and contact]

## TestFlight preparation checklist

- [ ] Resolve the book and other asset rights for the actual beta distribution and public download hosting; retain the evidence and required notices.
- [ ] Confirm developer account, app record, identifier, current agreements, signing and App Store Connect access. On 19 November, the account in the in-app browser received the message “Your Apple Account isn’t enabled for App Store Connect”; the reason is not established. A paid Apple Developer Program membership or access through an eligible enrolled team is normally required; check the correct Apple account and membership before assuming enrollment is missing. See https://developer.apple.com/help/account/basics/about-your-developer-account/. Do not confuse the `preview` internal-device build with an App Store distribution build.
- [ ] Create an iOS App Store-signed build using the production configuration, upload it to App Store Connect, and verify processing. A successful compile or local development install does not establish this.
- [ ] Finalize an accurate privacy policy and support/feedback contact; verify all download hosts, SDKs and app privacy disclosures. Complete the relevant TestFlight/App Store Connect information.
- [ ] Run typecheck, lint, meaningful tests and real-device install/update/offline checks, including iPhone and iPad.
- [ ] Add a small internal team group first. For external testers, complete Beta App Review and invite only once rights and beta information are ready. TestFlight is not a public App Store release.

Official Apple guidance: https://developer.apple.com/testflight/ and https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/ .
