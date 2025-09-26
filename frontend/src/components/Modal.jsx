export default function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>Fechar</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

const backdrop = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
};
const modal = {
  width: 'min(560px, 92vw)', background: '#fff', borderRadius: 12,
  padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
};
