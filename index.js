import 'dotenv/config';
import app from './src/app/index.js';

/**
 * Vercel serverless function export
 * @description
 * Vercel automatically handles server initialization.
 * We just need to export the Express app instance.
 * 
 * This file is used for Vercel deployment only.
 * For local development, use server.js instead.
 */
export default app;
