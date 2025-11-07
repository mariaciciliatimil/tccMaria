// src/layouts/SidebarLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const FUNC_MENU = [
  { label: "Iniciar paciente", to: "/funcionario/iniciar",  icon: "➕" },
  { label: "Pacientes",        to: "/funcionario/pacientes",icon: "👥" },
  { label: "Status",           to: "/funcionario/status",   icon: "📊" },
  { label: "Consultar",        to: "/funcionario/consultar",icon: "🔎" },
  { label: "Relatório",        to: "/funcionario/relatorio",icon: "📄" },
  { label: "Bandejas",         to: "/funcionario/bandejas", icon: "🧪" },
];

const PATO_MENU = [
  { label: "Fila do dia", to: "/patologista",             icon: "🧬" },
  { label: "Relatório",   to: "/patologista/relatorio",   icon: "📄" }, // ✅ novo
  // futuro: { label: 'Meus',  to: '/patologista/meus',   icon: '📌' },
];

function MenuItem({ to, label, icon, collapsed }) {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");

  const base = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    textDecoration: "none",
    color: "#0b2b3a",
    fontWeight: 800,
    letterSpacing: 0.3,
    border: "1px solid transparent",
    transition: "transform .15s ease, background .15s ease, box-shadow .15s ease, border .15s ease",
  };

  const style = active
    ? {
        ...base,
        background: "rgba(255,255,255,.78)",
        border: "1px solid rgba(2,6,23,.12)",
        boxShadow: "0 10px 24px rgba(2,6,23,.12)",
      }
    : {
        ...base,
        background: "transparent",
      };

  return (
    <Link
      to={to}
      style={style}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,.55)",
          border: "1px solid rgba(2,6,23,.08)",
          boxShadow: "0 4px 10px rgba(2,6,23,.08)",
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </div>
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
    </Link>
  );
}

export default function SidebarLayout({ title }) {
  const { pathname } = useLocation();
  const isPatologista = pathname.startsWith("/patologista");
  const MENU = useMemo(() => (isPatologista ? PATO_MENU : FUNC_MENU), [isPatologista]);

  const autoTitle = isPatologista ? "ÁREA DO PATOLOGISTA" : "SISTEMA DE RASTREAMENTO PATOLÓGICO";

  // colapso + responsividade
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const apply = () => setCollapsed(window.innerWidth < 980);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const SIDEBAR_W = collapsed ? 88 : 280;

  const css = {
    shell: {
      display: "grid",
      gridTemplateColumns: `${SIDEBAR_W}px 1fr`,
      minHeight: "100vh",
      background: "linear-gradient(120deg,#f8fafc 0%, #eef2ff 60%, #fff 100%)",
    },
    aside: {
      position: "sticky",
      top: 0,
      height: "100vh",
      background: "linear-gradient(180deg,#a9d0e2 0%,#8bbfd3 100%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 12px 30px rgba(2,6,23,.15)",
      borderRight: "1px solid rgba(2,6,23,.1)",
      display: "flex",
      flexDirection: "column",
      padding: 16,
      overflow: "hidden",
    },
    brandRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: collapsed ? "center" : "space-between",
      gap: 8,
      padding: "8px 10px",
      marginBottom: 10,
    },
    title: { fontWeight: 900, fontSize: 26, letterSpacing: 0.6, color: "#0b2b3a" },
    toggle: {
      border: "1px solid rgba(2,6,23,.15)",
      background: "rgba(255,255,255,.6)",
      cursor: "pointer",
      padding: "6px 10px",
      borderRadius: 10,
      fontWeight: 800,
    },
    nav: { display: "grid", gap: 8, marginTop: 8 },
    footer: {
      marginTop: "auto",
      fontSize: 12,
      color: "#0b2b3a",
      opacity: 0.7,
      padding: "8px 4px",
      textAlign: collapsed ? "center" : "left",
    },
    main: {
      position: "relative",
      zIndex: 1,
      padding: 24,
      overflow: "auto",
    },
    h2: { textAlign: "center", marginTop: 0, fontSize: 18, letterSpacing: 1, fontWeight: 900 },
  };

  return (
    <div style={css.shell}>
      <aside style={css.aside}>
        <div style={css.brandRow}>
          {!collapsed && <div style={css.title}>SIRP</div>}
          <button style={css.toggle} onClick={() => setCollapsed((v) => !v)} aria-label="Alternar menu">
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav style={css.nav}>
          {MENU.map((m) => (
            <MenuItem key={m.to} {...m} collapsed={collapsed} />
          ))}
        </nav>

        <div style={css.footer}>
          {!collapsed && (
            <>
              <div>
                <b>Laboratório</b> • v1.0
              </div>
              <div>© {new Date().getFullYear()} SIRP</div>
            </>
          )}
          {collapsed && <span>v1.0</span>}
        </div>
      </aside>

      <main style={css.main}>
        <h2 style={css.h2}>{title || autoTitle}</h2>
        <Outlet />
      </main>
    </div>
  );
}
