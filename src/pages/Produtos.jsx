import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiSearchLine, RiFileList2Line } from 'react-icons/ri'
import toast from 'react-hot-toast'

const EMPTY = { nome: '', descricao: '', preco: '', estoque: '', unidade: 'un' }

export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  const [movOpen, setMovOpen] = useState(false)
  const [movProduto, setMovProduto] = useState(null)
  const [movimentos, setMovimentos] = useState([])
  const [movLoading, setMovLoading] = useState(false)

  const confirmResolverRef = useRef(null)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: 'Confirmação',
    content: null,
    confirmText: 'Sim',
    cancelText: 'Não',
    confirmClassName: 'btn btn-success'
  })

  useEffect(() => { fetchProdutos() }, [])

  async function fetchProdutos() {
    setLoading(true)
    const { data: viewData, error: viewErr } = await supabase.from('vw_produtos_estoque').select('*').order('nome')
    if (!viewErr) {
      setProdutos(viewData || [])
    } else {
      const { data } = await supabase.from('produtos').select('*').order('nome')
      setProdutos(data || [])
    }
    setLoading(false)
  }

  const filtered = produtos.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() { setForm(EMPTY); setModal('create') }
  function openEdit(p) { setSelected(p); setForm({ nome: p.nome, descricao: p.descricao || '', preco: p.preco, estoque: p.estoque, unidade: p.unidade || 'un' }); setModal('edit') }
  function openDelete(p) { setSelected(p); setModal('delete') }
  function closeModal() { setModal(null); setSelected(null) }

  function askConfirm({ title = 'Confirmação', content, confirmText = 'Sim', cancelText = 'Não', confirmClassName = 'btn btn-success' }) {
    return new Promise(resolve => {
      confirmResolverRef.current = resolve
      setConfirmModal({ open: true, title, content, confirmText, cancelText, confirmClassName })
    })
  }

  function closeConfirm(choice) {
    setConfirmModal(m => ({ ...m, open: false }))
    if (confirmResolverRef.current) {
      confirmResolverRef.current(choice)
      confirmResolverRef.current = null
    }
  }

  async function openMovimentos(p) {
    setMovProduto(p)
    setMovOpen(true)
    setMovLoading(true)
    setMovimentos([])

    const { data, error } = await supabase
      .from('estoque_movimentos')
      .select('id, tipo, quantidade, ordem_id, created_at')
      .eq('produto_id', p.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      toast.error('Erro ao carregar movimentações')
    } else {
      setMovimentos(data || [])
    }

    setMovLoading(false)
  }

  function closeMovimentos() {
    setMovOpen(false)
    setMovProduto(null)
    setMovimentos([])
    setMovLoading(false)
  }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (form.preco === '' || isNaN(form.preco)) return toast.error('Preço inválido')
    setSaving(true)

    const estoqueInt = Math.trunc(Number(form.estoque) || 0)
    const payload = { ...form, preco: Number(form.preco), estoque: estoqueInt }

    if (modal === 'create') {
      const { error } = await supabase.from('produtos').insert([payload])
      if (error) toast.error('Erro ao salvar')
      else { toast.success('Produto criado!'); fetchProdutos(); closeModal() }
    } else {
      const estoqueAnterior = Math.trunc(Number(selected?.estoque) || 0)
      const estoqueNovo = estoqueInt

      if (estoqueNovo !== estoqueAnterior) {
        const delta = estoqueNovo - estoqueAnterior
        const ok = await askConfirm({
          title: 'Confirmação',
          content: (
            <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>ESTOQUE VAI SER ALTERADO</p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>Deseja continuar?</p>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--dark-2)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>Anterior</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{estoqueAnterior}</div>
                </div>
                <div style={{ background: 'var(--dark-2)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>Novo</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{estoqueNovo}</div>
                </div>
                <div style={{ background: 'var(--dark-2)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>Ajuste</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: delta >= 0 ? 'var(--success)' : 'var(--red)' }}>{delta >= 0 ? `+${delta}` : `${delta}`}</div>
                </div>
              </div>
            </div>
          ),
          confirmText: 'Sim',
          cancelText: 'Não',
          confirmClassName: 'btn btn-success'
        })
        if (!ok) {
          setSaving(false)
          return
        }

        // 1) Ajusta estoque via RPC (atômico e grava movimento)
        const { error: rpcErr } = await supabase.rpc('ajustar_estoque_cadastro', {
          p_produto_id: Number(selected.id),
          p_novo_estoque: estoqueNovo,
          p_descricao: 'Ajuste Cadastro'
        })

        if (rpcErr) {
          console.warn('RPC ajustar_estoque_cadastro falhou; tentando fallback.', rpcErr)

          // Fallback: atualiza estoque e registra movimento manualmente
          const { data: prodRow, error: prodErr } = await supabase
            .from('produtos')
            .select('id, estoque')
            .eq('id', selected.id)
            .single()

          if (prodErr || !prodRow) {
            toast.error('Erro ao ajustar estoque')
            setSaving(false)
            return
          }

          const anterior = Math.trunc(Number(prodRow.estoque) || 0)
          const atual = estoqueNovo
          const deltaFallback = atual - anterior

          const { error: updErr } = await supabase.from('produtos').update({ estoque: atual }).eq('id', selected.id)
          if (updErr) {
            toast.error('Erro ao ajustar estoque')
            setSaving(false)
            return
          }

          const { error: insErr } = await supabase.from('estoque_movimentos').insert([
            {
              produto_id: Number(selected.id),
              tipo: 'ajuste',
              quantidade: deltaFallback,
              descricao: `Ajuste Cadastro (de ${anterior} para ${atual})`,
              estoque_anterior: anterior,
              estoque_atual: atual,
            },
          ])

          if (insErr) {
            toast.error('Movimentações de ajuste não configuradas (aplique a migração SQL).')
            setSaving(false)
            return
          }
        }

        // 2) Atualiza demais campos (sem mexer no estoque novamente)
        const { error: updErr2 } = await supabase
          .from('produtos')
          .update({ nome: payload.nome, descricao: payload.descricao, preco: payload.preco, unidade: payload.unidade })
          .eq('id', selected.id)
        if (updErr2) toast.error('Erro ao salvar')
        else { toast.success('Produto atualizado!'); fetchProdutos(); closeModal() }
      } else {
        const { error } = await supabase.from('produtos').update(payload).eq('id', selected.id)
        if (error) toast.error('Erro ao salvar')
        else { toast.success('Produto atualizado!'); fetchProdutos(); closeModal() }
      }
    }
    setSaving(false)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('produtos').delete().eq('id', selected.id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Produto excluído!'); fetchProdutos(); closeModal() }
    setSaving(false)
  }

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
  const fmtQtd = v => v != null ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '—'
  const fmtDataHora = v => v ? new Date(v).toLocaleString('pt-BR') : '—'

  return (
    <div>
      <div className="page-header">
        <h2>Produtos</h2>
        <div className="page-tools">
          <div className="search-bar">
            <RiSearchLine className="search-icon" />
            <input className="form-control" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openCreate}><RiAddLine /> Novo Produto</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state"><p>Carregando...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>Nenhum produto encontrado.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Preço</th>
                  <th>Total</th>
                  <th>Reservado</th>
                  <th>Livre</th>
                  <th>Unidade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="fw-600">{p.nome}</td>
                    <td className="text-gray">{p.descricao || '—'}</td>
                    <td className="fw-600 text-red">{fmt(p.preco)}</td>
                    <td>{p.estoque ?? '—'}</td>
                    <td>{p.estoque_reservado ?? 0}</td>
                    <td>{p.estoque_livre ?? (p.estoque ?? 0)}</td>
                    <td>{p.unidade}</td>
                    <td>
                      <div className="td-actions">
                        <button
                          className="btn btn-secondary btn-icon"
                          title="Movimentações"
                          onClick={() => openMovimentos(p)}
                        >
                          <RiFileList2Line />
                        </button>
                        <button className="btn btn-secondary btn-icon" onClick={() => openEdit(p)}><RiEditLine /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => openDelete(p)}><RiDeleteBinLine /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {movOpen && (
        <div className="modal-overlay" onClick={closeMovimentos}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Movimentações - {movProduto?.nome}</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeMovimentos}>✕</button>
            </div>
            <div className="modal-body">
              {movLoading ? (
                <div className="empty-state"><p>Carregando...</p></div>
              ) : movimentos.length === 0 ? (
                <div className="empty-state"><p>Nenhuma movimentação encontrada.</p></div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Quantidade</th>
                        <th>Documento</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentos.map(m => (
                        <tr key={m.id}>
                          <td className="fw-600">{m.tipo}</td>
                          <td>{fmtQtd(m.quantidade)}</td>
                          <td>{m.ordem_id ? `OS #${m.ordem_id}` : '—'}</td>
                          <td>{fmtDataHora(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeMovimentos}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Novo Produto' : 'Editar Produto'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome *</label>
                <input className="form-control" placeholder="Nome do produto" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea className="form-control" placeholder="Descrição do produto" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço *</label>
                  <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Estoque</label>
                  <input className="form-control" type="number" min="0" placeholder="0" value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Unidade</label>
                <select className="form-control" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}>
                  <option value="un">Unidade (un)</option>
                  <option value="m">Metro (m)</option>
                  <option value="m2">Metro² (m²)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="l">Litro (L)</option>
                  <option value="cx">Caixa (cx)</option>
                  <option value="pc">Peça (pc)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir Produto</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja excluir o produto <strong>{selected?.nome}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>{saving ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="modal-overlay" onClick={() => closeConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => closeConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              {confirmModal.content}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => closeConfirm(false)}>{confirmModal.cancelText}</button>
              <button className={confirmModal.confirmClassName} onClick={() => closeConfirm(true)}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
