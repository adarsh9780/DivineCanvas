import { setAudioModeAsync, type AudioPlaylist } from 'expo-audio';
import type { GeneratedSpeech } from './speech/engine';

let audioMode: boolean | undefined;
let pendingMode: Promise<void> = Promise.resolve();

/** Expo's audio mode is shared by the players and the Settings preview. */
export function configureReadingAudio(background: boolean): Promise<void> {
  const operation = pendingMode.then(async () => {
    if (audioMode === background) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: background,
      interruptionMode: background ? 'doNotMix' : 'mixWithOthers',
    });
    audioMode = background;
  });
  pendingMode = operation.catch(() => {});
  return operation;
}

export function setReadingMusicVolume(player: AudioPlaylist, volume: number) {
  player.volume = volume;
}

type PassageQueueOptions = {
  player: AudioPlaylist;
  start: number;
  count: number;
  generate: (position: number, signal: AbortSignal) => Promise<GeneratedSpeech>;
  beforePlay: () => Promise<void>;
  onPosition: (position: number) => void;
  onFinish: () => void;
  onError: (error: unknown) => void;
};

const KEEP_BEHIND = 3;
const PREPARE_AHEAD = 6;

export class PassageAudioQueue {
  private controller = new AbortController();
  private files: GeneratedSpeech[] = [];
  private first: number;
  private filling = false;
  private exhausted = false;
  private started = false;
  private wantsPlayback = true;
  position: number;

  constructor(private options: PassageQueueOptions) {
    this.position = options.start;
    this.first = Math.max(0, options.start - 1);
  }

  get hasStarted() { return this.started; }

  private get player() { return this.options.player; }
  private get stopped() { return this.controller.signal.aborted; }

  async start() {
    try {
      // Prepare one previous passage before starting so it is a real native
      // playlist item and can be reached even with the screen locked.
      await this.append(this.first);
      if (this.first !== this.position) await this.append(this.position);
      if (this.stopped) return;
      if (this.first !== this.position) this.player.skipTo(this.position - this.first);
      await this.options.beforePlay();
      if (this.stopped) return;
      this.started = true;
      if (this.wantsPlayback) this.player.play();
      void this.fill();
    } catch (error) {
      if (!this.stopped) this.options.onError(error);
    }
  }

  private async append(position: number) {
    const file = await this.options.generate(position, this.controller.signal);
    if (this.stopped) {
      await file.dispose();
      return;
    }
    this.files.push(file);
    this.player.add({ uri: file.uri });
  }

  private async fill() {
    if (this.filling || this.stopped) return;
    this.filling = true;
    try {
      while (!this.stopped) {
        const next = this.first + this.files.length;
        if (next >= this.options.count || next > this.position + PREPARE_AHEAD) break;
        await this.append(next);
        if (this.stopped) return;
        if (this.exhausted && next === this.position + 1) {
          this.exhausted = false;
          this.player.skipTo(next - this.first);
          this.setPosition(next);
          if (this.wantsPlayback && !this.player.remoteTransportPaused) this.player.play();
        }
      }
    } catch (error) {
      if (!this.stopped) this.options.onError(error);
    } finally {
      this.filling = false;
    }
  }

  private setPosition(position: number) {
    if (position === this.position) return;
    this.position = position;
    this.options.onPosition(position);
  }

  syncPosition() {
    if (!this.started || this.stopped || this.exhausted) return;
    const index = this.player.currentIndex;
    if (index < 0 || index >= this.files.length) return;
    this.setPosition(this.first + index);
    while (this.position - this.first > KEEP_BEHIND) {
      const file = this.files.shift();
      this.first++;
      this.player.remove(0);
      if (file) void file.dispose().catch(() => {});
    }
    void this.fill();
  }

  finishTrack() {
    if (!this.started || this.stopped || this.exhausted) return;
    this.exhausted = true;
    if (this.position >= this.options.count - 1) {
      this.options.onFinish();
      return;
    }
    void this.fill();
  }

  pause() {
    this.wantsPlayback = false;
    if (this.started) this.player.pause();
  }

  resume() {
    this.wantsPlayback = true;
    if (this.started && !this.exhausted) this.player.play();
  }

  setRemotePlaying(playing: boolean) {
    this.wantsPlayback = playing;
  }

  dispose() {
    this.controller.abort();
    this.player.clear();
    for (const file of this.files) void file.dispose().catch(() => {});
    this.files = [];
  }
}
