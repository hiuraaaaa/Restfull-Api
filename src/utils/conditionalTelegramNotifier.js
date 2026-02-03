import logger from "./logger.js";

let telegramNotifier = null;

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  import("./telegramNotifier.js").then(module => {
    telegramNotifier = module.default;
    logger.info("Telegram Notifier enabled.");
  }).catch(err => {
    logger.error(`Failed to load Telegram Notifier: ${err.message}`);
  });
} else {
  logger.warn("Telegram Notifier disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.");
}

export default {
  sendLog: async (logData) => {
    if (telegramNotifier) {
      await telegramNotifier.sendLog(logData);
    } else {
      // Optionally log that telegramNotifier is not active if needed for debugging
      // logger.debug("Telegram Notifier is not active, skipping sendLog.");
    }
  }
};
