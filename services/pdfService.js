const PDFDocument = require("pdfkit");

function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pipePdfResponse(res, filename, buildFn) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  buildFn(doc);
  doc.end();
}

function buildScreeningReport(doc, record, player, partner) {
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#1f2937").text("Jireh Sports Pharmacy Screening Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#4b5563").text(`Generated: ${formatDate(record.created_at)}`);
  doc.text(`Screening ID: ${record.id}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#111827").text("Player Information", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).fillColor("#111827").text(`Name: ${player.name}`);
  doc.text(`Age: ${player.age || "N/A"}`);
  doc.text(`Sport: ${player.position || "N/A"}`);
  doc.text(`Position: ${player.position || "N/A"}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Vitals", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Height: ${record.height_cm || "N/A"} cm`);
  doc.text(`Weight: ${record.weight_kg || "N/A"} kg`);
  doc.text(`Blood Pressure: ${record.systolic}/${record.diastolic} mmHg`);
  doc.text(`Resting Heart Rate: ${record.resting_heart_rate || "N/A"} bpm`);
  doc.text(`Body Composition: ${record.body_composition || "N/A"}%`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Screening Answers", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Pain during training: ${record.pain_level}`);
  doc.text(`Recent dizziness or fainting: ${record.dizziness ? "Yes" : "No"}`);
  doc.text(`Previous injury: ${record.previous_injury}`);
  doc.text(`Currently injured: ${record.currently_injured ? "Yes" : "No"}`);
  doc.text(`On medication: ${record.on_medication ? "Yes" : "No"}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Calculated Results", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`BMI: ${record.bmi || "N/A"} (${record.bmi_category})`);
  doc.text(`Blood Pressure Category: ${record.bp_category}`);
  doc.text(`Heart Rate Category: ${record.hr_category}`);
  doc.text(`Overall Risk Level: ${record.risk_level}`);
  doc.text(`Recommendation: ${record.recommendation}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Pharmacy Notes", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(record.notes || "None provided.", { align: "justify" });
  doc.moveDown(1);

  doc.fontSize(10).fillColor("#6b7280").text("Disclaimer: This screening is not a medical diagnosis. Consult a qualified medical professional for further evaluation.");
  doc.moveDown(0.75);

  doc.fontSize(10).fillColor("#111827").text(`Partner: ${partner.clinic_name}`);
}

function buildAssessmentReport(doc, record, player, assessor) {
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#1f2937").text("Jireh Sports Coach Assessment Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#4b5563").text(`Generated: ${formatDate(record.created_at)}`);
  doc.text(`Assessment ID: ${record.id}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#111827").text("Player & Session Details", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Name: ${player.name}`);
  doc.text(`Age: ${player.age || "N/A"}`);
  doc.text(`Position: ${player.position || "N/A"}`);
  doc.text(`Session Type: ${record.session_type}`);
  doc.text(`Session Date: ${record.session_date}`);
  doc.text(`Opponent: ${record.opponent || "N/A"}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Ratings Summary", { underline: true });
  doc.moveDown(0.25);
  const ratingFields = [
    { label: "First Touch", value: record.first_touch },
    { label: "Weak Foot", value: record.weak_foot },
    { label: "Passing", value: record.passing },
    { label: "Dribbling", value: record.dribbling },
    { label: "Scanning", value: record.scanning },
    { label: "Positioning", value: record.positioning },
    { label: "Decision Making", value: record.decision_making },
    { label: "Pressing", value: record.pressing },
    { label: "Recovery Runs", value: record.recovery_runs },
    { label: "Aggression", value: record.aggression },
    { label: "Leadership", value: record.leadership },
    { label: "Reaction to Mistakes", value: record.reaction_to_mistakes },
    { label: "Composure", value: record.composure },
    { label: "Timing of Runs", value: record.timing_of_runs },
    { label: "Creating Space", value: record.creating_space },
    { label: "Body Orientation", value: record.body_orientation },
    { label: "Tackling", value: record.tackling },
    { label: "Interceptions", value: record.interceptions },
    { label: "Aerial Duels", value: record.aerial_duels },
    { label: "Crossing", value: record.crossing },
    { label: "Learning Speed", value: record.learning_speed },
    { label: "Response to Instructions", value: record.response_to_instructions },
    { label: "Attitude", value: record.attitude },
  ];

  ratingFields.forEach((item) => {
    doc.fontSize(11).text(`${item.label}: ${item.value || "N/A"}`);
  });
  doc.moveDown(0.75);

  doc.fontSize(14).text("Optional Physical Metrics", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Top Speed: ${record.top_speed || "N/A"} km/h`);
  doc.text(`Distance Covered: ${record.distance_covered || "N/A"} km`);
  doc.text(`High Intensity Sprints: ${record.high_intensity_sprints || "N/A"}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Auto Summary", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Average Rating: ${record.average_rating || "N/A"}`);
  doc.text(`Top Strengths: ${record.top_strengths || "N/A"}`);
  doc.text(`Weak Areas: ${record.bottom_weaknesses || "N/A"}`);
  doc.moveDown(0.75);

  doc.fontSize(14).text("Coach Notes", { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(11).text(record.coach_notes || "None provided.", { align: "justify" });
  doc.moveDown(1);

  doc.fontSize(10).fillColor("#6b7280").text("Disclaimer: This assessment is a coaching observation and is not a medical diagnosis. Consult a qualified professional for medical or injury evaluation.");
  doc.moveDown(0.75);

  doc.fontSize(10).fillColor("#111827").text(`Assessor: ${assessor.name}`);
}

module.exports = {
  pipePdfResponse,
  buildScreeningReport,
  buildAssessmentReport,
};
