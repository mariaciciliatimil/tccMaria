import { Router } from 'express'
import { pool, query } from '../db.js'

const router = Router()

// ---- AUTOCOMPLETE / CONVENIOS / INICIAR PACIENTE ----
router.get('/search', async (req, res) => {
  const q = (req.query.name || '').trim()
  if (!q || q.length < 2) return res.json([])
  const { rows } = await query(
    `SELECT id, name, birthdate, convenio_id
       FROM patients
      WHERE name ILIKE $1
      ORDER BY name
      LIMIT 10`,
    [`%${q}%`]
  )
  res.json(rows)
})

router.get('/convenios', async (_req, res) => {
  const { rows } = await query(`SELECT id, nome FROM convenios ORDER BY nome`)
  res.json(rows)
})

router.post('/initiate', async (req, res) => {
  const p = req.body?.patient || {}
  const e = req.body?.exam || {}
  if (!p.name) return res.status(400).json({ error: 'Nome do paciente é obrigatório' })
  if (!e.type) return res.status(400).json({ error: 'Tipo de exame é obrigatório' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let patient
    if (p.id) {
      const upd = await client.query(
        `UPDATE patients
            SET name = COALESCE($1, name),
                birthdate = COALESCE($2, birthdate),
                convenio_id = COALESCE($3, convenio_id)
          WHERE id = $4
        RETURNING id, name, birthdate, convenio_id`,
        [p.name ?? null, p.birthdate ?? null, p.convenio_id ?? null, p.id]
      )
      if (upd.rowCount === 0) throw new Error('Paciente não encontrado')
      patient = upd.rows[0]
    } else {
      let found = null
      if (p.birthdate) {
        const sr = await client.query(
          `SELECT id, name, birthdate, convenio_id
             FROM patients
            WHERE lower(name) = lower($1)
              AND birthdate = $2
            LIMIT 1`,
          [p.name, p.birthdate]
        )
        if (sr.rowCount > 0) found = sr.rows[0]
      }
      if (found) {
        patient = found
        if (p.convenio_id && p.convenio_id !== found.convenio_id) {
          const up = await client.query(
            `UPDATE patients SET convenio_id=$1
              WHERE id=$2
          RETURNING id, name, birthdate, convenio_id`,
            [p.convenio_id, found.id]
          )
          patient = up.rows[0]
        }
      } else {
        const ins = await client.query(
          `INSERT INTO patients (name, birthdate, convenio_id)
           VALUES ($1,$2,$3)
        RETURNING id, name, birthdate, convenio_id`,
          [p.name, p.birthdate || null, p.convenio_id || null]
        )
        patient = ins.rows[0]
      }
    }

    const exam = (await client.query(
      `INSERT INTO exams (patient_id, type, priority, created_by)
       VALUES ($1,$2,$3,$4)
    RETURNING id, patient_id, type, priority, created_at`,
      [patient.id, e.type, !!e.urgency, req.user?.id || null]
    )).rows[0]

    // Passo inicial fica PENDENTE (compatível com o CHECK do schema)
    const step = (await client.query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id)
       VALUES ($1,'RECEPCAO','PENDENTE',$2)
    RETURNING id, exam_id, step, status, started_at`,
      [exam.id, req.user?.id || null]
    )).rows[0]

    await client.query('COMMIT')
    res.status(201).json({ patient, exam, step })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Erro ao iniciar paciente' })
  } finally {
    client.release()
  }
})

// ---- MÓDULO II: LISTAR / OBTER / CRIAR / EDITAR / ASSOCIAR EXAME ----

// LISTAR PACIENTES
// GET /patients?q=jo&limit=20&offset=0
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

  const params = []
  let where = ''
  if (q && q.length >= 2) {
    params.push(`%${q}%`)
    where = `WHERE p.name ILIKE $${params.length}`
  }

  const sql = `
    SELECT p.id, p.name, p.birthdate, p.convenio_id, c.nome AS convenio_nome, p.created_at
      FROM patients p
      LEFT JOIN convenios c ON c.id = p.convenio_id
      ${where}
     ORDER BY p.name ASC
     LIMIT ${limit} OFFSET ${offset}
  `
  const { rows } = await query(sql, params)
  res.json(rows)
})

// OBTER 1 PACIENTE
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { rows } = await query(
    `SELECT p.id, p.name, p.birthdate, p.convenio_id, c.nome AS convenio_nome, p.created_at
       FROM patients p
       LEFT JOIN convenios c ON c.id = p.convenio_id
      WHERE p.id=$1`,
    [id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Paciente não encontrado' })
  res.json(rows[0])
})

// LISTAR EXAMES DO PACIENTE (usado pelo modal "Iniciar preparo")
// GET /patients/:id/exams
router.get('/:id/exams', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await query(
      `SELECT id, type, priority, created_at
         FROM exams
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [id]
    )
    res.json(r.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro ao listar exames do paciente' })
  }
})

// CADASTRAR PACIENTE
router.post('/', async (req, res) => {
  const { name, birthdate, convenio_id } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })

  try {
    const { rows } = await query(
      `INSERT INTO patients (name, birthdate, convenio_id)
       VALUES ($1, $2, $3)
    RETURNING id, name, birthdate, convenio_id, created_at`,
      [name, birthdate || null, convenio_id || null]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro ao cadastrar paciente' })
  }
})

// EDITAR PACIENTE
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { name, birthdate, convenio_id } = req.body || {}

  const fields = []
  const params = []
  let i = 1

  if (name !== undefined) { fields.push(`name=$${i++}`); params.push(name) }
  if (birthdate !== undefined) { fields.push(`birthdate=$${i++}`); params.push(birthdate || null) }
  if (convenio_id !== undefined) { fields.push(`convenio_id=$${i++}`); params.push(convenio_id || null) }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' })
  params.push(id)

  try {
    const { rows } = await query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id=$${i}
    RETURNING id, name, birthdate, convenio_id, created_at`,
      params
    )
    if (!rows.length) return res.status(404).json({ error: 'Paciente não encontrado' })
    res.json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Erro ao editar paciente' })
  }
})

// ASSOCIAR EXAME AO PACIENTE
// POST /patients/:id/exams { type, urgency }
router.post('/:id/exams', async (req, res) => {
  const id = Number(req.params.id)
  const { type, urgency } = req.body || {}
  if (!type) return res.status(400).json({ error: 'Tipo de exame é obrigatório' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const p = await client.query('SELECT id FROM patients WHERE id=$1', [id])
    if (!p.rowCount) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Paciente não encontrado' })
    }

    const exam = (await client.query(
      `INSERT INTO exams (patient_id, type, priority, created_by)
       VALUES ($1,$2,$3,$4)
    RETURNING id, patient_id, type, priority, created_at`,
      [id, type, !!urgency, req.user?.id || null]
    )).rows[0]

    // Passo inicial agora fica PENDENTE (compatível com o CHECK do schema)
    const step = (await client.query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id)
       VALUES ($1,'RECEPCAO','PENDENTE',$2)
    RETURNING id, exam_id, step, status, started_at`,
      [exam.id, req.user?.id || null]
    )).rows[0]

    await client.query('COMMIT')
    res.status(201).json({ exam, step })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: 'Erro ao associar exame' })
  } finally {
    client.release()
  }
})

export default router
