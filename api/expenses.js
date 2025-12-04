// api/expenses.js
// CommonJS, async handler — compatible with @vercel/node

let expenses = [];

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  // Allow simple CORS so the static UI can call this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, { success: true });
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, { success: true, data: expenses });
  }

  if (req.method === 'POST') {
    // Read raw body (works if Vercel does not auto-parse)
    try {
      const raw = await new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1e6) {
            // limit 1MB
            req.connection.destroy();
            reject(new Error('Request body too large'));
          }
        });
        req.on('end', () => resolve(body));
        req.on('error', (err) => reject(err));
      });

      let parsed = {};
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          return sendJson(res, 400, { success: false, error: 'Invalid JSON body' });
        }
      }

      const { amount, description, category, date } = parsed || {};

      const missing = [];
      if (amount === undefined || amount === null || amount === '') missing.push('amount');
      if (!description) missing.push('description');
      if (!category) missing.push('category');
      if (!date) missing.push('date');

      if (missing.length > 0) {
        return sendJson(res, 400, { success: false, error: `Missing required fields: ${missing.join(', ')}` });
      }

      // Validate amount
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount)) {
        return sendJson(res, 400, { success: false, error: 'Invalid field: amount must be a number' });
      }

      // Validate date (basic)
      const ts = Date.parse(date);
      if (Number.isNaN(ts)) {
        return sendJson(res, 400, { success: false, error: 'Invalid field: date must be a valid date string (e.g. 2025-01-01)' });
      }

      const expense = {
        id: expenses.length + 1,
        amount: numericAmount,
        description: String(description),
        category: String(category),
        date: new Date(ts).toISOString().split('T')[0] // YYYY-MM-DD
      };

      expenses.push(expense);

      return sendJson(res, 201, { success: true, data: expense });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: 'Server error', details: err.message });
    }
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
};
