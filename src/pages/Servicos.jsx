import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiSearchLine } from 'react-icons/ri'
import toast from 'react-hot-toast'

const EMPTY = { nome: '', descricao: '', preco: '' }

export default function Servicos() {
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchServicos() }, [])

  async function fetchServicos() {
    setLoading(true)
    const { data } = await supabase.from('servicos').select('*').order('nome')
    setServicos(data || [])
    setLoading(false)
  }

  const filtered = servicos.filter(s =>
    s.nome?.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() { setForm(EMPTY); setModal('create') }
  function openEdit(s) { setSelected(s); setForm({ nome: s.nome, descricao: s.descricao || '', preco: s.preco }); setModal('edit') }
  function openDelete(s) { setSelected(s); setModal('delete') }
  function closeModal() { setModal(null); setSelected(null) }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (form.preco === '' || isNaN(form.preco)) return toast.error('Preço inválido')
    setSaving(true)
    const payload = { ...form, preco: Number(form.preco) }
    if (modal === 'create') {
      const { error } = await supabase.from('servicos').insert([payload])
      if (error) toast.error('Erro ao salvar')
      else { toast.success('Serviço criado!'); fetchServicos(); closeModal() }
    } else {
      const { error } = await supabase.from('servicos').update(payload).eq('id', selected.id)
      if (error) toast.error('Erro ao salvar')
      else { toast.success('Serviço atualizado!'); fetchServicos(); closeModal() }
    }
    setSaving(false)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('servicos').delete().eq('id', selected.id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Serviço excluído!'); fetchServicos(); closeModal() }
    setSaving(false)
  }

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div>
      <div className="page-header">
        <h2>Serviços</h2>
        <div className="page-tools">
          <div className="search-bar">
            <RiSearchLine className="search-icon" />
            <input className="form-control" placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openCreate}><RiAddLine /> Novo Serviço</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state"><p>Carregando...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>Nenhum serviço encontrado.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Preço</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="fw-600">{s.nome}</td>
                    <td className="text-gray">{s.descricao || '—'}</td>
                    <td className="fw-600 text-red">{fmt(s.preco)}</td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-secondary btn-icon" onClick={() => openEdit(s)}><RiEditLine /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => openDelete(s)}><RiDeleteBinLine /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Novo Serviço' : 'Editar Serviço'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome *</label>
                <input className="form-control" placeholder="Nome do serviço" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea className="form-control" placeholder="Descrição do serviço" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Preço *</label>
                <input className="form-control" type="number" min="0" step="0.01" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} />
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
              <h3>Excluir Serviço</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja excluir o serviço <strong>{selected?.nome}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>{saving ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
