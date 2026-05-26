import { config } from "../../config";
import {
  uploadFile as uploadFileS3,
  getPresignedDownloadUrl as getPresignedDownloadUrlS3,
  deleteFile as deleteFileS3,
  buildStorageKey,
} from "./s3.service";
import { uploadFileLocal, getLocalDownloadUrl, deleteFileLocal } from "./local.service";

export { buildStorageKey };

export interface UploadResult {
  key: string;
  url: string;
  bucket?: string;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  if (config.storage.provider === "local") {
    return uploadFileLocal(key, body);
  }
  return uploadFileS3(key, body, mimeType, metadata);
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (config.storage.provider === "local") {
    return getLocalDownloadUrl(key);
  }
  return getPresignedDownloadUrlS3(key, expiresInSeconds);
}

export async function deleteFile(key: string): Promise<void> {
  if (config.storage.provider === "local") {
    return deleteFileLocal(key);
  }
  return deleteFileS3(key);
}
