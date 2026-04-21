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
          return { type, text: getText(content.rich_text), emoji };
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
          return { type, title: content.title || 'Database' };
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
