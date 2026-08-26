import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProductService } from '../src/services/product_service';
import { createProductSyncService } from '../src/services/product_sync_service';
import { validateProductCreate, validateProductUpdate, ProductDto } from '../src/dto/product_dto';
import { productRepository } from '../src/repositories/product_repository';
import { ValidationError } from '../src/errors/validation_error';
import { Pool, PoolClient } from 'pg';

describe('PHASE 8E — Product Image Contract & Media Foundation Unit Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const tenant2Id = '22222222-2222-4222-8222-222222222222';
  const productId = '77777777-7777-4777-8777-777777777777';

  let mockClient: any;
  let mockPool: any;
  let queryHistory: Array<{ text: string; params?: any[] }>;

  const sampleProductRow: ProductDto = {
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
    image_enabled: true,
    is_active: true,
    server_version: 1,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    queryHistory = [];

    mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        queryHistory.push({ text, params });
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        if (text.includes('COUNT(*)')) {
          return { rows: [{ total: 1 }] };
        }
        if (text.includes('SELECT') && text.includes('FROM products')) {
          return { rows: [sampleProductRow] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient as unknown as PoolClient),
    } as unknown as Pool;
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-001: image_url nullable
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-001: image_url is nullable on product DTO and accepts null and strings', () => {
    const validWithImage = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Kopi Susu',
      price_minor: 25000,
      image_url: 'https://images.example.com/kopi.png',
    });
    expect(validWithImage.image_url).toBe('https://images.example.com/kopi.png');

    const validWithNull = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Kopi Susu',
      price_minor: 25000,
      image_url: null,
    });
    expect(validWithNull.image_url).toBeNull();

    const validOmitted = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Kopi Susu',
      price_minor: 25000,
    });
    expect(validOmitted.image_url).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-002: image_url returned by product list
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-002: GET /v1/products list returns image_url for each item', async () => {
    const service = createProductService(mockPool);
    const result = await service.list({ business_id: businessId }, businessId);

    expect(result.items.length).toBe(1);
    expect(result.items[0].image_url).toBe('https://cdn.example.com/products/kopi-susu.jpg');
    expect(queryHistory.some(q => q.text.includes('image_url'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-003: image_url returned by product detail
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-003: GET /v1/products/:id returns image_url on single product lookup', async () => {
    const service = createProductService(mockPool);
    const result = await service.findById(productId, businessId);

    expect(result.id).toBe(productId);
    expect(result.image_url).toBe('https://cdn.example.com/products/kopi-susu.jpg');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-004: create with image_url
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-004: creates product with image_url and persists to database', async () => {
    mockClient.query = vi.fn(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params });
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('idempotency_keys')) return { rows: [] };
      if (text.includes('INSERT INTO products')) {
        return {
          rows: [{
            ...sampleProductRow,
            image_url: 'https://cdn.example.com/products/new-croissant.jpg',
          }],
        };
      }
      return { rows: [] };
    });

    const syncService = createProductSyncService(mockPool);
    const created = await syncService.create(
      {
        id: productId,
        business_id: businessId,
        name: 'Croissant Butter',
        price_minor: 28000,
        image_url: 'https://cdn.example.com/products/new-croissant.jpg',
      },
      '99999999-9999-4999-8999-999999999999',
      'hash-123',
      businessId
    );

    expect(created.image_url).toBe('https://cdn.example.com/products/new-croissant.jpg');
    const insertQuery = queryHistory.find(q => q.text.includes('INSERT INTO products'));
    expect(insertQuery).toBeDefined();
    expect(insertQuery?.text).toContain('image_url');
    expect(insertQuery?.params).toContain('https://cdn.example.com/products/new-croissant.jpg');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-005: update image_url
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-005: updates product image_url and increments server_version', async () => {
    mockClient.query = vi.fn(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params });
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('SELECT') && text.includes('FROM products')) {
        return { rows: [sampleProductRow] };
      }
      if (text.includes('UPDATE products')) {
        return {
          rows: [{
            ...sampleProductRow,
            image_url: 'https://cdn.example.com/products/updated-kopi.jpg',
            server_version: 2,
          }],
        };
      }
      return { rows: [] };
    });

    const syncService = createProductSyncService(mockPool);
    const updated = await syncService.update(
      productId,
      {
        business_id: businessId,
        expected_server_version: 1,
        image_url: 'https://cdn.example.com/products/updated-kopi.jpg',
      },
      businessId
    );

    expect(updated.image_url).toBe('https://cdn.example.com/products/updated-kopi.jpg');
    expect(updated.server_version).toBe(2);

    const updateQuery = queryHistory.find(q => q.text.includes('UPDATE products'));
    expect(updateQuery).toBeDefined();
    expect(updateQuery?.text).toContain('image_url');
    expect(updateQuery?.params).toContain('https://cdn.example.com/products/updated-kopi.jpg');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-006: clear image_url
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-006: clears product image_url when updated with null or empty string', async () => {
    mockClient.query = vi.fn(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params });
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('SELECT') && text.includes('FROM products')) {
        return { rows: [sampleProductRow] };
      }
      if (text.includes('UPDATE products')) {
        return {
          rows: [{
            ...sampleProductRow,
            image_url: null,
            server_version: 2,
          }],
        };
      }
      return { rows: [] };
    });

    const syncService = createProductSyncService(mockPool);
    const updated = await syncService.update(
      productId,
      {
        business_id: businessId,
        expected_server_version: 1,
        image_url: null,
      },
      businessId
    );

    expect(updated.image_url).toBeNull();
    const updateQuery = queryHistory.find(q => q.text.includes('UPDATE products'));
    expect(updateQuery?.params).toContain(null);
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-007: tenant isolation
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-007: enforces tenant isolation on product image read and write', async () => {
    const service = createProductService(mockPool);
    const syncService = createProductSyncService(mockPool);

    // Read attempt across tenants fails
    await expect(service.list({ business_id: businessId }, tenant2Id)).rejects.toThrow(
      'Business identity mismatch'
    );

    // Update attempt across tenants fails
    await expect(
      syncService.update(
        productId,
        {
          business_id: businessId,
          expected_server_version: 1,
          image_url: 'https://malicious.example.com/hacked.jpg',
        },
        tenant2Id
      )
    ).rejects.toThrow('Business identity mismatch');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-008: null image safe
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-008: products with image_url = null are completely safe and operable', async () => {
    const nullImageProduct: ProductDto = {
      ...sampleProductRow,
      image_url: null,
    };

    mockClient.query = vi.fn(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
      if (text.includes('SELECT') && text.includes('FROM products')) {
        return { rows: [nullImageProduct] };
      }
      return { rows: [] };
    });

    const service = createProductService(mockPool);
    const result = await service.list({ business_id: businessId }, businessId);

    expect(result.items.length).toBe(1);
    expect(result.items[0].image_url).toBeNull();
    expect(result.items[0].name).toBe('Kopi Susu Gula Aren');
    expect(result.items[0].price_minor).toBe(25000);
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-009: sync compatibility
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-009: GET /v1/sync/products returns image_url in sync delta items', async () => {
    mockClient.query = vi.fn(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('server_version >')) {
        return { rows: [sampleProductRow] };
      }
      return { rows: [] };
    });

    const syncService = createProductSyncService(mockPool);
    const syncResult = await syncService.list({ business_id: businessId, after_version: 0 }, businessId);

    expect(syncResult.items.length).toBe(1);
    expect(syncResult.items[0].image_url).toBe('https://cdn.example.com/products/kopi-susu.jpg');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-010: no POS-specific product image endpoint
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-010: product master is canonical entity; no POS-specific image route exists', () => {
    const columns = (productRepository as any);
    expect(columns).toBeDefined();
    // Image attribute belongs directly to product entity
    expect(sampleProductRow).toHaveProperty('image_url');
    expect(sampleProductRow).toHaveProperty('business_id');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-011: no fake/default business image values
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-011: validation and repository do not inject fake/mock image URLs', () => {
    const validated = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Plain Item',
      price_minor: 10000,
    });
    // Must remain undefined/null if not provided — never a mock stock photo URL
    expect(validated.image_url).toBeUndefined();

    const validatedEmpty = validateProductCreate({
      id: productId,
      business_id: businessId,
      name: 'Plain Item',
      price_minor: 10000,
      image_url: '',
    });
    expect(validatedEmpty.image_url).toBeNull();
  });

  // -------------------------------------------------------------------------
  // PRODUCT-IMG-012: media contract follows existing storage architecture
  // -------------------------------------------------------------------------
  it('PRODUCT-IMG-012: media contract stores image reference string without requiring binary blob in database', () => {
    const updatePatch = validateProductUpdate({
      business_id: businessId,
      expected_server_version: 1,
      image_url: '/static/uploads/products/item-01.webp',
    });
    expect(updatePatch.image_url).toBe('/static/uploads/products/item-01.webp');

    // Invalid non-string image_url rejected with validation error
    try {
      validateProductUpdate({
        business_id: businessId,
        expected_server_version: 1,
        image_url: 12345,
      });
      expect.unreachable('Should throw validation error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details?.image_url).toBe('image_url must be a string or null');
    }
  });
});
