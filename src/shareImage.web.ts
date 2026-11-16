import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// expo-sharing cannot share a local file URI on web. Keep the browser preview
// useful without uploading the reader's passage to an external service.
export async function sharePassageImage(view: ComponentRef<typeof View>, filename: string): Promise<void> {
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'data-uri' });
  const link = document.createElement('a');
  link.href = uri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
