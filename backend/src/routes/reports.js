// routes/reports.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* ======================
 * Utils
 * ====================== */

/** Descobre colunas existentes de uma tabela no schema public */
async function getColumns(table) {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `;
  const { rows } = await pool.query(q, [table]);
  return new Set(rows.map(r => r.column_name));
}

/** Procura uma coluna de "tipo de exame" por nomes comuns e, se não achar, via regex em colunas de texto */
async function resolveTypeColumn() {
  // 1) candidatos mais comuns
  const candidates = [
    'tipo_exame','tipo','exam_type','tipoexame','tipo_do_exame',
    'tipodeexame','exame_tipo','categoria_exame','categoria',
    'classificacao','nome_exame','tipo_nome','nome_tipo','tipo_anatomico'
  ];

  // Verifica rapidamente se alguma delas existe
  const qExist = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'exams'
      AND column_name = ANY($1::text[])
    LIMIT 1
  `;
  const { rows: r1 } = await pool.query(qExist, [candidates]);
  if (r1.length) return r1[0].column_name;

  // 2) fallback: qualquer coluna de TEXTO contendo palavras-chave
  const qRegex = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'exams'
      AND data_type IN ('character varying','text')
      AND (
        column_name ILIKE '%tipo%' OR
        column_name ILIKE '%type%' OR
        column_name ILIKE '%exame%' OR
        column_name ILIKE '%exam%'
      )
    ORDER BY ordinal_position
    LIMIT 1
  `;
  const { rows: r2 } = await pool.query(qRegex);
  if (r2.length) return r2[0].column_name;

  return null; // não encontrado
}

/** Builder simples de WHERE com parâmetros numerados ($1, $2...) */
function SqlBuilder() {
  this.where = [];
  this.params = [];
  this.add = (clause, value) => {
    this.params.push(value);
    this.where.push(clause.replace('$idx', `$${this.params.length}`));
  };
  this.build = () => (this.where.length ? `WHERE ${this.where.join(' AND ')}` : '');
}

/* ======================
 * Endpoints de diagnóstico (schema)
 * ====================== */

router.get('/patients/schema', async (_req, res) => {
  try {
    const q = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'patients'
      ORDER BY ordinal_position
    `;
    const { rows } = await pool.query(q);
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM patients');
    res.json({ table: 'patients', columns: rows, total_rows: count.rows[0].n });
  } catch (err) {
    console.error('reports/patients/schema error:', err);
    res.status(500).json({ error: 'schema patients', detail: err.message });
  }
});

router.get('/exams/schema', async (_req, res) => {
  try {
    const q = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'exams'
      ORDER BY ordinal_position
    `;
    const { rows } = await pool.query(q);
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM exams');
    res.json({ table: 'exams', columns: rows, total_rows: count.rows[0].n });
  } catch (err) {
    console.error('reports/exams/schema error:', err);
    res.status(500).json({ error: 'schema exams', detail: err.message });
  }
});

/* ======================
 * Relatório: Pacientes
 * GET /reports/patients
 * Filtros: ?q=texto&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aliases estáveis: nome, cpf, telefone, created_at
 * ====================== */
router.get('/patients', async (req, res) => {
  try {
    const cols = await getColumns('patients');

    const nameCol   = cols.has('nome') ? 'nome' : (cols.has('name') ? 'name' : null);
    const cpfCol    = cols.has('cpf') ? 'cpf'
                     : (cols.has('documento') ? 'documento'
                     : (cols.has('doc') ? 'doc' : null));
    const phoneCol  = cols.has('telefone') ? 'telefone'
                     : (cols.has('phone') ? 'phone'
                     : (cols.has('telefone_celular') ? 'telefone_celular' : null));
    const createdCol =
      cols.has('created_at') ? 'created_at'
      : (cols.has('createdat') ? 'createdat'
      : (cols.has('data_cadastro') ? 'data_cadastro' : null));

    if (!nameCol) {
      throw new Error('Coluna de nome não encontrada em "patients" (tente "nome" ou "name").');
    }

    const { q, from, to } = req.query;
    const sb = new SqlBuilder();

    if (q) {
      if (cpfCol) {
        sb.add(`(${nameCol} ILIKE $idx OR ${cpfCol} ILIKE $idx)`, `%${q}%`);
      } else {
        sb.add(`${nameCol} ILIKE $idx`, `%${q}%`);
      }
    }
    if (from && createdCol) sb.add(`${createdCol}::date >= $idx`, from);
    if (to && createdCol)   sb.add(`${createdCol}::date <= $idx`, to);

    const sql = `
      SELECT
        id,
        ${nameCol} AS nome,
        ${cpfCol ? `${cpfCol}` : `''`}::text  AS cpf,
        ${phoneCol ? `${phoneCol}` : `''`}::text AS telefone,
        ${createdCol ? `${createdCol}` : `NOW()`}::timestamp AS created_at
      FROM patients
      ${sb.build()}
      ORDER BY ${nameCol} ASC
    `;

    const { rows } = await pool.query(sql, sb.params);
    res.json(rows);
  } catch (err) {
    console.error('reports/patients error:', err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Falha ao gerar relatório de pacientes',
        detail: err.message,
        code: err.code,
      });
    }
    res.status(500).json({ error: 'Falha ao gerar relatório de pacientes' });
  }
});

/* ======================
 * Relatório: Exames (detalhado)
 * GET /reports/exams
 * Filtros: ?status=...&tipo=...&from=YYYY-MM-DD&to=YYYY-MM-DD&q=texto
 * Aliases estáveis: paciente, tipo_exame, status, prioridade, created_at
 * ====================== */
router.get('/exams', async (req, res) => {
  try {
    const eCols = await getColumns('exams');
    const pCols = await getColumns('patients');

    const tipoCol   = await resolveTypeColumn(); // << mais robusto
    const statusCol = eCols.has('status') ? 'status' : null;
    const prioCol   = eCols.has('prioridade') ? 'prioridade' : null;
    const createdCol =
      eCols.has('created_at') ? 'created_at'
      : (eCols.has('createdat') ? 'createdat'
      : (eCols.has('data') ? 'data' : null));

    const patientIdCol =
      eCols.has('patient_id') ? 'patient_id'
      : (eCols.has('paciente_id') ? 'paciente_id' : 'patient_id');

    const patientNameCol = pCols.has('nome') ? 'nome' : (pCols.has('name') ? 'name' : null);
    if (!patientNameCol) {
      throw new Error('Coluna de nome do paciente não encontrada em "patients" (tente "nome" ou "name").');
    }

    const { status, tipo, from, to, q } = req.query;
    const sb = new SqlBuilder();

    if (status && statusCol) sb.add(`e.${statusCol} = $idx`, status);
    if (tipo && tipoCol)     sb.add(`e.${tipoCol} = $idx`, tipo); // só filtra se encontrou a coluna
    if (from && createdCol)  sb.add(`e.${createdCol}::date >= $idx`, from);
    if (to && createdCol)    sb.add(`e.${createdCol}::date <= $idx`, to);
    if (q) {
      if (tipoCol) {
        sb.add(`(p.${patientNameCol} ILIKE $idx OR e.${tipoCol} ILIKE $idx)`, `%${q}%`);
      } else {
        sb.add(`(p.${patientNameCol} ILIKE $idx)`, `%${q}%`);
      }
    }

    const sql = `
      SELECT
        e.id,
        p.${patientNameCol} AS paciente,
        ${tipoCol ? `e.${tipoCol}` : `NULL`}::text AS tipo_exame,
        ${statusCol ? `e.${statusCol}` : `NULL`}::text AS status,
        ${prioCol ? `e.${prioCol}` : `NULL`}::int AS prioridade,
        ${createdCol ? `e.${createdCol}` : `NOW()`}::timestamp AS created_at
      FROM exams e
      JOIN patients p ON p.id = e.${patientIdCol}
      ${sb.build()}
      ORDER BY ${createdCol ? `e.${createdCol}` : 'e.id'} DESC
    `;

    const { rows } = await pool.query(sql, sb.params);
    res.json(rows);
  } catch (err) {
    console.error('reports/exams error:', err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Falha ao gerar relatório de exames',
        detail: err.message,
        code: err.code,
      });
    }
    res.status(500).json({ error: 'Falha ao gerar relatório de exames' });
  }
});

/* ======================
 * Relatório Mensal: Exames por mês
 * GET /reports/exams/monthly
 * Filtros: ?year=2025&status=CONCLUIDO&tipo=ONCOTICA&from=YYYY-MM&to=YYYY-MM
 * ====================== */
router.get('/exams/monthly', async (req, res) => {
  try {
    const eCols = await getColumns('exams');

    const createdCol =
      eCols.has('created_at') ? 'created_at' :
      (eCols.has('createdat') ? 'createdat' :
      (eCols.has('data') ? 'data' : null));

    if (!createdCol) {
      return res.status(400).json({
        error: 'Coluna de data do exame não encontrada em "exams" (tente created_at/createdat/data).'
      });
    }

    const tipoCol   = await resolveTypeColumn(); // << mais robusto
    const statusCol = eCols.has('status') ? 'status' : null;

    const { year, status, tipo, from, to } = req.query;
    const sb = new SqlBuilder();

    if (year) sb.add(`DATE_PART('year', ${createdCol}) = $idx`, Number(year));
    if (from) sb.add(`to_char(${createdCol}, 'YYYY-MM') >= $idx`, from);
    if (to)   sb.add(`to_char(${createdCol}, 'YYYY-MM') <= $idx`, to);
    if (status && statusCol) sb.add(`${statusCol} = $idx`, status);
    if (tipo && tipoCol)     sb.add(`${tipoCol} = $idx`, tipo); // só filtra se encontrou

    const sql = `
      SELECT
        to_char(date_trunc('month', ${createdCol}), 'YYYY-MM') AS month,
        COUNT(*)::int AS total
      FROM exams
      ${sb.build()}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const { rows } = await pool.query(sql, sb.params);
    res.json(rows);
  } catch (err) {
    console.error('reports/exams/monthly error:', err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Falha ao gerar relatório mensal de exames',
        detail: err.message,
        code: err.code,
      });
    }
    res.status(500).json({ error: 'Falha ao gerar relatório mensal de exames' });
  }
});

/* ======================
 * Relatório: Exames por TIPO (para gráfico pizza)
 * GET /reports/exams/by-type
 * Filtros: ?year=2025&status=CONCLUIDO&from=YYYY-MM&to=YYYY-MM
 * ====================== */
router.get('/exams/by-type', async (req, res) => {
  try {
    const eCols = await getColumns('exams');

    const tipoCol = await resolveTypeColumn(); // << mais robusto
    if (!tipoCol) {
      return res.status(400).json({ error: 'Coluna do tipo de exame não encontrada (tente renomear ou criar um alias).' });
    }

    const createdCol =
      eCols.has('created_at') ? 'created_at' :
      (eCols.has('createdat') ? 'createdat' :
      (eCols.has('data') ? 'data' : null));
    if (!createdCol) {
      return res.status(400).json({ error: 'Coluna de data do exame não encontrada (created_at/createdat/data).' });
    }

    const statusCol = eCols.has('status') ? 'status' : null;
    const { year, status, from, to } = req.query;
    const sb = new SqlBuilder();

    if (year) sb.add(`DATE_PART('year', ${createdCol}) = $idx`, Number(year));
    if (from) sb.add(`to_char(${createdCol}, 'YYYY-MM') >= $idx`, from);
    if (to)   sb.add(`to_char(${createdCol}, 'YYYY-MM') <= $idx`, to);
    if (status && statusCol) sb.add(`${statusCol} = $idx`, status);

    const sql = `
      SELECT
        COALESCE(${tipoCol}, 'SEM_TIPO') AS type,
        COUNT(*)::int AS total
      FROM exams
      ${sb.build()}
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
    `;
    const { rows } = await pool.query(sql, sb.params);
    res.json(rows);
  } catch (err) {
    console.error('reports/exams/by-type error:', err);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Falha ao gerar relatório por tipo',
        detail: err.message,
        code: err.code,
      });
    }
    res.status(500).json({ error: 'Falha ao gerar relatório por tipo' });
  }
});

export default router;
