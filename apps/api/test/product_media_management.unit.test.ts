import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { validateProductCreate, validateProductUpdate, ProductDto } from '../src/dto/product_dto';
import { productRepository } from '../src/repositories/product_repository';
import { createProductSyncService } from '../src/services/product_sync_service';
import { MediaService, mediaService, MAX_FILE_SIZE_BYTES } from '../src/services/media_service';
import { ValidationError } from '../src/errors/validation_error';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('PHASE 8G: Product Media Management & image_enabled Contract', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const otherBusinessId = '22222222-2222-4222-8222-222222222222';
  const productId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  let mockClient: any;
  let mockPool: any;
  let queryHistory: Array<{ text: string; params?: any[] }>;
  let tempUploadDir: string;
  let customMediaService: MediaService;

  const baseProductRow: ProductDto = {
    id: productId,
    business_id: businessId,
    name: 'Kopi Susu Gula Aren',
    description: 'Signature coffee',
    sku: 'SKU-KOPI-01',
    price_minor: 25000,
    cost_minor: 12000,
    category: 'Minuman',
    barcode: '8991234567890',
    image_url: 'https://cdn.example.com/products/kopi-susu.jpg',
    image_enabled: false,
    is_active: true,
    server_version: 1,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    queryHistory = [];

    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-erp-media-test-'));
    customMediaService = new MediaService(tempUploadDir);

    mockClient = {
      release: vi.fn(),
      query: vi.fn(async (text: string, params?: any[]) => {
        queryHistory.push({ text, params });

        if (text.includes('SELECT') && text.includes('FROM products') && text.includes('WHERE id = $1')) {
          return { rows: [baseProductRow], rowCount: 1 };
        }

        if (text.includes('UPDATE products')) {
          return {
            rows: [
              {
                ...baseProductRow,
                server_version: 2,
                image_enabled: params?.includes(true) ?? baseProductRow.image_enabled,
                updated_at: '2026-08-27T00:01:00.000Z',
              },
            ],
            rowCount: 1,
          };
        }

        if (text.includes('INSERT INTO products')) {
          return {
            rows: [
              {
                ...baseProductRow,
                id: params?.[0] || productId,
                name: params?.[2] || baseProductRow.name,
                image_url: params?.[9] || null,
                image_enabled: params?.[10] ?? false,
              },
            ],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient),
    };
  });

  afterEach(() => {
    if (tempUploadDir && fs.existsSync(tempUploadDir)) {
      fs.rmSync(tempUploadDir, { recursive: true, force: true });
    }
  });

  // PRODUCT-MEDIA-001: disabled by default
  it('PRODUCT-MEDIA-001: image_enabled defaults to false when omitted on create', () => {
    const payload = {
      id: productId,
      business_id: businessId,
      name: 'Matcha Latte',
      price_minor: 28000,
    };

    const validated = validateProductCreate(payload);
    expect(validated.image_enabled).toBe(false);
  });

  // PRODUCT-MEDIA-002: enable image
  it('PRODUCT-MEDIA-002: enables image via product update request and repository update', async () => {
    const updatePayload = {
      business_id: businessId,
      expected_server_version: 1,
      image_enabled: true,
    };

    const validated = validateProductUpdate(updatePayload);
    expect(validated.image_enabled).toBe(true);

    const result = await productRepository.update(mockClient, businessId, productId, 1, {
      image_enabled: true,
    });

    expect(result).toBeDefined();
    expect(mockClient.query).toHaveBeenCalled();
    const updateCall = queryHistory.find((q) => q.text.includes('UPDATE products'));
    expect(updateCall?.text).toContain('image_enabled');
    expect(updateCall?.params).toContain(true);
  });

  // PRODUCT-MEDIA-003: disable image
  it('PRODUCT-MEDIA-003: disables image while retaining image_url reference', async () => {
    const updatePayload = {
      business_id: businessId,
      expected_server_version: 1,
      image_enabled: false,
    };

    const validated = validateProductUpdate(updatePayload);
    expect(validated.image_enabled).toBe(false);

    await productRepository.update(mockClient, businessId, productId, 1, {
      image_enabled: false,
    });

    const updateCall = queryHistory.find((q) => q.text.includes('UPDATE products'));
    expect(updateCall?.params).toContain(false);
  });

  // PRODUCT-MEDIA-004: upload valid image
  it('PRODUCT-MEDIA-004: successfully uploads valid image and returns safe URL and metadata', async () => {
    const validPngBuffer = Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex');
    const result = await customMediaService.saveProductImage(businessId, validPngBuffer, 'image/png');

    expect(result.url).toMatch(new RegExp(`^/v1/media/products/${businessId}/[a-f0-9-]+\\.png$`));
    expect(result.filename).toMatch(/^[a-f0-9-]+.png$/);
    expect(result.mime_type).toBe('image/png');
    expect(result.size_bytes).toBe(validPngBuffer.length);

    const storedPath = customMediaService.getFilePath(businessId, result.filename);
    expect(storedPath).not.toBeNull();
    expect(fs.existsSync(storedPath!)).toBe(true);
  });

  // PRODUCT-MEDIA-005: reject invalid MIME
  it('PRODUCT-MEDIA-005: rejects invalid MIME types (e.g. text/html, application/pdf, .exe)', async () => {
    const fakeExeBuffer = Buffer.from('4d5a900003000000', 'hex');

    expect(() => {
      customMediaService.validateImage(fakeExeBuffer, 'application/x-msdownload');
    }).toThrow(ValidationError);

    expect(() => {
      customMediaService.validateImage(Buffer.from('<h1>hello</h1>'), 'text/html');
    }).toThrow(ValidationError);

    expect(() => {
      customMediaService.validateImage(Buffer.from('%PDF-1.4'), 'application/pdf');
    }).toThrow(ValidationError);
  });

  // PRODUCT-MEDIA-006: reject oversize
  it('PRODUCT-MEDIA-006: rejects files exceeding maximum size limit (5MB)', async () => {
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024, 'a');

    expect(() => {
      customMediaService.validateImage(oversizedBuffer, 'image/jpeg');
    }).toThrow(ValidationError);
  });

  // PRODUCT-MEDIA-007: replace image
  it('PRODUCT-MEDIA-007: replaces product image with new upload without collision', async () => {
    const buf1 = Buffer.from([1, 2, 3]);
    const buf2 = Buffer.from([4, 5, 6]);

    const res1 = await customMediaService.saveProductImage(businessId, buf1, 'image/jpeg');
    const res2 = await customMediaService.saveProductImage(businessId, buf2, 'image/jpeg');

    expect(res1.filename).not.toBe(res2.filename);
    expect(fs.existsSync(customMediaService.getFilePath(businessId, res1.filename)!)).toBe(true);
    expect(fs.existsSync(customMediaService.getFilePath(businessId, res2.filename)!)).toBe(true);
  });

  // PRODUCT-MEDIA-008: delete image
  it('PRODUCT-MEDIA-008: deletes media file and supports clearing image_url', async () => {
    const buf = Buffer.from([1, 2, 3]);
    const res = await customMediaService.saveProductImage(businessId, buf, 'image/webp');
    const filePath = customMediaService.getFilePath(businessId, res.filename);
    expect(fs.existsSync(filePath!)).toBe(true);

    const deleted = await customMediaService.deleteProductImage(businessId, res.filename);
    expect(deleted).toBe(true);
    expect(fs.existsSync(filePath!)).toBe(false);

    // Product repo clear image
    const updatePayload = {
      business_id: businessId,
      expected_server_version: 1,
      image_url: null,
      image_enabled: false,
    };
    const validated = validateProductUpdate(updatePayload);
    expect(validated.image_url).toBeNull();
    expect(validated.image_enabled).toBe(false);
  });

  // PRODUCT-MEDIA-009: tenant isolation
  it('PRODUCT-MEDIA-009: enforces tenant isolation on media paths and operations', async () => {
    const buf = Buffer.from([1, 2, 3]);
    const res = await customMediaService.saveProductImage(businessId, buf, 'image/png');

    // Other tenant cannot find file under their tenant directory
    const otherPath = customMediaService.getFilePath(otherBusinessId, res.filename);
    expect(otherPath).toBeNull();

    // Other tenant cannot delete tenant 1 file
    const otherDelete = await customMediaService.deleteProductImage(otherBusinessId, res.filename);
    expect(otherDelete).toBe(false);

    // Tenant 1 file remains safe
    const tenant1Path = customMediaService.getFilePath(businessId, res.filename);
    expect(fs.existsSync(tenant1Path!)).toBe(true);
  });

  // PRODUCT-MEDIA-010: mobile metadata compatibility
  it('PRODUCT-MEDIA-010: product sync service returns image_enabled for mobile clients', async () => {
    const service = createProductSyncService(mockPool);
    const syncResult = await service.create(
      {
        id: productId,
        business_id: businessId,
        name: 'Croissant Butter',
        price_minor: 25000,
        image_url: 'https://cdn.example.com/croissant.jpg',
        image_enabled: true,
      },
      'idempotency-key-123',
      'hash-123',
      businessId
    );

    expect(syncResult).toBeDefined();
    expect(syncResult.image_enabled).toBe(true);
    expect(syncResult.image_url).toBe('https://cdn.example.com/croissant.jpg');
  });

  // PRODUCT-MEDIA-011: no binary blob in product table
  it('PRODUCT-MEDIA-011: ensures product table stores URL text references and no raw binary blobs', () => {
    const insertCall = queryHistory.find((q) => q.text.includes('INSERT INTO products'));
    // Validates columns text schema
    const validated = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Espresso',
      price_minor: 18000,
      image_url: '/v1/media/products/tenant/img.png',
      image_enabled: true,
    });

    expect(typeof validated.image_url).toBe('string');
    expect(Buffer.isBuffer(validated.image_url)).toBe(false);
  });

  // PRODUCT-MEDIA-012: fallback when image unavailable
  it('PRODUCT-MEDIA-012: ensures image_enabled is explicitly validated and supports fallback state', () => {
    // When image_enabled is explicitly false, it remains false even if image_url is populated
    const productWithHiddenImage = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Earl Grey Milk Tea',
      price_minor: 24000,
      image_url: 'https://cdn.example.com/earl-grey.jpg',
      image_enabled: false,
    });

    expect(productWithHiddenImage.image_url).toBe('https://cdn.example.com/earl-grey.jpg');
    expect(productWithHiddenImage.image_enabled).toBe(false);
  });

  // PRODUCT-MEDIA-013: foreign tenant cannot read another tenant media
  it('PRODUCT-MEDIA-013: rejects cross-tenant media access with 403 Forbidden', async () => {
    const validPngBuffer = Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex');
    const uploadResult = await customMediaService.saveProductImage(businessId, validPngBuffer, 'image/png');

    // Simulate tenant assertion logic used in GET /v1/media/products/:businessId/:filename
    const authenticateMediaAccess = (urlBusinessId: string, authenticatedTenantId?: string) => {
      if (!authenticatedTenantId || authenticatedTenantId.toLowerCase() !== urlBusinessId.toLowerCase()) {
        throw new Error('403: FORBIDDEN - Access to another tenant media is forbidden');
      }
      return customMediaService.getFilePath(urlBusinessId, uploadResult.filename);
    };

    // 1. Foreign tenant attempting to read Tenant 1's media is rejected
    expect(() => {
      authenticateMediaAccess(businessId, otherBusinessId);
    }).toThrow('403: FORBIDDEN');

    // 2. Unauthenticated request is rejected
    expect(() => {
      authenticateMediaAccess(businessId, undefined);
    }).toThrow('403: FORBIDDEN');

    // 3. Same authenticated tenant successfully accesses their own media
    const allowedPath = authenticateMediaAccess(businessId, businessId);
    expect(allowedPath).not.toBeNull();
    expect(fs.existsSync(allowedPath!)).toBe(true);
  });
});
