/**
 * In-memory rate limiter (no persistent storage)
 * Simplified for Vercel serverless
 */

const rates = {}; // In-memory storage
const banned = {}; // In-memory storage

const MAX_REQUESTS = 100;
const WINDOW_MS = 60 * 1000;
const BAN_DURATION_MS = 15 * 60 * 1000;

function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'unknown';
}

function rateLimiter(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  // Check banned
  if (banned[ip] && now < banned[ip]) {
    const remainingMs = banned[ip] - now;
    const remainingMin = Math.ceil(remainingMs / 60000);
    return res.status(429).json({
      success: false,
      message: `Your IP is temporarily banned. Try again in ${remainingMin} minute(s).`,
      bannedUntil: new Date(banned[ip]).toISOString()
    });
  } else if (banned[ip]) {
    delete banned[ip];
  }

  // Rate limiting
  if (!rates[ip]) {
    rates[ip] = { count: 1, firstRequest: now };
  } else {
    const elapsed = now - rates[ip].firstRequest;
    
    if (elapsed > WINDOW_MS) {
      rates[ip] = { count: 1, firstRequest: now };
    } else {
      rates[ip].count++;
      
      if (rates[ip].count > MAX_REQUESTS) {
        banned[ip] = now + BAN_DURATION_MS;
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. You are banned for 15 minutes.`,
          bannedUntil: new Date(banned[ip]).toISOString()
        });
      }
    }
  }
  
  const remaining = Math.max(0, MAX_REQUESTS - rates[ip].count);
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', new Date(rates[ip].firstRequest + WINDOW_MS).toISOString());
  
  next();
}

function adminUnbanHandler(req, res) {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_KEY;

  if (!expectedKey) {
    return res.status(500).json({ 
      success: false, 
      message: 'Admin key not configured on server' 
    });
  }

  if (adminKey !== expectedKey) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid admin key' 
    });
  }

  const ipToUnban = req.body?.ip || req.query?.ip;
  
  if (!ipToUnban) {
    return res.status(400).json({ 
      success: false, 
      message: 'IP address is required' 
    });
  }

  if (!banned[ipToUnban]) {
    return res.status(404).json({ 
      success: false, 
      message: `IP ${ipToUnban} is not currently banned` 
    });
  }

  delete banned[ipToUnban];
  delete rates[ipToUnban];

  return res.json({ 
    success: true, 
    message: `IP ${ipToUnban} has been unbanned successfully` 
  });
}

function cleanup() {
  const now = Date.now();
  
  // Cleanup expired bans
  for (const ip in banned) {
    if (now >= banned[ip]) {
      delete banned[ip];
    }
  }
  
  // Cleanup old rate entries
  for (const ip in rates) {
    if (now - rates[ip].firstRequest > WINDOW_MS) {
      delete rates[ip];
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

export default {
  rateLimiter,
  adminUnbanHandler,
  cleanup
};
