// routes/checkout.routes.js
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// -------------------- MULTER SETUP --------------------
const uploadDir = path.join(__dirname, "../uploads/payment-icons");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// -------------------- BASE URL --------------------
// Always use your deployed backend URL
const BASE_URL = "https://fosten-e-commerce-backend.onrender.com";

// -------------------- SERVE UPLOADS --------------------
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// -------------------- GET PAYMENT METHODS --------------------
router.get("/payment-methods", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pm.code AS method,
             pm.label AS method_label,
             pm.description AS method_description,
             pm.icon,
             psc.code AS channel,
             psc.label AS channel_label,
             psc.icon AS channel_icon
      FROM payment_methods pm
      LEFT JOIN payment_sub_channels psc ON pm.code = psc.method_code
      WHERE pm.is_active = true
      ORDER BY pm.created_at ASC, psc.created_at ASC
    `);

    const methodsMap = {};
    rows.forEach((row) => {
      if (!methodsMap[row.method]) {
        methodsMap[row.method] = {
          id: row.method,
          method: row.method,
          label: row.method_label,
          description: row.method_description,
          icon: row.icon
            ? `${BASE_URL}${row.icon.replace(/\\/g, "/")}`
            : null,
          subMethods: [],
        };
      }

      if (row.channel) {
        methodsMap[row.method].subMethods.push({
          channel: row.channel,
          label: row.channel_label,
          icon: row.channel_icon
            ? `${BASE_URL}${row.channel_icon.replace(/\\/g, "/")}`
            : null,
        });
      }
    });

    res.json({ success: true, methods: Object.values(methodsMap) });
  } catch (err) {
    console.error("Failed to fetch payment methods:", err.message);
    res.status(500).json({
      success: false,
      methods: [],
      message: "Failed to fetch payment methods",
    });
  }
});

// -------------------- ADD/UPDATE PAYMENT METHOD --------------------
router.post(
  "/payment-methods",
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "subIcons" },
  ]),
  async (req, res) => {
    const { code, label, description, subChannels } = req.body;

    if (!code || !label || !description)
      return res
        .status(400)
        .json({ success: false, message: "Main method fields are required" });

    let subChannelsArray = [];
    try {
      if (subChannels) {
        subChannelsArray =
          typeof subChannels === "string"
            ? JSON.parse(subChannels)
            : subChannels;
      }
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subChannels format" });
    }

    const mainIcon = req.files?.icon?.[0]
      ? `/uploads/payment-icons/${req.files.icon[0].filename}`
      : null;

    const subIconsFiles = req.files?.subIcons || [];
    subChannelsArray = subChannelsArray.map((sub, idx) => ({
      ...sub,
      icon: subIconsFiles[idx]
        ? `/uploads/payment-icons/${subIconsFiles[idx].filename}`
        : sub.icon || null,
    }));

    try {
      // Upsert main payment method
      const { rows: mainRows } = await pool.query(
        `
        INSERT INTO payment_methods (code, label, description, icon, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT (code) DO UPDATE
        SET label = EXCLUDED.label,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            is_active = true
        RETURNING *;
      `,
        [code, label, description, mainIcon]
      );

      const mainMethod = mainRows[0];
      mainMethod.icon = mainMethod.icon
        ? `${BASE_URL}${mainMethod.icon.replace(/\\/g, "/")}`
        : null;

      // Upsert sub-channels
      for (const sub of subChannelsArray) {
        await pool.query(
          `
          INSERT INTO payment_sub_channels (method_code, code, label, description, icon, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, true, NOW())
          ON CONFLICT (code) DO UPDATE
          SET label = EXCLUDED.label,
              description = EXCLUDED.description,
              icon = EXCLUDED.icon,
              is_active = true;
        `,
          [code, sub.code, sub.label, sub.description || "", sub.icon || null]
        );
      }

      res.json({
        success: true,
        method: mainMethod,
        subChannels: subChannelsArray,
        message: "Payment method saved successfully.",
      });
    } catch (err) {
      console.error("Failed to save payment method:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Failed to save payment method" });
    }
  }
);

// -------------------- DELIVERY DETAILS --------------------
router.get("/delivery-details", protect, async (req, res) => {
  try {
    const { id, name, email, address, phone } = req.user;
    res.json({ success: true, data: { id, name, email, address, phone } });
  } catch (err) {
    console.error("Failed to fetch delivery details:", err.message);
    res.status(500).json({
      success: false,
      data: null,
      message: "Failed to fetch delivery details",
    });
  }
});

router.put("/delivery", protect, async (req, res) => {
  const { id } = req.user;
  const { name, address, phone, email } = req.body;
  if (!name || !address || !phone || !email)
    return res
      .status(400)
      .json({ success: false, message: "All fields required" });

  try {
    const { rowCount } = await pool.query(
      `
      UPDATE users
      SET name=$1, address=$2, phone=$3, email=$4, updated_at=NOW()
      WHERE id=$5 AND is_active = true
    `,
      [name, address, phone, email, id]
    );

    if (!rowCount)
      return res
        .status(404)
        .json({ success: false, message: "User not found or inactive" });

    res.json({
      success: true,
      message: "Delivery details updated successfully",
      data: { name, address, phone, email },
    });
  } catch (err) {
    console.error("Failed to update delivery details:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to update delivery details" });
  }
});

module.exports = router;
