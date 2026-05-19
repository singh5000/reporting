import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../../config";

const s3 = new S3Client({
  region: config.storage.region,
  credentials:
    config.storage.accessKeyId && config.storage.secretAccessKey
      ? {
          accessKeyId: config.storage.accessKeyId,
          secretAccessKey: config.storage.secretAccessKey,
        }
      : undefined,
  ...(config.storage.endpoint
    ? { endpoint: config.storage.endpoint, forcePathStyle: true }
    : {}),
});

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      Metadata: metadata,
    })
  );

  const url = config.storage.endpoint
    ? `${config.storage.endpoint}/${config.storage.bucket}/${key}`
    : `https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com/${key}`;

  return { key, url, bucket: config.storage.bucket };
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresInSeconds = 600
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: mimeType,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key })
  );
}

export function buildStorageKey(
  tenantId: string,
  folder: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  return `${tenantId}/${folder}/${timestamp}-${sanitized}`;
}
