import { api } from '@/lib/api';
import axios from 'axios';

export interface RequestPasswordResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  new_password: string;
  confirmation: string;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
  confirmation: string;
}

export interface PasswordResponse {
  message: string;
}

export async function requestPasswordReset(data: RequestPasswordResetDto): Promise<PasswordResponse> {
  const response = await api.post<PasswordResponse>('/v1/auth/forgot-password', data);
  return response.data;
}

export async function resetPassword(data: ResetPasswordDto): Promise<PasswordResponse> {
  const response = await api.post<PasswordResponse>('/v1/auth/reset-password', data);
  return response.data;
}

export async function changePassword(data: ChangePasswordDto): Promise<PasswordResponse> {
  const response = await api.post<PasswordResponse>('/v1/auth/change-password', data);
  return response.data;
}

export function parsePasswordError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { code?: string; message?: string; error?: string } | undefined;
    if (data?.message) {
      return data.message;
    }
    if (data?.code === 'TOO_MANY_REQUESTS' || err.response?.status === 429) {
      return 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.';
    }
    if (data?.code === 'INVALID_CURRENT_PASSWORD') {
      return 'Kata sandi lama yang Anda masukkan tidak sesuai.';
    }
    if (data?.code === 'PASSWORD_MISMATCH') {
      return 'Konfirmasi kata sandi baru tidak cocok.';
    }
    if (data?.code === 'WEAK_PASSWORD') {
      return 'Kata sandi baru minimal 8 karakter.';
    }
    if (data?.code === 'TOKEN_EXPIRED') {
      return 'Tautan pemulihan kata sandi telah kadaluarsa. Silakan ajukan permohonan baru.';
    }
    if (data?.code === 'TOKEN_ALREADY_USED') {
      return 'Tautan pemulihan kata sandi ini sudah pernah digunakan.';
    }
    if (data?.code === 'INVALID_TOKEN') {
      return 'Tautan pemulihan kata sandi tidak valid atau rusak.';
    }
  }
  return 'Terjadi kendala saat memproses permintaan. Silakan coba lagi.';
}
