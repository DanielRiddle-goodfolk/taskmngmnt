const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async (event) => {
  const { pageId } = event.queryStringParameters || {};
  if (!pageId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'pageId required' }) };
  }
  try {
    const response = await notion.comments.list({ block_id: pageId });

    // Collect unique commenter IDs, then resolve names in parallel
    const userIds = [...new Set(
      response.results.map(c => c.created_by?.id).filter(Boolean)
    )];
    const userMap = {};
    await Promise.all(userIds.map(async (id) => {
      try {
        const user = await notion.users.retrieve({ user_id: id });
        userMap[id] = user.name || 'Unknown';
      } catch (e) {
        userMap[id] = 'Unknown';
      }
    }));

    const comments = response.results.map(c => {
      const text = (c.rich_text || []).map(t => t.plain_text).join('');
      const date = new Date(c.created_time);
      const ts = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
                 date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return {
        id: c.id,
        author: userMap[c.created_by?.id] || 'Unknown',
        text,
        ts,
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ comments }),
    };
  } catch (err) {
    console.error('get-comments error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
