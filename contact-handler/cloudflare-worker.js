/**
 * Free serverless contact ingestion using Cloudflare Workers.
 *
 * Required Worker environment variables:
 * - GITHUB_TOKEN: Fine-grained token with "Issues: Read and write" on private target repo
 * - GITHUB_OWNER: Owner/org of the private target repo
 * - GITHUB_REPO: Private repository name where contact issues are stored
 * - ALLOWED_ORIGINS: Comma-separated allowed origins (e.g. https://example.com,https://www.example.com)
 */
export default {
  async fetch(request, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const originAllowed = allowedOrigins.includes(origin);
    const corsHeaders = {
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    };
    if (originAllowed) corsHeaders['Access-Control-Allow-Origin'] = origin;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originAllowed ? 204 : 403, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (!originAllowed) {
      return json({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || allowedOrigins.length === 0) {
      return json({ error: 'Server not configured' }, 500, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request payload' }, 400, corsHeaders);
    }

    try {
      const name = sanitizeSingleLine(body?.name || '', 80);
      const email = sanitizeSingleLine(body?.email || '', 120);
      const subject = sanitizeSingleLine(body?.subject || '', 120);
      const message = sanitizeMultiline(body?.message || '', 5000);
      const submittedAt = new Date().toISOString();
      const source = normalizeSource(body?.source);
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !email || !subject || !message || !isValidEmail) {
        return json({ error: 'Missing required fields' }, 400, corsHeaders);
      }

      const issueTitle = `[Contact] ${subject}`;
      const safeMessage = escapeMarkdown(message);
      const issueBody = [
        '## New Contact Form Submission',
        '',
        `- **Name:** ${name}`,
        `- **Email:** ${email}`,
        `- **Submitted At:** ${submittedAt}`,
        `- **Source:** ${source}`,
        '',
        '### Message',
        safeMessage
      ].join('\n');

      const ghResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + env.GITHUB_TOKEN,
            'User-Agent': 'portfolio-contact-worker',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ['contact-form', 'awaiting-reply']
          })
        }
      );

      if (!ghResponse.ok) {
        console.error('GitHub issue creation failed', ghResponse.status);
        return json({ error: 'Unable to create issue' }, 502, corsHeaders);
      }

      return json({ ok: true }, 200, corsHeaders);
    } catch (error) {
      console.error('contact-worker error', error);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }
  }
};

function json(payload, status, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function sanitizeSingleLine(value, maxLength) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength) {
  return String(value).replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function normalizeSource(value) {
  try {
    const url = new URL(String(value || '').trim());
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'unknown';
  }
}

function escapeMarkdown(value) {
  return String(value).replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}
