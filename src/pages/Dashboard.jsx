import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiUserLine, RiBox3Line, RiToolsLine, RiFileListLine, RiArrowRightLine } from 'react-icons/ri'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import './Dashboard.css'
import { useAuth } from '../contexts/AuthContext'
import pkg from '../../package.json'

const statusLabel = {
  aberto: 'Aberto',
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, userProfile } = useAuth()
  const [stats, setStats] = useState({ clientes: 0, produtos: 0, servicos: 0, ordens: 0 })
  const [recentOrdens, setRecentOrdens] = useState([])
  const [openOrdens, setOpenOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  const [techModal, setTechModal] = useState({ open: false, os: null, tecnico: '', saving: false })

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [cl, pr, sv, or] = await Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('produtos').select('id', { count: 'exact', head: true }),
      supabase.from('servicos').select('id', { count: 'exact', head: true }),
      supabase.from('ordens_servico').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      clientes: cl.count || 0,
      produtos: pr.count || 0,
      servicos: sv.count || 0,
      ordens: or.count || 0,
    })

    {
      const { data: ordens, error } = await supabase
        .from('ordens_servico')
        .select('id, status, total, created_at, clientes(nome)')
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) {
        console.error('Erro ao carregar ordens recentes:', error)
        const { data: ordensFallback, error: errorFallback } = await supabase
          .from('ordens_servico')
          .select('id, status, total, created_at')
          .order('created_at', { ascending: false })
          .limit(8)
        if (errorFallback) console.error('Erro fallback ordens recentes:', errorFallback)
        setRecentOrdens(ordensFallback || [])
      } else {
        setRecentOrdens(ordens || [])
      }
    }

    {
      const { data: abertas, error } = await supabase
        .from('ordens_servico')
        .select('id, status, created_at, tecnico_atendimento, clientes(nome, endereco)')
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Erro ao carregar OS em aberto:', error)
        // Fallback sem join/colunas opcionais (evita 400 caso migração/relacionamento não exista)
        const { data: abertasFallback, error: errorFallback } = await supabase
          .from('ordens_servico')
          .select('id, status, created_at')
          .eq('status', 'aberto')
          .order('created_at', { ascending: false })
          .limit(5)
        if (errorFallback) console.error('Erro fallback OS em aberto:', errorFallback)
        setOpenOrdens(abertasFallback || [])
      } else {
        setOpenOrdens(abertas || [])
      }
    }
    setLoading(false)
  }


  function openTechModal(os) {
    setTechModal({ open: true, os, tecnico: '', saving: false })
  }

  async function confirmTech() {
    if (!techModal.os?.id) return
    const tecnico = techModal.tecnico.trim()
    if (!tecnico) {
      toast.error('Informe o técnico')
      return
    }
    setTechModal(m => ({ ...m, saving: true }))
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ status: 'em_andamento', tecnico_atendimento: tecnico })
        .eq('id', techModal.os.id)
      if (error) throw error
      toast.success('OS marcada em atendimento!')
      setTechModal({ open: false, os: null, tecnico: '', saving: false })
      fetchAll()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível atualizar a OS')
      setTechModal(m => ({ ...m, saving: false }))
    }
  }

  const cards = [
    { label: 'Clientes', value: stats.clientes, icon: <RiUserLine />, color: '#3b82f6', to: '/clientes' },
    { label: 'Produtos', value: stats.produtos, icon: <RiBox3Line />, color: '#8b5cf6', to: '/produtos' },
    { label: 'Serviços', value: stats.servicos, icon: <RiToolsLine />, color: '#f59e0b', to: '/servicos' },
    { label: 'Ordens de Serviço', value: stats.ordens, icon: <RiFileListLine />, color: '#C41E2A', to: '/ordens' },
  ]

  const loggedUserLabel = userProfile?.nome || session?.user?.email || 'Usuário'
  const appVersion = pkg?.version || ''

  return (
    <div className="dashboard">
      <div className="dash-welcome dash-welcome-app">
        <div className="dash-welcome-text">
          <div className="dash-topline">
            <h2 className="dash-user-title">{loggedUserLabel}</h2>
            {appVersion ? <span className="dash-version">v{appVersion}</span> : null}
          </div>
        </div>
      </div>

      <div className="dash-stats">
        {cards.map(c => (
          <div
            key={c.label}
            className="stat-card"
            style={{ '--card-color': c.color }}
            onClick={() => navigate(c.to)}
          >
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{loading ? '—' : c.value}</span>
              <span className="stat-label">{c.label}</span>
            </div>
            <RiArrowRightLine className="stat-arrow" />
          </div>
        ))}
      </div>

      {/* Mobile app experience */}
      <div className="dash-mobile-only">
        <div className="card dash-mobile-card">
          <div className="card-title-row">
            <h3>OS em Aberto</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ordens')}>Ver todas</button>
          </div>

          {loading ? (
            <div className="empty-state"><p>Carregando...</p></div>
          ) : openOrdens.length === 0 ? (
            <div className="empty-state"><p>Nenhuma OS em aberto.</p></div>
          ) : (
            <div className="dash-open-list" style={{ marginTop: 12 }}>
              {openOrdens.map(o => (
                <div key={o.id} className="dash-open-item">
                  <div className="dash-open-main" onClick={() => navigate(`/ordens/${o.id}`)}>
                    <div className="dash-open-top">
                      <span className="dash-open-os">OS #{String(o.id).padStart(4, '0')}</span>
                      <span className="badge badge-aberto">Aberto</span>
                    </div>
                    <div className="dash-open-client">{o.clientes?.nome || '—'}</div>
                    <div className="dash-open-addr">{o.clientes?.endereco || '—'}</div>
                    <div className="dash-open-date">{new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <button className="btn btn-success btn-sm" onClick={() => openTechModal(o)}>Em atendimento</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h3>Ordens Recentes</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/ordens')}>Ver todas</button>
        </div>
        {loading ? (
          <div className="empty-state"><p>Carregando...</p></div>
        ) : recentOrdens.length === 0 ? (
          <div className="empty-state"><p>Nenhuma ordem cadastrada ainda.</p></div>
        ) : (
          <div className="table-wrapper mt-16">
            <table>
              <thead>
                <tr>
                  <th>Nº OS</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {recentOrdens.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <td className="fw-600 text-red">#{String(o.id).padStart(4, '0')}</td>
                    <td>{o.clientes?.nome || '—'}</td>
                    <td>
                      <span className={`badge badge-${o.status}`}>
                        {statusLabel[o.status] || o.status}
                      </span>
                    </td>
                    <td className="fw-600">
                      {o.total != null
                        ? `R$ ${Number(o.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="text-gray">
                      {new Date(o.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {techModal.open && (
        <div className="modal-overlay" onClick={() => !techModal.saving && setTechModal({ open: false, os: null, tecnico: '', saving: false })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Em atendimento</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => !techModal.saving && setTechModal({ open: false, os: null, tecnico: '', saving: false })}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 10 }}>
                OS <strong>#{String(techModal.os?.id || '').padStart(4, '0')}</strong> — informe o técnico responsável.
              </p>
              <div className="form-group">
                <label>Técnico</label>
                <input className="form-control" placeholder="Ex.: Danilo" value={techModal.tecnico} onChange={e => setTechModal(m => ({ ...m, tecnico: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={techModal.saving} onClick={() => setTechModal({ open: false, os: null, tecnico: '', saving: false })}>Cancelar</button>
              <button className="btn btn-success" disabled={techModal.saving} onClick={confirmTech}>{techModal.saving ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
