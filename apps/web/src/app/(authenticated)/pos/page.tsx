'use client';

import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import { usePOSViewModel } from '@/features/pos/use-pos-viewmodel';
import { POSSectionHead } from '@/features/pos/components/POSSectionHead';
import { POSCategoryFilter } from '@/features/pos/components/POSCategoryFilter';
import { POSProductGrid } from '@/features/pos/components/POSProductGrid';
import { POSCartSidebar } from '@/features/pos/components/POSCartSidebar';
import { POSPaymentModal } from '@/features/pos/components/POSPaymentModal';

export default function POSPage() {
  const { user, business } = useAuth();
  const { activeBranch } = useBranchContext();

  const cashierDisplayName = user?.email ? user.email.split('@')[0] : 'Kasir';

  const pos = usePOSViewModel({
    businessId: business?.id,
    branchId: activeBranch?.id,
    businessName: business?.name || 'SKM Mart',
    branchName: activeBranch?.name || 'Cabang Utama',
    cashierName: cashierDisplayName,
    cashierId: user?.id,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <POSSectionHead
        cashierName={cashierDisplayName}
        dailyCounter={pos.dailyCounter}
        onClear={pos.clearCart}
        isClearDisabled={pos.cart.lines.length === 0}
      />

      {/* Main 2-Column POS Layout */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left: Product Catalog */}
        <div className="space-y-4">
          <POSCategoryFilter
            categories={pos.categories}
            selectedCategory={pos.selectedCategory}
            onSelectCategory={pos.setSelectedCategory}
            searchQuery={pos.searchQuery}
            onSearchChange={pos.setSearchQuery}
          />

          {pos.dataState === 'loading' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card p-3.5 animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-3 w-16 bg-paper rounded" />
                    <div className="h-3 w-10 bg-paper rounded" />
                  </div>
                  <div className="h-8 bg-paper rounded" />
                  <div className="flex justify-between items-center pt-2">
                    <div className="h-5 w-20 bg-paper rounded" />
                    <div className="h-7 w-7 bg-paper rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : pos.dataState === 'error' ? (
            <div className="card p-8 text-center text-clay bg-clay-soft/30">
              <p className="font-bold">{pos.error || 'Gagal memuat produk'}</p>
              <button
                type="button"
                onClick={pos.refresh}
                className="btn-outline mt-3 px-4 py-1.5 text-[13px] cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <POSProductGrid
              products={pos.filteredProducts}
              selectedCategory={pos.selectedCategory}
              searchQuery={pos.searchQuery}
              onAddToCart={pos.addToCart}
            />
          )}
        </div>

        {/* Right: Sticky Cart Sidebar */}
        <div>
          <POSCartSidebar
            cart={pos.cart}
            customers={pos.customers}
            selectedCustomerId={pos.selectedCustomerId}
            onCustomerChange={pos.setCustomer}
            parkedOrders={pos.parkedOrders}
            onParkOrder={pos.saveParkedOrder}
            onRestoreParkedOrder={pos.restoreParkedOrder}
            onDeleteParkedOrder={pos.deleteParkedOrder}
            onIncrementLine={pos.incrementQuantity}
            onDecrementLine={pos.decrementQuantity}
            onRemoveLine={pos.removeFromCart}
            onDiscountChange={pos.setDiscountPercent}
            onOpenPayment={pos.openPaymentModal}
          />
        </div>
      </div>

      {/* Payment & Receipt Modal */}
      <POSPaymentModal
        isOpen={pos.isPaymentModalOpen}
        onClose={pos.closePaymentModal}
        cart={pos.cart}
        paymentState={pos.paymentState}
        onMethodChange={pos.setPaymentMethod}
        onPaidChange={pos.setCashReceived}
        onSubmitCheckout={pos.submitCheckout}
        isSubmitting={pos.checkoutState === 'submitting'}
        receipt={pos.receipt}
        onNewTransaction={pos.resetTransaction}
        error={pos.error}
      />
    </div>
  );
}
