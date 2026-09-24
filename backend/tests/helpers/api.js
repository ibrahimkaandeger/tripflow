// Thin real-fetch wrapper. No mocking anywhere in this file -- every
// call is a genuine HTTP round trip to the running test server, which
// runs the real app, real middleware chain, and real Postgres.
async function apiRequest(baseUrl, method, path, { token, companyId, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (companyId) headers["X-Company-Id"] = String(companyId);

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body (e.g. 204 No Content)
  }

  return { status: res.status, body: json };
}

module.exports = { apiRequest };
