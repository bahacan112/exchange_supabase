import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.IDRIVE_E2_REGION,
  endpoint: process.env.IDRIVE_E2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.IDRIVE_E2_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true  // gerekirse, bazen path-style istenebiliyor
});

/**
 * Dosya yükler.
 * @param key - bucket içindeki dosya adı (örneğin klasör/isim.ext)
 * @param body - dosya verisi
 * @param contentType - MIME tipi
 */
export async function uploadFile(
  key: string, 
  body: Buffer | Uint8Array | string, 
  contentType: string = 'application/octet-stream'
) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.IDRIVE_E2_BUCKET!,
    Key: key,
    Body: body,
    ContentType: contentType
  });

  const res = await s3.send(cmd);
  return res;
}

/**
 * Dosya indirme URL'si (imzalı) alır.
 * @param key 
 * @param expiresIn - saniye cinsinden geçerlilik süresi
 */
export async function getDownloadUrl(key: string, expiresIn: number = 3600) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.IDRIVE_E2_BUCKET!,
    Key: key
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return url;
}

/**
 * Bucket içindeki dosyaları listeler.
 * @param prefix - option prefix (klasör gibi düşün)
 */
export async function listFiles(prefix: string = '') {
  const cmd = new ListObjectsCommand({
    Bucket: process.env.IDRIVE_E2_BUCKET!,
    Prefix: prefix
  });

  const res = await s3.send(cmd);
  return res.Contents;  // liste bilgisi; undefined olabilir, null check yap
}

/**
 * Dosyayı siler.
 * @param key 
 */
export async function deleteFile(key: string) {
  const cmd = new DeleteObjectCommand({
    Bucket: process.env.IDRIVE_E2_BUCKET!,
    Key: key
  });

  const res = await s3.send(cmd);
  return res;
}

/**
 * Dosya okur ve stream olarak döner.
 * @param key 
 */
export async function getFile(key: string) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.IDRIVE_E2_BUCKET!,
    Key: key
  });

  const res = await s3.send(cmd);
  return res.Body;
}