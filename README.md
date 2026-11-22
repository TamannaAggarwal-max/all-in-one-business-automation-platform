# BizPilot — Your Business, Automated.

An all-in-one business operating system for small businesses. BizPilot unifies inbound lead capture, CRM activity timelines, an executable WHEN → THEN automation engine, follow-up scheduling, product catalog management, brand customization, a public customer storefront, analytics, and server-side Gemini AI assistance into a single workspace.

---

## Key Features

### Real Production Implementations
- **PostgreSQL Persistence (Drizzle ORM)**: Multi-tenant relational schema (`businesses`, `users`, `brand_settings`, `leads`, `customers`, `products`, `follow_ups`, `activities`, `automations`, `automation_actions`, `notifications`) with business-level data isolation.
- **Authentication & RBAC**: Dual authentication supporting Email/Password (`bcryptjs` + JWT stored in memory) and Google Sign-In (`Firebase Auth` verified via `firebase-admin`), with backend role enforcement (`ADMIN`, `MANAGER`, `SALES_EMPLOYEE`).
- **CRM & Auto-Conversion**: Full lead CRUD, search, filter, sort, employee assignment, detailed activity timelines, and automatic Customer creation when a lead moves to `Converted`.
- **Automation Engine**: Configurable `WHEN → THEN` workflows (`ASSIGN_EMPLOYEE`, `SEND_AUTOREPLY`, `CREATE_FOLLOWUP`, `CHANGE_STATUS`, `CREATE_NOTIFICATION`) that execute against PostgreSQL when leads arrive or statuses change.
- **Products & Brand Setup**: Catalog CRUD with low-stock notifications, publish/draft toggles, brand colors, and live storefront banner preview.
- **Public Storefront (`/store/:businessSlug`)**: Accessible without admin login; displays live brand settings, product catalog, bag inquiry capture (creates a real Website Form lead), and a grounded **AI Customer Assistant Chatbot**.
- **Server-Side Gemini AI (`@google/genai`)**:
  - `POST /api/ai/generate-reply` — Lead reply drafting (Professional, Friendly, Short, Sales-focused)
  - `POST /api/ai/product-description` — Structured product short description, full copy, and highlights
  - `POST /api/ai/banner-copy` — Storefront campaign headline, subheadline, and CTA
  - `POST /api/ai/business-insights` — Data-backed recommendations from aggregated non-PII metrics
  - `POST /api/ai/chat` — Grounded storefront Q&A strictly using live catalog inventory and prices
- **Analytics, Follow-ups, Team & Global Search**: Real PostgreSQL metrics rendered via Recharts, overdue follow-up detection, team performance leaderboard, notification bell, and cross-entity search.

### Demo / Simulated Integrations
- **Lead Capture Simulator**: Three clearly labeled buttons on the Leads page (`Simulate WhatsApp Lead`, `Simulate Website Lead`, `Simulate Call Lead`) create real PostgreSQL lead records with `isSimulated: true` and trigger the active Automation Engine without claiming third-party WhatsApp/telephony API credentials.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, Lucide React
- **Backend**: Node.js, Express.js, TypeScript, Zod, bcryptjs, jsonwebtoken, CORS
- **Database & ORM**: PostgreSQL (Cloud SQL / standard PostgreSQL) + Drizzle ORM + `pg`
- **AI**: Google Gemini API (`@google/genai`, `gemini-4-hydrogen`) called strictly server-side

---

## Demo Credentials

- **Email**: `demo@bizpilot.app`
- **Password**: `Demo@12345`
- **Role**: `ADMIN`
- **Public Demo Storefront**: `/store/atelier-nord`

*(Seeded automatically and idempotently on first API request with Atelier Nord products, leads, customers, follow-ups, automations, and notifications.)*

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env` and set `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`, `GEMINI_API_KEY`, and `JWT_SECRET`.
3. **Push database schema**:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
4. **Run full-stack dev server (Express API + Vite on port 3000)**:
   ```bash
   npm run dev
   ```
5. **Production build & start**:
   ```bash
   npm run build
   npm start
   ```

---

## Deployment (Render & Vercel)

- **Render (Full-Stack Node + PostgreSQL)**: Uses `render.yaml` (`npm install && npm run build`, start `npm start`). Set `GEMINI_API_KEY`, `JWT_SECRET`, `CLIENT_URL`, and `SQL_*` database credentials in Render environment settings.
- **Vercel (Frontend)**: Uses `vercel.json` SPA rewrites (`npm run build`, output `dist`). Set `VITE_API_URL` to your deployed Render backend URL if hosting frontend separately.

---

## Hackathon Demo Flow

1. Sign in as Admin (`demo@bizpilot.app` / `Demo@12345` or Google Sign-In).
2. Review **Dashboard** KPIs, conversion funnel, weekly charts, and **AI Business Insights**.
3. Open **Leads** and click **Simulate WhatsApp Lead** to watch a new lead appear and view the Automation Engine execution trace.
4. Open **Automation** to inspect the `WHEN → THEN` workflow and updated run count.
5. Open the lead's **Details** drawer to inspect its real Activity Timeline and draft an **AI Reply**.
6. Go to **Products → Add Product → Generate with AI** to create a product with Gemini copy.
7. Go to **Brand Setup** to adjust colors and generate AI banner copy.
8. Open `/store/atelier-nord` (no login required), browse products, and ask the **Store Assistant Chatbot**: *"Which products are under ₹1500?"*.
9. Return to **Analytics** to see updated metrics and refreshed AI recommendations.
