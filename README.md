# Pintrip 🗺️

A full-stack travel photo map app. Pin photos to a world map, write journal notes,
and get AI-generated captions and travel stories via Gemini Vision.

## Tech Stack

| Layer    | Tech                                           |
|----------|------------------------------------------------|
| Frontend | React 18 + Vite + Tailwind CSS + react-leaflet |
| Backend  | FastAPI (Python 3.12)                          |
| Database | Supabase (PostgreSQL + Storage)                |
| AI       | Google Gemini 1.5 Flash Vision API             |
| Deploy   | Vercel (frontend) + Fly.io (backend)           |

## Project Structure

```
pintrip/
├── supabase/
│   └── schema.sql
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   │   ├── places.py
│   │   │   ├── photos.py
│   │   │   └── ai.py
│   │   └── services/
│   │       ├── exif.py
│   │       ├── gemini.py
│   │       └── storage.py
│   ├── Dockerfile
│   ├── fly.toml
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── public/
    │   └── favicon.svg
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── lib/
    │   │   ├── supabase.js
    │   │   └── api.js
    │   ├── pages/
    │   │   ├── MapPage.jsx
    │   │   ├── GalleryPage.jsx
    │   │   └── AuthPage.jsx
    │   └── components/
    │       ├── Map/
    │       │   ├── MapView.jsx
    │       │   └── PhotoPin.jsx
    │       ├── Upload/
    │       │   ├── PhotoUploader.jsx
    │       │   └── ExifExtractor.js
    │       ├── Sidebar/
    │       │   └── PlaceSidebar.jsx
    │       └── UI/
    │           ├── NavBar.jsx
    │           ├── StatsBar.jsx
    │           └── AddPinModal.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vercel.json
    └── .env.example
```

## Local Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the **SQL Editor**
3. Create a storage bucket named `pintrip-photos` (set to **private**)
4. Add per-user storage policies (see comments at bottom of `schema.sql`)
5. Copy your **Project URL**, **anon key**, and **service role key**

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```

Interactive API docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install

cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

npm run dev
# Opens at http://localhost:5173
```

## Deployment

### Backend → Fly.io

```bash
cd backend
fly launch   # first time only — reads fly.toml
fly secrets set \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_KEY=your-service-key \
  GEMINI_API_KEY=your-gemini-key \
  ALLOWED_ORIGINS=https://your-app.vercel.app
fly deploy
```

### Frontend → Vercel

```bash
cd frontend
npm run build          # verify build passes locally first
vercel --prod
```

Set these in the Vercel dashboard → Project → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` → your Fly.io backend URL (e.g. `https://pintrip-api.fly.dev`)

## Environment Variables

| File              | Variable               | Description                              |
|-------------------|------------------------|------------------------------------------|
| `backend/.env`    | `SUPABASE_URL`         | Supabase project URL                     |
| `backend/.env`    | `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS for backend) |
| `backend/.env`    | `GEMINI_API_KEY`       | Google AI Studio API key                 |
| `backend/.env`    | `ALLOWED_ORIGINS`      | Comma-separated CORS origins             |
| `frontend/.env`   | `VITE_SUPABASE_URL`    | Supabase project URL                     |
| `frontend/.env`   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key               |
| `frontend/.env`   | `VITE_API_URL`         | Backend base URL                         |

## Key Features

- **Click-to-pin** — click any map location to create a place
- **EXIF GPS auto-placement** — upload a geotagged photo and the pin snaps to where it was taken
- **AI captions** — Gemini 1.5 Flash auto-captions every uploaded photo
- **AI travel story** — one-click diary entry generated from all photo captions at a place
- **Masonry gallery** — browse all photos across every trip
- **Row Level Security** — users can only access their own data

## Notes

- The Leaflet default icon path fix in `MapView.jsx` is required for Vite bundling
- Supabase Storage bucket must be created manually via dashboard or Supabase CLI
- Change `primary_region` in `fly.toml` to the region closest to your Supabase project
