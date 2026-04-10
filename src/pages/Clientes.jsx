import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiSearchLine } from 'react-icons/ri'
import toast from 'react-hot-toast'

const EMPTY = { nome: '', email: '', telefone: '', cpf_cnpj: '', endereco: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | 'edit' | 'delete'
  const [form, setForm] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes(data || [])
    setLoading(false)
  }

  const filtered = clientes.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search)
  )

  function openCreate() { setForm(EMPTY); setModal('create') }
  function openEdit(c) { setSelected(c); setForm({ nome: c.nome, email: c.email, telefone: c.telefone, cpf_cnpj: c.cpf_cnpj, endereco: c.endereco }); setModal('edit') }
  function openDelete(c) { setSelected(c); setModal('delete') }
  function closeModal() { setModal(null); setSelected(null) }

  async function handleSave() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    setSaving(true)
    if (modal === 'create') {
      const { error } = await supabase.from('clientes').insert([form])
      if (error) toast.error('Erro ao salvar')
      else { toast.success('Cliente criado!'); fetchClientes(); closeModal() }
    } else {
      const { error } = await supabase.from('clientes').update(form).eq('id', selected.id)
      if (error) toast.error('Erro ao salvar')
      else { toast.success('Cliente atualizado!'); fetchClientes(); closeModal() }
    }
    setSaving(false)
  }

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('clientes').delete().eq('id', selected.id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Cliente excluído!'); fetchClientes(); closeModal() }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Clientes</h2>
        <div className="page-tools">
          <div className="search-bar">
            <RiSearchLine className="search-icon" />
            <input className="form-control" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openCreate}><RiAddLine /> Novo Cliente</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state"><p>Carregando...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>Nenhum cliente encontrado.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th>CPF/CNPJ</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="fw-600">{c.nome}</td>
                    <td className="text-gray">{c.email || '—'}</td>
                    <td>{c.telefone || '—'}</td>
                    <td>{c.cpf_cnpj || '—'}</td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-secondary btn-icon" title="Editar" onClick={() => openEdit(c)}><RiEditLine /></button>
                        <button className="btn btn-danger btn-icon" title="Excluir" onClick={() => openDelete(c)}><RiDeleteBinLine /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Create/Edit */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome *</label>
                <input className="form-control" placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input className="form-control" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>CPF / CNPJ</label>
                <input className="form-control" placeholder="000.000.000-00" value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Endereço</label>
                <input className="form-control" placeholder="Rua, número, bairro..." value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
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

      {/* Modal Delete */}
      {modal === 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir Cliente</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja excluir o cliente <strong>{selected?.nome}</strong>? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
