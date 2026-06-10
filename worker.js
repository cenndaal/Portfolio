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

      // GitHub API credentials (from environment variables)
      const githubToken = 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN';
      const repoOwner = 'cenndaal';
      const repoName = 'Portfolio';

      // Format the issue body
      const issueBody = `**From:** ${name}  
**Email:** ${email}  
**Subject:** ${subject}

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
            title: `Contact Form: ${subject}`,
            body: issueBody,
            labels: ['contact-form', 'private'],
            private: true,
          }),
        }
      );

      if (!githubResponse.ok) {
        const errorData = await githubResponse.text();
        console.error('GitHub API error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to create GitHub issue' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const issueData = await githubResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Your message has been received',
          issueUrl: issueData.html_url,
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
