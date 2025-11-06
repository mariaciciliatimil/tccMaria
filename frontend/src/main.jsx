import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Admin from "./pages/Admin.jsx";

import Funcionario from "./pages/Funcionario.jsx";
import Iniciar from "./pages/Funcionario/Iniciar.jsx";
import Consultar from "./pages/Funcionario/Consultar.jsx";
import Relatorio from "./pages/Funcionario/Relatorio.jsx";
import Bandejas from "./pages/Funcionario/Bandejas.jsx";
import Pacientes from "./pages/Funcionario/Pacientes.jsx";
import Status from "./pages/Funcionario/Status.jsx";

import Patologista from "./pages/Patologista.jsx";
import QueuePatologista from "./pages/Patologista/Queue.jsx";
import Protected from "./shared/Protected.jsx";
import StatusBoard from "./components/StatusBoard.jsx";

// ✅ NOVO: página de impressão de etiquetas
import PrintSlides from "./pages/PrintSlides.jsx";

const router = createBrowserRouter([
  { path: "/", element: <Login /> },

  // ADMIN
  {
    path: "/admin",
    element: (
      <Protected roles={["ADMIN"]}>
        <Admin />
      </Protected>
    ),
  },

  // FUNCIONÁRIO (layout + rotas filhas)
  {
    path: "/funcionario",
    element: (
      <Protected roles={["FUNCIONARIO"]}>
        <Funcionario />
      </Protected>
    ),
    children: [
      { index: true, element: <StatusBoard /> },
      { path: "iniciar", element: <Iniciar /> },
      { path: "pacientes", element: <Pacientes /> },
      { path: "status", element: <Status /> },
      { path: "consultar", element: <Consultar /> },
      { path: "relatorio", element: <Relatorio /> },
      { path: "bandejas", element: <Bandejas /> },
    ],
  },

  // PATOLOGISTA (layout + rotas filhas)
  {
    path: "/patologista",
    element: (
      <Protected roles={["PATOLOGISTA", "ADMIN"]}>
        {/* coloque só PATOLOGISTA se preferir */}
        <Patologista />
      </Protected>
    ),
    children: [
      { index: true, element: <QueuePatologista /> }, // FILA como página inicial do patologista
      // futuro: { path: "meus", element: <QueuePatologista mode="MEUS" /> },
    ],
  },

  // ✅ NOVO: rota de impressão de etiquetas (abre página limpa para o print)
  {
    path: "/print/slides/:examId",
    element: (
      <Protected roles={["FUNCIONARIO", "ADMIN", "PATOLOGISTA"]}>
        <PrintSlides />
      </Protected>
    ),
  },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
