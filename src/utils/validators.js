const Joi = require("joi");
const { validate: uuidValidate } = require("uuid");

// -------------------- Helper: Auto-format phone --------------------
const formatPhoneNumber = (phone) => {
  if (!phone) return phone;

  let cleaned = phone.replace(/\s+/g, ""); // remove spaces

  // If starts with 0 → assume Ghana default (+233) or adjust logic for other countries
  if (/^0\d{9}$/.test(cleaned)) {
    return "+233" + cleaned.slice(1);
  }

  // If starts with +countrycode and valid length
  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  // If starts with country code but no '+'
  if (/^\d{10,15}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  return phone; // fallback (will still be validated)
};

// -------------------- User Validators --------------------

const validateRegister = (data) => {
  // Auto-format before validating
  if (data.phone) data.phone = formatPhoneNumber(data.phone);

  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&]).+$")
      )
      .message(
        "Password must have at least 1 uppercase, 1 lowercase, 1 number, and 1 special character"
      )
      .required(),
    phone: Joi.string()
      .pattern(/^\+\d{10,15}$/)
      .message(
        "Phone number must be valid (e.g., +233501234567 or +12025550123)"
      )
      .optional(),
    address: Joi.string().max(255).optional(),
  });

  return schema.validate(data, { abortEarly: false });
};

// -------------------- Individual Validators --------------------

const validateEmail = (email) => !Joi.string().email().validate(email).error;

const validatePassword = (password) => {
  const schema = Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&]).+$"));
  return !schema.validate(password).error;
};

const validateName = (name) => !Joi.string().min(2).max(50).validate(name).error;

// ✅ Updated phone validation (after formatting)
const validatePhone = (phone) => {
  if (!phone) return true;
  const formatted = formatPhoneNumber(phone);
  return !Joi.string().pattern(/^\+\d{10,15}$/).validate(formatted).error;
};

// -------------------- Shared Validators --------------------

const validateUUID = (id) => uuidValidate(id);

const validateRole = (role) => ["user", "seller", "admin"].includes(role);

module.exports = {
  validateRegister,
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  validateUUID,
  validateRole,
  formatPhoneNumber, // ✅ export this helper
};
