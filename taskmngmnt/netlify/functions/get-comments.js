const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async (event) => {
  const { pageId } = event.queryStringParameters || {};
  if (!pageId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'pageId required' }) };
  }
  try {
    const response = await notion.comments.list({ block_id: pageId });
    const comments = response.results.map(c => {
      const text = (c.rich_text || []).map(t => t.plain_text).join('');
      const date = new Date(c.created_time);
      const ts = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
                 date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return {
        id: c.id,
        author: c.created_by?.name || 'Unknown',
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
