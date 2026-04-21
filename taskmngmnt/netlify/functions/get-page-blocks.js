const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

exports.handler = async (event) => {
  const { pageId } = event.queryStringParameters || {};
  if (!pageId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'pageId required' }) };
  }
  try {
    const response = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
    const getText = (rt) => (rt || []).map(t => t.plain_text).join('');

    // Fetch child blocks for callouts with nested content (in parallel)
    const calloutBlocks = response.results.filter(b => b.type === 'callout' && b.has_children);
    const calloutChildMap = {};
    await Promise.all(calloutBlocks.map(async (b) => {
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
    }));

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
        case 'child_database':
          return { type, title: content.title || 'Database', id: b.id };
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
