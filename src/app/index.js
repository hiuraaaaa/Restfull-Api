import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import logger from "../utils/logger.js";
import logApiRequest from "../utils/logApiRequest.js";
import loadEndpoints from "../utils/loader.js";
import setupMiddleware from "./middleware.js";
import setupResponseFormatter from "./responseFormatter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

// Configure application settings
app.set("trust proxy", true);
app.set("json spaces", 2);

// Initialize middleware and response formatter
setupMiddleware(app);
setupResponseFormatter(app);

/**
 * Array to store all loaded API endpoints
 * @type {Array<Object>}
 */
let allEndpoints = [];

/**
 * Initializes the API server by loading endpoints and setting up routes
 * @async
 * @function initializeAPI
 * @returns {Promise<void>}
 */
(async function initializeAPI() {
  logger.info("Starting server initialization...");
  logger.info("Loading API endpoints...");

  allEndpoints = (await loadEndpoints(path.join(process.cwd(), "api"), app)) || [];

  logger.ready(`Loaded ${allEndpoints.length} endpoints`);

  setupRoutes(app, allEndpoints);
})();

/**
 * Sets up all routes for the Express application including API documentation and error handling
 * @function setupRoutes
 * @param {express.Application} app - The Express application instance
 * @param {Array<Object>} endpoints - Array of endpoint objects containing route information
 */
function setupRoutes(app, endpoints) {
  /**
   * GET /openapi.json
   * @name GET /openapi.json
   * @description Returns OpenAPI specification with all available endpoints
   * @route {GET} /openapi.json
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {Object} JSON response containing API documentation
   * @returns {string} returns.title - API title
   * @returns {string} returns.description - API description
   * @returns {string} returns.baseURL - Base URL of the API
   * @returns {Array<Object>} returns.endpoints - Array of endpoint objects with enriched URL information
   */
  app.get("/openapi.json", (req, res) => {
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    /**
     * Enriches endpoints with full URL information including query parameters
     * @type {Array<Object>}
     */
    const enrichedEndpoints = endpoints.map((ep) => {
      let url = baseURL + ep.route;
      if (ep.params && ep.params.length > 0) {
        const query = ep.params.map((p) => `${p}=YOUR_${p.toUpperCase()}`).join("&");
        url += "?" + query;
      }
      return { ...ep, url };
    });

    res.status(200).json({
      title: "InuSoft API's.",
      description: "Welcome to the API documentation. This interactive interface allows you to explore and test our API endpoints in real-time.",
      baseURL,
      endpoints: enrichedEndpoints,
    });
  });

  /**
   * GET /
   * @name GET /
   * @description Serves the main index.html page
   * @route {GET} /
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {file} Sends the index.html file
   */
  app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
  });

  /**
   * 404 Error Handler
   * @name 404 Handler
   * @description Handles requests to non-existent routes
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @returns {file} Sends the 404.html file with 404 status code
   */
  app.use((req, res) => {
      logger.info(`404: ${req.method} ${req.path}`);
      res.status(404).sendFile(path.join(process.cwd(), 'public', '404.html'));
  });

  /**
   * Global Error Handler
   * @name Error Handler
   * @description Handles all uncaught errors in the application
   * @param {Error} err - The error object
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @param {express.NextFunction} next - Express next function
   * @returns {file} Sends the 500.html file with 500 status code
   */
  app.use((err, req, res, next) => {
      logger.error(`500: ${err.message}`);
      res.status(500).sendFile(path.join(process.cwd(), 'public', '500.html'));
  });
}

export default app;