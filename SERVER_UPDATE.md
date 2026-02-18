# How to Update Your Server (MANDATORY)

The error you are seeing (`gemini-1.5-flash is not found`) confirms that **your server is running old code**.
I have updated the code to use `gemini-1.5-flash-001`, but your server doesn't have this change yet.

Please run these exact commands on your server terminal:

1. **Navigate to your project folder:**
   ```bash
   cd split-bill
   ```

2. **Pull the latest code:**
   ```bash
   git pull origin main
   ```
   *If it says "Already up to date", ensure you are in the right folder!*

3. **Rebuild the Docker containers:**
   ```bash
   docker compose down
   docker compose up --build -d
   ```

4. **Verify the Fix:**
   - Wait about 30 seconds for the server to start.
   - Go to your website and hard refresh (Ctrl + F5).
   - Try uploading a receipt again.

Ref: The error mentioning `gemini-1.5-flash` means it's ignoring my fix (`gemini-1.5-flash-001`).
