# POS Kasir + QR Menu Digital

A complete cafe/restaurant point-of-sale with a customer-facing QR menu, backed by Lovable Cloud (database, storage, realtime) so data is shared live between the cashier, kitchen, and customer phones.

## Pages

**Dashboard (/)**
Today's revenue, transaction count, items sold, low-stock warnings, a list of recent sales, and big shortcut tiles to Cashier, Orders, Products, Reports.

**Cashier (/kasir)**
Left: category tabs + search + product grid with photo, price, and stock badge. Right: the cart with quantity steppers, per-order discount (amount or percent), tax, and total. Payment sheet with Cash (enter amount, shows change), Card, and QRIS. On payment it saves the sale, deducts stock, and shows a printable receipt.

**Products (/produk)**
Table of items with add/edit dialog: name, price, image, category, stock, and a "show on QR menu" toggle. Stock edits, low-stock threshold, and archive.

**Orders (/pesanan)**
Live queue of tickets from both the cashier and the QR menu, as columns or cards with status New → Preparing → Ready → Completed, plus Cancel. Updates appear instantly for everyone.

**Reports (/laporan)**
Date-range filter, transaction list with receipt detail, payment method breakdown, and best-selling products.

**QR tables (/meja)**
Create tables and generate a printable QR code per table linking to that table's menu.

**Customer menu (/menu/$table)**
Mobile-first: category chips, item cards, cart drawer, note per item, customer name, and submit order. Confirmation screen with order number and live status.

## Data

Tables: categories, products, tables, orders, order_items, payments. Sample F&B data (coffee, tea, snacks, mains) seeded on creation. Stock deducts automatically when a sale or QR order is completed; low-stock flag when below threshold.

## Access

Staff pages (dashboard, cashier, products, orders, reports, tables) require sign-in with email + password. The customer menu is public — no login, only items toggled visible are shown.

## Design

Clean modern SaaS POS look: deep teal/ink accent, light neutral surfaces, rounded cards, large touch targets, tabular figures for money, Indonesian Rupiah formatting, dark mode support.

## Technical notes

- Lovable Cloud for Postgres + auth + realtime; RLS with owner-scoped staff policies and narrow public read for menu items/tables.
- Staff routes under `_authenticated`; `/menu/$table` public and SSR'd with its own metadata.
- Sales write through a server function inside a transaction-style RPC so stock and order rows stay consistent.
- Realtime subscription on orders for the queue.
- Seed rows shipped in the migration itself.
