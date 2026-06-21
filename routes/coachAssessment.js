const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const { authenticate, requireAssessor } = require("../middleware/auth");
const { pipePdfResponse, buildAssessmentReport } = require("../services/pdfService");

const ratingFields = [
  { key: "first_touch", label: "First Touch" },
  { key: "weak_foot", label: "Weak Foot" },
  { key: "passing", label: "Passing" },
  { key: "dribbling", label: "Dribbling" },
  { key: "scanning", label: "Scanning" },
  { key: "positioning", label: "Positioning" },
  { key: "decision_making", label: "Decision Making" },
  { key: "pressing", label: "Pressing" },
  { key: "recovery_runs", label: "Recovery Runs" },
  { key: "aggression", label: "Aggression" },
  { key: "leadership", label: "Leadership" },
  { key: "reaction_to_mistakes", label: "Reaction to Mistakes" },
  { key: "composure", label: "Composure" },
  { key: "timing_of_runs", label: "Timing of Runs" },
  { key: "creating_space", label: "Creating Space" },
  { key: "body_orientation", label: "Body Orientation" },
  { key: "tackling", label: "Tackling" },
  { key: "interceptions", label: "Interceptions" },
  { key: "aerial_duels", label: "Aerial Duels" },
  { key: "crossing", label: "Crossing" },
  { key: "learning_speed", label: "Learning Speed" },
  { key: "response_to_instructions", label: "Response to Instructions" },
  { key: "attitude", label: "Attitude" },
];

function averageRating(values) {
  if (!values.length) return null;
  const total = values.reduce((sum, next) => sum + next, 0);
  return Number((total / values.length).toFixed(1));
}

function normalizeValue(value) {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

router.post("/assessments", authenticate, requireAssessor, async (req, res) => {
  const {
    playerId,
    sessionType,
    sessionDate,
    opponent,
    firstTouch,
    weakFoot,
    passing,
    dribbling,
    scanning,
    positioning,
    decisionMaking,
    topSpeed,
    distanceCovered,
    highIntensitySprints,
    pressing,
    recoveryRuns,
    aggression,
    leadership,
    reactionToMistakes,
    composure,
    timingOfRuns,
    creatingSpace,
    bodyOrientation,
    tackling,
    interceptions,
    aerialDuels,
    shotsOnTarget,
    xgCreated,
    crossing,
    learningSpeed,
    responseToInstructions,
    attitude,
    coachNotes,
  } = req.body;

  if (!playerId || !sessionType || !sessionDate) {
    return res.status(400).json({ error: "Player, session type, and date are required." });
  }

  const playerResult = await pool.query("SELECT id, name, position, dob FROM players WHERE id = $1", [playerId]);
  if (playerResult.rows.length === 0) {
    return res.status(404).json({ error: "Player not found." });
  }

  const ratingValues = ratingFields.map((field) => normalizeValue(req.body[field.key]));
  const average_rating = averageRating(ratingValues);
  const entries = ratingFields.map((field, index) => ({ label: field.label, value: ratingValues[index] }));

  const topStrengths = entries
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((item) => `${item.label} (${item.value})`)
    .join(" | ");

  const bottomWeaknesses = entries
    .slice()
    .sort((a, b) => a.value - b.value)
    .slice(0, 3)
    .map((item) => `${item.label} (${item.value})`)
    .join(" | ");

  try {
    const result = await pool.query(
      `INSERT INTO coach_assessments (
        player_id, assessor_id, session_type, session_date, opponent,
        first_touch, weak_foot, passing, dribbling, scanning, positioning,
        decision_making, top_speed, distance_covered, high_intensity_sprints,
        pressing, recovery_runs, aggression, leadership, reaction_to_mistakes,
        composure, timing_of_runs, creating_space, body_orientation,
        tackling, interceptions, aerial_duels, shots_on_target, xg_created,
        crossing, learning_speed, response_to_instructions, attitude,
        average_rating, top_strengths, bottom_weaknesses, coach_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37) RETURNING *`,
      [
        playerId,
        req.user.id,
        sessionType,
        sessionDate,
        opponent || null,
        normalizeValue(firstTouch),
        normalizeValue(weakFoot),
        normalizeValue(passing),
        normalizeValue(dribbling),
        normalizeValue(scanning),
        normalizeValue(positioning),
        normalizeValue(decisionMaking),
        topSpeed ? Number(topSpeed) : null,
        distanceCovered ? Number(distanceCovered) : null,
        highIntensitySprints ? Number(highIntensitySprints) : null,
        normalizeValue(pressing),
        normalizeValue(recoveryRuns),
        normalizeValue(aggression),
        normalizeValue(leadership),
        normalizeValue(reactionToMistakes),
        normalizeValue(composure),
        normalizeValue(timingOfRuns),
        normalizeValue(creatingSpace),
        normalizeValue(bodyOrientation),
        normalizeValue(tackling),
        normalizeValue(interceptions),
        normalizeValue(aerialDuels),
        shotsOnTarget ? Number(shotsOnTarget) : null,
        xgCreated ? Number(xgCreated) : null,
        normalizeValue(crossing),
        normalizeValue(learningSpeed),
        normalizeValue(responseToInstructions),
        normalizeValue(attitude),
        average_rating,
        topStrengths,
        bottomWeaknesses,
        coachNotes || null,
      ]
    );

    res.json({ success: true, assessment: result.rows[0] });
  } catch (err) {
    console.error("Coach assessment error:", err.message);
    res.status(500).json({ error: "Server error saving assessment." });
  }
});

router.get("/assessments/:id/pdf", authenticate, requireAssessor, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.name AS player_name, p.position AS player_position, p.dob, u.name AS assessor_name
       FROM coach_assessments a
       JOIN players p ON p.id = a.player_id
       JOIN assessors u ON u.id = a.assessor_id
       WHERE a.id = $1 AND a.assessor_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assessment record not found." });
    }

    const record = result.rows[0];
    const player = {
      name: record.player_name,
      position: record.player_position,
      age: record.dob ? Math.floor((Date.now() - new Date(record.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null,
    };
    const assessor = { name: record.assessor_name };

    pipePdfResponse(res, `assessment-${record.id}.pdf`, (doc) => buildAssessmentReport(doc, record, player, assessor));
  } catch (err) {
    console.error("Assessment PDF error:", err.message);
    res.status(500).json({ error: "Server error generating PDF." });
  }
});

module.exports = router;
