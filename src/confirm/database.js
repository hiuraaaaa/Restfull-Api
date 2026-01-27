import { neon } from '@neondatabase/serverless';

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
                return [result]; // Return format [rows]
            } catch (error) {
                console.error('Database query error:', error);
                throw error;
            }
        }
    };
} else {
    // Fallback jika butuh MySQL untuk dev local
    console.warn('DATABASE_URL not found, using mock database');
    db = {
        query: async () => [[]]
    };
}

export default db;
