import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/validation_error';

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface MediaUploadResult {
  url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export class MediaService {
  private baseUploadDir: string;

  constructor(baseUploadDir?: string) {
    this.baseUploadDir = baseUploadDir || path.join(process.cwd(), 'uploads');
  }

  validateImage(buffer: Buffer, mimeType: string): { ext: string } {
    if (!mimeType || typeof mimeType !== 'string') {
      throw new ValidationError('Invalid MIME type', { mime_type: 'MIME type is required' });
    }

    const normalizedMime = mimeType.toLowerCase().trim();
    const ext = ALLOWED_MIME_TYPES[normalizedMime];

    if (!ext) {
      throw new ValidationError('Unsupported image format', {
        mime_type: `Invalid MIME type "${mimeType}". Allowed: image/jpeg, image/png, image/webp, image/gif`,
      });
    }

    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Empty file', { file: 'File content cannot be empty' });
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError('File size exceeds limit', {
        size: `File size ${buffer.length} bytes exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes (5MB)`,
      });
    }

    return { ext };
  }

  async saveProductImage(
    businessId: string,
    buffer: Buffer,
    mimeType: string,
    baseUrl: string = '/v1/media'
  ): Promise<MediaUploadResult> {
    const { ext } = this.validateImage(buffer, mimeType);

    // Sanitize businessId (must be valid alphanumeric/uuid)
    const safeTenant = businessId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeFilename = `${randomUUID()}.${ext}`;

    const tenantDir = path.join(this.baseUploadDir, 'products', safeTenant);
    fs.mkdirSync(tenantDir, { recursive: true });

    const filePath = path.join(tenantDir, safeFilename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `${baseUrl}/products/${safeTenant}/${safeFilename}`;

    return {
      url: relativeUrl,
      filename: safeFilename,
      mime_type: mimeType.toLowerCase().trim(),
      size_bytes: buffer.length,
    };
  }

  async deleteProductImage(businessId: string, filename: string): Promise<boolean> {
    const safeTenant = businessId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeFilename = path.basename(filename); // Prevent path traversal

    const filePath = path.join(this.baseUploadDir, 'products', safeTenant, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  getFilePath(businessId: string, filename: string): string | null {
    const safeTenant = businessId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeFilename = path.basename(filename);

    const filePath = path.join(this.baseUploadDir, 'products', safeTenant, safeFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }
}

export const mediaService = new MediaService();
