import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiAddLine, RiDeleteBinLine, RiArrowUpCircleFill, RiArrowDownCircleFill } from 'react-icons/ri'
import { MdOutlineAttachMoney, MdCreditCard, MdPix } from 'react-icons/md'
import toast from 'react-hot-toast'

const METODOS_ICONES = {
  dinheiro: <MdOutlineAttachMoney style={{ color: '#22c55e' }} />,
  pix: <MdPix style={{ color: '#06b6d4' }} />,
  cartao_credito: <MdCreditCard style={{ color: '#f59e0b' }} />,
  cartao_debito: <MdCreditCard style={{ color: '#3b82f6' }} />,
  a_prazo: <MdOutlineAttachMoney style={{ color: '#888' }} />
}

const METODO_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  a_prazo: 'A Prazo'
}

export default function Caixa() {
  const [movimentos, setMovimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [confirmDel, setConfirmDel] = useState({ open: false, id: null })

  const [form, setForm] = useState({
    descricao: '',
    tipo: 'receita',
    valor: '',
    metodo_pagamento: 'dinheiro'
  })

  // Start & End of today
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  useEffect(() => { fetchCaixa() }, [])

  async function fetchCaixa() {
    setLoading(true)
    const { data, error } = await supabase
      .from('caixa_movimentos')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao buscar o caixa de hoje')
      console.error(error)
    } else {
      setMovimentos(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.descricao || !form.valor || Number(form.valor) <= 0) return toast.error('Preencha os campos corretamente.')

    setSaving(true)
    const { data, error } = await supabase.from('caixa_movimentos').insert([{
      descricao: form.descricao,
      tipo: form.tipo,
      metodo_pagamento: form.metodo_pagamento,
      valor: Number(form.valor)
    }]).select()

    if (error) {
      toast.error('Erro ao lançar movimento')
    } else {
      toast.success('Lançamento registrado!')
      setMovimentos([data[0], ...movimentos])
      setShowModal(false)
      setForm({ descricao: '', tipo: 'receita', valor: '', metodo_pagamento: 'dinheiro' })
    }
    setSaving(false)
  }

  function pedirRemover(id) {
    setConfirmDel({ open: true, id })
  }

  async function removerConfirmado() {
    const id = confirmDel.id
    if (!id) return
    setConfirmDel({ open: false, id: null })

    const { error } = await supabase.from('caixa_movimentos').delete().eq('id', id)
    if (error) {
       toast.error('Erro ao remover')
    } else {
       toast.success('Removido com sucesso')
       setMovimentos(mov => mov.filter(m => m.id !== id))
    }
  }

  const receitas = movimentos.filter(m => m.tipo === 'receita').reduce((a, b) => a + Number(b.valor), 0)
  const despesas = movimentos.filter(m => m.tipo === 'despesa').reduce((a, b) => a + Number(b.valor), 0)
  const saldo = receitas - despesas

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Fluxo de Caixa Diário</h2>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>Movimentações consolidadas apenas de hoje {startOfDay.toLocaleDateString('pt-BR')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <RiAddLine /> Novo Lançamento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Entradas (Receitas)</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RiArrowUpCircleFill style={{ fontSize: 28, color: 'var(--success)' }} />
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--white)' }}>{fmt(receitas)}</span>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Saídas (Despesas)</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RiArrowDownCircleFill style={{ fontSize: 28, color: 'var(--red)' }} />
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--white)' }}>{fmt(despesas)}</span>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: saldo >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderColor: saldo >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
          <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Saldo do Dia</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdOutlineAttachMoney style={{ fontSize: 32, color: saldo >= 0 ? 'var(--success)' : 'var(--red)' }} />
            <span style={{ fontSize: 28, fontWeight: 700, color: saldo >= 0 ? 'var(--success)' : 'var(--red)' }}>{fmt(saldo)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray)' }}>Carregando...</p>
        ) : movimentos.length === 0 ? (
          <div className="empty-state">
            <p>Não há movimentações de caixa registradas hoje.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Descrição</th>
                  <th>Meio</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th width="60"></th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="fw-600">
                      {m.descricao}
                      {m.ordem_id && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--dark-3)', padding: '2px 6px', borderRadius: 4, color: 'var(--gray-light)' }}>OS #{String(m.ordem_id).padStart(4,'0')}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{METODOS_ICONES[m.metodo_pagamento] || METODOS_ICONES['dinheiro']}</span>
                        {METODO_LABELS[m.metodo_pagamento] || 'Dinheiro'}
                      </div>
                    </td>
                    <td>
                      {m.tipo === 'receita' ? (
                        <span className="badge badge-aprovado" style={{ background: 'transparent', border: '1px solid var(--success)' }}>Receita</span>
                      ) : (
                        <span className="badge badge-cancelado" style={{ background: 'transparent', border: '1px solid var(--red)' }}>Despesa</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: m.tipo === 'receita' ? 'var(--success)' : 'var(--red)' }}>
                      {m.tipo === 'receita' ? '+' : '-'} {fmt(m.valor)}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-icon" title="Remover" onClick={() => pedirRemover(m.id)}>
                        <RiDeleteBinLine />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDel.open && (
        <div className="modal-overlay" onClick={() => setConfirmDel({ open: false, id: null })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Remover lançamento</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setConfirmDel({ open: false, id: null })}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Deseja remover este registro?</p>
                <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>
                  Ele não refletirá mais na OS, se for o caso.
                </p>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel({ open: false, id: null })}>Não</button>
              <button className="btn btn-danger" onClick={removerConfirmado}>Sim</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Lançamento no Caixa</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tipo de Lançamento</label>
                  <select className="form-control" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="receita">Receita (Entrada)</option>
                    <option value="despesa">Despesa (Saída)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Descrição</label>
                  <input required className="form-control" placeholder="Ex: Venda avulsa do Produto, Compra de Almoço..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input required className="form-control" type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Forma</label>
                    <select className="form-control" value={form.metodo_pagamento} onChange={e => setForm(f => ({ ...f, metodo_pagamento: e.target.value }))}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Lançar no Caixa'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
