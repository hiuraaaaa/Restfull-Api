export default function setupResponseFormatter(app) {
  app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      if (data && typeof data === "object") {
        const statusCode = res.statusCode || 200;
        const responseData = {
          statusCode,
          ...data,
        };

        if (statusCode >= 200 && statusCode < 300) {
          responseData.timestamp = new Date().toISOString();
          responseData.attribution = "@synshin9";
        }

        return originalJson.call(this, responseData);
      }
      return originalJson.call(this, data);
    };
    next();
  });
}