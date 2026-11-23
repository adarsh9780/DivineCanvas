/** Contracts for interchangeable, device-local narration engines.
 * Implementations own their downloads, temporary files and native resources.
 */
export type SpeechLanguage = 'en' | 'hi' | 'sa';
export type SpeechVoice = { id: string; name: string; languages: readonly SpeechLanguage[] };
export type SpeechEngineInfo = { id: string; name: string; version: string; voices: readonly SpeechVoice[] };
export type SpeechDownloadProgress = { completedBytes: number; totalBytes?: number };
export type SpeechRequest = { text: string; language: SpeechLanguage; voiceId: string; rate?: number; expressiveness?: number };

/** A generated file remains owned by the engine until dispose is called. */
export type GeneratedSpeech = { uri: string; dispose(): Promise<void> };

export interface SpeechEngine {
  readonly info: SpeechEngineInfo;
  isInstalled(): Promise<boolean>;
  install(options: { signal?: AbortSignal; onProgress?: (progress: SpeechDownloadProgress) => void }): Promise<void>;
  uninstall(): Promise<void>;
  synthesize(request: SpeechRequest, signal?: AbortSignal): Promise<GeneratedSpeech>;
  dispose(): Promise<void>;
}
