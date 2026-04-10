import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { RiAddLine, RiDeleteBinLine, RiRefreshLine } from 'react-icons/ri'
import Select from 'react-select'

const customSelectStyles = {
  control: (base) => ({
    ...base,
    background: 'var(--dark-3)',
    borderColor: 'var(--white-border)',
    boxShadow: 'none',
    '&:hover': { borderColor: 'var(--red)' },
    minHeight: '38px',
    borderRadius: '8px',
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--dark-2)',
    zIndex: 99,
    border: '1px solid var(--white-border)',
    borderRadius: '8px',
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'var(--dark-3)' : 'transparent',
    color: 'var(--white)',
    '&:hover': { background: 'var(--dark-4)' },
  }),
  singleValue: (base) => ({ ...base, color: 'var(--white)' }),
  input: (base) => ({ ...base, color: 'var(--white)' }),
  placeholder: (base) => ({ ...base, color: 'var(--dark-5)' }),
  noOptionsMessage: (base) => ({ ...base, color: 'var(--gray-light)' }),
}

export default function EstoqueEntrada() {
  const [produtos, setProdutos] = useState([])
  const [movimentos, setMovimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMovs, setLoadingMovs] = useState(true)

  // Inclusão rápida (em modal)
  const [showModal, setShowModal] = useState(false)
  const [quick, setQuick] = useState({ produto_id: '', quantidade: 1 })
  const [quickList, setQuickList] = useState([]) // {key, produto_id, nome, unidade, quantidade}
  const [quickSaving, setQuickSaving] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setLoadingMovs(true)

    const [{ data: prodsView, error: prodsViewErr }, { data: movs, error: movsErr }] = await Promise.all([
      supabase.from('vw_produtos_estoque').select('id, nome, unidade, estoque, estoque_reservado, estoque_livre').order('nome'),
      supabase
        .from('estoque_movimentos')
        .select('id, produto_id, tipo, quantidade, descricao, estoque_anterior, estoque_atual, created_at, produtos(nome, unidade)')
        .in('tipo', ['entrada', 'ajuste'])
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    let prods = prodsView
    let prodsErr = prodsViewErr

    if (prodsViewErr) {
      // fallback: view pode não existir ainda
      const fallback = await supabase.from('produtos').select('id, nome, estoque, unidade').order('nome')
      prods = fallback.data
      prodsErr = fallback.error
    }

    if (prodsErr) {
      console.error(prodsErr)
      toast.error('Erro ao buscar produtos')
    }
    if (movsErr) {
      console.error(movsErr)
      // Tabela pode não existir ainda (SQL não aplicado)
      toast.error('Movimentos de estoque ainda não estão configurados (aplique a migração SQL).')
    }

    setProdutos((prods || []).map(p => ({
      ...p,
      estoque_reservado: p.estoque_reservado ?? 0,
      estoque_livre: p.estoque_livre ?? (Number(p.estoque) || 0),
    })))
    setMovimentos(movs || [])
    setLoading(false)
    setLoadingMovs(false)
  }

  const filteredProdutos = useMemo(() => {
    return produtos
  }, [produtos])

  const produtoOptions = useMemo(() => {
    return filteredProdutos.map(p => ({
      value: p.id,
      label: `${p.nome} (Livre: ${p.estoque_livre ?? 0} | Reserv.: ${p.estoque_reservado ?? 0} | Total: ${p.estoque || 0})`,
    }))
  }, [filteredProdutos])

  function closeModal() {
    if (quickSaving) return
    setShowModal(false)
    setQuick({ produto_id: '', quantidade: 1 })
    setQuickList([])
  }

  async function registrarEntrada({ produto_id, quantidade, descricao }) {
    const produtoIdNum = Number(produto_id)
    const qtdNum = Number(quantidade)

    if (!produtoIdNum) throw new Error('Selecione um produto')
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) throw new Error('Quantidade inválida')

    // 1) Prefer RPC (atômico)
    const { error: rpcErr } = await supabase.rpc('registrar_entrada_estoque', {
      p_produto_id: produtoIdNum,
      p_quantidade: Math.trunc(qtdNum),
      p_descricao: descricao?.trim() || null,
    })

    if (!rpcErr) return

    // 2) Fallback se a função não existir (ambiente sem migração completa)
    console.warn('RPC registrar_entrada_estoque falhou; tentando fallback.', rpcErr)

    const { data: prodRow, error: prodErr } = await supabase
      .from('produtos')
      .select('id, estoque')
      .eq('id', produtoIdNum)
      .single()

    if (prodErr || !prodRow) throw rpcErr

    const anterior = Number(prodRow.estoque) || 0
    const atual = anterior + Math.trunc(qtdNum)

    const { error: updErr } = await supabase.from('produtos').update({ estoque: atual }).eq('id', produtoIdNum)
    if (updErr) throw updErr

    const { error: insErr } = await supabase.from('estoque_movimentos').insert([
      {
        produto_id: produtoIdNum,
        tipo: 'entrada',
        quantidade: Math.trunc(qtdNum),
        descricao: descricao?.trim() || null,
        estoque_anterior: anterior,
        estoque_atual: atual,
      },
    ])

    if (insErr) throw insErr
  }

  function addQuickItem() {
    const produtoIdNum = Number(quick.produto_id)
    const qtdNum = Math.trunc(Number(quick.quantidade))

    if (!produtoIdNum) return toast.error('Selecione um produto')
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) return toast.error('Quantidade inválida')

    const prod = produtos.find(p => p.id === produtoIdNum)
    if (!prod) return toast.error('Produto não encontrado')

    setQuickList(prev => [
      ...prev,
      {
        key: `${produtoIdNum}-${Date.now()}`,
        produto_id: produtoIdNum,
        nome: prod.nome,
        unidade: prod.unidade,
        quantidade: qtdNum,
      },
    ])

    setQuick({ produto_id: '', quantidade: 1 })
  }

  function removeQuickItem(key) {
    setQuickList(prev => prev.filter(i => i.key !== key))
  }

  async function handleSubmitQuick() {
    if (quickList.length === 0) return toast.error('Adicione itens na lista primeiro')

    setQuickSaving(true)
    try {
      for (const item of quickList) {
        await registrarEntrada({ produto_id: item.produto_id, quantidade: item.quantidade, descricao: 'Inclusão rápida' })
      }
      toast.success('Entradas lançadas com sucesso!')
      setQuickList([])
      setQuick({ produto_id: '', quantidade: 1 })
      setShowModal(false)
      fetchAll()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Erro ao lançar entradas')
    }
    setQuickSaving(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Movimentações de Entrada</h2>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>
            Registre entradas no estoque e acompanhe o histórico.
          </p>
          <div className="page-tools" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
            <button className="btn btn-secondary" onClick={fetchAll} title="Atualizar">
              <RiRefreshLine /> Atualizar
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <RiAddLine /> Incluir
            </button>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Histórico (entradas e ajustes)</h3>
        {loadingMovs ? (
          <div className="empty-state">
            <p>Carregando...</p>
          </div>
        ) : movimentos.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma entrada registrada ainda.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Obs.</th>
                  <th>Estoque</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                    <td className="fw-600">{m.produtos?.nome || `#${m.produto_id}`}</td>
                    <td>
                      {m.tipo === 'ajuste' ? (
                        <span style={{ fontWeight: 800, color: Number(m.quantidade) >= 0 ? 'var(--success)' : 'var(--red)' }}>
                          {Number(m.quantidade) >= 0 ? `+${m.quantidade}` : `${m.quantidade}`} {m.produtos?.unidade || 'un'}
                        </span>
                      ) : (
                        <span>+{m.quantidade} {m.produtos?.unidade || 'un'}</span>
                      )}
                      {m.tipo === 'ajuste' && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--dark-3)', padding: '2px 6px', borderRadius: 6, color: 'var(--gray-light)' }}>
                          AJUSTE
                        </span>
                      )}
                    </td>
                    <td className="text-gray">{m.descricao || '—'}</td>
                    <td>
                      {m.estoque_anterior != null && m.estoque_atual != null
                        ? `${m.estoque_anterior} → ${m.estoque_atual}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de inclusão (lista) */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>Incluir</h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr auto' }}>
                <div className="form-group">
                  <label>Produto</label>
                  <Select
                    options={produtoOptions}
                    styles={customSelectStyles}
                    placeholder="Buscar produto..."
                    value={produtoOptions.find(o => String(o.value) === String(quick.produto_id)) || null}
                    onChange={sel => setQuick(q => ({ ...q, produto_id: sel ? String(sel.value) : '' }))}
                    isClearable
                    noOptionsMessage={() => 'Nenhum produto'}
                  />
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    step="1"
                    value={quick.quantidade}
                    onChange={e => setQuick(q => ({ ...q, quantidade: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <label style={{ visibility: 'hidden' }}>Adicionar</label>
                  <button className="btn btn-secondary" onClick={addQuickItem}>
                    <RiAddLine /> Adicionar
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                {quickList.length === 0 ? (
                  <div className="empty-state" style={{ padding: 16 }}>
                    <p>Adicione produtos e quantidades para gerar a contagem.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Quantidade</th>
                          <th width="60"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickList.map(i => (
                          <tr key={i.key}>
                            <td className="fw-600">{i.nome}</td>
                            <td>
                              {i.quantidade} {i.unidade || 'un'}
                            </td>
                            <td>
                              <button className="btn btn-danger btn-icon" title="Remover" onClick={() => removeQuickItem(i.key)}>
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
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitQuick} disabled={quickSaving || quickList.length === 0}>
                {quickSaving ? 'Lançando...' : 'Confirmar inclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
