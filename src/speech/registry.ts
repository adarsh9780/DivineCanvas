import type { SpeechEngine, SpeechEngineInfo } from './engine';

/** Engines register through factories so native modules are loaded only when needed. */
export type SpeechEngineFactory = { info: SpeechEngineInfo; create(): Promise<SpeechEngine> };

export class SpeechEngineRegistry {
  private readonly factories = new Map<string, SpeechEngineFactory>();

  register(factory: SpeechEngineFactory): void {
    if (this.factories.has(factory.info.id)) throw new Error(`Speech engine already registered: ${factory.info.id}`);
    this.factories.set(factory.info.id, factory);
  }

  list(): readonly SpeechEngineInfo[] {
    return Array.from(this.factories.values(), factory => factory.info);
  }

  async create(id: string): Promise<SpeechEngine> {
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`Unknown speech engine: ${id}`);
    return factory.create();
  }
}
