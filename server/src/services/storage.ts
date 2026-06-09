import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type DeleteObjectCommandInput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

export const allowedImageContentTypes = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageContentType = (typeof allowedImageContentTypes)[number];

export interface UploadImageInput {
  readonly buffer: Uint8Array;
  readonly contentType: string;
  readonly size: number;
}

export interface UploadedImageMetadata {
  readonly imageContentType: AllowedImageContentType;
  readonly imageKey: string;
  readonly imageSize: number;
  readonly imageUrl: string;
}

interface S3CommandSender {
  send(command: DeleteObjectCommand | PutObjectCommand): Promise<unknown>;
}

const imageExtensions: Record<AllowedImageContentType, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const testImageObjects = new Map<
  string,
  {
    readonly buffer: Buffer;
    readonly contentType: AllowedImageContentType;
  }
>();

const defaultS3Client = new S3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  region: env.S3_REGION,
});

export function validateImageUpload(input: UploadImageInput): AllowedImageContentType {
  if (!isAllowedImageContentType(input.contentType)) {
    throw new AppError("Unsupported image content type", {
      code: "INVALID_IMAGE_TYPE",
      details: {
        allowedContentTypes: allowedImageContentTypes,
        contentType: input.contentType,
      },
      statusCode: 400,
    });
  }

  if (input.size > env.MAX_IMAGE_BYTES) {
    throw new AppError("Image exceeds maximum allowed size", {
      code: "IMAGE_TOO_LARGE",
      details: {
        maxImageBytes: env.MAX_IMAGE_BYTES,
        size: input.size,
      },
      statusCode: 413,
    });
  }

  return input.contentType;
}

export async function uploadTaskImage(
  input: UploadImageInput,
  client: S3CommandSender = defaultS3Client
): Promise<UploadedImageMetadata> {
  const contentType = validateImageUpload(input);
  const imageKey = generateTaskImageKey(contentType);

  if (usesLocalTestStorage(client)) {
    testImageObjects.set(imageKey, {
      buffer: Buffer.from(input.buffer),
      contentType,
    });

    return {
      imageContentType: contentType,
      imageKey,
      imageSize: input.size,
      imageUrl: buildPublicImageUrl(imageKey),
    };
  }

  const commandInput: PutObjectCommandInput = {
    Body: input.buffer,
    Bucket: env.S3_BUCKET,
    ContentLength: input.size,
    ContentType: contentType,
    Key: imageKey,
  };

  try {
    await client.send(new PutObjectCommand(commandInput));
  } catch (cause) {
    throw new AppError("Image upload failed", {
      cause,
      code: "IMAGE_UPLOAD_FAILED",
      statusCode: 502,
    });
  }

  return {
    imageContentType: contentType,
    imageKey,
    imageSize: input.size,
    imageUrl: buildPublicImageUrl(imageKey),
  };
}

export async function deleteTaskImage(
  imageKey: string | null | undefined,
  client: S3CommandSender = defaultS3Client
): Promise<void> {
  if (!imageKey) {
    return;
  }

  const trimmedKey = imageKey.trim();

  if (!trimmedKey) {
    return;
  }

  if (usesLocalTestStorage(client)) {
    testImageObjects.delete(trimmedKey);
    return;
  }

  const commandInput: DeleteObjectCommandInput = {
    Bucket: env.S3_BUCKET,
    Key: trimmedKey,
  };

  try {
    await client.send(new DeleteObjectCommand(commandInput));
  } catch (cause) {
    throw new AppError("Image delete failed", {
      cause,
      code: "IMAGE_DELETE_FAILED",
      statusCode: 502,
    });
  }
}

export async function createSignedTaskImageUrl(
  imageKey: string,
  options: {
    readonly client?: S3Client;
    readonly expiresInSeconds?: number;
  } = {}
): Promise<string> {
  const trimmedKey = imageKey.trim();

  if (!trimmedKey) {
    throw new AppError("Image key is required", {
      code: "IMAGE_KEY_REQUIRED",
      statusCode: 400,
    });
  }

  if (env.NODE_ENV === "test" && !options.client) {
    const imageObject = testImageObjects.get(trimmedKey);

    if (imageObject) {
      return `data:${imageObject.contentType};base64,${imageObject.buffer.toString("base64")}`;
    }
  }

  return getSignedUrl(
    options.client ?? defaultS3Client,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: trimmedKey,
    }),
    {
      expiresIn: options.expiresInSeconds ?? 900,
    }
  );
}

export function buildPublicImageUrl(imageKey: string): string {
  const baseUrl = env.S3_PUBLIC_BASE_URL.endsWith("/")
    ? env.S3_PUBLIC_BASE_URL
    : `${env.S3_PUBLIC_BASE_URL}/`;
  const encodedKey = imageKey.split("/").map(encodeURIComponent).join("/");

  return new URL(encodedKey, baseUrl).toString();
}

export function generateTaskImageKey(contentType: AllowedImageContentType): string {
  return `tasks/images/${randomUUID()}.${imageExtensions[contentType]}`;
}

function isAllowedImageContentType(contentType: string): contentType is AllowedImageContentType {
  return allowedImageContentTypes.includes(contentType as AllowedImageContentType);
}

function usesLocalTestStorage(client: S3CommandSender): boolean {
  return env.NODE_ENV === "test" && client === defaultS3Client;
}
