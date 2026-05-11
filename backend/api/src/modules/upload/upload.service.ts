import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';

// =============================================================
// Upload Service — secure file upload
//
// Security:
// - MIME type validation (не доверяем расширению файла)
// - File magic bytes check
// - Filename sanitization
// - Max size enforcement
// - No execution in upload dir
// - Antivirus scan mock (ready для ClamAV integration)
// =============================================================

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF followed by WEBP
};

const MAX_SIZE_BYTES = config.UPLOAD_MAX_SIZE_MB * 1024 * 1024;

export interface UploadedFile {
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export class UploadService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = config.LOCAL_UPLOAD_PATH;
  }

  async saveImage(
    buffer: Buffer,
    originalFilename: string,
    declaredMimeType: string
  ): Promise<UploadedFile> {
    // ─── 1. Size check ────────────────────────────────
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new AppError(
        413,
        'FILE_TOO_LARGE',
        `File size exceeds ${config.UPLOAD_MAX_SIZE_MB}MB limit`
      );
    }

    // ─── 2. MIME type validation ──────────────────────
    if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG and WebP images are allowed');
    }

    // ─── 3. Magic bytes check (не доверяем заявленному MIME) ──
    const detectedMime = this.detectMimeFromBytes(buffer);
    if (!detectedMime || detectedMime !== declaredMimeType) {
      logger.warn(
        { declared: declaredMimeType, detected: detectedMime },
        'MIME type mismatch — potential attack'
      );
      throw new AppError(400, 'INVALID_FILE_CONTENT', 'File content does not match declared type');
    }

    // ─── 4. Antivirus scan (mock) ─────────────────────
    await this.scanForMalware(buffer);

    // ─── 5. Sanitize filename ─────────────────────────
    const safeExtension = this.getExtension(detectedMime);
    const storedName = `${crypto.randomUUID()}.${safeExtension}`;

    // ─── 6. Save file ─────────────────────────────────
    await fs.mkdir(this.uploadDir, { recursive: true });
    const filePath = path.join(this.uploadDir, storedName);

    // Path traversal check
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new AppError(400, 'INVALID_PATH', 'Invalid file path');
    }

    await fs.writeFile(filePath, buffer);

    logger.info(
      { storedName, sizeBytes: buffer.length, mimeType: detectedMime },
      'File uploaded successfully'
    );

    return {
      originalName: this.sanitizeFilename(originalFilename),
      storedName,
      url: `/uploads/${storedName}`,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
    };
  }

  async deleteFile(storedName: string): Promise<void> {
    // Path traversal protection
    const safeFilename = path.basename(storedName);
    const filePath = path.join(this.uploadDir, safeFilename);
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(this.uploadDir);

    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new AppError(400, 'INVALID_PATH', 'Invalid file path');
    }

    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Определяет MIME тип по magic bytes
   * Security: НЕ доверяем расширению или заявленному типу
   */
  private detectMimeFromBytes(buffer: Buffer): string | null {
    for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const signature of signatures) {
        if (buffer.length < signature.length) continue;

        const matches = signature.every(
          (byte, idx) => buffer[idx] === byte
        );

        if (matches) {
          // Дополнительная проверка для WebP
          if (mime === 'image/webp') {
            const webpSignature = Buffer.from('WEBP');
            if (buffer.slice(8, 12).equals(webpSignature)) {
              return mime;
            }
            continue;
          }
          return mime;
        }
      }
    }
    return null;
  }

  /**
   * Sanitize filename — убираем path traversal и опасные символы
   */
  private sanitizeFilename(filename: string): string {
    return path
      .basename(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
  }

  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return extensions[mimeType] ?? 'bin';
  }

  /**
   * Antivirus scan — mock implementation
   * В production: интегрировать с ClamAV через clamd socket
   */
  private async scanForMalware(buffer: Buffer): Promise<void> {
    // TODO: интеграция с ClamAV
    // const clam = new NodeClam();
    // const { isInfected } = await clam.scanBuffer(buffer);
    // if (isInfected) throw new AppError(400, 'MALWARE_DETECTED', 'File contains malware');

    // Mock: проверяем что файл не содержит PHP теги (минимальная проверка)
    const content = buffer.toString('binary');
    if (content.includes('<?php') || content.includes('<%')) {
      throw new AppError(400, 'MALWARE_DETECTED', 'Suspicious content in file');
    }
  }
}
