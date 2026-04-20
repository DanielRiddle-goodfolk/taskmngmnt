const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'PATCH') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { id, notes } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

    await notion.pages.update({
      page_id: id,
      properties: {
        Notes: { rich_text: [{ text: { content: notes || '' } }] },
      },
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('update-task error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
