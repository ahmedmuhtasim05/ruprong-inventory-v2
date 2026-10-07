# RupRong Inventory & Invoicing System v2.0

A complete inventory and invoicing management system for RupRong by Ananna.

## Features

- **Authentication** — Multi-user login with session management
- **Inventory Management** — Add, edit, delete, search, bulk import/export
- **Image Optimization** — Automatic optimization to <150KB using Sharp
- **Invoice Creation** — Create invoices with stock validation, PDF generation
- **Invoice History** — View, edit, delete invoices with stock restoration
- **Reports** — Sales, profit, and inventory reports with PDF/Excel export
- **Custom Themes** — Color picker to customize the app theme
- **Settings** — User management, danger zone

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Frontend:** React 19, Tailwind CSS
- **Database:** Neon Postgres
- **Auth:** Custom session-based authentication
- **Image Processing:** Sharp (server-side)
- **PDF:** pdf-lib
- **Excel:** xlsx, exceljs

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/ruprong-inventory-v2.git
cd ruprong-inventory-v2
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
DATABASE_URL=postgres://user:password@host:5432/ruprong_inventory
SESSION_SECRET=your-super-secret-key
```

### 3. Initialize Database

```bash
# Start the dev server first
npm run dev

# Then visit to auto-initialize:
# http://localhost:3000/api/init
```

### 4. Run

```bash
npm run dev
```

Visit http://localhost:3000

## Deployment to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables
4. Deploy

## Project Structure

```
app/
├── (main)/           # Protected pages
│   ├── inventory/    # Inventory management
│   ├── invoice/      # Create invoice
│   ├── history/      # Invoice history
│   ├── reports/      # Reports & analytics
│   └── settings/     # Settings & theme
├── api/              # API routes
│   ├── auth/         # Login/logout
│   ├── items/        # CRUD + import/export
│   ├── invoices/     # CRUD + PDF
│   ├── reports/      # Summary + PDF/Excel
│   ├── settings/     # Users, theme, clear
│   └── upload/       # Image optimization
├── login/            # Login page
├── globals.css       # Global styles
└── layout.js         # Root layout
lib/
├── db.js             # Database connection + schema
├── auth.js           # Authentication
├── image-optimizer.js # Sharp-based optimization
├── theme.js          # Theme management
└── reports.js        # Report calculations
```
