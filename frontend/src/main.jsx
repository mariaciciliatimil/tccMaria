import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import Funcionario from './pages/Funcionario.jsx'
import Iniciar from './pages/Funcionario/Iniciar.jsx'
import Consultar from './pages/Funcionario/Consultar.jsx'
import Relatorio from './pages/Funcionario/Relatorio.jsx'
import Bandejas from './pages/Funcionario/Bandejas.jsx'
import Patologista from './pages/Patologista.jsx'
import Protected from './shared/Protected.jsx'
import StatusBoard from './components/StatusBoard.jsx'

const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  { path: '/admin', element: <Protected roles={['ADMIN']}><Admin /></Protected> },
  {
    path: '/funcionario',
    element: <Protected roles={['FUNCIONARIO']}><Funcionario /></Protected>,
    children: [
      { index: true, element: <StatusBoard /> },
      { path: 'iniciar', element: <Iniciar /> },
      { path: 'consultar', element: <Consultar /> },
      { path: 'relatorio', element: <Relatorio /> },
      { path: 'bandejas', element: <Bandejas /> },
    ]
  },
  { path: '/patologista', element: <Protected roles={['PATOLOGISTA']}><Patologista /></Protected> },
])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
