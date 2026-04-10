import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  RiDashboardLine,
  RiUserLine,
  RiBox3Line,
  RiToolsLine,
  RiFileListLine,
  RiMenuLine,
  RiCloseLine,
  RiSunLine,
  RiMoonLine,
  RiLogoutBoxRLine,
  RiUserSettingsLine,
  RiWallet3Line,
  RiBarChartBoxLine,
  RiArchiveLine,
} from 'react-icons/ri'
import './Layout.css'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Dashboard', icon: <RiDashboardLine /> },
  { to: '/clientes', label: 'Clientes', icon: <RiUserLine /> },
  { to: '/produtos', label: 'Produtos', icon: <RiBox3Line /> },
  { to: '/estoque/entrada', label: 'Entrada de Estoque', icon: <RiArchiveLine /> },
  { to: '/servicos', label: 'Serviços', icon: <RiToolsLine /> },
  { to: '/ordens', label: 'Ordens de Serviço', icon: <RiFileListLine /> },
  { to: '/caixa', label: 'Caixa Diário', icon: <RiWallet3Line /> },
  { to: '/financeiro', label: 'Financeiro', icon: <RiBarChartBoxLine /> },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const { userProfile, isAdmin } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const pageTitle = navItems.find(n => {
    if (n.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(n.to)
  })?.label || 'ELETROCED'

  return (
    <div className="layout">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon" aria-hidden="true">
            <img src="/brand/mark.svg" alt="" />
          </div>
          <div className="logo-text">
            <span className="logo-name">ELETROCED</span>
            <span className="logo-sub">Sistema OS</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Menu Principal</span>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
          
          {isAdmin && (
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon"><RiUserSettingsLine /></span>
              <span className="nav-label">Usuários</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-user">
            <div className="user-avatar">{userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}</div>
            <div className="user-info">
              <span className="user-name">{userProfile?.nome || 'Carregando...'}</span>
              <span className="user-role">
                {userProfile?.is_administrador ? 'Administrador' : userProfile?.is_vendedor ? 'Vendedor' : 'Limitado'}
              </span>
            </div>
            <button 
              className="btn btn-secondary btn-icon" 
              style={{ marginLeft: 'auto', border: 'none', background: 'transparent' }}
              onClick={() => supabase.auth.signOut()}
              title="Sair"
            >
              <RiLogoutBoxRLine />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="header">
          <div className="header-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <RiMenuLine />
            </button>
            <h1 className="header-title">{pageTitle}</h1>
          </div>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <RiSunLine /> : <RiMoonLine />}
          </button>
        </header>
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
