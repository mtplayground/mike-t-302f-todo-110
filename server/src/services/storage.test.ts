import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import {
  buildPublicImageUrl,
  deleteTaskImage,
  generateTaskImageKey,
  uploadTaskImage,
  validateImageUpload,
} from "./storage.js";

describe("storage service", () => {
  it("validates supported image MIME types and size", () => {
    expect(
      validateImageUpload({
        buffer: new Uint8Array([1]),
        contentType: "image/png",
        size: 1,
      })
    ).toBe("image/png");

    expectAppError(
      () =>
        validateImageUpload({
          buffer: new Uint8Array([1]),
          contentType: "text/plain",
          size: 1,
        }),
      {
        code: "INVALID_IMAGE_TYPE",
        statusCode: 400,
      }
    );

    expectAppError(
      () =>
        validateImageUpload({
          buffer: new Uint8Array([1]),
          contentType: "image/jpeg",
          size: env.MAX_IMAGE_BYTES + 1,
        }),
      {
        code: "IMAGE_TOO_LARGE",
        statusCode: 413,
      }
    );
  });

  it("uploads images with a random key and returns metadata", async () => {
    const sentCommands: unknown[] = [];
    const client = {
      send: vi.fn(async (command: unknown) => {
        sentCommands.push(command);
        return {};
      }),
    };
    const buffer = new Uint8Array([1, 2, 3]);

    const metadata = await uploadTaskImage(
      {
        buffer,
        contentType: "image/webp",
        size: buffer.byteLength,
      },
      client
    );

    expect(metadata).toMatchObject({
      imageContentType: "image/webp",
      imageSize: buffer.byteLength,
    });
    expect(metadata.imageKey).toMatch(
      new RegExp(
        "^tasks/images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$"
      )
    );
    expect(metadata.imageUrl).toBe(buildPublicImageUrl(metadata.imageKey));
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(sentCommands[0]).toBeInstanceOf(PutObjectCommand);
    expect((sentCommands[0] as PutObjectCommand).input).toMatchObject({
      Body: buffer,
      Bucket: env.S3_BUCKET,
      ContentLength: buffer.byteLength,
      ContentType: "image/webp",
      Key: metadata.imageKey,
    });
  });

  it("deletes images by object key", async () => {
    const sentCommands: unknown[] = [];
    const client = {
      send: vi.fn(async (command: unknown) => {
        sentCommands.push(command);
        return {};
      }),
    };

    await deleteTaskImage("tasks/images/example.png", client);

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(sentCommands[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((sentCommands[0] as DeleteObjectCommand).input).toMatchObject({
      Bucket: env.S3_BUCKET,
      Key: "tasks/images/example.png",
    });
  });

  it("does not delete when no image key is present", async () => {
    const client = {
      send: vi.fn(async () => ({})),
    };

    await deleteTaskImage(null, client);
    await deleteTaskImage("   ", client);

    expect(client.send).not.toHaveBeenCalled();
  });

  it("generates keys without using user filenames", () => {
    const key = generateTaskImageKey("image/jpeg");

    expect(key).toMatch(
      new RegExp(
        "^tasks/images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$"
      )
    );
    expect(key).not.toContain("profile");
    expect(key).not.toContain("upload");
  });
});

function expectAppError(
  action: () => unknown,
  expected: {
    readonly code: string;
    readonly statusCode: number;
  }
): void {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject(expected);
    return;
  }

  throw new Error("Expected action to throw");
}
