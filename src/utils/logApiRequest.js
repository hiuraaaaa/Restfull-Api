import logger from "./logger.js";

const logApiRequest = async (req, res, next) => {
  const startTime = Date.now();

  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  res.send = function () {
    finishRequest.call(this);
    return originalSend.apply(this, arguments);
  };

  res.json = function () {
    finishRequest.call(this);
    return originalJson.apply(this, arguments);
  };

  res.end = function () {
    finishRequest.call(this);
    return originalEnd.apply(this, arguments);
  };

  function finishRequest() {
    res.send = originalSend;
    res.json = originalJson;
    res.end = originalEnd;

    const responseTime = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} [${res.statusCode}] (${responseTime}ms)`);
  }

  next();
};

export default logApiRequest;