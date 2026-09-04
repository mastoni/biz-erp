import { useEffect, useState } from 'react'
import { fetchPublicShowcase } from '../lib/api'
import { formatRupiah, formatBillingCycleSuffix } from '../lib/format'
import { resolveShowcaseCtaUrl } from '../lib/cta'
import type { PublicShowcaseItem, ShowcaseSection, PlanPricingDTO, BundlePricingDTO } from '../types'
import { IconCheck, IconArrowRight } from '../icons'
import { Reveal, Eyebrow } from './Ui'
import { ERP_URL } from '../data'

interface ShowcasePlansProps {
  section: ShowcaseSection
  eyebrowText?: string
  title?: string
  description?: string
  fallbackNode?: React.ReactNode
}

export default function ShowcasePlans({
  section,
  eyebrowText,
  title,
  description,
  fallbackNode,
}: ShowcasePlansProps) {
  const [items, setItems] = useState<PublicShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetchPublicShowcase(section, { signal: controller.signal })
        if (active) {
          if (res.items && res.items.length > 0) {
            // Sort deterministically by display_order ascending
            const sorted = [...res.items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            setItems(sorted)
          } else {
            setItems([])
          }
          setLoading(false)
        }
      } catch {
        if (active) {
          setItems([])
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
      controller.abort()
    }
  }, [section])

  // If loading, show skeleton cards matching paper-ink visual system
  if (loading) {
    return (
      <div className="mt-14 border-t-2 border-ink/10 pt-14">
        {eyebrowText && (
          <Reveal>
            <Eyebrow>{eyebrowText}</Eyebrow>
          </Reveal>
        )}
        {title && (
          <Reveal delay={90}>
            <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {title}
            </h2>
          </Reveal>
        )}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border-2 border-ink/10 bg-card p-6 sm:p-7 shadow-sm"
            >
              <div className="h-4 w-24 rounded bg-ink/10" />
              <div className="mt-4 h-7 w-3/4 rounded bg-ink/15" />
              <div className="mt-3 h-4 w-full rounded bg-ink/10" />
              <div className="mt-6 h-9 w-1/2 rounded bg-ink/20" />
              <div className="mt-6 space-y-2.5 border-t border-ink/10 pt-5">
                <div className="h-4 w-5/6 rounded bg-ink/10" />
                <div className="h-4 w-4/6 rounded bg-ink/10" />
                <div className="h-4 w-3/4 rounded bg-ink/10" />
              </div>
              <div className="mt-8 h-11 w-full rounded-xl bg-ink/15" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // If no items returned from API (empty or offline), render static fallback node
  if (items.length === 0) {
    return fallbackNode ? <>{fallbackNode}</> : null
  }

  // Render live dynamic showcase items
  return (
    <div className="mt-14 border-t-2 border-ink/10 pt-14">
      {eyebrowText && (
        <Reveal>
          <Eyebrow>{eyebrowText}</Eyebrow>
        </Reveal>
      )}
      {title && (
        <Reveal delay={90}>
          <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {title}
          </h2>
        </Reveal>
      )}
      {description && (
        <Reveal delay={150}>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/60">
            {description}
          </p>
        </Reveal>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => {
          const isFeatured = item.is_featured || Boolean(item.marketing_badge)
          const planPricing = item.item_type === 'PLAN' ? (item.pricing as PlanPricingDTO | null) : null
          const bundlePricing = item.item_type === 'BUNDLE' ? (item.pricing as BundlePricingDTO | null) : null
          const ctaUrl = resolveShowcaseCtaUrl(item)
          const isExternal = ctaUrl.startsWith('http://') || ctaUrl.startsWith('https://')

          return (
            <Reveal key={item.id} delay={idx * 80}>
              <div
                className={`relative flex h-full flex-col justify-between rounded-2xl border-2 transition hover:-translate-y-1 ${
                  isFeatured
                    ? 'border-marigold bg-card shadow-[0_20px_40px_-15px_rgba(235,160,0,0.25)]'
                    : 'border-ink/10 bg-card hover:border-ink/30 shadow-sm hover:shadow-md'
                } p-6 sm:p-7`}
              >
                <div>
                  {/* Marketing badge / ribbon */}
                  {item.marketing_badge && (
                    <div className="mb-4">
                      <span className="inline-flex items-center rounded-full border border-marigold/40 bg-marigold/15 px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.18em] text-marigold-2">
                        {item.marketing_badge}
                      </span>
                    </div>
                  )}

                  {/* Title & Headline */}
                  <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                    {item.display_name}
                  </h3>
                  {item.headline && (
                    <p className="mt-1 text-sm font-semibold text-ink/75">
                      {item.headline}
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-2 text-sm leading-relaxed text-ink/60">
                      {item.description}
                    </p>
                  )}

                  {/* Pricing Display */}
                  <div className="mt-6 rounded-xl border border-ink/10 bg-paper/50 p-4">
                    {item.item_type === 'PLAN' && planPricing && (
                      <div>
                        {((planPricing.discount_amount ?? 0) > 0 || ((planPricing as any).discount ?? 0) > 0) && (
                          <span className="block text-xs font-semibold text-ink/40 line-through">
                            {formatRupiah(planPricing.base_price)}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-3xl font-extrabold tracking-tight text-ink">
                            {formatRupiah(planPricing.final_price ?? planPricing.base_price)}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink/50">
                            {formatBillingCycleSuffix(item.target_details?.billing_cycle as string)}
                          </span>
                        </div>
                      </div>
                    )}

                    {item.item_type === 'BUNDLE' && bundlePricing && (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
                            {formatRupiah(bundlePricing.monthly_price ?? (bundlePricing as any).monthly ?? 0)}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink/50">/bulan</span>
                        </div>
                        {(Number(bundlePricing.one_time_price ?? (bundlePricing as any).one_time ?? 0) > 0) && (
                          <p className="font-mono text-[11px] font-semibold text-ink/60">
                            + {formatRupiah(bundlePricing.one_time_price ?? (bundlePricing as any).one_time)} (biaya perangkat & pasang)
                          </p>
                        )}
                      </div>
                    )}

                    {item.item_type === 'CATALOG_PRODUCT' && item.pricing && (
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-extrabold tracking-tight text-ink">
                          {formatRupiah((item.pricing as any).base_price)}
                        </span>
                      </div>
                    )}

                    {item.item_type === 'CUSTOM' && (
                      <span className="font-display text-lg font-bold text-ink">Hubungi Kami</span>
                    )}
                  </div>

                  {/* Feature bullet points */}
                  {Array.isArray(item.features_list) && item.features_list.length > 0 && (
                    <ul className="mt-6 space-y-2.5 border-t border-ink/10 pt-5">
                      {item.features_list.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-ink/75">
                          <IconCheck size={16} className="mt-0.5 shrink-0 text-leaf" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Call to Action button */}
                <div className="mt-8 pt-4 border-t border-ink/10">
                  <a
                    href={ctaUrl}
                    target={isExternal ? '_blank' : '_self'}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    className={`btn-arrow flex w-full items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-center text-sm font-extrabold transition ${
                      isFeatured
                        ? 'bg-marigold text-ink hover:bg-[#d99400] shadow-sm'
                        : 'bg-ink text-paper hover:bg-ink-2'
                    }`}
                  >
                    <span>{item.cta_text || 'Pilih Paket'}</span>
                    <IconArrowRight size={15} />
                  </a>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
