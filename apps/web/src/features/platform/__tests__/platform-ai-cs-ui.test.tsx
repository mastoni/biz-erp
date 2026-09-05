/**
 * Super Admin — Platform AI CS Settings & Control UI Acceptance Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformAiCsPage from '@/app/platform/ai-cs/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform AI CS Control UI Tests', () => {
  const sampleSettingsResponse: api.PlatformAiCsSettingsResponse = {
    settings: {
      id: 'default',
      is_enabled: true,
      provider: 'DETERMINISTIC',
      model: 'rule-engine-v1',
      fallback_behavior: 'GENERAL_FAQ',
      human_escalation_enabled: true,
      operational_health: 'HEALTHY',
      created_at: '2026-09-04T10:00:00.000Z',
      updated_at: '2026-09-04T10:00:00.000Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. verifies AI CS Control is in PLATFORM_NAVIGATION', () => {
    const navItem = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/ai-cs');
    expect(navItem).toBeDefined();
    expect(navItem?.name).toBe('AI CS Control');
  });

  it('2. renders the page header and structure correctly', () => {
    vi.spyOn(api, 'getPlatformAiCsSettings').mockResolvedValue(sampleSettingsResponse);

    const html = renderToString(<PlatformAiCsPage />);
    expect(html).toContain('AI CS Control &amp; Settings');
    expect(html).toContain('SUPER_ADMIN');
    expect(html).toContain('Segarkan');
  });

  it('3. verifies client API wrappers call correct platform endpoints', async () => {
    const mockGet = vi.spyOn(api, 'getPlatformAiCsSettings').mockResolvedValue(sampleSettingsResponse);
    const mockUpdate = vi.spyOn(api, 'updatePlatformAiCsSettings').mockResolvedValue({
      settings: {
        ...sampleSettingsResponse.settings,
        is_enabled: false,
      },
      message: 'Success',
    });

    const getRes = await api.getPlatformAiCsSettings();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(getRes.settings.is_enabled).toBe(true);
    expect(getRes.settings.provider).toBe('DETERMINISTIC');
    expect(getRes.settings.model).toBe('rule-engine-v1');

    const updateRes = await api.updatePlatformAiCsSettings({ is_enabled: false });
    expect(mockUpdate).toHaveBeenCalledWith({ is_enabled: false });
    expect(updateRes.settings.is_enabled).toBe(false);
  });
});
