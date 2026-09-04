/* ================= Konten statis SKMNetwork ================= */

/* ============ Konfigurasi terpusat: URL & kontak ============
   Semua URL keluar dikelola di satu tempat. Saat URL produksi
   resmi diterbitkan, cukup ubah nilai di blok ini — seluruh
   komponen akan mengikuti. Hanya URL produksi publik yang boleh
   dicantumkan di sini — jangan menaruh alamat sistem tertutup. */
export const SITE = "https://www.skmnetwork.com"; // VERIFIED — domain produksi landing publik
export const ERP_URL = "https://erp.skmnetwork.com"; // VERIFIED — SKMNetwork ERP web produksi
export const CONTACT_URL = "#kontak"; // rute kontak resmi (id="kontak")
export const INTERNET_URL = "#internet"; // arahkan ke bagian internet (id="internet")

/* Ilustrasi produk ERP (konten halaman, bukan aset brand).
   NEEDS-CONFIGURATION: aset resmi belum tersedia di repo (masih host
   eksternal). Unduh ke public/img/erp-illustration.png lalu ganti nilai
   di bawah menjadi "/img/erp-illustration.png" — seluruh komponen mengikuti. */
export const ERP_IMAGE =
  "https://image.qwenlm.ai/generated-images/00b49471-53ee-4e32-b0ec-f43fc53a8585/_result.png";

/* Kontak resmi — diisi HANYA dengan data terverifikasi SKMNetwork.
   Jangan mengarang nomor telepon, email, alamat, atau akun sosial. */
export const CONTACTS: { label: string; value: string; href: string }[] = [
  { label: "Situs resmi", value: "www.skmnetwork.com", href: SITE },
  { label: "Kontak & dukungan", value: "halaman kontak resmi", href: CONTACT_URL },
];

export const navLinks = [
  { href: "#beranda", label: "Beranda" },
  { href: "#internet", label: "Internet" },
  { href: "#erp", label: "ERP & POS" },
  { href: "#infrastruktur", label: "CCTV" },
  { href: "#paket-promo", label: "Paket / Promo" },
  { href: "#kontak", label: "Kontak" },
];

export const capabilities = [
  {
    icon: "wifi",
    title: "Internet & Connectivity",
    desc: "Koneksi untuk rumah, usaha, dan aktivitas digital.",
  },
  {
    icon: "network",
    title: "Network Infrastructure",
    desc: "Perancangan, instalasi, dan pengelolaan jaringan.",
  },
  {
    icon: "cctv",
    title: "CCTV & Security",
    desc: "Teknologi pengawasan dan keamanan yang terpantau.",
  },
  {
    icon: "code",
    title: "Software & Digital Solutions",
    desc: "Sistem digital untuk operasional bisnis.",
  },
];

export const servicesMarquee = [
  "Internet & WiFi",
  "Network Infrastructure",
  "CCTV & Security",
  "SKMNetwork ERP",
  "WhatsApp Gateway",
  "Auto-Posting Sosmed",
  "IT Solutions",
  "Maintenance & Support",
  "Cloud & Server",
  "Sistem Monitoring",
];

export const heroNodes = [
  { icon: "wifi", label: "Internet", sub: "konektivitas", pos: "top-[2%] left-1/2 -translate-x-1/2" },
  { icon: "network", label: "Network", sub: "infrastruktur", pos: "top-[22%] right-0" },
  { icon: "cctv", label: "CCTV", sub: "keamanan", pos: "top-[63%] right-[-2%]" },
  { icon: "code", label: "Software", sub: "sistem", pos: "bottom-[3%] right-[16%]" },
  { icon: "cloud", label: "Cloud", sub: "data", pos: "bottom-[3%] left-[8%]" },
  { icon: "business", label: "Business", sub: "operasional", pos: "top-[42%] left-[-2%]" },
];

export const problems = [
  {
    no: "01",
    icon: "wifi",
    title: "Internet dan jaringan tidak stabil",
    desc: "Koneksi putus-nyambung menghambat pekerjaan, transaksi, dan layanan pelanggan. Masalah jaringan sering baru ditangani setelah terlanjur mengganggu operasional.",
    tag: "koneksi sering terganggu",
  },
  {
    no: "02",
    icon: "network",
    title: "Perangkat dan sistem berjalan sendiri-sendiri",
    desc: "Internet, CCTV, perangkat, dan aplikasi bisnis tidak saling terhubung. Akibatnya data terpisah-pisah dan sulit mendapat gambaran utuh tentang kondisi lapangan.",
    tag: "data terpisah-pisah",
  },
  {
    no: "03",
    icon: "monitor",
    title: "Monitoring dilakukan manual",
    desc: "Pengecekan perangkat dan sistem mengandalkan kunjungan fisik atau laporan manual. Gangguan sering terlambat diketahui karena tidak ada pemantauan terpusat.",
    tag: "gangguan terlambat diketahui",
  },
  {
    no: "04",
    icon: "code",
    title: "Bisnis membutuhkan software yang sesuai kebutuhan",
    desc: "Software generik sering tidak cocok dengan alur kerja nyata di lapangan. Bisnis butuh sistem yang mengikuti prosesnya, bukan sebaliknya.",
    tag: "software tidak pas",
  },
];

export const solutions = [
  {
    id: "internet",
    icon: "wifi",
    title: "Internet & WiFi",
    desc: "Konektivitas andal untuk rumah dan bisnis — dirancang sesuai kebutuhan pemakaian, bukan sekadar terpasang.",
    points: ["Untuk rumah, toko, & kantor", "Konfigurasi WiFi yang tertata"],
    visual: "signal",
    span: "lg:col-span-7 lg:row-span-2",
  },
  {
    id: "network",
    icon: "network",
    title: "Network & Infrastructure",
    desc: "Instalasi, konfigurasi, dan pengelolaan jaringan — dari kabel hingga manajemen perangkat.",
    points: ["Perancangan topologi jaringan", "Manajemen & dokumentasi"],
    visual: "node",
    span: "lg:col-span-5",
  },
  {
    id: "cctv",
    icon: "cctv",
    title: "CCTV & Security",
    desc: "Teknologi pengawasan dan keamanan yang bisa dipantau, untuk rumah maupun tempat usaha.",
    points: ["Instalasi & penempatan kamera", "Akses pantauan jarak jauh"],
    visual: "cam",
    span: "lg:col-span-5",
  },
  {
    id: "software",
    icon: "code",
    title: "Software & ERP",
    desc: "Sistem digital untuk operasional bisnis — termasuk SKMNetwork ERP untuk penjualan dan inventory.",
    points: ["SKMNetwork ERP terintegrasi", "Dikembangkan sesuai kebutuhan"],
    visual: "code",
    span: "lg:col-span-4",
  },
  {
    id: "solutions",
    icon: "chip",
    title: "IT & Digital Solutions",
    desc: "Solusi teknologi dan produk digital yang disesuaikan dengan kebutuhan nyata bisnis — dari otomatisasi WhatsApp hingga auto-posting media sosial.",
    points: ["WA Gateway & AutoPost", "Solusi sesuai kebutuhan"],
    visual: "chip",
    span: "lg:col-span-4",
  },
  {
    id: "support",
    icon: "headset",
    title: "Maintenance & Support",
    desc: "Dukungan teknis dan perawatan sistem agar teknologi terus berjalan, bukan hanya saat pemasangan.",
    points: ["Perawatan berkala", "Bantuan teknis berkelanjutan"],
    visual: "support",
    span: "lg:col-span-4",
    dark: true,
  },
];

export const erpModules = [
  { icon: "erp", title: "Kasir & Penjualan", desc: "Catat transaksi penjualan harian dengan rapi." },
  { icon: "layers", title: "Inventory", desc: "Pantau pergerakan dan posisi stok." },
  { icon: "store", title: "Produk", desc: "Kelola data produk dalam satu tempat." },
  { icon: "target", title: "Pelanggan", desc: "Data pelanggan yang terpusat." },
  { icon: "expand", title: "Multi-Business / Multi-Tenant", desc: "Satu sistem untuk beberapa unit usaha." },
  { icon: "monitor", title: "Laporan & Monitoring", desc: "Ringkasan operasional untuk pengambilan keputusan." },
];

export const erpAccess = [
  {
    tag: "INCLUDED",
    title: "Termasuk untuk Pelanggan Internet",
    desc: "Untuk pelanggan internet SKMNetwork yang mendapatkan ERP sebagai bagian/benefit layanan sesuai ketentuan paket.",
  },
  {
    tag: "STANDALONE",
    title: "Berlangganan Mandiri",
    desc: "Untuk UMKM yang ingin menggunakan ERP secara mandiri tanpa harus menjadi pelanggan internet SKMNetwork.",
  },
];

export const ecosystemLayers = [
  {
    icon: "wifi",
    tag: "Layer 01 · Konektivitas",
    title: "Internet",
    desc: "Fondasi koneksi untuk seluruh perangkat dan sistem.",
  },
  {
    icon: "network",
    tag: "Layer 02 · Infrastruktur",
    title: "Network",
    desc: "Jaringan yang dirancang dan dikelola agar lalu lintas data tertata.",
  },
  {
    icon: "cctv",
    tag: "Layer 03 · Perangkat",
    title: "CCTV & Devices",
    desc: "Perangkat di lapangan yang terhubung ke jaringan.",
  },
  {
    icon: "monitor",
    tag: "Layer 04 · Pengawasan",
    title: "Monitoring",
    desc: "Kondisi jaringan dan perangkat terpantau secara terpusat.",
  },
  {
    icon: "code",
    tag: "Layer 05 · Sistem",
    title: "Software & ERP",
    desc: "Sistem digital yang menjalankan proses bisnis sehari-hari.",
  },
  {
    icon: "business",
    tag: "Layer 06 · Hasil",
    title: "Business",
    desc: "Operasional yang lebih terhubung dan keputusan yang lebih baik.",
  },
];

export const steps = [
  {
    no: "01",
    icon: "target",
    title: "Kenali Kebutuhan",
    desc: "Kami mulai dengan memahami kondisi, kebutuhan, dan tujuan Anda — bukan langsung menawarkan paket.",
  },
  {
    no: "02",
    icon: "layers",
    title: "Rancang Solusi",
    desc: "Solusi disusun dari kombinasi layanan yang relevan: konektivitas, jaringan, keamanan, hingga sistem digital.",
  },
  {
    no: "03",
    icon: "headset",
    title: "Implementasi & Support",
    desc: "Solusi diimplementasikan dengan rapi dan didukung perawatan serta bantuan teknis berkelanjutan.",
  },
];

export const customerTypes = [
  {
    icon: "home",
    title: "Rumah",
    desc: "Koneksi dan keamanan untuk aktivitas digital keluarga.",
    items: ["Internet & WiFi", "CCTV rumah"],
  },
  {
    icon: "store",
    title: "Usaha Kecil",
    desc: "Teknologi yang membantu usaha berjalan lebih rapi.",
    items: ["Internet usaha", "Kasir & ERP", "CCTV"],
  },
  {
    icon: "business",
    title: "Toko",
    desc: "Operasional penjualan dan keamanan yang terpantau.",
    items: ["Kasir & penjualan", "Inventory", "CCTV"],
  },
  {
    icon: "office",
    title: "Kantor",
    desc: "Jaringan kerja yang stabil dan sistem yang mendukung produktivitas.",
    items: ["Jaringan kantor", "Software", "Maintenance"],
  },
  {
    icon: "globe",
    title: "Bisnis",
    desc: "Ekosistem teknologi untuk operasional multi-unit.",
    items: ["ERP multi-business", "Infrastruktur", "Monitoring"],
  },
  {
    icon: "server",
    title: "Network / ISP",
    desc: "Dukungan infrastruktur dan sistem untuk penyedia layanan.",
    items: ["Infrastruktur jaringan", "Monitoring", "Dukungan teknis"],
  },
];

export const whyPoints = [
  {
    no: "01",
    icon: "link",
    title: "Solusi Terintegrasi",
    desc: "Internet, jaringan, keamanan, dan sistem digital dirancang saling terhubung — bukan berjalan sendiri-sendiri.",
  },
  {
    no: "02",
    icon: "headset",
    title: "Dukungan Teknis",
    desc: "Teknologi tidak berhenti saat pemasangan. Kami mendampingi dengan perawatan dan bantuan teknis.",
  },
  {
    no: "03",
    icon: "gear",
    title: "Pendekatan Praktis",
    desc: "Solusi yang membumi dan bisa dijalankan, bukan teknologi rumit yang sulit dirawat.",
  },
  {
    no: "04",
    icon: "expand",
    title: "Skalabel",
    desc: "Ekosistem yang bisa tumbuh mengikuti perkembangan kebutuhan rumah, usaha, dan bisnis Anda.",
  },
  {
    no: "05",
    icon: "target",
    title: "Berbasis Kebutuhan",
    desc: "Setiap solusi berangkat dari kebutuhan nyata di lapangan, bukan dari template yang dipaksakan.",
  },
];

export const devTracks = [
  {
    icon: "network",
    title: "Network",
    desc: "Infrastruktur dan layanan jaringan yang terus dirapikan.",
    focus: ["Konektivitas", "Manajemen jaringan"],
    status: "Aktif & berkembang",
    color: "sky",
    rotate: "-rotate-2",
  },
  {
    icon: "erp",
    title: "SKMNetwork ERP",
    desc: "Sistem operasional bisnis yang dikembangkan bertahap.",
    focus: ["Kasir & penjualan", "Inventory", "Multi-tenant"],
    status: "Pengembangan berkelanjutan",
    color: "marigold",
    rotate: "rotate-1",
  },
  {
    icon: "cctv",
    title: "CCTV & Security",
    desc: "Teknologi pengawasan yang makin mudah dipantau.",
    focus: ["Instalasi", "Monitoring jarak jauh"],
    status: "Aktif",
    color: "leaf",
    rotate: "-rotate-1",
  },
  {
    icon: "chip",
    title: "Digital Products",
    desc: "Produk dan solusi digital baru sesuai kebutuhan pelanggan.",
    focus: ["WA Gateway", "Auto-posting", "Solusi custom"],
    status: "Bertahap",
    color: "brick",
    rotate: "rotate-2",
  },
  {
    icon: "headset",
    title: "Support",
    desc: "Layanan dukungan dan perawatan yang terus ditingkatkan.",
    focus: ["Maintenance", "Bantuan teknis"],
    status: "Berjalan",
    color: "ink",
    rotate: "-rotate-3",
  },
];

export const faqs = [
  {
    q: "Apa saja layanan SKMNetwork?",
    a: "SKMNetwork menghadirkan ekosistem teknologi yang mencakup internet & konektivitas, infrastruktur jaringan, CCTV & keamanan, software & ERP, solusi IT & digital, serta maintenance & dukungan teknis. Internet adalah salah satu bagian dari ekosistem ini, bukan keseluruhan layanan.",
  },
  {
    q: "Apakah tersedia layanan internet?",
    a: "Ya. Internet & konektivitas tersedia sebagai bagian dari ekosistem SKMNetwork, untuk kebutuhan rumah, usaha, dan bisnis. Untuk detail layanan yang sesuai kebutuhan Anda, silakan hubungi SKMNetwork melalui halaman kontak resmi.",
  },
  {
    q: "Apakah SKMNetwork menyediakan CCTV?",
    a: "Ya. SKMNetwork menyediakan solusi CCTV & keamanan, termasuk instalasi dan teknologi monitoring, untuk rumah maupun tempat usaha.",
  },
  {
    q: "Apakah tersedia solusi jaringan untuk usaha?",
    a: "Tersedia. SKMNetwork menangani perancangan, instalasi, konfigurasi, dan pengelolaan jaringan untuk berbagai kebutuhan — dari toko dan kantor hingga bisnis dengan beberapa unit.",
  },
  {
    q: "Apa itu SKMNetwork ERP?",
    a: "SKMNetwork ERP adalah sistem terintegrasi untuk operasional bisnis: kasir & penjualan, inventory, produk, pelanggan, dukungan multi-business/multi-tenant, serta laporan & monitoring dalam satu sistem.",
  },
  {
    q: "Bagaimana cara menghubungi atau berkonsultasi dengan tim SKMNetwork?",
    a: "Anda dapat menghubungi tim SKMNetwork melalui bagian kontak resmi di situs skmnetwork.com atau melalui asisten chat publik di pojok kanan bawah. Ceritakan kebutuhan Anda, dan tim kami siap membantu menentukan solusi yang paling sesuai.",
  },
  {
    q: "Apakah SKMNetwork ERP hanya untuk pelanggan internet SKMNetwork?",
    a: "Tidak. SKMNetwork ERP dapat diakses oleh pelanggan internet SKMNetwork sebagai bagian dari layanan (sesuai ketentuan paket), sekaligus dapat berlangganan secara mandiri oleh UMKM tanpa harus menjadi pelanggan internet SKMNetwork.",
  },
  {
    q: "Bagaimana cara mulai menggunakan SKMNetwork ERP?",
    a: "Pelanggan internet SKMNetwork dapat menanyakan ketersediaan ERP sebagai benefit paket melalui halaman kontak resmi. UMKM yang ingin menggunakan ERP secara mandiri dapat mengakses langsung situs resmi SKMNetwork ERP.",
  },
  {
    q: "Apakah SKMNetwork menyediakan otomatisasi WhatsApp dan posting media sosial?",
    a: "Ya. Sebagai bagian dari ekosistem produk digital, SKMNetwork mengembangkan WhatsApp Gateway untuk otomatisasi broadcast, auto-reply, dan notifikasi bisnis, serta AutoPost untuk penjadwalan posting media sosial lintas platform. Keduanya dirancang agar dapat terhubung dengan SKMNetwork ERP, sehingga operasional dan pemasaran berjalan dalam satu alur.",
  },
];
