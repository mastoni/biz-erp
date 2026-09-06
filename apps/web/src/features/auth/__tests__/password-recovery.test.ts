import { describe, it, expect, vi } from 'vitest';
import { parsePasswordError, requestPasswordReset, resetPassword, changePassword } from '../password-recovery';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('password-recovery frontend client', () => {
  it('correctly parses server error codes into UMKM Indonesian messages', () => {
    expect(parsePasswordError({ isAxiosError: true, response: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } } })).toBe(
      'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'INVALID_CURRENT_PASSWORD' } } })).toBe(
      'Kata sandi lama yang Anda masukkan tidak sesuai.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'PASSWORD_MISMATCH' } } })).toBe(
      'Konfirmasi kata sandi baru tidak cocok.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'WEAK_PASSWORD' } } })).toBe(
      'Kata sandi baru minimal 8 karakter.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'TOKEN_EXPIRED' } } })).toBe(
      'Tautan pemulihan kata sandi telah kadaluarsa. Silakan ajukan permohonan baru.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'TOKEN_ALREADY_USED' } } })).toBe(
      'Tautan pemulihan kata sandi ini sudah pernah digunakan.'
    );
    expect(parsePasswordError({ isAxiosError: true, response: { status: 400, data: { code: 'INVALID_TOKEN' } } })).toBe(
      'Tautan pemulihan kata sandi tidak valid atau rusak.'
    );
    expect(parsePasswordError(new Error('Unknown network error'))).toBe(
      'Terjadi kendala saat memproses permintaan. Silakan coba lagi.'
    );
  });

  it('calls requestPasswordReset API', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce({ data: { message: 'OK' } });

    const res = await requestPasswordReset({ email: 'test@example.com' });
    expect(mockPost).toHaveBeenCalledWith('/v1/auth/forgot-password', { email: 'test@example.com' });
    expect(res.message).toBe('OK');
  });

  it('calls resetPassword API', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce({ data: { message: 'Reset success' } });

    const res = await resetPassword({
      token: 'token123',
      new_password: 'password123',
      confirmation: 'password123',
    });
    expect(mockPost).toHaveBeenCalledWith('/v1/auth/reset-password', {
      token: 'token123',
      new_password: 'password123',
      confirmation: 'password123',
    });
    expect(res.message).toBe('Reset success');
  });

  it('calls changePassword API', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce({ data: { message: 'Changed' } });

    const res = await changePassword({
      current_password: 'old',
      new_password: 'new',
      confirmation: 'new',
    });
    expect(mockPost).toHaveBeenCalledWith('/v1/auth/change-password', {
      current_password: 'old',
      new_password: 'new',
      confirmation: 'new',
    });
    expect(res.message).toBe('Changed');
  });
});
