exports.handler = async (event) => {
 
  // Handle preflight CORS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
 
  const token = process.env.HUBSPOT_TOKEN;
 
  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HubSpot token not configured' })
    };
  }
 
  const dealId = event.queryStringParameters && event.queryStringParameters.dealId;
  const props = event.queryStringParameters && event.queryStringParameters.properties;
 
  if (!dealId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing dealId parameter' })
    };
  }
 
  let url = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`;
  if (props) url += `?properties=${props}`;
 
  const isPost = event.httpMethod === 'POST';
 
  const options = {
    method: isPost ? 'PATCH' : 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
 
  if (isPost && event.body) {
    options.body = event.body;
  }
 
  try {
    const res = await fetch(url, options);
    const data = await res.json();
 
    return {
      statusCode: res.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
 
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
 
};
 
