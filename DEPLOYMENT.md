# Deployment Guide

To deploy this application to production using Docker, follow these steps:

## 1. Prerequisites
- A server (VPS) with **Docker** and **Docker Compose** installed.
- Your Gemini API Key.

## 2. Setup on Server

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cdesqus/split-bill.git
   cd split-bill
   ```

2. **Create the `.env` file:**
   This file is **essential** because it holds your secret API Key. It is not included in Git for security.
   
   Create and edit the file:
   ```bash
   nano .env
   ```
   
   Paste the following content (replace `YOUR_ACTUAL_KEY_HERE` with your real key):
   ```env
   # API Keys
   VITE_GEMINI_API_KEY=YOUR_ACTUAL_API_KEY

   # Database Configuration
   # In production docker-compose, the host is 'db', user/pass matches docker-compose.yml
   DATABASE_URL=postgres://postgres:password@db:5432/splitbill_db

   # Server Configuration
   PORT=3000
   NODE_ENV=production
   ```
   
   Save and exit (Ctrl+O, Enter, Ctrl+X).

## 3. Deployment

Run the following command to build and start the application. This command reads the `.env` file and "bakes" the API key into the frontend container.

```bash
docker compose up --build -d
```

## 4. Verification

Your app should now be running at: `http://YOUR_SERVER_IP:3010`

- **Frontend**: Check if the camera/scan works.
- **Backend**: Try saving a bill to ensure database connection works.

## Troubleshooting

If the API key is missing or invalid:
1. Check if `.env` exists and has the correct key.
2. Re-run `docker compose up --build -d` to force a rebuild (since Vite needs the key at build time).
