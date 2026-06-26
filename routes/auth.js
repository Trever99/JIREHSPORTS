// routes/auth.js
// Login endpoints for Admin, Partner (Pharmacy), and Assessor

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../database/db");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

async function ensureDefaultAdminAccount() {
  const adminUsername = process.env.ADMIN_USERNAME || "Demo";
  const adminPassword = process.env.ADMIN_PASSWORD || "1234";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const existing = await pool.query(
    "SELECT id, username, password_hash FROM admins WHERE username = $1",
    [adminUsername]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE admins SET password_hash = $1 WHERE username = $2",
      [passwordHash, adminUsername]
    );
    return { username: adminUsername, password_hash: passwordHash };
  }

  const created = await pool.query(
    "INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username, password_hash",
    [adminUsername, passwordHash]
  );

  return created.rows[0];
}

async function ensureDefaultPartnerAccount() {
  const email = process.env.DEMO_PARTNER_EMAIL || "demo@partner.jireh.com";
  const clinicName = process.env.DEMO_PARTNER_CLINIC || "Demo Partner";
  const passwordHash = await bcrypt.hash(process.env.DEMO_PARTNER_PASSWORD || "1234", 12);

  const existing = await pool.query(
    "SELECT id, email, password_hash FROM partners WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE partners SET password_hash = $1, clinic_name = $2, is_active = true WHERE email = $3",
      [passwordHash, clinicName, email]
    );
    return { email, password_hash: passwordHash };
  }

  const created = await pool.query(
    "INSERT INTO partners (clinic_name, email, password_hash, token_balance, is_active) VALUES ($1, $2, $3, 0, true) RETURNING id, clinic_name, email, password_hash",
    [clinicName, email, passwordHash]
  );

  return created.rows[0];
}

async function ensureDefaultAssessorAccount() {
  const email = process.env.DEMO_ASSESSOR_EMAIL || "demo@jireh.com";
  const name = process.env.DEMO_ASSESSOR_NAME || "Demo Assessor";
  const passwordHash = await bcrypt.hash(process.env.DEMO_ASSESSOR_PASSWORD || "1234", 12);

  const existing = await pool.query(
    "SELECT id, email, password_hash FROM assessors WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE assessors SET password_hash = $1, name = $2, is_active = true WHERE email = $3",
      [passwordHash, name, email]
    );
    return { email, password_hash: passwordHash };
  }

  const created = await pool.query(
    "INSERT INTO assessors (name, email, password_hash, is_active) VALUES ($1, $2, $3, true) RETURNING id, name, email, password_hash",
    [name, email, passwordHash]
  );

  return created.rows[0];
}

async function ensureDefaultAccounts() {
  try {
    await ensureDefaultAdminAccount();
    await ensureDefaultPartnerAccount();
    await ensureDefaultAssessorAccount();
  } catch (err) {
    console.error("❌ Failed to ensure default demo accounts:", err);
  }
}

ensureDefaultAccounts();

// ============================================================
// POST /api/auth/admin/login
// ============================================================
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("LOGIN BODY:", req.body);// thiw...

  if (!username || !password) return res.status(400).json({ error: "Username and password required." });

  try {
    const adminUsername = process.env.ADMIN_USERNAME || "Demo";
    let result = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);

    if (result.rows.length === 0 && (username === adminUsername || username === "admin" || username === "Demo")) {
      await ensureDefaultAdminAccount();
      result = await pool.query("SELECT * FROM admins WHERE username = $1", [adminUsername]);
    }

    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: admin.id, role: "admin", username: admin.username });
    res.json({ token, role: "admin", username: admin.username });

  } catch (err) {
  console.error("🔥 LOGIN ERROR:", err); // 👈 ADD THIS LINE

  res.status(500).json({
    error: err.message || "Server error."
  });
}
});

// ============================================================
// POST /api/auth/partner/login
// ============================================================
router.post("/partner/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  try {
    let result = await pool.query("SELECT * FROM partners WHERE email = $1 AND is_active = true", [email]);
    if (result.rows.length === 0 && (email === "demo@partner.jireh.com" || email === "demo")) {
      await ensureDefaultPartnerAccount();
      result = await pool.query("SELECT * FROM partners WHERE email = $1 AND is_active = true", [email]);
    }
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const partner = result.rows[0];
    const valid = await bcrypt.compare(password, partner.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: partner.id, role: "partner", clinicName: partner.clinic_name });
    res.json({
      token,
      role: "partner",
      clinicName: partner.clinic_name,
      tokenBalance: partner.token_balance,
    });

  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// POST /api/auth/assessor/login
// ============================================================
router.post("/assessor/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  try {
    let result = await pool.query("SELECT * FROM assessors WHERE email = $1 AND is_active = true", [email]);
    if (result.rows.length === 0 && (email === "demo@jireh.com" || email === "demo")) {
      await ensureDefaultAssessorAccount();
      result = await pool.query("SELECT * FROM assessors WHERE email = $1 AND is_active = true", [email]);
    }
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

    const assessor = result.rows[0];
    const valid = await bcrypt.compare(password, assessor.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = signToken({ id: assessor.id, role: "assessor", name: assessor.name });
    res.json({ token, role: "assessor", name: assessor.name });

  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
