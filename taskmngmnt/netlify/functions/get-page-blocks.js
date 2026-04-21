const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Extract plain text from rich_text array
const getText = (rt) => (rt || []).map(t => t.plain_text).join('');

// Extract a displayable value from any property type
function getPropValue(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':        return getText(prop.title);
    case 'rich_text':    return getText(prop.rich_text);
    case 'select':       return prop.select?.name || '';
    case 'multi_select': return (prop.multi_select || []).map(s => s.name).join(', ');
    case 'status':       return prop.status?.name || '';
    case 'date':         return prop.date?.start || '';
    case 'checkbox':     return prop.checkbox ? '✓' : '';
    case 'number':       return prop.number !== null && prop.number !== undefined ? String(prop.number) : '';
    case 'people':       return (prop.people || []).map(p => p.name || '').filter(Boolean).join(', ');
    case 'email':        return prop.email || '';
    case 'url':          return prop.url || '';
    case 'phone_number': return prop.phone_number || '';
    default:             return '';
  }
}

exports.handler = async (event) => {
  const { pageId } = event.queryStringParameters || {};
  if (!pageId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'pageId required' }) };
  }
  try {
    const response = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });

    // Identify callouts with children and embedded databases — fetch both in parallel
    const calloutBlocks = response.results.filter(b => b.type === 'callout' && b.has_children);
    const dbBlocks      = response.results.filter(b => b.type === 'child_database');

    const calloutChildMap = {};
    const dbDataMap = {};

    await Promise.all([
      // Fetch callout children
      ...calloutBlocks.map(async (b) => {
        try {
          const childRes = await notion.blocks.children.list({ block_id: b.id, page_size: 50 });
          calloutChildMap[b.id] = childRes.results.map(cb => {
            const ct = cb.type;
            const cc = cb[ct];
            if (!cc) return null;
            if (['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','quote'].includes(ct)) {
              return { type: ct, text: getText(cc.rich_text) };
            }
            if (ct === 'to_do') return { type: ct, text: getText(cc.rich_text), checked: cc.checked };
            return null;
          }).filter(Boolean);
        } catch (e) {
          calloutChildMap[b.id] = [];
        }
      }),

      // Fetch database rows
      ...dbBlocks.map(async (b) => {
        try {
          const dbRes = await notion.databases.query({ database_id: b.id, page_size: 50 });
          // Find all property names (excluding title type — that's the row name)
          const samplePage = dbRes.results[0];
          const propKeys = samplePage
            ? Object.entries(samplePage.properties)
                .filter(([, v]) => v.type !== 'title')
                .map(([k]) => k)
            : [];

          const rows = dbRes.results.map(page => {
            // Row title
            const titleEntry = Object.values(page.properties).find(p => p.type === 'title');
            const title = titleEntry ? getText(titleEntry.title) : 'Untitled';
            // Up to 3 additional properties with a value
            const extras = propKeys
              .map(k => ({ key: k, value: getPropValue(page.properties[k]) }))
              .filter(p => p.value)
              .slice(0, 3);
            return { title, extras };
          });

          // Column headers (up to 3 extras that actually appear in any row)
          const usedKeys = propKeys.filter(k =>
            rows.some(r => r.extras.some(e => e.key === k))
          ).slice(0, 3);

          dbDataMap[b.id] = { rows, columns: usedKeys };
        } catch (e) {
          dbDataMap[b.id] = { rows: [], columns: [] };
        }
      }),
    ]);

    const blocks = response.results.map(b => {
      const type = b.type;
      const content = b[type];
      if (!content) return null;
      switch (type) {
        case 'paragraph':
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
        case 'bulleted_list_item':
        case 'numbered_list_item':
        case 'quote':
          return { type, text: getText(content.rich_text) };
        case 'to_do':
          return { type, text: getText(content.rich_text), checked: content.checked };
        case 'callout': {
          const icon = content.icon;
          const emoji = icon?.type === 'emoji' ? icon.emoji : '💡';
          const children = calloutChildMap[b.id] || [];
          return { type, text: getText(content.rich_text), emoji, children };
        }
        case 'image': {
          const url = content.type === 'external'
            ? content.external?.url
            : content.file?.url;
          const caption = getText(content.caption);
          return url ? { type, url, caption } : null;
        }
        case 'bookmark':
          return content.url
            ? { type, url: content.url, caption: getText(content.caption) }
            : null;
        case 'link_preview':
        case 'embed':
          return content.url ? { type: 'bookmark', url: content.url, caption: '' } : null;
        case 'child_database': {
          const db = dbDataMap[b.id] || { rows: [], columns: [] };
          return { type, title: content.title || 'Database', id: b.id, rows: db.rows, columns: db.columns };
        }
        case 'divider':
          return { type };
        default:
          return null;
      }
    }).filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ blocks }),
    };
  } catch (err) {
    console.error('get-page-blocks error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
