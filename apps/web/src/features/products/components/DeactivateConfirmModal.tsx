import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { ProductViewModel } from '../types';

interface DeactivateConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  product: ProductViewModel | null;
  isSubmitting?: boolean;
}

export function DeactivateConfirmModal({
  open,
  onClose,
  onConfirm,
  product,
  isSubmitting = false,
}: DeactivateConfirmModalProps) {
  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title="Nonaktifkan Produk?"
      maxWidth="sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-clay shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-ink mb-1">
            Produk <strong className="font-medium">{product.name}</strong> akan dinonaktifkan.
          </p>
          <p className="text-xs text-fog">
            Produk yang dinonaktifkan tidak akan ditampilkan di kasir, namun data tetap tersimpan.
          </p>
          <p className="text-xs text-fog mt-2">
            Server Version: {product.server_version}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Batal
        </Button>
        <Button
          type="button"
          variant="clay"
          size="sm"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Memproses...' : 'Nonaktifkan'}
        </Button>
      </div>
    </Modal>
  );
}
