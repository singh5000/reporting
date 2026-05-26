import { promises as fs } from "fs";
import path from "path";
import { config } from "../../config";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function uploadFileLocal(
  key: string,
  body: Buffer,
): Promise<{ key: string; url: string }> {
  const filePath = path.join(UPLOADS_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
  return { key, url: `${config.server.url}/uploads/${key}` };
}

export async function getLocalDownloadUrl(key: string): Promise<string> {
  return `${config.server.url}/uploads/${key}`;
}

export async function deleteFileLocal(key: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, key);
  await fs.unlink(filePath).catch(() => {});
}

export function getLocalFilePath(key: string): string {
  return path.join(UPLOADS_DIR, key);
}
