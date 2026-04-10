import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RiMoneyDollarCircleLine, RiArrowUpCircleFill, RiArrowDownCircleFill, RiCalendarTodoLine } from 'react-icons/ri'

export default function Financeiro() {
  const [loading, setLoading] = useState(true)
  const [movimentos, setMovimentos] = useState([])
  
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const curDate = new Date()
  const [filtroMes, setFiltroMes] = useState(curDate.getMonth())
  const [filtroAno, setFiltroAno] = useState(curDate.getFullYear())

  useEffect(() => {
    fetchDados()
  }, [filtroMes, filtroAno])

  async function fetchDados() {
    setLoading(true)
    // Calcula start & end of month
    const startM = new Date(filtroAno, filtroMes, 1)
    const endM = new Date(filtroAno, filtroMes + 1, 0)
    endM.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('caixa_movimentos')
      .select('*')
      .gte('created_at', startM.toISOString())
      .lte('created_at', endM.toISOString())
    
    if (!error && data) {
      setMovimentos(data)
    }
    setLoading(false)
  }

  const receitas = movimentos.filter(m => m.tipo === 'receita').reduce((a, b) => a + Number(b.valor), 0)
  const despesas = movimentos.filter(m => m.tipo === 'despesa').reduce((a, b) => a + Number(b.valor), 0)
  const lucro = receitas - despesas
  const margem = receitas > 0 ? ((lucro / receitas) * 100).toFixed(1) : 0

  const fmt =(v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Painel Financeiro</h2>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>Visão Consolidada Mensal</p>
        </div>
        <div style={{ display: 'flex', gap: 10, background: 'var(--dark-2)', padding: '6px 12px', borderRadius: 12, border: '1px solid var(--white-border)', alignItems: 'center' }}>
          <RiCalendarTodoLine style={{ fontSize: 20, color: 'var(--gray)' }} />
          <select className="form-control" style={{ border: 'none', background: 'transparent', height: 'auto', padding: 4 }} value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <input className="form-control" type="number" style={{ border: 'none', background: 'transparent', width: 60, height: 'auto', padding: 4 }} value={filtroAno} onChange={e => setFiltroAno(Number(e.target.value))} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--gray)' }}>Carregando...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Faturamento Bruto (Receitas)</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RiArrowUpCircleFill style={{ fontSize: 32, color: 'var(--success)' }} />
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>{fmt(receitas)}</span>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Gasto Total (Despesas)</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RiArrowDownCircleFill style={{ fontSize: 32, color: 'var(--red)' }} />
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--red)' }}>{fmt(despesas)}</span>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: lucro >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderColor: lucro >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ color: 'var(--gray)', fontWeight: 600, fontSize: 13, textTransform: 'uppercase' }}>Lucro Líquido</h4>
                <span style={{ fontSize: 12, fontWeight: 700, color: lucro >= 0 ? 'var(--success)' : 'var(--red)', background: lucro >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', padding: '2px 6px', borderRadius: 12 }}>MG {margem}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <RiMoneyDollarCircleLine style={{ fontSize: 36, color: lucro >= 0 ? 'var(--success)' : 'var(--red)' }} />
                <span style={{ fontSize: 32, fontWeight: 700, color: lucro >= 0 ? 'var(--success)' : 'var(--red)' }}>{fmt(lucro)}</span>
              </div>
            </div>
          </div>

          {/* Gráfico Simples Customizado com Barras */}
          <div className="card">
             <h3 className="section-title">Composição do Agregado</h3>
             {receitas === 0 && despesas === 0 ? (
                <p style={{ color: 'var(--gray)', marginTop: 24 }}>Sem dados para esse período.</p>
             ) : (
                <div style={{ display: 'flex', height: 28, borderRadius: 14, overflow: 'hidden', marginTop: 20 }}>
                  <div style={{ width: `${(receitas / (receitas + despesas)) * 100}%`, background: 'var(--success)', display: 'flex', alignItems: 'center', paddingLeft: 12, fontSize: 13, fontWeight: 600 }}>Entradas</div>
                  <div style={{ width: `${(despesas / (receitas + despesas)) * 100}%`, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12, fontSize: 13, fontWeight: 600 }}>Saídas</div>
                </div>
             )}
          </div>
        </>
      )}
    </div>
  )
}
