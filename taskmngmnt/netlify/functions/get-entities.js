const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async () => {
  try {
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });

    const entityProp = db.properties['Entity'];
    const entities =
      entityProp?.select?.options?.map((o) => ({
        name: o.name,
        color: o.color || 'default',
      })) || [];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ entities }),
    };
  } catch (err) {
    console.error('get-entities error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
