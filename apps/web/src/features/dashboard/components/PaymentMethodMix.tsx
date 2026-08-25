import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatMinor } from '@/lib/format';
import { CreditCard, QrCode, Banknote, Landmark } from 'lucide-react';
import type { PaymentMethodShare } from '../types';

export interface PaymentMethodMixProps {
  paymentMix: PaymentMethodShare[];
}

function getPaymentIcon(method: string) {
  const m = method.toUpperCase();
  if (m.includes('QRIS')) return <QrCode className="h-3.5 w-3.5" />;
  if (m.includes('CASH') || m.includes('TUNAI')) return <Banknote className="h-3.5 w-3.5" />;
  if (m.includes('TRANSFER') || m.includes('BANK')) return <Landmark className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
}

function getPaymentColors(method: string) {
  const m = method.toUpperCase();
  if (m.includes('QRIS')) return { bg: 'bg-pine-soft', text: 'text-pine', border: 'border-pine/20', bar: 'bg-pine' };
  if (m.includes('TRANSFER') || m.includes('BANK')) return { bg: 'bg-ocean-soft', text: 'text-ocean', border: 'border-ocean/20', bar: 'bg-ocean' };
  if (m.includes('CASH') || m.includes('TUNAI')) return { bg: 'bg-honey-soft', text: 'text-honey', border: 'border-honey/20', bar: 'bg-honey' };
  return { bg: 'bg-surface-soft', text: 'text-ink', border: 'border-line', bar: 'bg-ink/60' };
}

export function PaymentMethodMix({ paymentMix }: PaymentMethodMixProps) {
  return (
    <Card className="border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)] flex flex-col justify-between">
      <CardHeader className="pb-3 border-b border-line/60">
        <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-ocean-soft border border-ocean/20 flex items-center justify-center text-ocean">
            <CreditCard className="h-3.5 w-3.5" />
          </div>
          <span>Bauran Pembayaran</span>
        </CardTitle>
        <p className="text-xs text-fog">Metode pembayaran transaksi hari ini</p>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {paymentMix.length === 0 ? (
          <div className="py-12 text-center text-xs text-fog">
            Belum ada data pembayaran hari ini
          </div>
        ) : (
          <>
            {/* Top Multi-Segment Ratio Bar */}
            <div className="h-2.5 w-full rounded-full bg-surface-soft overflow-hidden flex shadow-inner">
              {paymentMix.map((item) => {
                const colors = getPaymentColors(item.payment_method);
                return (
                  <div
                    key={item.payment_method}
                    style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    className={`h-full ${colors.bar} transition-all duration-300`}
                    title={`${item.label}: ${item.percentage}%`}
                  />
                );
              })}
            </div>

            {/* Itemized List */}
            <div className="space-y-3 pt-1">
              {paymentMix.map((item) => {
                const colors = getPaymentColors(item.payment_method);
                const Icon = getPaymentIcon(item.payment_method);

                return (
                  <div key={item.payment_method} className="space-y-1.5 p-2 rounded-lg bg-surface-soft/40 border border-line/50">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded flex items-center justify-center ${colors.bg} ${colors.text} ${colors.border} border`}>
                          {Icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink leading-tight">{item.label}</span>
                          <span className="text-[10px] text-fog">{item.count} transaksi</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <span className="num font-bold text-ink">
                          {formatMinor(item.total_minor)}
                        </span>
                        <span className={`num font-extrabold text-[11px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
