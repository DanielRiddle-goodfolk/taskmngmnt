const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const { pageId, text } = JSON.parse(event.body || '{}');
    if (!pageId || !text?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'pageId and text required' }) };
    }
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: text.trim() } }],
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('add-comment error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
