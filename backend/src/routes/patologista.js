// backend/src/routes/patologista.js
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * GET /patologista/fila
 * Query:
 *  - hoje=1 (opcional)
 *  - status=NA_FILA|EM_ANALISE|CONCLUIDO (default: NA_FILA)
 *  - busca=texto (opcional) -> paciente ou tipo do exame
 */
router.get('/fila', async (req, res) => {
  try {
    const hoje = String(req.query.hoje || '1') === '1';
    const rawStatus = (req.query.status || 'NA_FILA').toString().toUpperCase();
    const busca = (req.query.busca || '').trim();

    const OK = new Set(['NA_FILA','EM_ANALISE','CONCLUIDO']);
    const status = OK.has(rawStatus) ? rawStatus : 'NA_FILA';

    const params = [];
    const where = [];

    params.push(status);
    where.push(`t.tray_status = $${params.length}`);

    if (hoje) {
      where.push(`t.created_at::date = CURRENT_DATE`);
    }

    if (busca) {
      params.push(`%${busca}%`);
      params.push(`%${busca}%`);
      where.push(`(p.name ILIKE $${params.length - 1} OR e.type ILIKE $${params.length})`);
    }

    const sql = `
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
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY t.priority ASC, t.created_at::date ASC, t.created_at ASC
      LIMIT 200
    `;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (e) {
    console.error('GET /patologista/fila', e);
    return res.status(500).json({ error: 'erro_listar_fila', detail: String(e.message || e) });
  }
});

/**
 * GET /patologista/meus
 * Lista bandejas em análise pelo patologista logado
 */
router.get('/meus', async (req, res) => {
  try {
    const patologistaId = req.user?.id;
    if (!patologistaId) return res.status(401).json({ error: 'unauthorized' });

    const { rows } = await query(
      `
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
      WHERE t.tray_status = 'EM_ANALISE'
        AND t.pathologist_id = $1
      ORDER BY t.started_at DESC NULLS LAST, t.created_at DESC
      LIMIT 200
      `,
      [patologistaId]
    );

    return res.json(rows);
  } catch (e) {
    console.error('GET /patologista/meus', e);
    return res.status(500).json({ error: 'erro_listar_meus', detail: String(e.message || e) });
  }
});

/**
 * 🔎 GET /patologista/exame/:id/detalhes
 * Dados para o pop-up (exame + paciente + etiquetas + histórico)
 */
router.get('/exame/:id/detalhes', async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) return res.status(400).json({ error: 'id_invalido' });

  try {
    const examSql = `
      WITH last_step AS (
        SELECT DISTINCT ON (exam_id) exam_id, status, started_at
        FROM exam_steps
        WHERE exam_id = $1
        ORDER BY exam_id, started_at DESC, id DESC
      )
      SELECT
        e.id, e.type, e.priority,
        COALESCE(ls.status, 'PENDENTE') AS status,
        e.created_at,
        e.prep_laminas, e.prep_responsavel, e.prep_started_at,
        p.id   AS patient_id,
        p.name AS patient_name,
        p.birthdate,
        p.document AS cpf
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN last_step ls ON ls.exam_id = e.id
      WHERE e.id = $1
    `;
    const exam = await query(examSql, [examId]);
    if (!exam.rowCount) return res.status(404).json({ error: 'exame_nao_encontrado' });

    const slides = await query(
      `SELECT seq, label, printed_at
         FROM exam_slides
        WHERE exam_id = $1
        ORDER BY seq`,
      [examId]
    );

    const history = await query(
      `SELECT id, type, priority, created_at
         FROM exams
        WHERE patient_id = $1
          AND id <> $2
        ORDER BY created_at DESC
        LIMIT 20`,
      [exam.rows[0].patient_id, examId]
    );

    res.json({
      exam: exam.rows[0],
      slides: slides.rows,
      history: history.rows
    });
  } catch (e) {
    console.error('GET /patologista/exame/:id/detalhes', e);
    return res.status(500).json({ error: 'erro_detalhes', detail: String(e.message || e) });
  }
});

/**
 * PATCH /patologista/:id/iniciar
 * Passa de NA_FILA -> EM_ANALISE e marca o patologista
 */
router.patch('/:id(\\d+)/iniciar', async (req, res) => {
  const bandejaId = Number(req.params.id);
  const patologistaId = req.user?.id;

  if (!bandejaId) return res.status(400).json({ error: 'id_invalido' });
  if (!patologistaId) return res.status(401).json({ error: 'unauthorized' });

  try {
    await query('BEGIN');

    const cur = await query('SELECT tray_status FROM exam_tray WHERE id=$1 FOR UPDATE', [bandejaId]);
    if (!cur.rowCount) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'bandeja_nao_encontrada' });
    }
    if (cur.rows[0].tray_status !== 'NA_FILA') {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'status_invalido', from: cur.rows[0].tray_status });
    }

    const upd = await query(
      `
      UPDATE exam_tray
         SET tray_status    = 'EM_ANALISE',
             pathologist_id = $1,
             started_at     = NOW()
       WHERE id = $2
       RETURNING
         id AS bandeja_id, exam_id AS exame_id, priority AS prioridade,
         note AS observacao, tray_status AS status_bandeja, pathologist_id AS patologista_id,
         started_at AS iniciado_em, finished_at AS concluido_em, created_at AS adicionado_em
      `,
      [patologistaId, bandejaId]
    );

    await query('COMMIT');
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error('PATCH /patologista/:id/iniciar', e);
    try { await query('ROLLBACK'); } catch {}
    return res.status(500).json({ error: 'erro_iniciar', detail: String(e.message || e) });
  }
});

/**
 * PATCH /patologista/:id/concluir
 * Passa de EM_ANALISE -> CONCLUIDO e registra passo em exam_steps (FINALIZACAO/CONCLUIDO)
 */
router.patch('/:id(\\d+)/concluir', async (req, res) => {
  const bandejaId = Number(req.params.id);
  const patologistaId = req.user?.id;

  if (!bandejaId) return res.status(400).json({ error: 'id_invalido' });
  if (!patologistaId) return res.status(401).json({ error: 'unauthorized' });

  try {
    await query('BEGIN');

    // travar linha e obter exam_id
    const cur = await query(
      'SELECT tray_status, pathologist_id, exam_id FROM exam_tray WHERE id=$1 FOR UPDATE',
      [bandejaId]
    );
    if (!cur.rowCount) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'bandeja_nao_encontrada' });
    }
    const row = cur.rows[0];
    if (row.tray_status !== 'EM_ANALISE') {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'status_invalido', from: row.tray_status });
    }
    if (row.pathologist_id && row.pathologist_id !== patologistaId) {
      await query('ROLLBACK');
      return res.status(403).json({ error: 'nao_autorizado_para_concluir' });
    }

    // concluir bandeja
    const upd = await query(
      `
      UPDATE exam_tray
         SET tray_status    = 'CONCLUIDO',
             pathologist_id = COALESCE(pathologist_id, $1),
             finished_at    = NOW()
       WHERE id = $2
       RETURNING
         id AS bandeja_id, exam_id AS exame_id, priority AS prioridade,
         note AS observacao, tray_status AS status_bandeja, pathologist_id AS patologista_id,
         started_at AS iniciado_em, finished_at AS concluido_em, created_at AS adicionado_em
      `,
      [patologistaId, bandejaId]
    );

    // registrar passo CONCLUIDO no exam_steps (somente se ainda não estiver CONCLUIDO)
    const examId = row.exam_id;
    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const lastStatus = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (lastStatus !== 'CONCLUIDO') {
      await query(
        `INSERT INTO exam_steps (exam_id, step, status, responsible_id, started_at)
         VALUES ($1, 'FINALIZACAO', 'CONCLUIDO', $2, NOW())`,
        [examId, patologistaId]
      );
    }

    await query('COMMIT');
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error('PATCH /patologista/:id/concluir', e);
    try { await query('ROLLBACK'); } catch {}
    return res.status(500).json({ error: 'erro_concluir', detail: String(e.message || e) });
  }
});

export default router;
