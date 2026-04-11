import React, { useMemo, useRef, useState, useEffect } from 'react'
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
  RiNotification3Line,
  RiNotificationOffLine,
  RiLogoutBoxRLine,
  RiUserSettingsLine,
  RiWallet3Line,
  RiBarChartBoxLine,
  RiArchiveLine,
} from 'react-icons/ri'
import './Layout.css'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { disablePushNotifications, enablePushNotifications, getPushStatus } from '../lib/pushNotifications'

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
  const { session, userProfile, isAdmin } = useAuth()
  const location = useLocation()

  const [pushInfo, setPushInfo] = useState({ supported: false, permission: 'default', subscribed: false })
  const [pushLoading, setPushLoading] = useState(false)
  const promptedRef = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  async function refreshPushInfo() {
    try {
      const info = await getPushStatus()
      setPushInfo(info)
    } catch {
      setPushInfo({ supported: false, permission: 'default', subscribed: false })
    }
  }

  useEffect(() => {
    refreshPushInfo()
  }, [])

  useEffect(() => {
    // Ao abrir o sistema: se não estiver ativo, perguntar se deseja ativar
    // (somente uma vez por carregamento e somente quando logado)
    if (promptedRef.current) return
    if (!session?.user?.id) return
    if (!pushInfo.supported) return
    if (pushInfo.permission === 'denied') return
    if (pushInfo.subscribed) return

    promptedRef.current = true
    const ok = window.confirm('Deseja ativar as notificações neste aparelho?')
    if (!ok) return

    ;(async () => {
      setPushLoading(true)
      try {
        await enablePushNotifications({ supabase, userId: session.user.id })
        toast.success('Notificações ativadas!')
        await refreshPushInfo()
      } catch (e) {
        console.error(e)
        toast.error(e?.message || 'Não foi possível ativar')
      }
      setPushLoading(false)
    })()
  }, [session?.user?.id, pushInfo.supported, pushInfo.permission, pushInfo.subscribed])

  const bellIcon = useMemo(() => {
    if (!pushInfo.supported) return <RiNotificationOffLine />
    if (pushInfo.permission === 'denied') return <RiNotificationOffLine />
    return pushInfo.subscribed ? <RiNotification3Line /> : <RiNotificationOffLine />
  }, [pushInfo.supported, pushInfo.permission, pushInfo.subscribed])

  async function togglePush() {
    if (!session?.user?.id) {
      toast.error('Faça login para gerenciar notificações')
      return
    }
    if (!pushInfo.supported) {
      toast.error('Seu navegador não suporta notificações push')
      return
    }
    if (pushInfo.permission === 'denied') {
      toast.error('Notificações bloqueadas no navegador')
      return
    }

    setPushLoading(true)
    try {
      if (pushInfo.subscribed) {
        await disablePushNotifications({ supabase, userId: session.user.id })
        toast.success('Notificações desativadas!')
      } else {
        await enablePushNotifications({ supabase, userId: session.user.id })
        toast.success('Notificações ativadas!')
      }
      await refreshPushInfo()
    } catch (e) {
      console.error(e)
      toast.error(e?.message || 'Não foi possível atualizar')
    }
    setPushLoading(false)
  }

  const pageTitle = navItems.find(n => {
    if (n.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(n.to)
  })?.label || 'ELETROCED'

  const headerTitle = pageTitle === 'Ordens de Serviço' ? 'O.S Serviço' : pageTitle

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
        <header className={`header ${location.pathname === '/' ? 'is-dashboard' : ''}`}>
          <div className="header-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <RiMenuLine />
            </button>
            <NavLink to="/" className="mobile-brand" aria-label="Ir para o Dashboard">
              <img className="mobile-brand-icon" src="/brand/mark.svg" alt="" />
              <span className="mobile-brand-name">ELETROCED</span>
            </NavLink>
            <h1 className="header-title">{headerTitle}</h1>
          </div>
          <div className="header-right">
            <button
              className={`btn btn-secondary btn-icon ${pushInfo.subscribed ? 'push-active' : ''}`}
              onClick={togglePush}
              disabled={pushLoading}
              title={pushInfo.subscribed ? 'Desativar notificações' : 'Ativar notificações'}
            >
              {bellIcon}
            </button>
            <button 
              className="btn btn-secondary btn-icon" 
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? <RiSunLine /> : <RiMoonLine />}
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => supabase.auth.signOut()}
              title="Sair"
            >
              <RiLogoutBoxRLine />
            </button>
          </div>
        </header>
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  )
}
