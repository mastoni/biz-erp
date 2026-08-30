PRD untuk membangun sistem dari nol
Struktur dan fitur roadmap saya susun sebagai spesifikasi pengembangan baru.

# PRD — ERP & POS SaaS

**Nama sementara:** `BizERP`
**Versi PRD:** 1.0
**Status:** Draft Development
**Platform:** Web + Mobile App
**Model:** SaaS Multi-Tenant
**Referensi utama:** WeERP Offline Documentation

---

# 1. Product Overview

## 1.1 Tujuan Produk

Membangun aplikasi **ERP + POS berbasis SaaS** yang memungkinkan pemilik bisnis mengelola:

* perusahaan/bisnis
* cabang
* pengguna/karyawan
* produk
* kategori
* variasi produk
* stok
* pembelian
* penjualan
* pelanggan
* supplier
* kas
* bank
* akun pembayaran
* pengeluaran
* absensi
* laporan
* POS
* printer thermal
* dashboard bisnis
* aplikasi mobile

Referensi menjelaskan WeERP sebagai solusi manajemen bisnis/perusahaan dengan POS yang ditujukan agar mudah digunakan bahkan oleh pengguna non-teknis. 

---

# 2. Target Pengguna

Sistem memiliki beberapa level pengguna.

### 2.1 Super Admin

Pemilik platform SaaS.

Memiliki akses:

* semua bisnis
* semua pengguna
* paket langganan
* billing SaaS
* konfigurasi sistem
* laporan platform
* pengaturan global

---

### 2.2 Business Owner

Pemilik perusahaan/bisnis.

Memiliki akses:

* dashboard
* produk
* stok
* pembelian
* penjualan
* pelanggan
* supplier
* cabang
* karyawan
* akun keuangan
* laporan
* POS
* profile bisnis

Dokumen referensi menyebutkan Business Owner dapat login/register melalui aplikasi dan melihat dashboard bisnis. 

---

### 2.3 Branch Manager

Pengelola cabang.

Akses dibatasi pada cabang tertentu:

* penjualan
* stok
* pembelian
* pelanggan
* karyawan cabang
* kas cabang
* laporan cabang

---

### 2.4 Cashier

Kasir.

Akses utama:

* POS
* transaksi penjualan
* pelanggan
* pembayaran
* cetak struk

---

### 2.5 Staff / Employee

Akses sesuai permission:

* stok
* produk
* pembelian
* penjualan
* absensi

---

# 3. Konsep Multi-Tenant

Arsitektur utama harus menggunakan:

```text
Platform
   │
   ├── Business A
   │     ├── Branch 1
   │     ├── Branch 2
   │     └── Users
   │
   ├── Business B
   │     ├── Branch 1
   │     └── Users
   │
   └── Business C
         └── Branch 1
```

Setiap bisnis mempunyai data yang **terisolasi**.

Contoh:

```text
Business A tidak boleh melihat:

Business B
- customer
- products
- sales
- stock
- employees
- reports
```

Ini menjadi requirement keamanan paling penting dari sistem SaaS.

---

# 4. Modul Utama

## 4.1 Authentication

### Fitur

* login
* logout
* register business
* forgot password
* reset password
* change password
* remember session
* email verification
* role-based access
* permission

Referensi secara eksplisit mencantumkan business registration, login, dan reset password. 

### Flow

```text
Register
   ↓
Create Business
   ↓
Create Owner
   ↓
Email Verification
   ↓
Login
   ↓
Business Dashboard
```

---

# 5. Business Management

Setiap account Business mempunyai:

```text
Business
├── Profile
├── Branches
├── Users
├── Employees
├── Products
├── Customers
├── Suppliers
├── Sales
├── Purchases
├── Expenses
├── Accounts
└── Reports
```

## Business Profile

Data:

* business name
* logo
* email
* phone
* address
* city
* province
* country
* tax number
* currency
* timezone
* invoice prefix
* receipt footer

Referensi menyebutkan profile bisnis dapat dilihat dan diperbarui dari halaman profile. 

---

# 6. Branch Management

## Branch

Field:

```text
id
business_id
name
code
phone
email
address
city
province
status
created_at
updated_at
```

### Fitur

* tambah cabang
* edit cabang
* aktif/nonaktif
* branch manager
* branch users
* branch stock
* branch cash
* branch sales

Penjualan pada referensi dapat dilihat berdasarkan seluruh cabang dan detail penjualan dapat dibuka. 

---

# 7. Product Management

Ini salah satu modul inti.

Dokumentasi menyebutkan produk dapat mempunyai **multiple variation**, harga variasi, warranty, unit, category dan sub-category. 

## Product

```text
Product
├── Basic Information
├── Category
├── Sub Category
├── Brand
├── Unit
├── SKU
├── Barcode
├── Cost Price
├── Selling Price
├── Stock
├── Warranty
└── Variations
```

### Product Fields

```text
id
business_id
category_id
subcategory_id
brand_id
name
sku
barcode
description
unit_id
cost_price
selling_price
has_variation
warranty
status
image
```

---

# 8. Product Variation

Contoh:

```text
T-Shirt
│
├── Size S
├── Size M
├── Size L
└── Size XL
```

Atau:

```text
Laptop
│
├── RAM 8GB
├── RAM 16GB
└── RAM 32GB
```

Variation mempunyai:

```text
id
product_id
name
sku
barcode
cost_price
selling_price
stock
```

---

# 9. Category

Struktur:

```text
Category
   │
   ├── Sub Category
   │
   └── Products
```

Contoh:

```text
Elektronik
├── Smartphone
├── Laptop
├── Router
└── CCTV
```

---

# 10. Inventory / Stock

## Stock Management

Setiap stok harus terikat dengan:

```text
Business
Branch
Product
Variation
```

### Stock Movement

Semua perubahan stok dicatat.

```text
PURCHASE
    ↓
+ STOCK

SALE
    ↓
- STOCK

RETURN PURCHASE
    ↓
- STOCK

RETURN SALE
    ↓
+ STOCK

ADJUSTMENT
    ↓
± STOCK
```

### Stock Ledger

```text
Date
Reference
Product
Branch
In
Out
Balance
User
```

---

# 11. Purchase Management

## Purchase

```text
Purchase
├── Supplier
├── Branch
├── Date
├── Invoice Number
├── Items
├── Subtotal
├── Discount
├── Tax
├── Shipping
├── Total
└── Payment
```

Status:

```text
Draft
Pending
Received
Partial
Paid
Cancelled
```

---

# 12. Supplier

Data:

```text
Supplier
├── Name
├── Phone
├── Email
├── Address
├── Tax Number
└── Balance
```

Fitur:

* tambah supplier
* edit supplier
* supplier ledger
* purchase history
* outstanding payment

---

# 13. Customer Management

Customer:

```text
Customer
├── Name
├── Phone
├── Email
├── Address
├── Credit Limit
├── Total Purchase
├── Total Paid
└── Due
```

Referensi menyebutkan **Customer Sales Report** menampilkan berapa pembelian pelanggan, pembayaran, dan jumlah yang masih due. 

---

# 14. POS

Ini merupakan modul utama.

## POS Screen

```text
┌──────────────────────────────────────────┐
│ SEARCH PRODUCT / BARCODE                 │
├───────────────────┬──────────────────────┤
│                   │                      │
│ Product           │ Cart                 │
│                   │                      │
│ [Product]         │ Product A x 2        │
│ [Product]         │ Product B x 1        │
│ [Product]         │                      │
│                   │ Subtotal             │
│                   │ Discount             │
│                   │ Tax                  │
│                   │ TOTAL                │
│                   │                      │
│                   │ CASH CARD TRANSFER   │
└───────────────────┴──────────────────────┘
```

### POS Features

* barcode scan
* product search
* category filter
* variation selection
* cart
* discount
* tax
* customer
* payment
* cash
* bank
* mobile payment
* split payment
* hold transaction
* resume transaction
* print receipt
* sales return

Referensi menyebutkan produk dapat dijual melalui aplikasi menggunakan thermal printer dan dapat difilter berdasarkan branch dan category. 

---

# 15. Payment

Payment method:

```text
Cash
Bank
Mobile
Card
Other
```

Setiap pembayaran harus dicatat:

```text
payment_id
sale_id
account_id
amount
payment_method
reference
paid_at
```

---

# 16. Sales

## Sales List

Filter:

* date
* branch
* cashier
* customer
* payment method
* status

Referensi menyatakan daftar sales seluruh branch dapat dilihat beserta detailnya. 

### Sales Detail

```text
Invoice
Customer
Branch
Cashier

Products
Qty
Price
Discount
Tax
Subtotal

Payment
Paid
Due

Status
```

---

# 17. Sales Return

Flow:

```text
Sales
 ↓
Open Invoice
 ↓
Return
 ↓
Select Product
 ↓
Quantity
 ↓
Reason
 ↓
Refund
 ↓
Stock +
```

---

# 18. Accounts / Finance

Referensi menyebutkan Business Owner dapat mengelola account dan melakukan filter, termasuk **Cash, Bank, dan Mobile accounts**. 

## Account

```text
Cash
Bank
Mobile
```

Setiap account mempunyai ledger:

```text
Opening Balance
+
Sales
+
Income
-
Expense
-
Purchase
=
Current Balance
```

---

# 19. Expense

## Expense

```text
Expense
├── Category
├── Branch
├── Account
├── Amount
├── Date
├── Description
├── Attachment
└── User
```

Contoh:

```text
Listrik
Internet
Sewa
Transport
Gaji
Operasional
Maintenance
```

---

# 20. Income

Selain penjualan, sistem dapat mencatat pemasukan lain:

```text
Income
├── Account
├── Category
├── Amount
├── Date
├── Description
└── Reference
```

---

# 21. Employee Management

Employee:

```text
Employee
├── Personal Data
├── Position
├── Department
├── Branch
├── Salary
├── Join Date
├── Status
└── User Account
```

---

# 22. Attendance

Sistem menyediakan attendance dan report kehadiran.

Data:

```text
Employee
Date
Check In
Check Out
Status
```

Status:

```text
Present
Absent
Leave
Holiday
Late
```

Referensi menyebutkan attendance report dapat menunjukkan jumlah hari hadir, tidak hadir, dan hari libur. 

---

# 23. Reports

Modul report minimal:

### Sales Report

* total sales
* sales per day
* sales per branch
* sales per cashier
* sales per product

### Purchase Report

* purchase
* supplier
* branch
* product

### Stock Report

* current stock
* stock movement
* low stock
* stock valuation

### Expense Report

* expense category
* branch
* account

### Customer Sales Report

```text
Customer
Total Purchase
Total Paid
Total Due
```

### Attendance Report

```text
Employee
Present
Absent
Holiday
Leave
```

Dokumen referensi memang mencantumkan report untuk attendance, expense, stock, customer sales dan sales. 

---

# 24. Business Dashboard

Dashboard harus memberikan ringkasan bisnis.

Referensi menampilkan dashboard dengan ringkasan sales, purchase/return, POS, jumlah produk dan grafik analytics. 

### KPI

```text
Today's Sales
Today's Purchase
Today's Expense
Today's Profit
Total Products
Low Stock
Customers
Suppliers
Receivable
Payable
```

### Charts

```text
Sales Analytics
Purchase Analytics
Expense Analytics
Profit Analytics
```

Filter:

```text
Today
Yesterday
This Week
This Month
This Year
Custom Range
```

---

# 25. Mobile Business App

Dokumentasi referensi mempunyai Business App untuk pemilik bisnis.

### Mobile Menu

```text
Dashboard
Products
Sales
Purchases
Profile
```

### Mobile Features

* login
* register
* forgot password
* dashboard
* sales analytics
* purchase analytics
* product count
* profile
* update profile

Referensi juga memperlihatkan Business App memiliki navigation untuk dashboard, product/sales-related area dan profile. 

---

# 26. Thermal Printer

POS harus mendukung pencetakan struk.

### Receipt

```text
BUSINESS NAME
Address
Phone
-------------------------
Invoice: INV-00001
Cashier: John
Branch: Main

Product       Qty   Total
-------------------------
Product A      2    20.000
Product B      1    15.000
-------------------------
Subtotal            35.000
Discount             2.000
TOTAL               33.000

Paid                50.000
Change              17.000

Thank You
```

Target printer:

```text
58mm
80mm
```

---

# 27. Role & Permission

Jangan menggunakan role saja.

Gunakan:

```text
Role
+
Permission
+
Business
+
Branch
```

Contoh:

### Owner

```text
*
```

### Manager

```text
sales.view
sales.create
purchase.view
purchase.create
stock.view
report.view
```

### Cashier

```text
pos.access
sales.create
customer.view
customer.create
```

### Warehouse

```text
product.view
stock.view
stock.adjust
purchase.view
```

---

# 28. Audit Log

Semua aktivitas penting dicatat.

```text
User
Action
Module
Record
IP
Timestamp
Old Data
New Data
```

Contoh:

```text
USER: admin
ACTION: UPDATE
MODULE: PRODUCT
RECORD: Router TP-Link
OLD PRICE: 100000
NEW PRICE: 110000
```

---

# 29. Database Design

Database utama:

**MySQL/PostgreSQL**

Saya merekomendasikan PostgreSQL untuk implementasi baru, tetapi referensi asli menggunakan PHP/MySQL. Dokumentasi menyebut kebutuhan MySQL dan PHP pada versi referensinya. 

### Core Tables

```text
businesses
branches
users
roles
permissions
role_permissions
user_roles

categories
subcategories
brands
units
products
product_variations

customers
suppliers

warehouses
stocks
stock_movements

purchases
purchase_items
purchase_payments

sales
sale_items
sale_payments
sale_returns
sale_return_items

accounts
account_transactions

expenses
expense_categories
incomes
income_categories

employees
attendance

notifications
audit_logs
settings
```

---

# 30. Relasi Database Utama

```text
BUSINESS
   │
   ├──── USERS
   │
   ├──── BRANCHES
   │       │
   │       ├── SALES
   │       ├── PURCHASES
   │       ├── STOCK
   │       └── EMPLOYEES
   │
   ├──── PRODUCTS
   │       │
   │       └── VARIATIONS
   │
   ├──── CUSTOMERS
   │
   ├──── SUPPLIERS
   │
   └──── ACCOUNTS
```

---

# 31. Recommended Architecture

Untuk pembangunan **dari nol**, saya sarankan tidak mengikuti struktur teknis lama dari WeERP.

## Backend

```text
Node.js
Express.js
TypeScript
PostgreSQL
Prisma / Drizzle
Redis
JWT
REST API
```

## Web

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
React Query
Zod
```

## Mobile

```text
Flutter
```

Referensi aslinya memang menggunakan Flutter untuk aplikasi mobile dan Laravel/PHP/MySQL pada sisi web.  

---

# 32. Struktur Project

Saya sarankan monorepo:

```text
biz-erp/
│
├── apps/
│   │
│   ├── web/
│   │   └── Next.js
│   │
│   ├── api/
│   │   └── Express.js
│   │
│   └── mobile/
│       └── Flutter
│
├── packages/
│   │
│   ├── types/
│   ├── validation/
│   ├── database/
│   └── config/
│
├── docs/
│
├── docker/
│
└── README.md
```

---

# 33. API Structure

```text
/api/v1
```

## Auth

```http
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

## Business

```http
GET    /business
PUT    /business
GET    /business/settings
PUT    /business/settings
```

## Branch

```http
GET    /branches
POST   /branches
GET    /branches/:id
PUT    /branches/:id
DELETE /branches/:id
```

## Products

```http
GET    /products
POST   /products
GET    /products/:id
PUT    /products/:id
DELETE /products/:id
```

## POS

```http
POST /pos/cart
POST /pos/checkout
POST /pos/hold
POST /pos/resume
```

## Sales

```http
GET  /sales
GET  /sales/:id
POST /sales
POST /sales/:id/return
```

## Purchase

```http
GET  /purchases
POST /purchases
GET  /purchases/:id
```

## Reports

```http
GET /reports/sales
GET /reports/purchases
GET /reports/stock
GET /reports/expenses
GET /reports/customers
GET /reports/attendance
```

---

# 34. Dashboard Architecture

```text
Next.js
    │
    │ REST API
    ▼
Express API
    │
    ├── Auth
    ├── Business
    ├── Branch
    ├── Product
    ├── Inventory
    ├── POS
    ├── Sales
    ├── Purchase
    ├── Finance
    ├── Employee
    └── Reports
          │
          ▼
      PostgreSQL
```

---

# 35. Security Requirements

Wajib:

* password hashing Argon2/bcrypt
* JWT access token
* refresh token
* HTTPS
* RBAC
* tenant isolation
* branch isolation
* input validation
* SQL injection protection
* XSS protection
* CSRF protection jika menggunakan cookie
* rate limiting
* audit log
* secure file upload
* database backup
* login attempt protection

### Tenant Security

Setiap query harus mempunyai konteks:

```text
business_id
```

Contoh:

```sql
SELECT *
FROM products
WHERE business_id = current_business_id;
```

Bukan:

```sql
SELECT *
FROM products;
```

---

# 36. SaaS Subscription

Karena produk referensi menggunakan konsep SaaS, versi baru sebaiknya mempunyai:

```text
Plans
├── Free
├── Basic
├── Pro
└── Enterprise
```

Contoh limit:

| Feature  |  Free |    Basic |       Pro |
| -------- | ----: | -------: | --------: |
| Branch   |     1 |        5 | Unlimited |
| Users    |     2 |       10 | Unlimited |
| Products |   100 |    1.000 | Unlimited |
| POS      |     ✓ |        ✓ |         ✓ |
| Reports  | Basic | Advanced |  Advanced |
| Mobile   |     ✓ |        ✓ |         ✓ |

**Catatan:** tabel paket ini adalah rekomendasi pengembangan baru, bukan fitur yang secara eksplisit ditentukan dalam PDF.

---

# 37. Notification

Sistem:

```text
Low Stock
Payment Due
Purchase
Sales
Expense
New Employee
System Notification
```

Channel:

```text
Web Notification
Push Notification
Email
```

---

# 38. File / Media Management

Produk dapat mempunyai:

* thumbnail
* product image
* multiple images

Dokumen referensi menunjukkan pengelolaan produk beserta detail dan variasinya, sehingga media produk sebaiknya dipisahkan dari tabel produk utama.

---

# 39. MVP

Agar proyek tidak terlalu besar sejak awal, **jangan langsung membuat semua fitur**.

## MVP Phase 1

### Authentication

* login
* register
* logout
* forgot password

### Business

* business profile
* branch

### User

* users
* roles
* permissions

### Product

* category
* product
* variation
* unit
* barcode

### Inventory

* stock
* stock adjustment
* stock movement

### POS

* product search
* cart
* checkout
* payment
* invoice
* receipt

### Sales

* sales list
* sales detail
* sales return

### Dashboard

* sales
* product
* stock
* customer

---

# 40. Phase 2

```text
Purchase
Supplier
Customer
Expense
Income
Accounts
Employee
Attendance
Reports
```

---

# 41. Phase 3

```text
Mobile App
Thermal Printer
Barcode Scanner
Push Notification
Advanced Dashboard
Advanced Reports
```

---

# 42. Phase 4 — SaaS

```text
Subscription
Plans
Payment Gateway
Tenant Management
Super Admin
Usage Limit
Billing
Invoice SaaS
```

---

# 43. Development Roadmap

## Sprint 01 — Foundation

```text
Project setup
Database
Docker
Environment
Authentication
RBAC
Multi-tenancy
```

**Output:**

```text
Login
Register
Business
User
Role
Permission
```

---

## Sprint 02 — Business

```text
Business Profile
Branch
Users
Employees
```

---

## Sprint 03 — Product

```text
Category
Subcategory
Brand
Unit
Product
Variation
Barcode
```

---

## Sprint 04 — Inventory

```text
Warehouse
Stock
Stock Movement
Adjustment
Stock Opname
```

---

## Sprint 05 — Purchase

```text
Supplier
Purchase
Purchase Items
Payment
Purchase Return
```

---

## Sprint 06 — POS

```text
POS UI
Cart
Barcode
Customer
Discount
Tax
Payment
Receipt
```

---

## Sprint 07 — Sales

```text
Sales
Invoice
Payment
Return
Due
Customer Ledger
```

---

## Sprint 08 — Finance

```text
Accounts
Cash
Bank
Mobile
Income
Expense
Transaction Ledger
```

---

## Sprint 09 — Reports

```text
Sales
Purchase
Stock
Expense
Customer
Attendance
Profit
```

---

## Sprint 10 — Mobile

```text
Flutter
Login
Dashboard
Product
Sales
Profile
Notifications
```

---

## Sprint 11 — Printer

```text
Bluetooth Printer
Network Printer
58mm
80mm
Receipt Template
```

---

## Sprint 12 — SaaS

```text
Super Admin
Plans
Subscription
Tenant Management
Billing
Usage
```

---

# 44. Acceptance Criteria MVP

Sistem dianggap MVP berhasil jika:

### Authentication

* [ ] user dapat register
* [ ] user dapat login
* [ ] user dapat logout
* [ ] password dapat di-reset

### Multi Tenant

* [ ] Business A tidak dapat melihat Business B
* [ ] user hanya melihat data bisnisnya
* [ ] branch user tidak dapat melihat branch lain tanpa permission

### Product

* [ ] dapat membuat produk
* [ ] dapat membuat variation
* [ ] dapat membuat kategori
* [ ] dapat memasukkan SKU/barcode

### Inventory

* [ ] pembelian menambah stok
* [ ] penjualan mengurangi stok
* [ ] retur penjualan menambah stok
* [ ] stock adjustment tercatat

### POS

* [ ] produk dapat dicari
* [ ] produk dapat dimasukkan ke cart
* [ ] customer dapat dipilih
* [ ] transaksi dapat dibayar
* [ ] invoice dibuat
* [ ] stok berkurang
* [ ] receipt dapat dicetak

### Reporting

* [ ] sales report
* [ ] purchase report
* [ ] stock report
* [ ] customer report
* [ ] expense report

---

# 45. Prinsip UX

Mengikuti semangat referensi, UI harus:

* sederhana
* mudah dipahami
* responsive
* minim langkah
* cocok untuk pengguna non-teknis

Dokumentasi referensi secara eksplisit menekankan antarmuka yang sederhana dan mudah digunakan oleh pengguna non-teknis. 

Untuk POS:

> **Kasir harus dapat menyelesaikan transaksi tanpa membuka banyak halaman.**

---

# 46. Menu Web

Struktur menu yang saya rekomendasikan:

```text
Dashboard

Business
├── Profile
├── Branches
└── Settings

Products
├── Products
├── Categories
├── Brands
├── Units
└── Variations

Inventory
├── Stock
├── Stock Movement
├── Adjustment
└── Stock Opname

Sales
├── POS
├── Sales
├── Returns
└── Customers

Purchases
├── Purchases
├── Returns
└── Suppliers

Finance
├── Accounts
├── Income
├── Expenses
└── Transactions

Employees
├── Employees
├── Attendance
└── Departments

Reports
├── Sales
├── Purchase
├── Stock
├── Expense
├── Customer
└── Attendance

Users
├── Users
├── Roles
└── Permissions

Settings
```

---

# 47. Menu Mobile

Untuk mobile jangan membawa seluruh menu web.

```text
Home
│
├── Dashboard
├── Sales
├── Products
├── Customers
└── Profile
```

Bottom navigation:

```text
┌────────┬────────┬────────┬────────┐
│ Home   │ Sales  │Product │ Profile│
└────────┴────────┴────────┴────────┘
```

---

# 48. Prioritas Pengembangan

Saya menyarankan prioritas:

```text
P0 = Wajib
P1 = Penting
P2 = Setelah MVP
P3 = Nice to Have
```

### P0

```text
Authentication
Multi Tenant
Business
Branch
User/Roles
Product
Inventory
Customer
Supplier
POS
Sales
Payment
Dashboard
```

### P1

```text
Purchase
Expense
Accounts
Reports
Employee
Attendance
Return
Printer
```

### P2

```text
Mobile
Notification
Advanced Analytics
Subscription
Payment Gateway
```

### P3

```text
AI
Forecasting
Recommendation
Advanced accounting
Marketplace
Integrations
```

---

# 49. Definition of Done

Sebuah modul dianggap selesai apabila:

```text
Database
   ✓

Migration
   ✓

Model
   ✓

Repository/Service
   ✓

API
   ✓

Validation
   ✓

Permission
   ✓

Web UI
   ✓

Mobile jika diperlukan
   ✓

Unit Test
   ✓

Integration Test
   ✓

Audit Log
   ✓

Documentation
   ✓
```

---

# 50. Target Akhir Sistem

Arsitektur final:

```text
                         ┌─────────────────────┐
                         │     SUPER ADMIN     │
                         │    SaaS Platform    │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │      BUSINESS       │
                         │      TENANT A       │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
       ┌─────▼─────┐          ┌─────▼─────┐          ┌─────▼─────┐
       │  BRANCH 1 │          │  BRANCH 2 │          │  BRANCH 3 │
       └─────┬─────┘          └─────┬─────┘          └─────┬─────┘
             │                      │                      │
       ┌─────▼──────────────────────▼──────────────────────▼─────┐
       │                         ERP CORE                         │
       │                                                         │
       │ Product │ Stock │ Purchase │ Sales │ POS │ Finance     │
       │ Customer│ Supplier│ Employee│ Reports │ Accounts       │
       └──────────────────────────┬──────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────▼─────┐               ┌────▼─────┐
              │    WEB    │               │  MOBILE  │
              │  Next.js  │               │ Flutter  │
              └───────────┘               └──────────┘
```

## Kesimpulan

Jadi, **jangan membuat WeERP clone secara langsung**. Lebih bagus kita jadikan PDF tersebut sebagai **functional reference**, lalu membangun produk baru dengan arsitektur modern:

**Next.js + Express/TypeScript + PostgreSQL + Flutter + REST API + Multi-Tenant + RBAC.**

Fitur inti yang paling jelas didukung oleh referensi adalah **Business Dashboard, Product Management dengan variation/category/unit/warranty, POS/thermal printer, Sales, Accounts Cash/Bank/Mobile, dan Reports**, termasuk attendance, expense, stock, customer sales, dan sales.  

**Langkah berikutnya yang paling tepat adalah mengubah PRD ini menjadi `Technical Design Document (TDD)` → ERD/database lengkap → struktur folder backend/frontend → daftar API → lalu kita pecah menjadi task Trello untuk programmer junior.**
