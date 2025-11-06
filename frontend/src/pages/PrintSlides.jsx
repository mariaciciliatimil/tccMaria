import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

export default function PrintSlides() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    (async () => {
      // detalhes do exame (paciente, tipo, etc.)
      const ex = await fetch(`${API}/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.json());

      // etiquetas
      const sl = await fetch(`${API}/exams/${examId}/slides`, {
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.json());

      setExam(ex);
      setSlides(sl);
      // espera montar e dispara a caixa de impressão
      setTimeout(() => window.print(), 250);
    })();
  }, [examId]);

  if (!exam) return null;

  // opcional: cortar nome grande
  const nome = (exam.patient_name || "").slice(0, 28);
  const data = new Date().toLocaleDateString();

  return (
    <div className="print-page">
      {/* grade de etiquetas */}
      <div className="labels">
        {slides.map(s => (
          <div key={s.seq} className="label">
            <div className="l1">{nome}</div>
            <div className="l2">Exame #{exam.id} • {exam.type}</div>
            <div className="l3">Etiqueta: {s.label}</div>
            <div className="l4">{data}</div>
          </div>
        ))}
      </div>

      <style>{css}</style>
    </div>
  );
}

// CSS simples para impressão A4 com “cartelinhas” 3x10 (ajuste se usar folha adesiva diferente)
const css = `
@media screen {
  .print-page { padding: 16px; font-family: system-ui, sans-serif; }
}
@media print {
  @page { size: A4; margin: 8mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.labels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6mm 6mm;
}
.label {
  border: 1px solid #ddd;
  padding: 4mm;
  border-radius: 2mm;
  height: 25mm; /* ajuste conforme sua etiqueta */
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  font-size: 11pt;
}
.label .l1 { font-weight: 700; font-size: 12pt; }
.label .l2 { opacity: .9; }
.label .l3 { font-weight: 600; }
.label .l4 { font-size: 10pt; opacity: .8; }
`;
