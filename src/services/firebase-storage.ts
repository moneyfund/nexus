import type { Attachment } from "@/domain/models";
import { entity } from "@/domain/seed";
import { firebaseClient } from "@/lib/firebase";
import type { StorageProvider } from "./providers";

export class RestFirebaseStorageProvider implements StorageProvider {
  async upload(userId: string, file: File): Promise<Attachment> {
    const uploaded = await firebaseClient.uploadFile(file);
    return {
      ...entity(crypto.randomUUID(), "user", userId),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      provider: "firebase",
      externalId: uploaded.path,
    };
  }

  async getUrl(userId: string, attachment: Attachment) {
    if (
      attachment.userId !== userId ||
      attachment.provider !== "firebase" ||
      !attachment.externalId
    )
      return null;

    return firebaseClient.getDownloadUrl(attachment.externalId);
  }

  async remove(_userId: string, id: string) {
    await firebaseClient.deleteFile(id);
  }
}
