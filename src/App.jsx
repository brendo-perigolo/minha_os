import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Produtos from './pages/Produtos'
import Servicos from './pages/Servicos'
import EstoqueEntrada from './pages/EstoqueEntrada'
import OrdemServico from './pages/OrdemServico'
import OrdemServicoForm from './pages/OrdemServicoForm'
import Caixa from './pages/Caixa'
import Financeiro from './pages/Financeiro'
import Login from './pages/Login'
import Usuarios from './pages/Usuarios'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Navigate } from 'react-router-dom'

function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null // ou um spinner
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#232323',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#232323' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#232323' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Protegidas */}
          <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/clientes" element={<PrivateRoute><Layout><Clientes /></Layout></PrivateRoute>} />
          <Route path="/produtos" element={<PrivateRoute><Layout><Produtos /></Layout></PrivateRoute>} />
          <Route path="/estoque/entrada" element={<PrivateRoute><Layout><EstoqueEntrada /></Layout></PrivateRoute>} />
          <Route path="/servicos" element={<PrivateRoute><Layout><Servicos /></Layout></PrivateRoute>} />
          <Route path="/ordens" element={<PrivateRoute><Layout><OrdemServico /></Layout></PrivateRoute>} />
          <Route path="/ordens/:id" element={<PrivateRoute><Layout><OrdemServicoForm /></Layout></PrivateRoute>} />
          <Route path="/caixa" element={<PrivateRoute><Layout><Caixa /></Layout></PrivateRoute>} />
          <Route path="/financeiro" element={<PrivateRoute><Layout><Financeiro /></Layout></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><Layout><Usuarios /></Layout></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
