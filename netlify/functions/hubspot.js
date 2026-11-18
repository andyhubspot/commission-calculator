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
 
  // Token lives securely in Netlify environment variables only
  const token = process.env.HUBSPOT_TOKEN;
 
  // Debug — remove after testing
  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'HUBSPOT_TOKEN environment variable is not set' })
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
 
  // ── Save a report to the deal: a note on the timeline with a Word file attached ──
  // POST ?dealId=…&action=report  body: { noteId, noteBody, fileName, fileBase64 }
  const action = event.queryStringParameters && event.queryStringParameters.action;
  if (action === 'report' && event.httpMethod === 'POST') {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    const reply = (statusCode, obj) => ({ statusCode, headers: cors, body: JSON.stringify(obj) });
    const auth = { 'Authorization': `Bearer ${token}` };
    const scopeHint = (status) => (status === 401 || status === 403)
      ? 'The HubSpot access token needs more permissions: add the "files" scope and note (engagement) write access to the private app, then update HUBSPOT_TOKEN in Netlify.'
      : '';
    let input;
    try { input = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Invalid request body' }); }
    if (!/^\d+$/.test(String(dealId))) return reply(400, { error: 'Invalid deal ID' });
    if (!input.noteBody) return reply(400, { error: 'Missing report content' });

    try {
      // 1. Upload the Word file (same folder + name each time, so a newer save replaces the older file)
      let fileId = null, fileError = null;
      if (input.fileBase64 && input.fileName) {
        try {
          const safeName = String(input.fileName).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120);
          const form = new FormData();
          form.append('file', new Blob([Buffer.from(input.fileBase64, 'base64')], { type: 'application/msword' }), safeName);
          form.append('fileName', safeName);
          form.append('folderPath', `/deal-platform-reports/${dealId}`);
          form.append('options', JSON.stringify({ access: 'PRIVATE', overwrite: true }));
          const up = await fetch('https://api.hubapi.com/files/v3/files', { method: 'POST', headers: auth, body: form });
          const upData = await up.json().catch(() => ({}));
          if (up.ok && upData.id) fileId = String(upData.id);
          else fileError = (upData.message || `file upload failed (HTTP ${up.status})`) + (scopeHint(up.status) ? ' ' + scopeHint(up.status) : '');
        } catch (e) { fileError = e.message; }
      }

      // 2. Update the existing note for this report, or create a new one
      const properties = { hs_timestamp: new Date().toISOString(), hs_note_body: String(input.noteBody).slice(0, 65000) };
      if (fileId) properties.hs_attachment_ids = fileId;
      const jsonHeaders = Object.assign({ 'Content-Type': 'application/json' }, auth);
      let noteId = null, updated = false;
      if (input.noteId && /^\d+$/.test(String(input.noteId))) {
        const pr = await fetch(`https://api.hubapi.com/crm/v3/objects/notes/${input.noteId}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ properties }) });
        if (pr.ok) { noteId = String(input.noteId); updated = true; }
      }
      if (!noteId) {
        const cr = await fetch('https://api.hubapi.com/crm/v3/objects/notes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ properties }) });
        const crData = await cr.json().catch(() => ({}));
        if (!cr.ok || !crData.id) return reply(cr.status || 500, { error: crData.message || 'Could not create the note in HubSpot', hint: scopeHint(cr.status), fileId, fileError });
        noteId = String(crData.id);
        const as = await fetch(`https://api.hubapi.com/crm/v4/objects/notes/${noteId}/associations/default/deals/${dealId}`, { method: 'PUT', headers: auth });
        if (!as.ok) {
          const asData = await as.json().catch(() => ({}));
          return reply(as.status, { error: 'The note was created but could not be linked to the deal: ' + (asData.message || `HTTP ${as.status}`), noteId, fileId, fileError });
        }
      }
      return reply(200, { noteId, updated, fileId, fileError });
    } catch (err) {
      return reply(500, { error: err.message });
    }
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
