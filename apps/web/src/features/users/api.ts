import { api } from '@/lib/api';

export interface UserDto {
  id: string;
  email: string;
  role: 'OWNER' | 'CASHIER';
  status: string;
  created_at: string;
}

export interface UserListResponse {
  items: UserDto[];
  total: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: 'OWNER' | 'CASHIER';
}

export async function getUsers(): Promise<UserListResponse> {
  const response = await api.get<UserListResponse>('/v1/users');
  return response.data;
}

export async function createUser(input: CreateUserInput): Promise<UserDto> {
  const response = await api.post<UserDto>('/v1/users', input);
  return response.data;
}

export async function revokeUser(userId: string): Promise<{ message: string }> {
  const response = await api.patch<{ message: string }>(`/v1/users/${userId}`, {
    status: 'REVOKED',
  });
  return response.data;
}
