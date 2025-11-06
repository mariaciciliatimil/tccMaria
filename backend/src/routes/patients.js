// backend/src/routes/patients.js
import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

// util
const onlyDigits = (s = '') => String(s).replace(/\D+/g, '')

// ==============================
// Convênios (para o select)
// ==============================
router.get('/convenios', async (_req, res) => {
  try {
    const r = await query(`SELECT id, nome FROM convenios ORDER BY nome`)
    res.json(r.rows)
  } catch (e) {
    console.error('GET /patients/convenios', e)
    res.status(500).json({ error: 'Erro ao listar convênios', detail: String(e.message || e) })
  }
})

// ==============================
// Busca autocomplete: nome (2+) ou CPF (11)
// /patients/search?q=...
// ==============================
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json([])

    const digits = onlyDigits(q)
    if (digits.length === 11) {
      const r = await query(
        `SELECT p.id, p.name, p.document AS cpf, p.phone, p.birthdate, p.convenio_id
           FROM patients p
          WHERE p.document = $1
          ORDER BY p.name
          LIMIT 20`,
        [digits]
      )
      return res.json(r.rows)
    }

    if (q.length < 2) return res.json([])
    const r = await query(
      `SELECT p.id, p.name, p.document AS cpf, p.phone, p.birthdate, p.convenio_id
         FROM patients p
        WHERE p.name ILIKE $1
        ORDER BY p.name
        LIMIT 20`,
      [`%${q}%`]
    )
    res.json(r.rows)
  } catch (e) {
    console.error('GET /patients/search', e)
    res.status(500).json({ error: 'Erro na busca de pacientes', detail: String(e.message || e) })
  }
})

// ==============================
// Listagem básica (+ filtro por nome via ?q=)
// ==============================
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    let r
    if (q && q.length >= 2) {
      r = await query(
        `SELECT p.id, p.name, p.birthdate, p.convenio_id, c.nome AS convenio_nome
           FROM patients p
      LEFT JOIN convenios c ON c.id = p.convenio_id
          WHERE p.name ILIKE $1
          ORDER BY p.name
          LIMIT 100`,
        [`%${q}%`]
      )
    } else {
      r = await query(
        `SELECT p.id, p.name, p.birthdate, p.convenio_id, c.nome AS convenio_nome
           FROM patients p
      LEFT JOIN convenios c ON c.id = p.convenio_id
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT 100`
      )
    }
    res.json(r.rows)
  } catch (e) {
    console.error('GET /patients', e)
    res.status(500).json({ error: 'Erro ao listar pacientes', detail: String(e.message || e) })
  }
})

// ==============================
// Criar paciente (tela Pacientes)
// body: { name, birthdate?, convenio_id? }
// ==============================
router.post('/', async (req, res) => {
  try {
    const { name, birthdate = null, convenio_id = null } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Informe o nome.' })

    const ins = await query(
      `INSERT INTO patients (name, birthdate, convenio_id)
       VALUES ($1,$2,$3)
       RETURNING id, name, birthdate, convenio_id`,
      [name, birthdate || null, convenio_id || null]
    )
    res.status(201).json(ins.rows[0])
  } catch (e) {
    console.error('POST /patients', e)
    res.status(500).json({ error: 'Erro ao criar paciente', detail: String(e.message || e) })
  }
})

// ==============================
// Editar paciente
// body: { name?, birthdate?, convenio_id? }
// ==============================
router.patch('/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { name = null, birthdate = null, convenio_id = null } = req.body || {}
    const upd = await query(
      `UPDATE patients
          SET name        = COALESCE($1, name),
              birthdate   = COALESCE($2, birthdate),
              convenio_id = COALESCE($3, convenio_id)
        WHERE id = $4
        RETURNING id, name, birthdate, convenio_id`,
      [name, birthdate, convenio_id, id]
    )
    if (!upd.rowCount) return res.status(404).json({ error: 'Paciente não encontrado' })
    res.json(upd.rows[0])
  } catch (e) {
    console.error('PATCH /patients/:id', e)
    res.status(500).json({ error: 'Erro ao atualizar paciente', detail: String(e.message || e) })
  }
})

// ==============================
// Exames de um paciente (modal Iniciar Preparo)
// ==============================
router.get('/:id(\\d+)/exams', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const r = await query(
      `SELECT id, type, priority, created_at
         FROM exams
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [id]
    )
    res.json(r.rows)
  } catch (e) {
    console.error('GET /patients/:id/exams', e)
    res.status(500).json({ error: 'Erro ao listar exames do paciente', detail: String(e.message || e) })
  }
})

// ==============================
// Iniciar paciente: cria/atualiza paciente e cria EXAME
// body: {
//   patient: { id?, name, cpf?, phone?, birthdate?, convenio_id? },
//   exam:    { type, priority?=4 }
// }
// ==============================
router.post('/initiate', async (req, res) => {
  try {
    const { patient = {}, exam = {} } = req.body || {}
    let {
      id,
      name,
      cpf = null,
      phone = null,
      birthdate = null,
      convenio_id = null,
    } = patient
    const { type, priority = 4 } = exam

    // validações
    if (!id && !name) return res.status(400).json({ error: 'Informe o nome do paciente.' })
    if (!type)        return res.status(400).json({ error: 'Informe o tipo de exame.' })

    // normalizações
    const cpfDigits   = cpf ? onlyDigits(cpf)   : null
    const phoneDigits = phone ? onlyDigits(phone) : null
    if (cpfDigits && cpfDigits.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido (11 dígitos).' })
    }

    await query('BEGIN')

    // cria ou atualiza paciente
    let patientId = id ? Number(id) : null
    if (!patientId) {
      const ins = await query(
        `INSERT INTO patients (name, document, phone, birthdate, convenio_id, created_at)
         VALUES ($1,$2,$3,$4,$5, NOW())
         RETURNING id, name`,
        [name, cpfDigits, phoneDigits, birthdate || null, convenio_id || null]
      )
      patientId = ins.rows[0].id
    } else {
      await query(
        `UPDATE patients
            SET name        = COALESCE($1, name),
                document    = COALESCE($2, document),
                phone       = COALESCE($3, phone),
                birthdate   = COALESCE($4, birthdate),
                convenio_id = COALESCE($5, convenio_id)
          WHERE id = $6`,
        [name || null, cpfDigits, phoneDigits, birthdate || null, convenio_id || null, patientId]
      )
    }

    // cria exame
    const insExam = await query(
      `INSERT INTO exams (patient_id, type, priority, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, patient_id, type, priority, created_at`,
      [patientId, String(type).toUpperCase(), Number(priority)]
    )

    await query('COMMIT')
    return res.status(201).json({
      patient: { id: patientId, name: name },
      exam: insExam.rows[0],
    })
  } catch (e) {
    console.error('POST /patients/initiate', e)
    try { await query('ROLLBACK') } catch {}
    return res.status(500).json({ error: 'Erro ao iniciar paciente', detail: String(e.message || e) })
  }
})

export default router
