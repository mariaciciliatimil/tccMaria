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
-- PRIORIDADE: 1=Emergência, 2=Muito urgente, 3=Urgente, 4=Rotina
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

CREATE INDEX IF NOT EXISTS idx_exams_patient  ON exams(patient_id);
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

-- ==========================
-- MÓDULO IV – BANDEJA DO DIA (FILA DO PATOLOGISTA)
-- Estados: NA_FILA, EM_ANALISE, CONCLUIDO
-- ==========================
CREATE TABLE IF NOT EXISTS exam_tray (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  priority SMALLINT NOT NULL DEFAULT 4 CHECK (priority IN (1,2,3,4)),
  note TEXT,
  added_by INT REFERENCES users(id) ON DELETE SET NULL,            -- quem adicionou
  tray_status TEXT NOT NULL DEFAULT 'NA_FILA'
    CHECK (tray_status IN ('NA_FILA','EM_ANALISE','CONCLUIDO')),
  pathologist_id INT REFERENCES users(id) ON DELETE SET NULL,      -- quem analisou
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evita duplicar o mesmo exame na bandeja do mesmo dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_tray_exam_day
  ON exam_tray (exam_id, (created_at::date));

-- Índices úteis para a fila
CREATE INDEX IF NOT EXISTS idx_exam_tray_status       ON exam_tray(tray_status);
CREATE INDEX IF NOT EXISTS idx_exam_tray_priority     ON exam_tray(priority);
CREATE INDEX IF NOT EXISTS idx_exam_tray_created_day  ON exam_tray((created_at::date));

-- Índices adicionais (aceleram /patologista/meus e /patologista/fila)
CREATE INDEX IF NOT EXISTS idx_exam_tray_meus
  ON exam_tray (pathologist_id, tray_status, started_at);
CREATE INDEX IF NOT EXISTS idx_exam_tray_status_day
  ON exam_tray (tray_status, (created_at::date));

-- ==========================
-- VIEW (opcional) – Fila de hoje com aliases em PT-BR
-- ==========================
CREATE OR REPLACE VIEW pathologist_queue_today AS
SELECT
  t.id              AS bandeja_id,
  t.exam_id         AS exame_id,
  t.priority        AS prioridade,
  t.note            AS observacao,
  t.tray_status     AS status_bandeja,
  t.pathologist_id  AS patologista_id,
  t.started_at      AS iniciado_em,
  t.finished_at     AS concluido_em,
  t.created_at      AS adicionado_em,
  e.type            AS tipo_exame,
  p.name            AS paciente
FROM exam_tray t
JOIN exams    e ON e.id = t.exam_id
JOIN patients p ON p.id = e.patient_id
WHERE t.tray_status = 'NA_FILA'
  AND t.created_at::date = CURRENT_DATE
ORDER BY t.priority ASC, t.created_at ASC;
