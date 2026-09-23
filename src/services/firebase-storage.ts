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
      metadata: uploaded.downloadToken
        ? { downloadToken: uploaded.downloadToken }
        : undefined,
    };
  }

  async getUrl(_userId: string, attachment: Attachment) {
    if (!attachment.externalId) return null;
    const token =
      typeof attachment.metadata?.downloadToken === "string"
        ? attachment.metadata.downloadToken
        : undefined;
    return firebaseClient.getDownloadUrl(attachment.externalId, token);
  }

  async remove(_userId: string, id: string) {
    await firebaseClient.deleteFile(id);
  }
}
