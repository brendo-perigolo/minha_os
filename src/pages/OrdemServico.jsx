import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiSearchLine, RiEyeLine, RiDeleteBinLine, RiFileListLine, RiPrinterLine } from 'react-icons/ri'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { gerarPdfOrdemServico } from '../lib/ordemServicoPdf'
import './OrdemServico.css'

const STATUS_LABELS = {
  aberto: 'Aberto',
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export default function OrdemServico() {
  const navigate = useNavigate()
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleteModal, setDeleteModal] = useState(null)
  const [saving, setSaving] = useState(false)

  const [printModal, setPrintModal] = useState({ open: false, ordem: null, loading: false })

  useEffect(() => { fetchOrdens() }, [])

  async function fetchOrdens() {
    setLoading(true)
    const { data } = await supabase
      .from('ordens_servico')
      .select('*, clientes(nome)')
      .order('created_at', { ascending: false })
    setOrdens(data || [])
    setLoading(false)
  }

  const filtered = ordens.filter(o => {
    const matchSearch = !search ||
      o.clientes?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search)
    const matchStatus = !filterStatus || o.status === filterStatus
    return matchSearch && matchStatus
  })

  async function handleDelete() {
    if (!deleteModal) return
    setSaving(true)
    // Delete child records first
    await supabase.from('ordem_produtos').delete().eq('ordem_id', deleteModal.id)
    await supabase.from('ordem_servicos').delete().eq('ordem_id', deleteModal.id)
    const { error } = await supabase.from('ordens_servico').delete().eq('id', deleteModal.id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Ordem excluída!'); fetchOrdens() }
    setDeleteModal(null)
    setSaving(false)
  }

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  async function baixarPdfOs({ osId, abrirParaImprimir }) {
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select('id, status, total, created_at, problema_reclamado, observacoes, condicao_pagamento, metodo_pagamento, cliente_id, equipamento_id, clientes(nome, telefone), equipamentos(modelo, marca, numero_serie, voltagem)')
      .eq('id', osId)
      .single()
    if (osErr || !os) throw osErr || new Error('OS não encontrada')

    const [{ data: op, error: opErr }, { data: oss, error: ossErr }] = await Promise.all([
      supabase.from('ordem_produtos').select('produto_id, quantidade, preco_unitario, produtos(nome, unidade)').eq('ordem_id', osId),
      supabase.from('ordem_servicos').select('servico_id, quantidade, preco_unitario, servicos(nome)').eq('ordem_id', osId),
    ])
    if (opErr) throw opErr
    if (ossErr) throw ossErr

    const itens = [
      ...(op || []).map(i => ({
        tipo: 'PROD',
        descricao: i.produtos?.nome || 'Produto',
        unidade: i.produtos?.unidade || 'un',
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
      ...(oss || []).map(i => ({
        tipo: 'SERV',
        descricao: i.servicos?.nome || 'Serviço',
        unidade: '',
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
    ]

    await gerarPdfOrdemServico({
      os: {
        id: os.id,
        status: os.status,
        total: os.total,
        created_at: os.created_at,
        problema_reclamado: os.problema_reclamado,
        observacoes: os.observacoes,
        condicao_pagamento: os.condicao_pagamento,
        metodo_pagamento: os.metodo_pagamento,
      },
      cliente: os.clientes,
      equipamento: os.equipamentos,
      itens,
      abrirParaImprimir,
    })
  }

  function openPrint(ordem) {
    setPrintModal({ open: true, ordem, loading: false })
  }

  async function confirmarPrint(abrirParaImprimir) {
    if (!printModal.ordem?.id) return
    setPrintModal(m => ({ ...m, loading: true }))
    try {
      await baixarPdfOs({ osId: printModal.ordem.id, abrirParaImprimir })
      toast.success('PDF gerado!')
      setPrintModal({ open: false, ordem: null, loading: false })
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível gerar o PDF')
      setPrintModal(m => ({ ...m, loading: false }))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-tools os-tools">
          <div className="os-tools-top">
            <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/ordens/nova')}>
              <RiAddLine /> Nova OS
            </button>
          </div>

          <div className="search-bar os-tools-search">
            <RiSearchLine className="search-icon" />
            <input className="form-control" placeholder="Buscar por cliente ou nº..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><p>Carregando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <RiFileListLine />
            <p>Nenhuma ordem encontrada.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/ordens/nova')}>Criar primeira OS</button>
          </div>
        ) : (
          <>
            <div className="os-mobile-list">
              {filtered.map(o => (
                <div key={o.id} className="os-card">
                  <div className="os-card-top" onClick={() => navigate(`/ordens/${o.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="os-card-os">OS #{String(o.id).padStart(4, '0')}</div>
                    <span className={`badge badge-${o.status}`}>{STATUS_LABELS[o.status] || o.status}</span>
                  </div>

                  <div className="os-card-client" title={o.clientes?.nome || ''}>
                    {o.clientes?.nome || '—'}
                  </div>

                  <div className="os-card-meta">
                    <span className="fw-600">{fmt(o.total)}</span>
                    <span>{new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div className="os-card-actions">
                    <button className="btn btn-secondary btn-icon" title="Ver/Editar" onClick={() => navigate(`/ordens/${o.id}`)}>
                      <RiEyeLine />
                    </button>
                    <button className="btn btn-secondary btn-icon" title="Reimprimir" onClick={() => openPrint(o)}>
                      <RiPrinterLine />
                    </button>
                    <button className="btn btn-danger btn-icon" title="Excluir" onClick={() => setDeleteModal(o)}>
                      <RiDeleteBinLine />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="table-wrapper os-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Nº OS</th>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td className="fw-600 text-red">#{String(o.id).padStart(4, '0')}</td>
                      <td className="fw-600">{o.clientes?.nome || '—'}</td>
                      <td><span className={`badge badge-${o.status}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                      <td className="fw-600">{fmt(o.total)}</td>
                      <td className="text-gray">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-secondary btn-icon" title="Ver/Editar" onClick={() => navigate(`/ordens/${o.id}`)}>
                            <RiEyeLine />
                          </button>
                          <button className="btn btn-secondary btn-icon" title="Reimprimir" onClick={() => openPrint(o)}>
                            <RiPrinterLine />
                          </button>
                          <button className="btn btn-danger btn-icon" title="Excluir" onClick={() => setDeleteModal(o)}>
                            <RiDeleteBinLine />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {printModal.open && (
        <div className="modal-overlay" onClick={() => !printModal.loading && setPrintModal({ open: false, ordem: null, loading: false })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Confirmação</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => !printModal.loading && setPrintModal({ open: false, ordem: null, loading: false })}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA IMPRIMIR?</p>
                <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>
                  O sistema vai baixar o <strong>PDF</strong> da OS #{String(printModal.ordem?.id || '').padStart(4, '0')}.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={printModal.loading} onClick={() => confirmarPrint(false)}>Não</button>
              <button className="btn btn-success" disabled={printModal.loading} onClick={() => confirmarPrint(true)}>
                {printModal.loading ? 'Gerando...' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir OS</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setDeleteModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Excluir a OS <strong>#{String(deleteModal.id).padStart(4, '0')}</strong> de <strong>{deleteModal.clientes?.nome}</strong>? Todos os itens serão removidos.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>{saving ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
