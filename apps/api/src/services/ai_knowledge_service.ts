export interface KnowledgeArticle {
  id: string
  domain: 'PLATFORM' | 'ERP' | 'POS' | 'ISP_MANAGEMENT' | 'CCTV_MANAGEMENT' | 'BILLING' | 'TROUBLESHOOTING'
  title: string
  content: string
  keywords: string[]
  isPublic: boolean
}

export function createAiKnowledgeService() {
  const articles: KnowledgeArticle[] = [
    {
      id: 'kb-plat-01',
      domain: 'PLATFORM',
      title: 'Tentang Ekosistem SKMNetwork',
      content: 'SKMNetwork adalah platform multi-service terintegrasi yang menyediakan ERP, ISP Management, CCTV Management, WhatsApp Gateway, dan Digital Marketing AutoPost.',
      keywords: ['skmnetwork', 'ekosistem', 'platform', 'layanan'],
      isPublic: true,
    },
    {
      id: 'kb-bill-01',
      domain: 'BILLING',
      title: 'Siklus dan Pembayaran Tagihan',
      content: 'Tagihan langganan dibuat setiap awal periode penagihan. Pembayaran dapat dilakukan via virtual account atau transfer bank otomatis.',
      keywords: ['tagihan', 'pembayaran', 'invoice', 'bayar', 'billing'],
      isPublic: true,
    },
    {
      id: 'kb-isp-01',
      domain: 'ISP_MANAGEMENT',
      title: 'Troubleshooting Router dan Internet ISP',
      content: 'Jika koneksi internet mati: 1. Periksa lampu indikator PON/LOS pada router ONT. 2. Restart router selama 30 detik. 3. Jika lampu LOS merah, hubungi tim teknis via AI CS.',
      keywords: ['wifi', 'internet', 'mati', 'los', 'pon', 'ont', 'router'],
      isPublic: false,
    },
    {
      id: 'kb-erp-01',
      domain: 'ERP',
      title: 'Pencatatan dan Laporan Penjualan ERP',
      content: 'Laporan penjualan harian dapat diakses melalui menu Penjualan > Laporan. Transaksi kasir POS secara otomatis tersinkronisasi ke jurnal keuangan.',
      keywords: ['laporan', 'penjualan', 'pos', 'kasir', 'stok', 'erp'],
      isPublic: false,
    },
    {
      id: 'kb-cctv-01',
      domain: 'CCTV_MANAGEMENT',
      title: 'Konfigurasi Streaming CCTV & Retensi Video',
      content: 'Kamera CCTV terhubung melalui gateway streaming terenkripsi. Retensi rekaman default adalah 30 hari sesuai paket langganan.',
      keywords: ['cctv', 'kamera', 'rekaman', 'streaming', 'nvr'],
      isPublic: false,
    },
    {
      id: 'kb-trbl-01',
      domain: 'TROUBLESHOOTING',
      title: 'Panduan Eskalasi Kendala Teknis',
      content: 'Untuk kendala kritis yang tidak terselesaikan melalui panduan otomatis, Anda dapat meminta eskalasi langsung ke tiket bantuan operator manusia.',
      keywords: ['eskalasi', 'bantuan', 'manusia', 'tiket', 'operator', 'support'],
      isPublic: true,
    },
  ]

  return {
    /**
     * Search knowledge articles matching query keywords within allowed domains.
     */
    searchKnowledge(query: string, allowedDomains: string[] = ['PLATFORM', 'BILLING', 'TROUBLESHOOTING']): KnowledgeArticle[] {
      const q = query.toLowerCase()
      return articles.filter((art) => {
        if (!art.isPublic && !allowedDomains.includes(art.domain)) {
          return false
        }
        return (
          art.title.toLowerCase().includes(q) ||
          art.content.toLowerCase().includes(q) ||
          art.keywords.some((kw) => q.includes(kw))
        )
      })
    },

    getArticleById(id: string): KnowledgeArticle | null {
      return articles.find((a) => a.id === id) || null
    },
  }
}
