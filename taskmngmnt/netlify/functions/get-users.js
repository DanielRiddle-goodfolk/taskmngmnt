const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async () => {
  try {
    let allUsers = [];
    let cursor;

    do {
      const response = await notion.users.list({
        start_cursor: cursor,
        page_size: 100,
      });
      allUsers = allUsers.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    // Only return real people, not bots/integrations
    const users = allUsers
      .filter((u) => u.type === 'person')
      .map((u) => ({
        id: u.id,
        name: u.name || 'Unknown',
        avatarUrl: u.avatar_url || null,
        email: u.person?.email || null,
      }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ users }),
    };
  } catch (err) {
    console.error('get-users error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
