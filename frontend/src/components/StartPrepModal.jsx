import React, { useEffect, useState } from 'react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const token = () => localStorage.getItem('token') || '';

export default function StartPrepModal({ open, onClose, patient, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [laminas, setLaminas] = useState('');
  const [responsavel, setResponsavel] = useState(localStorage.getItem('userName') || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !patient) return;
    setError(''); setLoading(true);
    // Tenta buscar exames do paciente (suporta dois formatos de rota)
    const load = async () => {
      try {
        let res = await fetch(`${API}/patients/${patient.id}/exams`, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.status === 404) {
          // fallback para filtros via querystring, se sua API suportar
          res = await fetch(`${API}/exams?patient_id=${patient.id}`, {
            headers: { Authorization: `Bearer ${token()}` }
          });
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar exames do paciente');
        const list = Array.isArray(data) ? data : (data.items || []);
        setExams(list);
        setExamId(list?.[0]?.id || '');
      } catch (e) {
        setError(e.message);
        setExams([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, patient]);

  const save = async () => {
    try {
      setError('');
      if (!examId) return setError('Selecione um exame.');
      if (!laminas || Number(laminas) <= 0) return setError('Informe a quantidade de lâminas (>0).');
      if (!responsavel.trim()) return setError('Informe o responsável.');

      const res = await fetch(`${API}/exams/${examId}/start-prep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({ laminas: Number(laminas), responsavel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar preparo');
      onSaved?.(data);
      onClose?.();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!open) return null;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e)=>e.stopPropagation()}>
        <h3 style={{margin:0, marginBottom:12}}>Iniciar preparo</h3>
        <div style={{fontSize:13, color:'#475569', marginBottom:12}}>
          Paciente: <b>{patient?.name}</b>
        </div>

        {loading ? <div>Carregando exames…</div> : (
          <>
            {exams.length === 0 ? (
              <div style={{color:'#b00020', marginBottom:12}}>
                Este paciente não possui exames pendentes. Crie/associe um exame antes de iniciar o preparo.
              </div>
            ) : (
              <div style={S.field}>
                <label>Exame</label>
                <select value={examId} onChange={e=>setExamId(e.target.value)} style={S.input}>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      #{ex.id} • {String(ex.type || '').replaceAll('_',' ')} {ex.priority ? '• Prioritário' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={S.field}>
              <label>Qtd. de lâminas</label>
              <input type="number" min="1" value={laminas} onChange={e=>setLaminas(e.target.value)} style={S.input}/>
            </div>
            <div style={S.field}>
              <label>Responsável</label>
              <input type="text" value={responsavel} onChange={e=>setResponsavel(e.target.value)} style={S.input}/>
            </div>

            {error && <div style={{color:'#b00020', marginTop:6}}>{error}</div>}

            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:14}}>
              <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
              <button onClick={save} style={S.btnPrimary} disabled={exams.length===0}>Salvar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: { position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
  modal: { width:480, background:'#fff', borderRadius:12, padding:18, boxShadow:'0 10px 30px rgba(0,0,0,.2)' },
  field: { display:'flex', flexDirection:'column', gap:6, marginBottom:10 },
  input: { padding:'10px 12px', border:'1px solid #d0d5dd', borderRadius:8, outline:'none' },
  btnGhost: { padding:'10px 14px', borderRadius:10, border:'1px solid #d0d5dd', background:'#fff', cursor:'pointer' },
  btnPrimary:{ padding:'10px 14px', borderRadius:10, background:'#0ea5e9', color:'#fff', border:'none', cursor:'pointer' },
};
