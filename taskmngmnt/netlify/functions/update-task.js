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
    const { id, taskName, entity, dueDate, notes, personIds } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

    const properties = {};

    if (taskName !== undefined) {
      properties['Task Name'] = { title: [{ text: { content: taskName.trim() } }] };
    }
    if (notes !== undefined) {
      properties['Notes'] = { rich_text: [{ text: { content: notes || '' } }] };
    }
    if (entity !== undefined) {
      properties['Entity'] = entity ? { select: { name: entity } } : { select: null };
    }
    if (dueDate !== undefined) {
      properties['Due Date'] = dueDate ? { date: { start: dueDate } } : { date: null };
    }
    if (personIds !== undefined) {
      properties['Person'] = { people: personIds.map(uid => ({ object: 'user', id: uid })) };
    }

    await notion.pages.update({ page_id: id, properties });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('update-task error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
