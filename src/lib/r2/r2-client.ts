import { S3Client } from "@aws-sdk/client-s3";

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 environment variables");
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _r2Client;
}

export function getR2BucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) throw new Error("R2_BUCKET_NAME is not configured");
  return bucketName;
}

export function getR2PublicUrl(): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) throw new Error("R2_PUBLIC_URL is not configured");
  return publicUrl;
}
