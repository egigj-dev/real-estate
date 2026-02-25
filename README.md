# Tirana Real Estate

Property listings web app for Tirana, Albania. ML-powered price estimates and comparable listings.

## Structure

```
real-estate/
├── backend/    FastAPI + XGBoost
└── frontend/   React + Vite + Bootstrap
```

## Quick Start

**Terminal 1 — Backend**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173** in your browser.

## Features

- Browse and filter 4 000+ Tirana property listings
- ML price estimate with fair/overpriced/underpriced label
- 5 comparable listings per property
- Market insights by neighborhood