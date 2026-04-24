exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  // Handle Slack's challenge verification
  if (body.type === 'url_verification') {
    return {
      statusCode: 200,
      body: JSON.stringify({ challenge: body.challenge })
    };
  }

  // Forward app_mention events to Zapier
  if (body.event && body.event.type === 'app_mention') {
    await fetch('https://hooks.zapier.com/hooks/catch/3282298/uvyxc1x/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.event)
    });
  }

  return { statusCode: 200, body: 'OK' };
};