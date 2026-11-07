import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Kartı önbellek klasörüne yazar ve sistemin paylaşım menüsünü açar.
export async function shareImage(bytes: Uint8Array, title: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, `plumbline-${Date.now()}.png`);
  try {
    file.create();
    await file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
    return true;
  } catch {
    return false;
  }
}
