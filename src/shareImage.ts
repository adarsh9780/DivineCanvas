import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export async function sharePassageImage(view: ComponentRef<typeof View>, _filename: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is not available on this device.');
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  // The receiving app may read the file after the share sheet closes.
  // Keep it in the temporary cache so the OS can clean it up later.
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share passage' });
}
