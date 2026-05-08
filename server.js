const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const compression = require('compression');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Uploaded files are served from hard-to-guess UUID folders so the email can include links.
// For production at scale, move uploads to S3, Cloudflare R2, or another object store.
app.use('/uploads', express.static(UPLOAD_DIR, {
  dotfiles: 'deny',
  index: false,
  fallthrough: false
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many form submissions. Please wait a few minutes and try again.'
});

const allowedServices = new Set([
  'Repair / maintenance',
  'Installation / mounting',
  'Assembly / setup',
  'Other handyman work'
]);

function sanitizeText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return sanitizeText(value, 5000)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSubmissionId(req) {
  if (!req.submissionId) {
    req.submissionId = crypto.randomUUID();
  }
  return req.submissionId;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const submissionDir = path.join(UPLOAD_DIR, getSubmissionId(req));
    fs.mkdirSync(submissionDir, { recursive: true });
    cb(null, submissionDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 12 ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 8,
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isAllowed = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    cb(isAllowed ? null : new Error('Only image and video files are allowed.'), isAllowed);
  }
});

function getMailer() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'LEAD_EMAIL_TO'];
  const hasConfig = required.every((key) => Boolean(process.env[key]));

  if (!hasConfig) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function buildEmail({ submission, fileLinks }) {
  const safeName = escapeHtml(submission.name);
  const safePhone = escapeHtml(submission.phone);
  const safeEmail = escapeHtml(submission.email || 'Not provided');
  const safeService = escapeHtml(submission.service);
  const safeMessage = escapeHtml(submission.message).replaceAll('\n', '<br />');

  const filesHtml = fileLinks.length
    ? `<ul>${fileLinks.map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.originalName)}</a> (${escapeHtml(file.sizeMb)} MB)</li>`).join('')}</ul>`
    : '<p>No files were attached.</p>';

  const textFiles = fileLinks.length
    ? fileLinks.map((file) => `- ${file.originalName} (${file.sizeMb} MB): ${file.url}`).join('\n')
    : 'No files were attached.';

  return {
    subject: `New website request: ${submission.service} from ${submission.name}`,
    text: `New Sol & Stone Property Services request

Name: ${submission.name}
Phone: ${submission.phone}
Email: ${submission.email || 'Not provided'}
Service: ${submission.service}

Project details:
${submission.message}

Files:
${textFiles}

Submitted: ${submission.createdAt}
`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111d13">
        <h2>New Sol &amp; Stone Property Services Request</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Service:</strong> ${safeService}</p>
        <h3>Project details</h3>
        <p>${safeMessage}</p>
        <h3>Uploaded files</h3>
        ${filesHtml}
        <p><strong>Submitted:</strong> ${escapeHtml(submission.createdAt)}</p>
      </div>
    `
  };
}

app.post('/api/contact', contactLimiter, upload.array('projectFiles', 8), async (req, res, next) => {
  try {
    // Honeypot spam protection: real users never see or complete this field.
    if (sanitizeText(req.body.company, 120)) {
      return res.redirect('/thank-you.html');
    }

    const submissionId = getSubmissionId(req);
    const name = sanitizeText(req.body.name, 120);
    const phone = sanitizeText(req.body.phone, 60);
    const email = sanitizeText(req.body.email, 160);
    const service = sanitizeText(req.body.service, 120);
    const message = sanitizeText(req.body.message, 3000);

    if (!name || !phone || !service || !message) {
      return res.status(400).send('Please go back and complete all required fields.');
    }

    if (!allowedServices.has(service)) {
      return res.status(400).send('Please go back and select a valid service.');
    }

    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      storedName: file.filename,
      mimetype: file.mimetype,
      sizeBytes: file.size,
      sizeMb: (file.size / 1024 / 1024).toFixed(1),
      url: `${BASE_URL}/uploads/${submissionId}/${encodeURIComponent(file.filename)}`
    }));

    const submission = {
      id: submissionId,
      createdAt: new Date().toISOString(),
      name,
      phone,
      email,
      service,
      message,
      files
    };

    const submissionDir = path.join(UPLOAD_DIR, submissionId);
    fs.mkdirSync(submissionDir, { recursive: true });
    fs.writeFileSync(
      path.join(submissionDir, 'submission.json'),
      JSON.stringify(submission, null, 2),
      'utf8'
    );

    const mailer = getMailer();

    if (mailer) {
      const emailContent = buildEmail({ submission, fileLinks: files });
      await mailer.sendMail({
        from: process.env.LEAD_EMAIL_FROM || process.env.SMTP_USER,
        to: process.env.LEAD_EMAIL_TO,
        replyTo: email || undefined,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html
      });
    } else {
      console.log('New form submission saved locally. Add SMTP settings in .env to receive email alerts.');
      console.log(JSON.stringify(submission, null, 2));
    }

    return res.redirect('/thank-you.html');
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('One of your files is too large. Please keep each file under 25 MB.');
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).send('Please upload no more than 8 files.');
    }
  }

  if (error.message === 'Only image and video files are allowed.') {
    return res.status(400).send(error.message);
  }

  console.error(error);
  return res.status(500).send('Something went wrong while sending your request. Please try again or call us directly.');
});

app.listen(PORT, () => {
  console.log(`Sol & Stone Property Services site running at http://localhost:${PORT}`);
});
