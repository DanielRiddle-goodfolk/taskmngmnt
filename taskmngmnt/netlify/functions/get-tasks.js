const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async () => {
  try {
    let allResults = [];
    let cursor;

    // Handle pagination — Notion returns max 100 results per call
    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        start_cursor: cursor,
        page_size: 100,
      });
      allResults = allResults.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const tasks = allResults.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        url: page.url,
        createdTime: page.created_time,
        taskName:
          props['Task Name']?.title?.map((t) => t.plain_text).join('') || '',
        status: props['Status']?.status?.name || 'Not started',
        person:
          props['Person']?.people?.map((p) => ({
            id: p.id,
            name: p.name || 'Unknown',
            avatarUrl: p.avatar_url || null,
          })) || [],
        entity: props['Entity']?.select?.name || '',
        dueDate: props['Due Date']?.date?.start || null,
        notes:
          props['Notes']?.rich_text?.map((t) => t.plain_text).join('') || '',
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ tasks }),
    };
  } catch (err) {
    console.error('get-tasks error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
