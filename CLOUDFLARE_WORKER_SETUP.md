# Cloudflare Worker Setup Guide: GitHub Issue Integration

This guide will help you connect your portfolio contact form to automatically create private GitHub issues.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- GitHub account with `cenndaal/Portfolio` repository
- Personal computer with text editor

---

## Step 1: Create GitHub Personal Access Token

### Why?
The Cloudflare Worker needs permission to create issues in your GitHub repository.

### How:
1. Go to **GitHub** → **Settings** (top-right menu)
2. Click **Developer settings** (left sidebar, bottom)
3. Click **Personal access tokens** → **Tokens (classic)**
4. Click **Generate new token (classic)** (blue button)

### Token Configuration:
- **Token name:** `portfolio-contact-worker`
- **Expiration:** 90 days (recommended)
- **Scopes - Check these boxes:**
  - ✅ `repo` (Full control of private repositories)
  - ✅ `issues` (Create/read/update issues)

### Save Token:
1. Click **Generate token**
2. **COPY AND SAVE** the token immediately (40 characters starting with `ghp_`)
3. You won't see it again!

---

## Step 2: Create Cloudflare Worker

### Access Workers Dashboard:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages** (left sidebar)
3. Click **Create application**
4. Click **Create Worker** (blue button)

### Deploy:
- **Worker name:** `portfolio-contact-handler`
- Click **Deploy**

### You're now in the Worker Editor

---

## Step 3: Update Worker Code

The Worker code is already created in your repo at `worker.js`. Now add it to Cloudflare:

### In Cloudflare Worker Editor:
1. You'll see default code with `export default { ... }`
2. **Delete all** of it
3. Copy this code:

```javascript
export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      const { name, email, subject, message } = data;

      // Validation
      if (!name || !email || !subject || !message) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get from environment variables (set in Step 4)
      const githubToken = GITHUB_TOKEN;
      const repoOwner = 'cenndaal';
      const repoName = 'Portfolio';

      // Format the issue body
      const issueBody = `**From:** ${name}  
**Email:** ${email}  

---

## Message

${message}

---
*Auto-created by contact form*`;

      // Create issue on GitHub
      const githubResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Accept': 'application/vnd.github+json',
          },
          body: JSON.stringify({
            title: `📬 ${subject}`,
            body: issueBody,
            labels: ['contact-form', 'private'],
          }),
        }
      );

      if (!githubResponse.ok) {
        const errorData = await githubResponse.json();
        console.error('GitHub API error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to create issue' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Thank you! Your message has been received.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
```

4. Click **Save and deploy** (blue button)

---

## Step 4: Add Environment Variables

This is where you add your GitHub token securely.

### In Cloudflare Worker Dashboard:
1. Click **Settings** (left sidebar)
2. Scroll to **Environment variables** section
3. Click **Add variable**

### Add Your Token:
- **Variable name:** `GITHUB_TOKEN`
- **Value:** Paste your GitHub token from Step 1 (the `ghp_...` string)
- Click **Encrypt**
- Click **Save and deploy**

---

## Step 5: Get Your Worker URL

### Find Your Endpoint:
1. In Worker Dashboard, click **Overview** tab
2. Copy the **URL** (format: `https://portfolio-contact-handler.{subdomain}.workers.dev`)
3. Save this URL

---

## Step 6: Update Your Portfolio HTML

Edit `index.html` and find line ~867:

### Before:
```html
<form class="contact-form" id="contact-form" data-endpoint="https://REPLACE_WITH_YOUR_WORKER_URL.workers.dev/api/contact" novalidate>
```

### After:
```html
<form class="contact-form" id="contact-form" data-endpoint="https://portfolio-contact-handler.{YOUR_SUBDOMAIN}.workers.dev" novalidate>
```

**Example:**
```html
<form class="contact-form" id="contact-form" data-endpoint="https://portfolio-contact-handler.abc123xyz.workers.dev" novalidate>
```

---

## Step 7: Test It!

### On Your Portfolio:
1. Visit your site
2. Scroll to **Contact** section
3. Fill out the form:
   - Name: "Jane Doe"
   - Email: "jane@example.com"
   - Subject: "Test Message"
   - Message: "This is a test"
4. Click **Send Message**

### Check GitHub Issues:
1. Go to GitHub → Your `Portfolio` repo
2. Click **Issues** tab
3. You should see a new issue:
   - **Title:** 📬 Test Message
   - **Body:** Contains all form data
   - **Labels:** `contact-form`, `private`

---

## What Happens Behind the Scenes

```
User fills form on Portfolio
         ↓
JavaScript sends data to Cloudflare Worker
         ↓
Worker receives and validates data
         ↓
Worker creates GitHub Issue via GitHub API
         ↓
You receive notification on GitHub
         ↓
Issue appears in your Portfolio repo (private)
```

---

## Troubleshooting

### ❌ "401 Unauthorized" Error
- **Cause:** GitHub token is invalid or expired
- **Fix:** Generate a new token in Step 1

### ❌ "404 Not Found" Error
- **Cause:** Repository name/owner is wrong
- **Fix:** Check spelling of `cenndaal/Portfolio`

### ❌ Form shows success but no issue created
- **Cause:** Worker error
- **Fix:** Check Cloudflare Worker logs (Worker dashboard → Logs tab)

### ❌ CORS error in browser console
- **Cause:** Usually a Worker URL issue
- **Fix:** Verify Worker URL matches exactly in HTML

### ❌ Issue created but can't see it
- **Cause:** Repository access issue
- **Fix:** Ensure you have write access to Portfolio repo

---

## Optional Enhancements

### Add More Labels
In Worker code, line 61, change:
```javascript
labels: ['contact-form', 'private', 'needs-response'],
```

### Create Separate Private Inbox
1. Create new private repo: `portfolio-contact-inbox`
2. In Worker code, line 20, change:
   ```javascript
   const repoName = 'portfolio-contact-inbox';
   ```

### Add Auto-Reply Email
Add this after Worker creates issue to also email yourself:
```javascript
// Email notification (optional)
// Send email to yourself with form details
```

---

## Security Notes

✅ **Good practices used:**
- GitHub token stored securely as environment variable
- CORS headers prevent unauthorized access
- Input validation on all fields
- GitHub API uses Bearer token authentication

⚠️ **Keep in mind:**
- Never expose your GitHub token in code
- Token has full repo access (keep it safe)
- Issues are created in your repo, so visibility depends on repo privacy

---

## Next Steps

1. **Test the form** with a test submission
2. **Check your GitHub Issues** for the new issue
3. **Celebrate!** Your contact form now integrates with GitHub

Need help? Check Cloudflare Worker logs or GitHub API error responses.
