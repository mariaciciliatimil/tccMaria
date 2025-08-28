import { Router } from 'express'
import { pool, query } from '../db.js'
const router = Router()
router.get('/search', async (req, res) => {
  const q = (req.query.name || '').trim()
  if (!q || q.length < 2) return res.json([])
  const { rows } = await query(`SELECT id, name, birthdate, convenio_id FROM patients WHERE name ILIKE $1 ORDER BY name LIMIT 10`, [`%${q}%`])
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
        `UPDATE patients SET name = COALESCE($1, name), birthdate = COALESCE($2, birthdate), convenio_id = COALESCE($3, convenio_id) WHERE id = $4
         RETURNING id, name, birthdate, convenio_id`,
        [p.name ?? null, p.birthdate ?? null, p.convenio_id ?? null, p.id]
      )
      if (upd.rowCount === 0) throw new Error('Paciente não encontrado')
      patient = upd.rows[0]
    } else {
      let found = null
      if (p.birthdate) {
        const sr = await client.query(
          `SELECT id, name, birthdate, convenio_id FROM patients WHERE lower(name) = lower($1) AND birthdate = $2 LIMIT 1`,
          [p.name, p.birthdate]
        )
        if (sr.rowCount > 0) found = sr.rows[0]
      }
      if (found) {
        patient = found
        if (p.convenio_id && p.convenio_id !== found.convenio_id) {
          const up = await client.query(
            `UPDATE patients SET convenio_id=$1 WHERE id=$2 RETURNING id, name, birthdate, convenio_id`,
            [p.convenio_id, found.id]
          )
          patient = up.rows[0]
        }
      } else {
        const ins = await client.query(
          `INSERT INTO patients (name, birthdate, convenio_id) VALUES ($1,$2,$3) RETURNING id, name, birthdate, convenio_id`,
          [p.name, p.birthdate || null, p.convenio_id || null]
        )
        patient = ins.rows[0]
      }
    }
    const exam = (await client.query(
      `INSERT INTO exams (patient_id, type, priority, created_by) VALUES ($1,$2,$3,$4) RETURNING id, patient_id, type, priority, created_at`,
      [patient.id, e.type, !!e.urgency, req.user?.id || null]
    )).rows[0]
    const step = (await client.query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id) VALUES ($1,'RECEPCAO','EM_ANDAMENTO',$2) RETURNING id, exam_id, step, status, started_at`,
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
export default router
