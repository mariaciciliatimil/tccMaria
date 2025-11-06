import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/* =========================
   ROTAS ESPECÍFICAS (sem :id)
   ========================= */

// Lista responsáveis (funcionários / patologistas ativos)
router.get('/responsaveis', async (_req, res) => {
  try {
    const r = await query(
      `SELECT id, name, role
         FROM users
        WHERE enabled = TRUE
          AND role IN ('FUNCIONARIO','PATOLOGISTA')
        ORDER BY name`
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar responsáveis' });
  }
});

/**
 * BOARD: PENDENTE | EM_PREPARO_INICIAL | CONCLUIDO
 */
router.get('/board', async (_req, res) => {
  const countsSql = `
    WITH last_steps AS (
      SELECT DISTINCT ON (exam_id) exam_id, status
      FROM exam_steps
      ORDER BY exam_id, started_at DESC, id DESC
    )
    SELECT COALESCE(ls.status, 'PENDENTE') AS status, COUNT(*)::int AS count
    FROM exams e
    LEFT JOIN last_steps ls ON ls.exam_id = e.id
    GROUP BY COALESCE(ls.status, 'PENDENTE')
  `;

  const itemsSql = `
    WITH last_steps AS (
      SELECT DISTINCT ON (exam_id) exam_id, status
      FROM exam_steps
      ORDER BY exam_id, started_at DESC, id DESC
    )
    SELECT
      e.id,
      e.type,
      e.priority,
      COALESCE(ls.status,'PENDENTE') AS status,
      p.name AS patient_name,
      e.created_at
    FROM exams e
    LEFT JOIN last_steps ls ON ls.exam_id = e.id
    LEFT JOIN patients p ON p.id = e.patient_id
    WHERE COALESCE(ls.status,'PENDENTE') = $1
    ORDER BY e.created_at DESC
    LIMIT 20
  `;

  try {
    const countsRes = await query(countsSql);
    const counts = { PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 };
    for (const r of countsRes.rows) if (counts[r.status] !== undefined) counts[r.status] = r.count;

    const [pend, prep, done] = await Promise.all([
      query(itemsSql, ['PENDENTE']),
      query(itemsSql, ['EM_PREPARO_INICIAL']),
      query(itemsSql, ['CONCLUIDO']),
    ]);

    res.json({
      counts,
      columns: {
        PENDENTE: pend.rows,
        EM_PREPARO_INICIAL: prep.rows,
        CONCLUIDO: done.rows
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao montar board' });
  }
});

/**
 * (Opcional) Filtro simples: /exams?patient_id=123
 */
router.get('/', async (req, res) => {
  try {
    const { patient_id } = req.query;
    if (patient_id) {
      const r = await query(
        `SELECT id, type, priority, created_at
           FROM exams
          WHERE patient_id = $1
          ORDER BY created_at DESC`,
        [patient_id]
      );
      return res.json(r.rows);
    }
    const r = await query(`SELECT id, type, priority, created_at FROM exams ORDER BY created_at DESC LIMIT 50`);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar exames' });
  }
});

// ====== LISTA "EXAMES CONCLUÍDOS" (que AINDA NÃO estão na bandeja de HOJE)
router.get('/concluded', async (_req, res) => {
  try {
    const sql = `
      WITH last_steps AS (
        SELECT DISTINCT ON (exam_id) exam_id, status
        FROM exam_steps
        ORDER BY exam_id, started_at DESC, id DESC
      ),
      today_tray AS (
        SELECT exam_id
        FROM exam_tray
        WHERE created_at::date = CURRENT_DATE
      )
      SELECT
        e.id,
        e.type,
        e.priority,
        p.name AS patient_name,
        e.created_at
      FROM exams e
      JOIN patients p       ON p.id = e.patient_id
      LEFT JOIN last_steps s ON s.exam_id = e.id
      LEFT JOIN today_tray t ON t.exam_id = e.id
      WHERE COALESCE(s.status, 'PENDENTE') = 'CONCLUIDO'
        AND t.exam_id IS NULL
      ORDER BY e.created_at DESC
      LIMIT 50
    `;
    const r = await query(sql);
    res.json(r.rows);
  } catch (e) {
    console.error('GET /exams/concluded', e);
    res.status(500).json({ error: 'Erro ao listar exames concluídos.' });
  }
});

// ====== LISTA "BANDEJA DO DIA" (prioridade do EXAME)
router.get('/tray-today', async (_req, res) => {
  try {
    const sql = `
      SELECT
        t.id            AS tray_id,
        e.id            AS exam_id,
        e.type,
        e.priority      AS priority,
        p.name          AS patient_name,
        t.note,
        t.created_at
      FROM exam_tray t
      JOIN exams e    ON e.id = t.exam_id
      JOIN patients p ON p.id = e.patient_id
      WHERE t.created_at::date = CURRENT_DATE
      ORDER BY e.priority ASC, t.created_at ASC
    `;
    const r = await query(sql);
    res.json(r.rows);
  } catch (e) {
    console.error('GET /exams/tray-today', e);
    res.status(500).json({ error: 'Erro ao listar a bandeja do dia.' });
  }
});

/* =========
   BANDEJA: editar / excluir (trayId numérico)
   ========= */

// EDITAR item da bandeja (AGORA só nota/observação)
router.put('/tray/:trayId(\\d+)', async (req, res) => {
  const trayId = Number(req.params.trayId);
  const { note } = req.body || {};

  if (!trayId) return res.status(400).json({ error: 'ID inválido.' });

  const role = req.user?.role;
  if (!['ADMIN','FUNCIONARIO'].includes(role))
    return res.status(403).json({ error: 'Sem permissão para editar a bandeja.' });

  try {
    const ex = await query('SELECT id FROM exam_tray WHERE id = $1', [trayId]);
    if (ex.rowCount === 0) return res.status(404).json({ error: 'Item da bandeja não encontrado.' });

    const { rows } = await query(
      `UPDATE exam_tray
         SET note = COALESCE($1, note)
       WHERE id = $2
       RETURNING id, exam_id, note, created_at`,
      [note ?? null, trayId]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('PUT /exams/tray/:trayId', e);
    res.status(500).json({ error: 'Erro ao atualizar item da bandeja.' });
  }
});

// EXCLUIR item da bandeja
router.delete('/tray/:trayId(\\d+)', async (req, res) => {
  const trayId = Number(req.params.trayId);
  if (!trayId) return res.status(400).json({ error: 'ID inválido.' });

  const role = req.user?.role;
  if (!['ADMIN','FUNCIONARIO'].includes(role))
    return res.status(403).json({ error: 'Sem permissão para excluir da bandeja.' });

  try {
    const del = await query('DELETE FROM exam_tray WHERE id = $1 RETURNING id', [trayId]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'Item da bandeja não encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /exams/tray/:trayId', e);
    res.status(500).json({ error: 'Erro ao remover item da bandeja.' });
  }
});

/* =========================
   ROTAS COM :id (numérico)
   ========================= */

// INICIAR PREPARO (gera/recria etiquetas e muda status)
router.post('/:id(\\d+)/start-prep', async (req, res) => {
  const examId = Number(req.params.id);
  const { laminas, responsavel_id } = req.body || {};

  if (!examId) return res.status(400).json({ error: 'Exame inválido.' });

  const qtd = Number(laminas);
  if (!qtd || qtd <= 0)
    return res.status(400).json({ error: 'Informe a quantidade de lâminas (> 0).' });

  const respId = Number(responsavel_id);
  if (!respId)
    return res.status(400).json({ error: 'Selecione o responsável.' });

  try {
    await query('BEGIN');

    // Exame existe?
    const e = await query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (e.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }

    // Último status precisa ser PENDENTE
    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const lastStatus = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (lastStatus !== 'PENDENTE') {
      await query('ROLLBACK');
      return res.status(409).json({ error: `Exame não está pendente (status atual: ${lastStatus}).` });
    }

    // responsável válido?
    const u = await query(
      `SELECT id, name
         FROM users
        WHERE id = $1
          AND enabled = TRUE
          AND role IN ('FUNCIONARIO','PATOLOGISTA')`,
      [respId]
    );
    if (!u.rowCount) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'Responsável inválido.' });
    }
    const respName = u.rows[0].name;

    // Atualiza metadados do preparo
    await query(
      `UPDATE exams
          SET prep_laminas = $1,
              prep_responsavel = $2,
              prep_started_at = NOW()
        WHERE id = $3`,
      [qtd, respName, examId]
    );

    // Recria etiquetas de forma idempotente (tipagem explícita p/ evitar erro do $1)
    await query('DELETE FROM exam_slides WHERE exam_id = $1::int', [examId]);

    await query(
      `INSERT INTO exam_slides (exam_id, seq, label)
       SELECT
         $1::int                                           AS exam_id,
         gs::int                                           AS seq,
         (($1::int)::text || '_' || gs::int::text)         AS label
       FROM generate_series(1, $2::int) AS gs`,
      [examId, qtd]
    );

    // Registra etapa EM_PREPARO_INICIAL
    await query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id, started_at)
       VALUES ($1, 'PREPARO_INICIAL', 'EM_PREPARO_INICIAL', $2, NOW())`,
      [examId, respId]
    );

    // Busca as etiquetas criadas
    const slidesRes = await query(
      `SELECT seq, label, printed_at
         FROM exam_slides
        WHERE exam_id = $1::int
        ORDER BY seq`,
      [examId]
    );

    await query('COMMIT');

    res.json({
      id: examId,
      status: 'EM_PREPARO_INICIAL',
      prep_laminas: qtd,
      prep_responsavel: respName,
      slides: slidesRes.rows
    });
  } catch (err) {
    console.error('POST /exams/:id/start-prep', err);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao iniciar preparo do exame', detail: String(err?.message || err) });
  }
});

// ATUALIZAR PRIORIDADE DO EXAME (só quando CONCLUIDO)
router.patch('/:id(\\d+)/priority', async (req, res) => {
  const examId = Number(req.params.id);
  const { priority } = req.body || {};
  if (!examId) return res.status(400).json({ error: 'ID inválido.' });
  if (![1, 2, 3].includes(Number(priority))) {
    return res.status(400).json({ error: 'Prioridade inválida (1=Alta, 2=Média, 3=Normal).' });
  }

  const role = req.user?.role;
  if (!['ADMIN', 'FUNCIONARIO'].includes(role)) {
    return res.status(403).json({ error: 'Sem permissão para alterar prioridade.' });
  }

  try {
    const last = await query(
      `SELECT status FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const st = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (st !== 'CONCLUIDO') {
      return res.status(409).json({ error: `Exame não está CONCLUÍDO (status: ${st}).` });
    }

    const upd = await query(
      `UPDATE exams SET priority = $1 WHERE id = $2 RETURNING id, priority`,
      [Number(priority), examId]
    );
    if (!upd.rowCount) return res.status(404).json({ error: 'Exame não encontrado.' });

    res.json(upd.rows[0]);
  } catch (e) {
    console.error('PATCH /exams/:id/priority', e);
    res.status(500).json({ error: 'Erro ao atualizar prioridade.' });
  }
});

// DETALHES DO EXAME (para o modal)
router.get('/:id(\\d+)', async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const sql = `
      WITH last_step AS (
        SELECT DISTINCT ON (exam_id) exam_id, status, started_at
        FROM exam_steps
        WHERE exam_id = $1
        ORDER BY exam_id, started_at DESC, id DESC
      )
      SELECT
        e.id,
        e.type,
        e.priority,
        COALESCE(ls.status, 'PENDENTE') AS status,
        e.created_at,
        e.prep_laminas,
        e.prep_responsavel,
        e.prep_started_at,
        p.id   AS patient_id,
        p.name AS patient_name
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN last_step ls ON ls.exam_id = e.id
      WHERE e.id = $1
    `;
    const r = await query(sql, [examId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Exame não encontrado.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('GET /exams/:id error:', e);
    res.status(500).json({ error: 'Erro ao buscar detalhes do exame.' });
  }
});

// CONCLUIR EXAME (botão do modal)
router.post('/:id(\\d+)/conclude', async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const role = req.user?.role;
    if (!['ADMIN', 'FUNCIONARIO'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão para concluir.' });
    }

    await query('BEGIN');

    const ex = await query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (ex.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }

    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const lastStatus = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (lastStatus === 'CONCLUIDO') {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'Exame já está CONCLUÍDO.' });
    }

    await query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id, started_at)
       VALUES ($1, 'FINALIZACAO', 'CONCLUIDO', $2, NOW())`,
      [examId, req.user?.id || null]
    );

    await query('COMMIT');
    res.json({ id: examId, status: 'CONCLUIDO' });
  } catch (e) {
    console.error('POST /exams/:id/conclude error:', e);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao concluir exame.' });
  }
});

/* =========================
   NOVO: ENFILEIRAR PARA PATOLOGISTA
   ========================= */
router.post('/:id(\\d+)/enfileirar', async (req, res) => {
  const examId = Number(req.params.id);
  let { priority = null, note = null } = req.body || {};

  if (!examId) return res.status(400).json({ error: 'Exame inválido.' });

  const role = req.user?.role;
  if (!['ADMIN','FUNCIONARIO'].includes(role))
    return res.status(403).json({ error: 'Sem permissão para enfileirar.' });

  try {
    await query('BEGIN');

    const e = await query('SELECT id, priority FROM exams WHERE id = $1', [examId]);
    if (!e.rowCount) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }
    const examPriority = e.rows[0].priority;
    const finalPriority = [1,2,3,4].includes(Number(priority)) ? Number(priority) : examPriority;

    const ins = await query(
      `INSERT INTO exam_tray (exam_id, priority, note, added_by, tray_status, created_at)
       VALUES ($1, $2, $3, $4, 'NA_FILA', NOW())
       ON CONFLICT (exam_id, (created_at::date)) DO NOTHING
       RETURNING id, exam_id, priority, tray_status, created_at`,
      [examId, finalPriority, note ?? null, req.user?.id || null]
    );

    if (!ins.rowCount) {
      const r2 = await query(
        `SELECT id, exam_id, priority, tray_status, created_at
           FROM exam_tray
          WHERE exam_id = $1 AND created_at::date = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1`,
        [examId]
      );
      await query('COMMIT');
      return res.status(200).json({ info: 'already_in_today_tray', ...r2.rows[0] });
    }

    await query('COMMIT');
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error('POST /exams/:id/enfileirar', e);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao enfileirar exame.' });
  }
});

// ADICIONA UM EXAME CONCLUÍDO NA "BANDEJA DO DIA"
router.post('/:id(\\d+)/add-to-tray', async (req, res) => {
  const examId = Number(req.params.id);
  const { note = null } = req.body || {};

  if (!examId) return res.status(400).json({ error: 'Exame inválido.' });

  try {
    const role = req.user?.role;
    if (!['ADMIN','FUNCIONARIO'].includes(role))
      return res.status(403).json({ error: 'Sem permissão para adicionar na bandeja.' });

    await query('BEGIN');

    const ex = await query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (ex.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }

    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const statusAtual = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (statusAtual !== 'CONCLUIDO') {
      await query('ROLLBACK');
      return res.status(409).json({ error: `Exame não está CONCLUÍDO (status: ${statusAtual}).` });
    }

    const already = await query(
      `SELECT 1 FROM exam_tray
        WHERE exam_id = $1
          AND created_at::date = CURRENT_DATE`,
      [examId]
    );
    if (already.rowCount) {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'Este exame já está na bandeja de hoje.' });
    }

    const ins = await query(
      `INSERT INTO exam_tray (exam_id, note, added_by)
       VALUES ($1, $2, $3)
       RETURNING id, exam_id, note, created_at`,
      [examId, note, req.user?.id || null]
    );

    await query('COMMIT');
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error('POST /exams/:id/add-to-tray', e);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao adicionar exame na bandeja do dia.' });
  }
});

/* =========================
   SLIDES (etiquetas)
   ========================= */

// Lista etiquetas do exame
router.get('/:id(\\d+)/slides', async (req, res) => {
  const examId = Number(req.params.id);
  try {
    const r = await query(
      `SELECT seq, label, printed_at
         FROM exam_slides
        WHERE exam_id = $1::int
        ORDER BY seq`,
      [examId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('GET /exams/:id/slides', e);
    res.status(500).json({ error: 'Erro ao listar etiquetas.' });
  }
});

// Marca todas as etiquetas do exame como impressas
router.patch('/:id(\\d+)/slides/printed', async (req, res) => {
  const examId = Number(req.params.id);
  try {
    await query(
      `UPDATE exam_slides
          SET printed_at = NOW()
        WHERE exam_id = $1::int
          AND printed_at IS NULL`,
      [examId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /exams/:id/slides/printed', e);
    res.status(500).json({ error: 'Erro ao marcar impressão.' });
  }
});

export default router;
