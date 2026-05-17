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
      ContentLength: size,
      ContentDisposition: `inline; filename="${originalName.replace(/"/g, "")}"`,
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
};
