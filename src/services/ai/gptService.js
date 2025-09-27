import axios from "axios";

export class GptService {
  static async process(input, options = {}) {
    try {
      const response = await axios.post(
        "https://chateverywhere.app/api/chat/",
        {
          model: {
            id: "gpt-4",
            name: "GPT-4",
            maxLength: 32000,
            tokencoin: 8000,
            completionTokencoin: 5000,
            deploymentName: "gpt-4",
          },
          messages: [
            {
              pluginId: null,
              content: input,
              role: "user",
            },
          ],
          prompt: options.prompt || null,
          temperature: options.temperature || 0.5,
        },
        {
          headers: {
            Accept: "*/*",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch AI response: ${error.response?.data?.error || error.message}`
      );
    }
  }
}

export default GptService;