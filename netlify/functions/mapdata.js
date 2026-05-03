// Netlify function — handles saving and loading map data
// Stores zoning, schools, and daycares as JSON blobs in Netlify Blobs
// No file size limits — handles Denver's full zoning GeoJSON easily
 
const { getStore } = require('@netlify/blobs');
 
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
 
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
 
  const store = getStore('map-data');
  const key = event.queryStringParameters && event.queryStringParameters.key;
 
  if (!key) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing key parameter' }) };
  }
 
  try {
    // GET — load data
    if (event.httpMethod === 'GET') {
      const data = await store.get(key);
      if (!data) {
        return { statusCode: 404, headers, body: JSON.stringify({ found: false }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ found: true, data }) };
    }
 
    // POST — save data
    if (event.httpMethod === 'POST') {
      const body = event.body;
      if (!body) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No data provided' }) };
      }
      await store.set(key, body);
      return { statusCode: 200, headers, body: JSON.stringify({ saved: true, key, size: body.length }) };
    }
 
    // DELETE — clear data
    if (event.httpMethod === 'DELETE') {
      await store.delete(key);
      return { statusCode: 200, headers, body: JSON.stringify({ deleted: true, key }) };
    }
 
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
 
  } catch (err) {
    console.error('Map data error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
