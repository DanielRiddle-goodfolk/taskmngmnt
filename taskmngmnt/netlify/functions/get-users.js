const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async () => {
  try {
    // Fetch workspace members and task-assigned people in parallel
    const [membersRes, tasksRes] = await Promise.all([
      // Workspace members (paginated)
      (async () => {
        let all = [];
        let cursor;
        do {
          const res = await notion.users.list({ start_cursor: cursor, page_size: 100 });
          all = all.concat(res.results);
          cursor = res.has_more ? res.next_cursor : undefined;
        } while (cursor);
        return all;
      })(),

      // All tasks — to pick up guests assigned to tasks but not full members
      (async () => {
        let all = [];
        let cursor;
        do {
          const res = await notion.databases.query({
            database_id: DATABASE_ID,
            start_cursor: cursor,
            page_size: 100,
          });
          all = all.concat(res.results);
          cursor = res.has_more ? res.next_cursor : undefined;
        } while (cursor);
        return all;
      })(),
    ]);

    // Build user map from workspace members
    const userMap = {};
    membersRes
      .filter(u => u.type === 'person')
      .forEach(u => {
        userMap[u.id] = {
          id: u.id,
          name: u.name || 'Unknown',
          avatarUrl: u.avatar_url || null,
          email: u.person?.email || null,
        };
      });

    // Add anyone assigned to a task who isn't already in the map (guests)
    tasksRes.forEach(page => {
      const people = page.properties?.['Person']?.people || [];
      people.forEach(p => {
        if (!userMap[p.id]) {
          userMap[p.id] = {
            id: p.id,
            name: p.name || 'Unknown',
            avatarUrl: p.avatar_url || null,
            email: null,
          };
        }
      });
    });

    const users = Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ users }),
    };
  } catch (err) {
    console.error('get-users error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
