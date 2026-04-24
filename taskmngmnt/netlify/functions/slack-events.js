exports.handler = async (event) => {
  if (!event.body) {
    return { statusCode: 200, body: 'OK' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 200, body: 'OK' };
  }

  // Handle Slack's challenge verification
  if (body.type === 'url_verification') {
    return {
      statusCode: 200,
      body: JSON.stringify({ challenge: body.challenge })
    };
  }

  // Forward app_mention events to Zapier
  if (body.event && body.event.type === 'app_mention') {
    await fetch('YOUR_ZAPIER_CATCH_HOOK_URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.event)
    });
  }

  return { statusCode: 200, body: 'OK' };
};