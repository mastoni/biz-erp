import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, Save, Image as ImageIcon, X, Upload } from 'lucide-react';
import type {
  ProductViewModel,
  ProductFormModel,
  ProductOperationError,
  ProductSaveState,
} from '../types';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  businessId: string;
  branchName?: string;
  product?: ProductViewModel;
  serverVersion?: number;
  onSave: (
    payload: ProductFormModel & { id?: string; business_id: string; expected_server_version?: number },
    idempotencyKey?: string,
  ) => Promise<void>;
  conflictError?: ProductOperationError | null;
  onResolveConflict?: () => void;
}

const initialForm: ProductFormModel = {
  name: '',
  description: '',
  sku: '',
  category: '',
  barcode: '',
  image_url: '',
  image_enabled: false,
  price_minor: 0,
  cost_minor: null,
  is_active: true,
};

function formFromProduct(product: ProductViewModel | undefined): ProductFormModel {
  if (!product) return { ...initialForm, is_active: true };
  return {
    name: product.name,
    description: product.description || '',
    sku: product.sku || '',
    category: product.category || '',
    barcode: product.barcode || '',
    image_url: product.image_url || '',
    image_enabled: product.image_enabled ?? Boolean(product.image_url),
    price_minor: product.price_minor,
    cost_minor: product.cost_minor,
    is_active: product.is_active,
  };
}

export function ProductFormModal({
  open,
  onClose,
  mode,
  businessId,
  branchName,
  product,
  serverVersion,
  onSave,
  conflictError,
  onResolveConflict,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductFormModel>(() => formFromProduct(mode === 'edit' ? product : undefined));
  const [saveState, setSaveState] = useState<ProductSaveState>('saved');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (name === 'image_url') {
      setImagePreviewError(false);
      if (value.trim().length > 0 && !form.image_enabled) {
        setForm((prev) => ({ ...prev, image_url: value, image_enabled: true }));
        return;
      }
    }

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      const numValue = value === '' ? 0 : parseInt(value, 10);
      setForm((prev) => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFieldError('Hanya file gambar (JPG, PNG, WEBP, GIF) yang diperbolehkan');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldError('Ukuran file tidak boleh lebih dari 5MB');
      return;
    }

    // Convert to object URL for local preview or reference
    const localUrl = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      image_url: localUrl,
      image_enabled: true,
    }));
    setImagePreviewError(false);
    setFieldError(null);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Nama produk wajib diisi';
    if (form.price_minor < 0) return 'Harga jual tidak boleh negatif';
    if (form.cost_minor !== null && form.cost_minor < 0) return 'HPP tidak boleh negatif';
    return null;
  };

  const handleClearImage = () => {
    setForm((prev) => ({ ...prev, image_url: '', image_enabled: false }));
    setImagePreviewError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setSaveState('saving');

    const cleanPayload: ProductFormModel = {
      ...form,
      image_url: form.image_url?.trim() ? form.image_url.trim() : undefined,
      image_enabled: form.image_enabled ?? false,
    };

    try {
      if (mode === 'edit') {
        await onSave(
          { ...cleanPayload, id: product?.id, business_id: businessId, expected_server_version: serverVersion },
        );
      } else {
        const idempotencyKey = crypto.randomUUID();
        await onSave(
          { ...cleanPayload, business_id: businessId },
          idempotencyKey,
        );
      }
      setSaveState('saved');
      onClose();
    } catch (err) {
      const classified = err as ProductOperationError | undefined;
      if (classified?.type === 'sku_conflict' || classified?.type === 'barcode_conflict' || classified?.type === 'version_conflict') {
        setSaveState('conflict');
      } else {
        setSaveState('error');
        setFieldError(
          classified?.message ||
          (err instanceof Error ? err.message : 'Gagal menyimpan produk'),
        );
      }
    }
  };

  const isSaving = saveState === 'saving';
  const title = mode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk';
  const submitLabel = mode === 'create' ? 'Buat Produk' : 'Simpan Perubahan';

  return (
    <Modal
      open={open}
      onClose={isSaving ? () => {} : onClose}
      title={title}
      description={branchName ? `Cabang: ${branchName}` : undefined}
      maxWidth="lg"
    >
      <div key={mode === 'edit' && product ? `edit-${product.id}` : 'create'}>
      {conflictError && (
        <div className="mb-4 p-3 rounded-md bg-clay-soft/20 border border-clay/30 text-clay">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                {conflictError.type === 'version_conflict'
                  ? 'Produk diubah oleh pengguna lain'
                  : conflictError.type === 'sku_conflict'
                    ? 'SKU sudah digunakan'
                    : 'Barcode sudah digunakan'}
              </p>
              <p className="text-xs mt-1">{conflictError.message}</p>
              {onResolveConflict && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={onResolveConflict}
                >
                  Muat Data Terbaru
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="label">Nama Produk *</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            disabled={isSaving || !!conflictError}
            placeholder="e.g. Kopi Susu Gula Aren"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price_minor" className="label">Harga Jual *</Label>
            <Input
              id="price_minor"
              name="price_minor"
              type="number"
              min="0"
              required
              value={form.price_minor}
              onChange={handleChange}
              disabled={isSaving || !!conflictError}
              className="num"
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_minor" className="label">HPP (Cost)</Label>
            <Input
              id="cost_minor"
              name="cost_minor"
              type="number"
              min="0"
              value={form.cost_minor ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({ ...prev, cost_minor: val === '' ? null : parseInt(val, 10) }));
              }}
              disabled={isSaving || !!conflictError}
              className="num"
              placeholder="Kosongkan jika tidak diketahui"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku" className="label">SKU</Label>
          <Input
            id="sku"
            name="sku"
            type="text"
            value={form.sku}
            onChange={handleChange}
            disabled={isSaving || !!conflictError}
            placeholder="Optional — unik per tenant"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="barcode" className="label">Barcode</Label>
            <Input
              id="barcode"
              name="barcode"
              type="text"
              value={form.barcode}
              onChange={handleChange}
              disabled={isSaving || !!conflictError}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="label">Kategori</Label>
            <Input
              id="category"
              name="category"
              type="text"
              value={form.category}
              onChange={handleChange}
              disabled={isSaving || !!conflictError}
              placeholder="e.g. Minuman"
            />
          </div>
        </div>

        {/* Product Media & Image Section */}
        <div className="space-y-2 rounded-lg border border-line p-3 bg-paper/30">
          <div className="flex items-center justify-between">
            <Label htmlFor="image_url" className="label">
              URL Gambar Produk
            </Label>
            <span className="text-[11px] font-normal text-fog">URL atau Unggah Berkas</span>
          </div>

          <div className="flex gap-2">
            <Input
              id="image_url"
              name="image_url"
              type="url"
              value={form.image_url || ''}
              onChange={handleChange}
              disabled={isSaving || !!conflictError}
              placeholder="https://example.com/gambar-produk.jpg"
              className="flex-1"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileUpload}
              className="hidden"
              id="product-file-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-3"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving || !!conflictError}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Unggah
            </Button>
          </div>

          {form.image_url && form.image_url.trim().length > 0 && (
            <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-line bg-paper/60 p-2.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface">
                {!imagePreviewError ? (
                  <img
                    src={form.image_url.trim()}
                    alt="Pratinjau gambar produk"
                    className="h-full w-full object-cover"
                    onError={() => setImagePreviewError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-1">
                    <ImageIcon className="h-4 w-4 text-clay" />
                    <span className="text-[9.5px] font-semibold text-clay mt-0.5">Gagal</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{form.image_url.trim()}</p>
                <p className="text-[11px] text-fog">
                  {!imagePreviewError ? 'Pratinjau gambar valid' : 'Tautan gambar tidak dapat dimuat'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-clay hover:bg-clay-soft/50"
                onClick={handleClearImage}
                disabled={isSaving || !!conflictError}
              >
                <X className="mr-1 h-3 w-3" />
                Hapus
              </Button>
            </div>
          )}

          {/* image_enabled toggle */}
          <div className="flex items-center gap-2 pt-1.5 border-t border-line/60">
            <input
              id="image_enabled"
              name="image_enabled"
              type="checkbox"
              checked={form.image_enabled ?? false}
              onChange={handleChange}
              disabled={isSaving || !!conflictError}
              className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
            />
            <Label htmlFor="image_enabled" className="text-xs font-medium text-ink cursor-pointer">
              Tampilkan gambar di katalog dan kasir POS
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="label">Deskripsi</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
            disabled={isSaving || !!conflictError}
            className="input resize-y"
            placeholder="Deskripsi singkat produk..."
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            checked={form.is_active}
            onChange={handleChange}
            disabled={isSaving || !!conflictError}
            className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
          />
          <Label htmlFor="is_active" className="text-xs text-fog">
            Aktif (tersedia untuk dijual)
          </Label>
        </div>

        {fieldError && (
          <p className="text-xs text-clay">{fieldError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isSaving || !!conflictError}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </form>
      </div>
    </Modal>
  );
}
