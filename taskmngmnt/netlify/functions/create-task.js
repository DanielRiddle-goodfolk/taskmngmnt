const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { taskName, entity, dueDate, notes, personIds } = JSON.parse(
      event.body || '{}'
    );

    if (!taskName || !taskName.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task name is required.' }),
      };
    }

    const properties = {
      'Task Name': {
        title: [{ text: { content: taskName.trim() } }],
      },
      Status: {
        status: { name: 'Not started' },
      },
    };

    if (entity) {
      properties['Entity'] = { select: { name: entity } };
    }

    if (dueDate) {
      properties['Due Date'] = { date: { start: dueDate } };
    }

    if (notes && notes.trim()) {
      properties['Notes'] = {
        rich_text: [{ text: { content: notes.trim() } }],
      };
    }

    if (personIds && personIds.length > 0) {
      properties['Person'] = {
        people: personIds.map((id) => ({ object: 'user', id })),
      };
    }

    const page = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ id: page.id, url: page.url }),
    };
  } catch (err) {
    console.error('create-task error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
