-- ==========================
-- Usuários
-- ==========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','FUNCIONARIO','PATOLOGISTA')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- Convênios
-- ==========================
CREATE TABLE IF NOT EXISTS convenios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

INSERT INTO convenios (nome) VALUES ('PARTICULAR'), ('SUS'), ('PLANO A')
ON CONFLICT (nome) DO NOTHING;

-- ==========================
-- Pacientes
-- ==========================
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT,
  birthdate DATE,
  convenio_id INTEGER REFERENCES convenios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (lower(name));

-- ==========================
-- Exames
-- PRIORIDADE:
--   1 = Emergência (vermelho claro)
--   2 = Muito urgente (laranja claro)
--   3 = Urgente (amarelo claro)
--   4 = Rotina (verde claro)
-- ==========================
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 4 CHECK (priority IN (1,2,3,4)),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Campos para controle do preparo
  prep_laminas INT,
  prep_responsavel TEXT,
  prep_started_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exams_patient ON exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_exams_priority ON exams(priority);

-- ==========================
-- Etapas dos exames
-- ==========================
CREATE TABLE IF NOT EXISTS exam_steps (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDENTE','EM_PREPARO_INICIAL','CONCLUIDO')) DEFAULT 'PENDENTE',
  responsible_id INTEGER REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_steps_exam ON exam_steps(exam_id);

-- MÓDULO IV – BANDEJA DO DIA
-- Prioridade: 1=Emergência, 2=Muito urgente, 3=Urgente, 4=Rotina
CREATE TABLE IF NOT EXISTS exam_tray (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  priority SMALLINT NOT NULL DEFAULT 4 CHECK (priority IN (1,2,3,4)),
  note TEXT,
  added_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evita duplicar o mesmo exame na bandeja do mesmo dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_tray_exam_day
  ON exam_tray (exam_id, (created_at::date));
