'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getUsers, createUser, revokeUser, UserDto } from '@/features/users/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, UserX, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UsersPage() {
  const { user: currentUser, role } = useAuth();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'CASHIER' as 'OWNER' | 'CASHIER',
  });

  const isOwner = role === 'OWNER';

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data.items);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Gagal memuat data pengguna.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchUsers();
    }
  }, [isOwner]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createUser({
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      setCreateDialogOpen(false);
      setFormData({ email: '', password: '', role: 'CASHIER' });
      await fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Gagal menambahkan pengguna.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await revokeUser(selectedUser.id);
      setRevokeDialogOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Gagal mencabut akses pengguna.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Manajemen Pengguna</h2>
          <p className="text-ink/60 mt-1">Kelola pengguna yang memiliki akses ke bisnis ini.</p>
        </div>
        <Alert className="border-brick/20 bg-brick/5">
          <AlertTitle className="text-brick">Akses Ditolak</AlertTitle>
          <AlertDescription className="text-brick/80">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Manajemen Pengguna</h2>
          <p className="text-ink/60 mt-1">Kelola pengguna yang memiliki akses ke bisnis ini.</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger
            render={
              <Button className="bg-ink text-paper hover:bg-ink-2">
                <UserPlus className="mr-2 h-4 w-4" />
                Tambah Pengguna
              </Button>
            }
          />
          <DialogContent className="border-2 border-ink/10 bg-card">
            <DialogHeader>
              <DialogTitle className="font-display font-medium text-ink">Tambah Pengguna</DialogTitle>
              <DialogDescription className="text-ink/60">
                Buat akun pengguna baru untuk bisnis ini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-ink">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="border-ink/15 focus:border-ink focus:ring-marigold/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-ink">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="border-ink/15 focus:border-ink focus:ring-marigold/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-ink">Role</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'OWNER' | 'CASHIER' })}
                    className="flex h-8 w-full rounded-md border border-ink/15 bg-transparent px-2.5 py-1 text-sm transition-colors focus:border-ink focus:ring-marigold/50"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="CASHIER">CASHIER</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isSubmitting}
                  className="border-ink/20 text-ink hover:bg-ink/5"
                >
                  Batal
                </Button>
                <Button type="submit" className="bg-ink text-paper hover:bg-ink-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    'Simpan'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-2 border-ink/10 bg-card shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Daftar Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-ink/40">
              <p className="text-sm">Belum ada pengguna.</p>
            </div>
          ) : (
            <div className="rounded-md border border-ink/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ink/5">
                    <TableHead className="text-ink font-medium">Email</TableHead>
                    <TableHead className="text-ink font-medium">Role</TableHead>
                    <TableHead className="text-ink font-medium">Status</TableHead>
                    <TableHead className="text-ink font-medium text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-ink/5">
                      <TableCell className="font-medium text-ink">{u.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          u.role === 'OWNER'
                            ? 'bg-ink text-paper'
                            : 'bg-ink/5 text-ink border border-ink/10'
                        }`}>
                          {u.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          u.status === 'ACTIVE'
                            ? 'bg-leaf/5 text-leaf border border-leaf/20'
                            : 'bg-brick/5 text-brick border border-brick/20'
                        }`}>
                          {u.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {u.status === 'ACTIVE' && u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setRevokeDialogOpen(true);
                            }}
                            className="text-brick hover:text-brick hover:bg-brick/5"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Cabut Akses
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="border-2 border-ink/10 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display font-medium text-ink">Cabut Akses Pengguna</DialogTitle>
            <DialogDescription className="text-ink/60">
              Apakah Anda yakin ingin mencabut akses untuk <strong>{selectedUser?.email}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={isSubmitting}
              className="border-ink/20 text-ink hover:bg-ink/5"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isSubmitting}
              className="bg-brick text-white hover:bg-brick/90"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                'Cabut Akses'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
