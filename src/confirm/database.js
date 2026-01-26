const { neon } = require('@neondatabase/serverless');

let db;

if (process.env.DATABASE_URL) {
    // Production - Neon Database
    const sql = neon(process.env.DATABASE_URL);
    
    db = {
        query: async (text, params = []) => {
            try {
                // Convert ? placeholders to $1, $2, etc for PostgreSQL
                let pgText = text;
                let paramIndex = 1;
                pgText = pgText.replace(/\?/g, () => `$${paramIndex++}`);
                
                const result = await sql(pgText, params);
                return [result]; // Return format [rows, fields]
            } catch (error) {
                console.error('Database query error:', error);
                throw error;
            }
        }
    };
} else {
    // Development - MySQL (optional)
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'api_system',
        waitForConnections: true,
        connectionLimit: 10,
    });
    
    db = pool;
}

module.exports = db;
