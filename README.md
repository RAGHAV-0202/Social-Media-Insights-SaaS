# Social Media Insights Dashboard

A premium social media analytics dashboard for **Explore St. Kitts & Nevis**.

This repository is split into two main sections:
- `/frontend`: Vite React TypeScript UI dashboard.
- `/backend`: Node.js / Express TypeScript server with scheduling (`node-cron`) and DB migrations runner.

---

## Folder Structure

```text
├── backend/            # Express.js Server
│   ├── src/
│   │   ├── config/     # Database Pool configuration
│   │   ├── jobs/       # node-cron scheduled tasks (runs every 12 hours)
│   │   ├── routes/     # Express API endpoints
│   │   ├── services/   # Apify Scraper & AI Summary integrations
│   │   └── scripts/    # Database initialization & migrations script
│   └── package.json
└── frontend/           # React + Tailwind Dashboard (no node_modules installed)
    └── src/
```

---

## Backend Setup & Getting Started

### 1. Configure Environment Variables
Create a `.env` file in the `/backend` folder:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/social_insights
APIFY_API_KEY=your_apify_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Start the Server (Development)
```bash
npm run dev
```

---

## Frontend Integration

The React dashboard is fully integrated with the backend API.
- All dashboard statistics are retrieved in a single, fast API call (`GET /api/dashboard-data`).
- Active scraper runs are tracked in real-time using smart polling.
- AI Performance briefs are triggered on-demand via the local Express gateway.

*Note: Frontend packages should be installed in the `/frontend` directory when ready (`npm install` or `bun install`).*
