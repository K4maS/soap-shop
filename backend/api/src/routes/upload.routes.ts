import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { authenticate, requireRole } from '../middleware/rbac.middleware.js';
import { UploadService } from '../modules/upload/upload.service.js';
import { ApiResponse } from '../types/index.js';
import { config } from '../config/index.js';

// =============================================================
// Upload router — image upload endpoint
//
// Security:
// - Memory storage only (no disk write before validation)
// - MIME type validated in UploadService via magic bytes (not extension)
// - File size enforced at both multer and service layers
// - Admin/manager only
// =============================================================

const MAX_SIZE_BYTES = config.UPLOAD_MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(
  config.UPLOAD_ALLOWED_TYPES.split(',').map((t) => t.trim())
);

// ─── Multer configuration ────────────────────────────────────

const storage = multer.memoryStorage(); // no disk write before validation

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1, // one file per request
  },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          'INVALID_FILE_TYPE',
          `File type "${file.mimetype}" is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(', ')}`
        )
      );
    }
  },
});

// ─── Router factory ─────────────────────────────────────────

export function createUploadRouter(): Router {
  const router = Router();
  const uploadService = new UploadService();

  /**
   * POST /images
   * Accepts multipart/form-data with field "image".
   * Returns { url, filename }.
   *
   * Access: admin, manager only.
   */
  router.post(
    '/images',
    authenticate(),
    requireRole('admin', 'manager'),
    upload.single('image'),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No file provided in field "image"');
      }

      const file = req.file;

      const result = await uploadService.saveImage(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      const response: ApiResponse<{ url: string; filename: string }> = {
        success: true,
        data: {
          url: result.url,
          filename: result.storedName,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(201).json(response);
    })
  );

  return router;
}
