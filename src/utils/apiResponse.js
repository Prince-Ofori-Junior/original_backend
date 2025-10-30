// utils/apiResponse.js
const apiResponse = (res, statusCode, success, message, data = {}, errors = []) => {
  const sanitizedData = sanitize(data);

  // Ensure errors are always an array of objects with param & message
  const safeErrors = Array.isArray(errors) && errors.length
    ? errors.map((err) => {
        if (typeof err === "string") return { param: null, message: err };
        return { param: err.param || null, message: err.message || message };
      })
    : [{ param: null, message }];

  return res.status(statusCode).json({
    success,
    message, // always include message
    ...(success
      ? { data: sanitizedData }
      : { errors: safeErrors }),
  });
};

// ------------------ Private Sanitizer ------------------
const sanitize = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  const clone = JSON.parse(JSON.stringify(obj));
  const sensitiveKeys = ["password", "token", "refreshToken", "secret", "creditCard"];

  sensitiveKeys.forEach((key) => {
    if (clone.hasOwnProperty(key)) delete clone[key];
  });

  return clone;
};

module.exports = apiResponse;
