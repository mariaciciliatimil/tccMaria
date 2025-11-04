// backend/src/routes/patients.js
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Helper: manter só dígitos
const onlyDigits = (s = '') => String(s).replace(/\D+/g, '');

// ==============================
// CONVÊNIOS (apoio ao formulário)
// ==============================
router.get('/convenios', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome
         FROM convenios
        ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /patients/convenios', e);
    res.status(500).json({ error: 'erro_listar_convenios' });
  }
});

// ============================================
// BUSCA: nome (>=2) OU CPF (11 dígitos exatos)
// ============================================
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const digits = onlyDigits(q);
    if (digits.length === 11) {
      const { rows } = await query(
        `SELECT id, name, document AS cpf, phone, birthdate, convenio_id
           FROM patients
          WHERE document = $1
          ORDER BY id DESC
          LIMIT 5`,
        [digits]
      );
      return res.json(rows);
    }

    if (q.length < 2) return res.json([]);

    const { rows } = await query(
      `SELECT id, name, document AS cpf, phone, birthdate, convenio_id
         FROM patients
        WHERE lower(name) LIKE lower($1)
        ORDER BY name
        LIMIT 20`,
      [`%${q}%`]
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /patients/search', e);
    res.status(500).json({ error: 'erro_busca_pacientes' });
  }
});

// ==============================
// LISTAGEM (compatibilidade)
//   - /patients               (ultimos 50)
//   - /patients?patient_id=id (1 paciente)
// ==============================
router.get('/', async (req, res) => {
  try {
    const { patient_id } = req.query;
    if (patient_id) {
      const r = await query(
        `SELECT id, name, document AS cpf, phone, birthdate, convenio_id, created_at
           FROM patients
          WHERE id = $1`,
        [Number(patient_id)]
      );
      return res.json(r.rows);
    }
    const r = await query(
      `SELECT id, name, document AS cpf, phone, birthdate, convenio_id, created_at
         FROM patients
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 50`
    );
    res.json(r.rows);
  } catch (e) {
    console.error('GET /patients', e);
    res.status(500).json({ error: 'erro_listar_pacientes' });
  }
});

// ==============================
// DETALHE POR ID (compatibilidade)
// ==============================
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT id, name, document AS cpf, phone, birthdate, convenio_id, created_at
         FROM patients
        WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'paciente_nao_encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('GET /patients/:id', e);
    res.status(500).json({ error: 'erro_detalhe_paciente' });
  }
});

// ==============================
// CRIAR PACIENTE (com CPF/telefone)
// ==============================
router.post('/', async (req, res) => {
  try {
    let { name, cpf, phone, birthdate, convenio_id } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'nome_obrigatorio' });
    }

    cpf = cpf ? onlyDigits(cpf) : null;
    if (cpf && cpf.length !== 11) {
      return res.status(400).json({ error: 'cpf_invalido' });
    }

    phone = phone ? onlyDigits(phone) : null;

    // evita duplicar CPF
    if (cpf) {
      const exists = await query(
        `SELECT id FROM patients WHERE document = $1 LIMIT 1`,
        [cpf]
      );
      if (exists.rowCount) {
        return res.status(409).json({ error: 'cpf_ja_cadastrado', id: exists.rows[0].id });
      }
    }

    const { rows } = await query(
      `INSERT INTO patients (name, document, phone, birthdate, convenio_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, document AS cpf, phone, birthdate, convenio_id, created_at`,
      [name.trim(), cpf, phone, birthdate || null, convenio_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('POST /patients', e);
    res.status(500).json({ error: 'erro_criar_paciente' });
  }
});

// ==============================
// ATUALIZAR PACIENTE
// ==============================
router.put('/:id(\\d+)', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let { name, cpf, phone, birthdate, convenio_id } = req.body || {};

    cpf = cpf ? onlyDigits(cpf) : null;
    if (cpf && cpf.length !== 11) {
      return res.status(400).json({ error: 'cpf_invalido' });
    }
    phone = phone ? onlyDigits(phone) : null;

    const { rows } = await query(
      `UPDATE patients
          SET name        = COALESCE($1, name),
              document    = $2,
              phone       = $3,
              birthdate   = $4,
              convenio_id = $5
        WHERE id = $6
        RETURNING id, name, document AS cpf, phone, birthdate, convenio_id, created_at`,
      [name?.trim() ?? null, cpf, phone, birthdate || null, convenio_id || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'paciente_nao_encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('PUT /patients/:id', e);
    res.status(500).json({ error: 'erro_atualizar_paciente' });
  }
});

export default router;
