CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','FUNCIONARIO','PATOLOGISTA')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS convenios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);
INSERT INTO convenios (nome) VALUES ('PARTICULAR'), ('SUS'), ('PLANO A')
ON CONFLICT (nome) DO NOTHING;
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT,
  birthdate DATE,
  convenio_id INTEGER REFERENCES convenios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (lower(name));
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id);
CREATE TABLE IF NOT EXISTS exam_steps (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  responsible_id INTEGER REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_steps_exam ON exam_steps(exam_id);
