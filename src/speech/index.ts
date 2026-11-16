import { SpeechEngineRegistry } from './registry';
import { paradeeFactory } from './paradee/adapter';

export const speechEngines = new SpeechEngineRegistry();
speechEngines.register(paradeeFactory);
export const defaultSpeechEngineId = 'paradee';
