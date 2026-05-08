# Sol & Stone Property Services Website + Form Backend

This project includes the landing page plus a lightweight Node.js/Express backend for the contact form.

## What the backend does

- Receives the contact form at `POST /api/contact`
- Accepts photo/video uploads from the `projectFiles` field
- Limits uploads to 8 files, 25 MB per file
- Allows image and video file types only
- Saves each submission in a unique folder under `uploads/`
- Saves submission details as `submission.json`
- Sends an email notification when SMTP is configured
- Redirects successful visitors to a friendly `thank-you.html` page
- Adds basic security headers, compression, rate limiting, and honeypot spam protection

## Project structure

```text
sol-stone-property-services-backend-ready/
├── index.html
├── thank-you.html
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── assets/
│   └── images/
└── uploads/
    └── .gitkeep
```

## Run locally in VS Code

1. Install Node.js 18 or newer.
2. Open this folder in VS Code.
3. Open the terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Visit:

```text
http://localhost:3000
```

## Configure email delivery

1. Copy `.env.example` to `.env`.
2. Fill in your SMTP settings.
3. Set `LEAD_EMAIL_TO` to the email address that should receive new job requests.
4. Restart the server.

Without SMTP settings, the backend still saves submissions locally in the `uploads/` folder and logs the details in the terminal.

## Production notes

For a small service business, this backend is intentionally simple and efficient. For production hosting with many video uploads, the best next upgrade is to store files in S3, Cloudflare R2, or another object storage service instead of local server storage.
