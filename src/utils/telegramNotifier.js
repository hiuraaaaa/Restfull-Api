import logger from "./logger.js";

/**
 * Telegram notification service for API request logging
 * @class TelegramNotifier
 * @description Sends formatted API request logs to Telegram bot
 */
class TelegramNotifier {
  constructor() {
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.enabled = Boolean(this.botToken && this.chatId);
    
    if (!this.enabled) {
      logger.warn('Telegram notifier disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }
  }

  /**
   * Send log notification to Telegram
   * @param {Object} logData - Request log data
   * @returns {Promise<void>}
   */
  async sendLog(logData) {
    if (!this.enabled) return;

    try {
      const message = this.formatLogMessage(logData);
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      logger.error(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  /**
   * Format log data into readable Telegram message
   * @param {Object} data - Log data
   * @returns {string} Formatted message
   */
  formatLogMessage(data) {
    const { method, path, status, ip, userAgent, responseTime, timestamp } = data;
    
    // Status emoji
    const statusEmoji = status >= 500 ? '🔴' : 
                       status >= 400 ? '🟡' : 
                       status >= 300 ? '🔵' : '🟢';
    
    // Shorten user agent
    const device = this.getDeviceInfo(userAgent);
    
    return `
${statusEmoji} <b>API Request</b>

<b>Endpoint:</b> <code>${method} ${path}</code>
<b>Status:</b> ${status}
<b>Time:</b> ${responseTime}ms
<b>IP:</b> <code>${ip}</code>
<b>Device:</b> ${device}
<b>Timestamp:</b> ${new Date(timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
    `.trim();
  }

  /**
   * Extract device info from user agent
   * @param {string} ua - User agent string
   * @returns {string} Device info
   */
  getDeviceInfo(ua) {
    if (!ua) return 'Unknown';
    
    if (ua.includes('Postman')) return '📮 Postman';
    if (ua.includes('curl')) return '🔧 cURL';
    if (ua.includes('Python')) return '🐍 Python';
    if (ua.includes('Chrome')) return '🌐 Chrome';
    if (ua.includes('Firefox')) return '🦊 Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return '🧭 Safari';
    if (ua.includes('Edge')) return '🌊 Edge';
    if (ua.includes('iPhone')) return '🍎 iPhone';
    if (ua.includes('Android')) return '🤖 Android';
    if (ua.includes('Mobile')) return '📱 Mobile';
    
    return '💻 Desktop';
  }
}

export default new TelegramNotifier();
