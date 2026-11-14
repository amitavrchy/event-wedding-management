import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, open, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { AuthGuard } from "./auth";
import { Database } from "./prisma";
import { parse, z } from "./validation";
import { isProduction } from "./config";

/**
 * File uploads. Clients ask for an upload slot, send the bytes straight to
 * object storage (S3, Cloudflare R2, MinIO), then confirm. The server checks
 * size and the file's real type (magic bytes) before marking it ready.
 *
 * STORAGE_DRIVER = s3 | local (local is for development only)
 * S3_BUCKET, S3_REGION, S3_ENDPOINT?, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * S3_PUBLIC_URL (CDN/base URL for public objects), S3_FORCE_PATH_STYLE=true for MinIO
 */
const IMAGE = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT = [...IMAGE, "application/pdf"];
const MB = 1024 * 1024;
export const purposes = {
  VENDOR_PORTFOLIO: { types: IMAGE, maxBytes: 8 * MB, public: true },
  VENDOR_LOGO: { types: IMAGE, maxBytes: 2 * MB, public: true },
  AVATAR: { types: IMAGE, maxBytes: 2 * MB, public: true },
  EVENT_COVER: { types: IMAGE, maxBytes: 8 * MB, public: true },
  INSPIRATION: { types: IMAGE, maxBytes: 8 * MB, public: true },
  GUEST_PHOTO: { types: IMAGE, maxBytes: 12 * MB, public: true },
  RECEIPT: { types: DOCUMENT, maxBytes: 10 * MB, public: false },
  EVENT_DOCUMENT: { types: DOCUMENT, maxBytes: 15 * MB, public: false },
  VERIFICATION: { types: DOCUMENT, maxBytes: 10 * MB, public: false },
  PAYMENT_PROOF: { types: DOCUMENT, maxBytes: 10 * MB, public: false },
} as const;
export type Purpose = keyof typeof purposes;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Detects the real content type from the first bytes of a file. */
export function sniff(bytes: Buffer): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return undefined;
}

const driver = () => (process.env.STORAGE_DRIVER || (isProduction() ? "s3" : "local")).toLowerCase();
const localRoot = () => process.env.LOCAL_STORAGE_DIR || join(process.cwd(), "uploads");

let s3Client: any;
async function s3() {
  if (!process.env.S3_BUCKET) throw new ServiceUnavailableException("File storage is not configured");
  if (!s3Client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3Client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: process.env.S3_ACCESS_KEY_ID
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" }
        : undefined,
    });
  }
  return s3Client;
}

export function publicUrl(key: string) {
  if (driver() === "local") return `/api/uploads/files/${key}`;
  const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  return base ? `${base}/${key}` : `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
}

/** Reads the first bytes and the size of a stored object. */
async function inspect(key: string): Promise<{ size: number; head: Buffer } | undefined> {
  if (driver() === "local") {
    const path = join(localRoot(), key);
    if (!existsSync(path)) return undefined;
    const info = await stat(path);
    const handle = await open(path, "r");
    const head = Buffer.alloc(16);
    await handle.read(head, 0, 16, 0);
    await handle.close();
    return { size: info.size, head };
  }
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    const result = await (await s3()).send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Range: "bytes=0-15" }),
    );
    const head = Buffer.from(await result.Body.transformToByteArray());
    const total = Number(String(result.ContentRange || "").split("/")[1] || result.ContentLength || 0);
    return { size: total, head };
  } catch {
    return undefined;
  }
}

async function removeObject(key: string) {
  if (driver() === "local") return unlink(join(localRoot(), key)).catch(() => undefined);
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await (await s3()).send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })).catch(() => undefined);
}

export async function signedReadUrl(key: string) {
  if (driver() === "local") return `/api/uploads/files/${key}`;
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(await s3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }), { expiresIn: 600 });
}

export type UploadRequest = { purpose: Purpose; contentType: string; sizeBytes: number; fileName?: string };
export const uploadRequest = z.object({
  purpose: z.enum(Object.keys(purposes) as [Purpose, ...Purpose[]]),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().min(1),
  fileName: z.string().max(200).optional(),
});

/** Creates a pending media record and an upload target. Shared by authenticated and guest uploads. */
export async function createUpload(db: Database, ownerId: string, data: UploadRequest) {
  const rule = purposes[data.purpose];
  if (!(rule.types as readonly string[]).includes(data.contentType))
    throw new BadRequestException(`This file type is not allowed. Use ${rule.types.map((t) => EXTENSION[t]).join(", ")}.`);
  if (data.sizeBytes > rule.maxBytes)
    throw new BadRequestException(`File is too large. The limit is ${Math.round(rule.maxBytes / MB)} MB.`);
  const key = `${rule.public ? "public" : "private"}/${data.purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomBytes(16).toString("hex")}.${EXTENSION[data.contentType]}`;
  const media = await db.media.create({
    data: {
      ownerId,
      key,
      purpose: data.purpose,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      fileName: data.fileName,
    },
  });
  if (driver() === "local")
    return {
      id: media.id,
      upload: { method: "PUT" as const, url: `/api/uploads/${media.id}/local`, headers: { "Content-Type": data.contentType } },
    };
  const { createPresignedPost } = await import("@aws-sdk/s3-presigned-post");
  const post = await createPresignedPost(await s3(), {
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Conditions: [
      ["content-length-range", 1, rule.maxBytes],
      ["eq", "$Content-Type", data.contentType],
    ],
    Fields: { "Content-Type": data.contentType },
    Expires: 600,
  });
  return { id: media.id, upload: { method: "POST" as const, url: post.url, fields: post.fields } };
}

/** Verifies the uploaded bytes and marks the media ready. */
export async function completeUpload(db: Database, ownerId: string, id: string) {
  const media = await db.media.findUnique({ where: { id } });
  if (!media || media.ownerId !== ownerId) throw new NotFoundException("Upload not found");
  if (media.status === "READY") return present(media);
  const object = await inspect(media.key);
  if (!object) throw new BadRequestException("The file has not finished uploading");
  const rule = purposes[media.purpose as Purpose];
  const actual = sniff(object.head);
  if (!actual || actual !== media.contentType || object.size > rule.maxBytes) {
    await removeObject(media.key);
    await db.media.update({ where: { id }, data: { status: "REJECTED" } });
    throw new BadRequestException("The file content does not match an allowed type");
  }
  const ready = await db.media.update({ where: { id }, data: { status: "READY", sizeBytes: object.size } });
  return present(ready);
}

export async function present(media: { id: string; key: string; purpose: string; contentType: string; sizeBytes: number; fileName: string | null; status: string }) {
  const isPublic = purposes[media.purpose as Purpose]?.public;
  return {
    id: media.id,
    purpose: media.purpose,
    contentType: media.contentType,
    sizeBytes: media.sizeBytes,
    fileName: media.fileName,
    status: media.status,
    url: isPublic ? publicUrl(media.key) : null,
  };
}

/** Resolves a READY media id owned by the user to its public URL (for profile images, covers…). */
export async function readyPublicUrl(db: Database, ownerId: string, id: string, allowed: Purpose[]) {
  const media = await db.media.findUnique({ where: { id } });
  if (!media || media.ownerId !== ownerId || media.status !== "READY" || !allowed.includes(media.purpose as Purpose))
    throw new BadRequestException("Upload the image first");
  return publicUrl(media.key);
}

@Controller("uploads")
export class UploadsController {
  constructor(private db: Database) {}

  @Post() @UseGuards(AuthGuard) create(@Req() req: any, @Body() body: unknown) {
    return createUpload(this.db, req.user.sub, parse(uploadRequest, body));
  }

  @Post(":id/complete") @UseGuards(AuthGuard) complete(@Req() req: any, @Param("id") id: string) {
    return completeUpload(this.db, req.user.sub, id);
  }

  /** Short-lived link to a private file (receipts, documents). Owner or platform admin. */
  @Get(":id/url") @UseGuards(AuthGuard) async url(@Req() req: any, @Param("id") id: string) {
    const media = await this.db.media.findUnique({ where: { id } });
    if (!media || media.status !== "READY") throw new NotFoundException("File not found");
    if (media.ownerId !== req.user.sub && req.user.role !== "PLATFORM_ADMIN")
      throw new ForbiddenException("This file is outside your permissions");
    return { url: purposes[media.purpose as Purpose]?.public ? publicUrl(media.key) : await signedReadUrl(media.key) };
  }

  /** Development-only upload target used by STORAGE_DRIVER=local. */
  @Put(":id/local") async local(@Req() req: any, @Param("id") id: string) {
    if (driver() !== "local") throw new NotFoundException();
    const media = await this.db.media.findUnique({ where: { id } });
    if (!media || media.status !== "PENDING") throw new NotFoundException("Upload not found");
    const limit = purposes[media.purpose as Purpose].maxBytes;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > limit) throw new BadRequestException("File is too large");
      chunks.push(chunk);
    }
    const path = join(localRoot(), media.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.concat(chunks));
    return { ok: true };
  }

  /** Development-only file server. Private files need a signed link in production. */
  @Get("files/*path") async file(@Param("path") path: string | string[], @Res() res: any) {
    if (driver() !== "local") throw new NotFoundException();
    const key = normalize(Array.isArray(path) ? path.join("/") : path);
    if (key.includes("..") || !key.startsWith("public/") && !key.startsWith("private/")) throw new NotFoundException();
    const full = join(localRoot(), key);
    if (!existsSync(full)) throw new NotFoundException();
    const media = await this.db.media.findUnique({ where: { key } });
    res.setHeader("Content-Type", media?.contentType || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    createReadStream(full).pipe(res);
  }
}
