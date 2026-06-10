/**
 * Free serverless contact ingestion using Cloudflare Workers.
 *
 * Required Worker environment variables:
 * - GITHUB_TOKEN: Fine-grained token with "Issues: Read and write" on private target repo
 * - GITHUB_OWNER: Owner/org of the private target repo
 * - GITHUB_REPO: Private repository name where contact issues are stored
 */
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    try {
      if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
        return json({ error: 'Server not configured' }, 500, corsHeaders);
      }

      const body = await request.json();
      const name = (body?.name || '').trim();
      const email = (body?.email || '').trim();
      const subject = (body?.subject || '').trim();
      const message = (body?.message || '').trim();
      const submittedAt = (body?.submittedAt || new Date().toISOString()).trim();
      const source = (body?.source || 'unknown').trim();

      if (!name || !email || !subject || !message) {
        return json({ error: 'Missing required fields' }, 400, corsHeaders);
      }

      const issueTitle = `[Contact] ${subject}`;
      const issueBody = [
        '## New Contact Form Submission',
        '',
        `- **Name:** ${name}`,
        `- **Email:** ${email}`,
        `- **Submitted At:** ${submittedAt}`,
        `- **Source:** ${source}`,
        '',
        '### Message',
        message
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
        return json({ error: 'Unable to create issue' }, 502, corsHeaders);
      }

      return json({ ok: true }, 200, corsHeaders);
    } catch {
      return json({ error: 'Invalid request payload' }, 400, corsHeaders);
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
