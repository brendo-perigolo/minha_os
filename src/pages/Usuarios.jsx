import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiDeleteBinLine, RiUserSettingsLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

const EMPTY = {
  nome: '',
  email: '',
  password: '',
  is_licenca: true,
  is_administrador: false,
  is_caixa: false,
  is_vendedor: false,
}

export default function Usuarios() {
  const { session, isAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isAdmin) fetchUsuarios()
  }, [isAdmin])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('usuarios').select('*').order('nome')
    setUsuarios(data || [])
    setLoading(false)
  }

  // Handle Checkbox rules dynamically
  function handleCheckboxChange(field, checked) {
    setForm(prev => {
      const next = { ...prev, [field]: checked }
      
      if (field === 'is_administrador' && checked) {
        next.is_vendedor = true
        next.is_caixa = true
      }
      if (field === 'is_caixa' && checked) {
        next.is_vendedor = true
      }
      
      return next
    })
  }

  function openCreate() { setForm(EMPTY); setModal(true) }
  function closeModal() { setModal(false) }

  async function handleSave() {
    if (!form.nome.trim() || !form.email.trim() || !form.password) {
      return toast.error('Nome, e-mail e senha são obrigatórios')
    }

    setSaving(true)
    try {
      // Faz o POST para a Edge Function de criar usuários
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: form
      })

      if (error) {
        throw new Error(error.message || 'Erro ao processar criação')
      }
      
      if (data?.error) {
        throw new Error(data.error)
      }

      toast.success('Usuário criado com sucesso!')
      fetchUsuarios()
      closeModal()
    } catch (err) {
      console.error(err)
      toast.error(`Falha: ${err.message}`)
    }
    setSaving(false)
  }

  async function handleDelete(u) {
    if (u.id === session?.user?.id) {
      return toast.error('Você não pode excluir a sua própria conta')
    }
    // Delete implies deleting from both Auth and custom table if constraints cascade
    // However, our edge function/admin API isn't built for delete right now,
    // deleting directly via RLS won't delete the auth.users if not configured using triggers.
    // For MVP, we will only remove the user from 'usuarios' table or just throw a warning
    toast.error('Exclusão direta via frontend desativada. Apague no painel do Supabase.')
  }

  if (!isAdmin) {
    return <div className="empty-state"><p>Acesso restrito.</p></div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Gestão de Usuários</h2>
        <div className="page-tools">
          <button className="btn btn-primary" onClick={openCreate}><RiAddLine /> Novo Usuário</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state"><p>Carregando...</p></div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state">
              <RiUserSettingsLine />
              <p>Nenhum usuário encontrado na tabela</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papéis (Roles)</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td className="fw-600">{u.nome} {u.id === session?.user?.id ? "(Você)" : ""}</td>
                    <td className="text-gray">{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {u.is_administrador && <span className="badge badge-primary" style={{background: 'rgba(59,130,246,0.15)', color: '#3b82f6'}}>Admin</span>}
                        {u.is_vendedor && <span className="badge badge-warning" style={{background: 'rgba(245,158,11,0.15)', color: '#f59e0b'}}>Vendedor</span>}
                        {u.is_caixa && <span className="badge badge-success" style={{background: 'rgba(34,197,94,0.15)', color: '#22c55e'}}>Caixa</span>}
                        {!u.is_administrador && !u.is_vendedor && !u.is_caixa && <span className="text-gray" style={{fontSize: 12}}>Sem papéis</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.is_licenca ? 'badge-aprovado' : 'badge-cancelado'}`}>
                        {u.is_licenca ? 'Ativo' : 'Licença Revogada'}
                      </span>
                    </td>
                    <td>
                      <div className="td-actions">
                         <button className="btn btn-danger btn-icon" onClick={() => handleDelete(u)}><RiDeleteBinLine /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Usuário do Sistema</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 24, alignItems: 'start' }}>
              
              {/* Esquerda: Dados Basicos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input className="form-control" value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value }))} placeholder="João Siva" />
                </div>
                <div className="form-group">
                  <label>E-mail (Usado no acesso)</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value }))} placeholder="joao@eletroced.com" />
                </div>
                <div className="form-group">
                  <label>Senha de Acesso Mínima (6+ caracteres)</label>
                  <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value }))} placeholder="•••" />
                </div>
              </div>

              {/* Direita: Checkboxes */}
              <div className="card" style={{ padding: 16 }}>
                 <h4 style={{ fontSize: 13, marginBottom: 16, color: 'var(--gray)' }}>PERMISSÕES DO USUÁRIO</h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                     <input type="checkbox" checked={form.is_licenca} onChange={e => handleCheckboxChange('is_licenca', e.target.checked)} />
                     Tem Licença (Ativo)
                   </label>
                   
                   <hr style={{ border: 0, borderTop: '1px solid var(--white-border)' }} />
                   
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: form.is_administrador ? 700: 400, color: form.is_administrador ? 'var(--info)' : 'inherit' }}>
                     <input type="checkbox" checked={form.is_administrador} onChange={e => handleCheckboxChange('is_administrador', e.target.checked)} />
                     Administrador
                   </label>
                   
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                     <input type="checkbox" checked={form.is_caixa} onChange={e => handleCheckboxChange('is_caixa', e.target.checked)} />
                     Caixa
                   </label>
                   
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                     <input type="checkbox" checked={form.is_vendedor} onChange={e => handleCheckboxChange('is_vendedor', e.target.checked)} />
                     Vendedor
                   </label>

                 </div>
                 <p style={{ marginTop: 16, fontSize: 12, color: 'var(--gray-light)', lineHeight: 1.4 }}>
                    Dica: Administradores automaticamente possuem acesso de vendedor e caixa.
                 </p>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Criando Conta...' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
