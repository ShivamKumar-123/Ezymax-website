// Hands a file the client asked for (the personal-data export) to the system share sheet: save to Files, AirDrop,
// email… The file is written to the app's cache first and never uploaded anywhere by the app.
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function shareJson(name: string, data: unknown, title: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(data, null, 2));
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}
