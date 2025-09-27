import app from './src/app/index.js';
import logger from './src/utils/logger.js';

import os from "os";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("");
  logger.ready(`Server started successfully`);
  logger.info(`Local: http://localhost:${PORT}`);

  try {
    const nets = os.networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          if (!results[name]) results[name] = [];
          results[name].push(net.address);
        }
      }
    }

    for (const [, addresses] of Object.entries(results)) {
      for (const addr of addresses) {
        logger.info(`Network: http://${addr}:${PORT}`);
      }
    }
  } catch (error) {
    logger.warn(`Cannot detect network interfaces: ${error.message}`);
  }

  logger.info("Ready for connections");
  console.log("");
});

export default app;