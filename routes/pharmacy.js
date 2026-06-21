const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const { authenticate, requirePartner } = require("../middleware/auth");
const { pipePdfResponse, buildScreeningReport } = require("../services/pdfService");

function parseBloodPressure(bp) {
  if (!bp) return null;
  const parts = bp.split("/").map(p => parseInt(p.trim(), 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return { systolic: parts[0], diastolic: parts[1] };
}

function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const result = weightKg / ((heightCm / 100) ** 2);
  return Number(result.toFixed(1));
}

function bmiCategory(bmi) {
  if (!bmi) return "Unknown";
  if (bmi < 18.5) return "Under";
  if (bmi < 25) return "Normal";
  return "Over";
}

function bpCategory(systolic, diastolic) {
  if (systolic >= 140 || diastolic >= 90) return "High";
  if (systolic >= 120 || diastolic >= 80) return "Elevated";
  return "Normal";
}

function hrCategory(hr) {
  if (!hr) return "Unknown";
  return hr > 100 ? "Elevated" : "Normal";
}

function riskLevel(systolic, diastolic, dizziness, heartRate, painLevel, currentlyInjured) {
  if (systolic >= 140 || diastolic >= 90 || dizziness) return "HIGH";
  if (heartRate > 100 || painLevel === "Severe" || currentlyInjured) return "MODERATE";
  return "LOW";
}

function recommendation(level) {
  if (level === "HIGH") return "Refer to clinic for further evaluation";
  if (level === "MODERATE") return "Monitor or refer to physiotherapy";
  return "Fit for activity";
}

router.post("/screenings", authenticate, requirePartner, async (req, res) => {
  const {
    playerId,
    heightCm,
    weightKg,
    bloodPressure,
    restingHeartRate,
    bodyComposition,
    painLevel,
    dizziness,
    previousInjury,
    currentlyInjured,
    onMedication,
    notes,
  } = req.body;

  if (!playerId || !heightCm || !weightKg || !bloodPressure || !restingHeartRate || typeof dizziness !== "boolean" || !painLevel || typeof currentlyInjured !== "boolean" || typeof onMedication !== "boolean") {
    return res.status(400).json({ error: "Missing required screening fields." });
  }

  const bp = parseBloodPressure(bloodPressure);
  if (!bp) {
    return res.status(400).json({ error: "Blood pressure must be in the format SYSTOLIC/DIASTOLIC (e.g. 120/80)." });
  }

  const playerResult = await pool.query("SELECT id, name, position, dob FROM players WHERE id = $1", [playerId]);
  if (playerResult.rows.length === 0) {
    return res.status(404).json({ error: "Player not found." });
  }

  const player = playerResult.rows[0];
  const bmi = calcBmi(Number(weightKg), Number(heightCm));
  const bmi_category = bmiCategory(bmi);
  const bp_category = bpCategory(bp.systolic, bp.diastolic);
  const hr_category = hrCategory(Number(restingHeartRate));
  const risk_level = riskLevel(bp.systolic, bp.diastolic, dizziness, Number(restingHeartRate), painLevel, currentlyInjured);
  const recommendationText = recommendation(risk_level);

  try {
    const result = await pool.query(
      `INSERT INTO pharmacy_screenings (
        player_id, partner_id, height_cm, weight_kg, systolic, diastolic,
        resting_heart_rate, body_composition, pain_level, dizziness,
        previous_injury, currently_injured, on_medication, bmi, bmi_category,
        bp_category, hr_category, risk_level, recommendation, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [
        playerId,
        req.user.id,
        Number(heightCm),
        Number(weightKg),
        bp.systolic,
        bp.diastolic,
        Number(restingHeartRate),
        bodyComposition ? Number(bodyComposition) : null,
        painLevel,
        dizziness,
        previousInjury || "None",
        currentlyInjured,
        onMedication,
        bmi,
        bmi_category,
        bp_category,
        hr_category,
        risk_level,
        recommendationText,
        notes || null,
      ]
    );

    res.json({ success: true, screening: result.rows[0] });
  } catch (err) {
    console.error("Pharmacy screening error:", err.message);
    res.status(500).json({ error: "Server error saving screening." });
  }
});

router.get("/screenings/:id", authenticate, requirePartner, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pharmacy_screenings WHERE id = $1 AND partner_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Screening record not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch screening error:", err.message);
    res.status(500).json({ error: "Server error fetching screening." });
  }
});

router.get("/screenings/:id/pdf", authenticate, requirePartner, async (req, res) => {
  try {
    const screeningResult = await pool.query(
      `SELECT s.*, p.name AS player_name, p.position AS player_position, p.dob, par.clinic_name FROM pharmacy_screenings s
       JOIN players p ON p.id = s.player_id
       JOIN partners par ON par.id = s.partner_id
       WHERE s.id = $1 AND s.partner_id = $2`,
      [req.params.id, req.user.id]
    );

    if (screeningResult.rows.length === 0) {
      return res.status(404).json({ error: "Screening record not found." });
    }

    const record = screeningResult.rows[0];
    const player = {
      name: record.player_name,
      position: record.player_position,
      age: record.dob ? Math.floor((Date.now() - new Date(record.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null,
    };
    const partner = { clinic_name: record.clinic_name };

    pipePdfResponse(res, `screening-${record.id}.pdf`, (doc) => buildScreeningReport(doc, record, player, partner));
  } catch (err) {
    console.error("Screening PDF error:", err.message);
    res.status(500).json({ error: "Server error generating PDF." });
  }
});

module.exports = router;
