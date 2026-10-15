import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequestError } from '../lib/ApiError.js';

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Only these extensions are ever persisted. The client-supplied filename is
 * otherwise untrusted: accepting arbitrary extensions would let an attacker
 * upload e.g. .html/.svg that gets served as active content (stored XSS).
 * SVG is intentionally excluded (scripts can run inside it).
 */
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith('image/')) {
      cb(badRequestError('Only image uploads are allowed'));
      return;
    }
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(badRequestError('Image format not allowed (jpg, jpeg, png, gif, webp)'));
      return;
    }
    cb(null, true);
  },
});

/** URL prefix for files stored by multer (served statically at /uploads). */
export function publicUrl(filename: string): string {
  return `/uploads/${filename}`;
}
