# Offline narration

The reader accesses voice engines through `src/speech/engine.ts` and the lazy registry in `src/speech/index.ts`. The first adapter is Paradee 1.3, in `src/speech/paradee/adapter.ts`; model download, deletion, pinned revisions and SHA-256 verification live in `assets.ts` and `storage.ts`. The user can download or remove the voice in Settings. Model files total about 10.6 MB; the native ONNX runtime increases application size separately.

The adapter runs locally and creates temporary 24 kHz WAV files. It uses Paradee's learned grapheme-to-phoneme model and lexicon with simplified text normalization. It does not implement the full upstream English misaki pipeline, punctuation context, or number normalization, so pronunciation can differ from the desktop reference. The Hindi voice is used experimentally for Sanskrit; it is not a Sanskrit voice. Verify the results on real passages and devices before release.

The read-aloud button reads the selected passage. Speech pauses auto-scroll, lowers music volume, and stops on passage, language, tab or app-state changes. No narration runs as a background service. Downloading or reading speech requires a development or standalone build containing `onnxruntime-react-native`; Expo Go does not provide this native module. The user can continue using Expo Go for other app features.

Validate downloads, interruption/cancellation, voice quality, playback, memory and performance on physical iOS and Android before distribution. The desktop ONNX pipeline smoke test and Expo JS bundle do not replace device testing. Future engines should implement `SpeechEngine` and register a factory; keep model-specific pronunciation, downloads and cleanup inside the adapter.

Upstream: https://github.com/sahilmahendrakar/paradee and https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3
