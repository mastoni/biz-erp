import { describe, it, expect, vi } from 'vitest';
import {
  getPlatformPlans,
  createPlatformPlan,
  updatePlatformPlan,
  setPlatformPlanStatus,
  getPlatformBundles,
  createPlatformBundle,
  updatePlatformBundle,
  setPlatformBundleStatus,
  setPlatformBundleItems,
  getPlatformShowcase,
  createPlatformShowcaseItem,
  setPlatformShowcasePublish,
  getPublicShowcase,
  getPlatformCatalogProducts,
} from '../api';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Phase SA-2.3: Superadmin Commercial UI & Client Operations', () => {
  it('1. Plans: lists plans with filters, handles direct Rupiah integer pricing and limits', async () => {
    const mockPlansRes = {
      data: {
        items: [
          {
            code: 'ERP_PRO',
            name: 'Paket ERP Pro',
            family: 'ERP_PLAN',
            tier: 'PRO',
            billing_cycle: 'MONTHLY',
            pricing: { base_price: 250000, discount: 0, tax: 27500, final_price: 277500 },
            status: 'ACTIVE',
            limits: { max_branches: 3, max_users: 5 },
            trial_days: 14,
            is_published: true,
            display_order: 1,
            version: 1,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
        summary: { total: 1, active_count: 1, draft_count: 0, deprecated_count: 0 },
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockPlansRes);

    const res = await getPlatformPlans({ status: 'ACTIVE', search: 'ERP' });
    expect(api.get).toHaveBeenCalledWith('/v1/platform/plans', {
      params: { limit: 20, offset: 0, status: 'ACTIVE', family: undefined, search: 'ERP' },
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].pricing.final_price).toBe(277500);
    expect(res.items[0].limits.max_branches).toBe(3);
  });

  it('2. Plans: creates and updates plan with expected_version optimistic concurrency', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { message: 'Plan created successfully', plan: { code: 'ERP_NEW', version: 1 } },
    });

    const createRes = await createPlatformPlan({
      code: 'ERP_NEW',
      name: 'Paket Baru',
      pricing: { base_price: 150000, final_price: 150000 },
      status: 'DRAFT',
    });
    expect(createRes.plan.code).toBe('ERP_NEW');

    vi.mocked(api.put).mockResolvedValueOnce({
      data: { message: 'Plan updated successfully', plan: { code: 'ERP_NEW', version: 2 } },
    });

    const updateRes = await updatePlatformPlan('ERP_NEW', {
      name: 'Paket Baru Edited',
      expected_version: 1,
    });
    expect(updateRes.plan.version).toBe(2);
  });

  it('3. Bundle Composer: lists bundles and manages multi-item composition', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { message: 'Bundle created', bundle: { code: 'STORE_BUNDLE', status: 'DRAFT' } },
    });

    const bundleRes = await createPlatformBundle({
      code: 'STORE_BUNDLE',
      name: 'Paket Toko Cerdas',
      pricing: { one_time: 1000000, monthly: 550000, commitment_months: 12 },
    });
    expect(bundleRes.bundle.code).toBe('STORE_BUNDLE');

    vi.mocked(api.put).mockResolvedValueOnce({
      data: { message: 'Bundle items saved', bundle_code: 'STORE_BUNDLE', item_count: 2 },
    });

    const itemsRes = await setPlatformBundleItems('STORE_BUNDLE', [
      { item_type: 'PLAN', item_code: 'ERP_PRO', quantity: 1, required: true },
      { item_type: 'PRODUCT', item_code: 'ISP_50M', quantity: 1, required: true },
    ]);
    expect(itemsRes.item_count).toBe(2);
  });

  it('4. Showcase: manages placement, publishing toggle, and unauthenticated public showcase', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        message: 'Showcase item created',
        item: { id: 'showcase-123', section: 'ERP_PLANS', is_published: true },
      },
    });

    const showcaseRes = await createPlatformShowcaseItem({
      section: 'ERP_PLANS',
      item_type: 'PLAN',
      plan_code: 'ERP_PRO',
      display_name: 'Paket Juara UMKM',
      is_published: true,
    });
    expect(showcaseRes.item.id).toBe('showcase-123');

    vi.mocked(api.patch).mockResolvedValueOnce({
      data: { message: 'Status updated', item: { id: 'showcase-123', is_published: false } },
    });

    const toggleRes = await setPlatformShowcasePublish('showcase-123', false);
    expect(toggleRes.item.is_published).toBe(false);

    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'showcase-123',
            section: 'ERP_PLANS',
            item_type: 'PLAN',
            display_name: 'Paket Juara UMKM',
            cta_text: 'Coba Gratis 14 Hari',
          },
        ],
      },
    });

    const publicRes = await getPublicShowcase('ERP_PLANS');
    expect(publicRes.items).toHaveLength(1);
    expect(publicRes.items[0].cta_text).toBe('Coba Gratis 14 Hari');
  });

  it('5. Catalog Products: lists active canonical catalog products dynamically for showcase selection', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        items: [
          {
            code: 'POS_PRINTER_THERMAL',
            name: 'Printer Kasir Thermal 80mm USB+Bluetooth',
            type: 'HARDWARE',
            category: 'POS_EQUIPMENT',
            billing_model: 'ONE_TIME',
            base_price: 650000,
            status: 'ACTIVE',
            display_order: 13,
          },
          {
            code: 'INET_BASIC',
            name: 'Internet Paket Basic 20 Mbps',
            type: 'INTERNET',
            category: 'INTERNET_BROADBAND',
            billing_model: 'RECURRING',
            base_price: 110000,
            status: 'ACTIVE',
            display_order: 1,
          },
        ],
        total: 2,
        limit: 100,
        offset: 0,
        has_more: false,
      },
    });

    const res = await getPlatformCatalogProducts({ status: 'ACTIVE', limit: 100 });
    expect(api.get).toHaveBeenCalledWith('/v1/platform/catalog-products', {
      params: {
        limit: 100,
        offset: 0,
        status: 'ACTIVE',
        category: undefined,
        search: undefined,
      },
    });
    expect(res.items).toHaveLength(2);
    expect(res.items[0].code).toBe('POS_PRINTER_THERMAL');
    expect(res.items[0].base_price).toBe(650000);
  });
});
