import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2BucketName } from "@/lib/r2/r2-client";
import { v4 as uuidv4 } from "uuid";
import logger from "@/lib/logger";
import { getFileExtension } from "@/lib/validations/upload.schema";

const ALLOWED_PUBLIC_TYPES: Record<string, string> = {
  pdf: "application/pdf",
};
const ALLOWED_ADMIN_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const MAX_PUBLIC_SIZE = Math.floor(2.5 * 1024 * 1024); // 2.5MB
const MAX_ADMIN_SIZE = 10 * 1024 * 1024; // 10MB

export const r2Service = {
  /**
   * Generate a presigned URL for file upload
   */
  async generatePresignedUrl(
    originalName: string,
    contentType: string,
    size: number,
    isAdmin: boolean = false
  ): Promise<{
    uploadUrl: string;
    fileKey: string;
    publicUrl: string;
  }> {
    const extension = getFileExtension(originalName);
    const allowedTypes = isAdmin ? ALLOWED_ADMIN_TYPES : ALLOWED_PUBLIC_TYPES;
    const expectedMime = allowedTypes[extension];

    if (!extension || !expectedMime) {
      throw new Error(
        "Tipo de archivo no permitido"
      );
    }
    if (contentType !== expectedMime) {
      throw new Error("Tipo MIME inválido para la extensión del archivo");
    }

    const maxSize = isAdmin ? MAX_ADMIN_SIZE : MAX_PUBLIC_SIZE;
    if (size > maxSize) {
      throw new Error(
        `El archivo excede el tamaño máximo de ${maxSize / (1024 * 1024)}MB`
      );
    }

    const r2 = getR2Client();
    const bucket = getR2BucketName();

    const fileKey = `requerimientos/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: contentType,
    });

    // Presigned URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    logger.info({ fileKey, contentType, size }, "Presigned URL generated");

    return {
      uploadUrl,
      fileKey,
      publicUrl: `/api/documentos?key=${encodeURIComponent(fileKey)}`, // Internally generated link
    };
  },

  /**
   * Generate a presigned URL for file download/viewing
   */
  async generatePresignedGetUrl(fileKey: string): Promise<string> {
    const r2 = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    // Presigned GET URL expires in 10 minutes
    const url = await getSignedUrl(r2, command, { expiresIn: 600 });
    return url;
  },

  async putBuffer(fileKey: string, body: Buffer, contentType: string): Promise<void> {
    const r2 = getR2Client();
    const bucket = getR2BucketName();
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
      })
    );
    logger.info({ fileKey, contentType, size: body.length }, "File uploaded to R2");
  },

  async getFileBuffer(fileKey: string): Promise<Buffer> {
    const r2 = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    });

    const response = await r2.send(command);
    if (!response.Body) throw new Error("Archivo vacío en R2");
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  },
};
