require("dotenv").config();
const dns = require("dns");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
  };
}

const pool = new Pool({
  ...parseDatabaseUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  family: 4,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log("Setting up Jireh Sports database...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        clinic_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        token_balance INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Partners table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        temp_id VARCHAR(20) UNIQUE,
        official_id VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        city VARCHAR(100) NOT NULL,
        position VARCHAR(50) NOT NULL,
        email VARCHAR(150) NOT NULL,
        whatsapp VARCHAR(30) NOT NULL,
        parent_email VARCHAR(150),
        status VARCHAR(20) DEFAULT 'Pending',
        fitness_grade VARCHAR(20),
        last_tested_date TIMESTAMP,
        height_cm DECIMAL(5,1),
        weight_kg DECIMAL(5,1),
        blood_pressure VARCHAR(20),
        sprint_40m DECIMAL(5,2),
        vertical_jump_cm DECIMAL(5,1),
        assessor_notes TEXT,
        verified_by INTEGER REFERENCES partners(id),
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Players table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES partners(id),
        change_amount INTEGER NOT NULL,
        reason VARCHAR(100),
        player_id INTEGER REFERENCES players(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Token transactions table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_screenings (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
        height_cm DECIMAL(5,1) NOT NULL,
        weight_kg DECIMAL(5,1) NOT NULL,
        systolic INTEGER NOT NULL,
        diastolic INTEGER NOT NULL,
        resting_heart_rate INTEGER NOT NULL,
        body_composition DECIMAL(5,2),
        pain_level VARCHAR(20) NOT NULL,
        dizziness BOOLEAN NOT NULL,
        previous_injury VARCHAR(50) NOT NULL,
        currently_injured BOOLEAN NOT NULL,
        on_medication BOOLEAN NOT NULL,
        bmi DECIMAL(5,2),
        bmi_category VARCHAR(20),
        bp_category VARCHAR(20),
        hr_category VARCHAR(20),
        risk_level VARCHAR(20),
        recommendation VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Pharmacy screenings table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS coach_assessments (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        assessor_id INTEGER REFERENCES assessors(id) ON DELETE SET NULL,
        session_type VARCHAR(30) NOT NULL,
        session_date DATE NOT NULL,
        opponent VARCHAR(150),
        first_touch INTEGER,
        weak_foot INTEGER,
        passing INTEGER,
        dribbling INTEGER,
        scanning INTEGER,
        positioning INTEGER,
        decision_making INTEGER,
        top_speed DECIMAL(6,2),
        distance_covered DECIMAL(6,2),
        high_intensity_sprints INTEGER,
        pressing INTEGER,
        recovery_runs INTEGER,
        aggression INTEGER,
        leadership INTEGER,
        reaction_to_mistakes INTEGER,
        composure INTEGER,
        timing_of_runs INTEGER,
        creating_space INTEGER,
        body_orientation INTEGER,
        tackling INTEGER,
        interceptions INTEGER,
        aerial_duels INTEGER,
        shots_on_target INTEGER,
        xg_created DECIMAL(6,2),
        crossing INTEGER,
        learning_speed INTEGER,
        response_to_instructions INTEGER,
        attitude INTEGER,
        average_rating DECIMAL(4,2),
        top_strengths TEXT,
        bottom_weaknesses TEXT,
        coach_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Coach assessments table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS assessors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Assessors table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        dates VARCHAR(100) NOT NULL,
        location VARCHAR(200) NOT NULL,
        registration_fee VARCHAR(50) DEFAULT '$15 USD',
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Events table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        to_email VARCHAR(150) NOT NULL,
        subject VARCHAR(250) NOT NULL,
        type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        success BOOLEAN DEFAULT true
      );
    `);
    console.log("Email logs table created");

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Admins table created");

    const adminUsername = process.env.ADMIN_USERNAME || "Demo";
    const adminPassword = process.env.ADMIN_PASSWORD || "1234";
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await client.query(`
      INSERT INTO admins (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [adminUsername, adminHash]);
    console.log("Admin account seeded");

    const partnerHash = await bcrypt.hash("pharmacy123", 12);
    const demoPartnerHash = await bcrypt.hash(process.env.DEMO_PARTNER_PASSWORD || "1234", 12);
    await client.query(`
      INSERT INTO partners (clinic_name, email, password_hash, token_balance)
      VALUES
        ('Avenues Pharmacy', 'avenues@partner.jireh.com', $1, 8),
        ('CityMed Clinic', 'citymed@partner.jireh.com', $1, 3),
        ('BulaCare Health', 'bulacare@partner.jireh.com', $1, 0),
        ('Demo Partner', 'demo@partner.jireh.com', $2, 0)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, clinic_name = EXCLUDED.clinic_name, is_active = true;
    `, [partnerHash, demoPartnerHash]);
    console.log("Sample pharmacies seeded");

    const assessorHash = await bcrypt.hash("assessor123", 12);
    const demoAssessorHash = await bcrypt.hash(process.env.DEMO_ASSESSOR_PASSWORD || "1234", 12);
    await client.query(`
      INSERT INTO assessors (name, email, password_hash)
      VALUES ('Coach Jireh', 'coach@jireh.com', $1), ('Demo Assessor', 'demo@jireh.com', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, is_active = true;
    `, [assessorHash, demoAssessorHash]);
    console.log("Sample assessor seeded");

    await client.query(`
      INSERT INTO events (title, dates, location, registration_fee)
      VALUES
        ('Harare Pop-Up Combine', 'Feb 28 - Mar 2, 2026', 'Rufaro Stadium, Harare', '$15 USD'),
        ('Bulawayo Talent Assessment', 'Mar 14-16, 2026', 'Barbourfields Stadium', '$15 USD'),
        ('Mutare Highland Combine', 'Apr 4-6, 2026', 'Sakubva Stadium, Mutare', '$10 USD')
      ON CONFLICT DO NOTHING;
    `);
    console.log("Sample events seeded");

    console.log("\nDatabase setup complete! Run: npm run dev\n");

  } catch (err) {
    console.error("Database setup error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();

