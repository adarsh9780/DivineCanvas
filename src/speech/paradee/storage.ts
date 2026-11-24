import { Directory, File, Paths } from 'expo-file-system';
import type { SpeechDownloadProgress } from '../engine';
import { PARADEE_ASSETS, PARADEE_DOWNLOAD_BYTES } from './assets';

const folder = () => new Directory(Paths.document, 'speech-engines');
export const paradeeDirectory = () => new Directory(folder(), 'paradee-1.3');
let installing = false;

/** A voice is available only when all expected files passed verification. */
export function isParadeeInstalled(): boolean {
  const directory = paradeeDirectory();
  return directory.exists && new File(directory, 'verified.json').exists &&
    PARADEE_ASSETS.every(asset => new File(directory, asset.name).exists);
}

export async function installParadee(options: {signal?: AbortSignal; onProgress?: (progress: SpeechDownloadProgress) => void} = {}): Promise<void> {
  if (installing) throw new Error('A voice download is already in progress.');
  if (isParadeeInstalled()) return;
  installing = true;
  const staging = new Directory(folder(), `paradee-staging-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let completedBytes = 0;
  let moved = false;
  try {
    folder().create({idempotent:true, intermediates:true});
    staging.create({intermediates:true});
    for (const asset of PARADEE_ASSETS) {
      if (options.signal?.aborted) throw new Error('Download cancelled.');
      const file = new File(staging, asset.name);
      const task = File.createDownloadTask(asset.url, file, {
        signal: options.signal,
        onProgress: ({bytesWritten}) => options.onProgress?.({completedBytes:completedBytes + bytesWritten, totalBytes:PARADEE_DOWNLOAD_BYTES}),
      });
      const downloaded = await task.downloadAsync();
      if (!downloaded || options.signal?.aborted) throw new Error('Download cancelled.');
      if (await downloaded.digest('SHA-256') !== asset.sha256) throw new Error(`Verification failed for ${asset.name}.`);
      completedBytes += downloaded.size ?? asset.size;
      options.onProgress?.({completedBytes, totalBytes:PARADEE_DOWNLOAD_BYTES});
    }
    if (options.signal?.aborted) throw new Error('Download cancelled.');
    await new File(staging, 'verified.json').write(JSON.stringify({version:'1.3', sourceRevision:'b569f5efb789af5ba643a44af348427242ceb784'}));
    const final = paradeeDirectory();
    if (final.exists) final.delete();
    await staging.move(final);
    moved = true;
  } finally {
    if (!moved && staging.exists) staging.delete();
    installing = false;
  }
}

export function removeParadee(): void {
  if (installing) throw new Error('Wait for the voice download to finish.');
  const directory = paradeeDirectory();
  if (directory.exists) directory.delete();
}

export function paradeeFile(name: typeof PARADEE_ASSETS[number]['name']): File {
  if (!isParadeeInstalled()) throw new Error('The voice has not been downloaded.');
  return new File(paradeeDirectory(), name);
}
