import fs from "fs";
import path from "path";

/**
 * Rate Limiter Middleware with IP Blocking and Admin Unban
 * 
 * Features:
 * - Tracks request counts per IP
 * - Blocks IPs exceeding rate limit
 * - Persistent storage in /tmp (Vercel compatible)
 * - Admin unban endpoint
 * - Auto-cleanup of old data
 */

// Use /tmp for Vercel serverless environment (read-only filesystem workaround)
const DATA_DIR = '/tmp/data';
const RATE_FILE = path.join(DATA_DIR, 'rate.json');
const BAN_FILE = path.join(DATA_DIR, 'ban.json');

const MAX_REQUESTS = 100;
const WINDOW_MS = 60 * 1000; // 1 minute
const BAN_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Ensures data directory and files exist
 */
function ensureFiles() {
  // Create directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (err) {
      console.warn('Could not create data directory:', err.message);
    }
  }
  
  // Create rate.json if it doesn't exist
  if (!fs.existsSync(RATE_FILE)) {
    try {
      fs.writeFileSync(RATE_FILE, JSON.stringify({}));
    } catch (err) {
      console.warn('Could not create rate file:', err.message);
    }
  }
  
  // Create ban.json if it doesn't exist
  if (!fs.existsSync(BAN_FILE)) {
    try {
      fs.writeFileSync(BAN_FILE, JSON.stringify({}));
    } catch (err) {
      console.warn('Could not create ban file:', err.message);
    }
  }
}

// Initialize files (with error handling for serverless)
try {
  ensureFiles();
} catch (err) {
  console.warn('Rate limiter initialization warning:', err.message);
}

/**
 * Read JSON file with fallback
 */
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.warn(`Error reading ${filePath}:`, err.message);
    return {};
  }
}

/**
 * Write JSON file with error handling
 */
function writeJSON(filePath, data) {
  try {
    ensureFiles(); // Ensure directory exists before writing
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn(`Error writing ${filePath}:`, err.message);
  }
}

/**
 * Get client IP from request
 */
function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'unknown';
}

/**
 * Rate limiter middleware
 */
function rateLimiter(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  // Check if IP is banned
  const banned = readJSON(BAN_FILE);
  if (banned[ip]) {
    const banExpiry = banned[ip];
    if (now < banExpiry) {
      const remainingMs = banExpiry - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        message: `Your IP is temporarily banned. Try again in ${remainingMin} minute(s).`,
        bannedUntil: new Date(banExpiry).toISOString()
      });
    } else {
      // Ban expired, remove it
      delete banned[ip];
      writeJSON(BAN_FILE, banned);
    }
  }

  // Rate limiting logic
  const rates = readJSON(RATE_FILE);
  
  if (!rates[ip]) {
    rates[ip] = { count: 1, firstRequest: now };
  } else {
    const elapsed = now - rates[ip].firstRequest;
    
    if (elapsed > WINDOW_MS) {
      // Reset window
      rates[ip] = { count: 1, firstRequest: now };
    } else {
      rates[ip].count++;
      
      if (rates[ip].count > MAX_REQUESTS) {
        // Ban the IP
        banned[ip] = now + BAN_DURATION_MS;
        writeJSON(BAN_FILE, banned);
        
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. You are banned for 15 minutes.`,
          bannedUntil: new Date(banned[ip]).toISOString()
        });
      }
    }
  }
  
  writeJSON(RATE_FILE, rates);
  
  // Add rate limit headers
  const remaining = Math.max(0, MAX_REQUESTS - rates[ip].count);
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', new Date(rates[ip].firstRequest + WINDOW_MS).toISOString());
  
  next();
}

/**
 * Admin unban handler
 */
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

  const banned = readJSON(BAN_FILE);
  
  if (!banned[ipToUnban]) {
    return res.status(404).json({ 
      success: false, 
      message: `IP ${ipToUnban} is not currently banned` 
    });
  }

  delete banned[ipToUnban];
  writeJSON(BAN_FILE, banned);

  // Also clear rate limit data
  const rates = readJSON(RATE_FILE);
  delete rates[ipToUnban];
  writeJSON(RATE_FILE, rates);

  return res.json({ 
    success: true, 
    message: `IP ${ipToUnban} has been unbanned successfully` 
  });
}

/**
 * Cleanup old entries (optional - can be called periodically)
 */
function cleanup() {
  const now = Date.now();
  
  // Cleanup expired bans
  const banned = readJSON(BAN_FILE);
  let changed = false;
  for (const ip in banned) {
    if (now >= banned[ip]) {
      delete banned[ip];
      changed = true;
    }
  }
  if (changed) writeJSON(BAN_FILE, banned);
  
  // Cleanup old rate entries
  const rates = readJSON(RATE_FILE);
  changed = false;
  for (const ip in rates) {
    if (now - rates[ip].firstRequest > WINDOW_MS) {
      delete rates[ip];
      changed = true;
    }
  }
  if (changed) writeJSON(RATE_FILE, rates);
}

// Run cleanup every 5 minutes (optional)
setInterval(cleanup, 5 * 60 * 1000);

export default {
  rateLimiter,
  adminUnbanHandler,
  cleanup
};
