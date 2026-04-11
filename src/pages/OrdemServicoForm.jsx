import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'
import {
  RiArrowLeftLine, RiAddLine, RiDeleteBinLine,
  RiCheckboxCircleLine, RiSaveLine, RiMoneyDollarCircleLine,
  RiBankCardLine, RiQuestionAnswerLine, RiWhatsappLine, RiEyeLine
} from 'react-icons/ri'
import { MdPix, MdOutlineAttachMoney, MdCreditCard } from 'react-icons/md'
import toast from 'react-hot-toast'
import Select from 'react-select'
import './OrdemServicoForm.css'
import { gerarPdfOrdemServico } from '../lib/ordemServicoPdf'

const customSelectStyles = {
  control: (base) => ({
    ...base,
    background: 'var(--dark-3)',
    borderColor: 'var(--white-border)',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--red)'
    },
    minHeight: '34px',
    fontSize: '13px',
    borderRadius: '8px'
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 10px'
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: 6
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: 6
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  menu: (base) => ({
    ...base,
    background: 'var(--dark-2)',
    zIndex: 99,
    border: '1px solid var(--white-border)',
    borderRadius: '8px'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'var(--dark-3)' : 'transparent',
    color: 'var(--white)',
    '&:hover': {
      background: 'var(--dark-4)'
    }
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--white)'
  }),
  input: (base) => ({
    ...base,
    color: 'var(--white)'
  }),
  groupHeading: (base) => ({
    ...base,
    color: 'var(--gray)',
    fontWeight: '700'
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'var(--gray-light)'
  })
}

const STATUS_LABELS = {
  aberto: 'Aberto',
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const METODOS_PAGAMENTO = {
  dinheiro: { label: 'Dinheiro', icon: <MdOutlineAttachMoney />, disabled: false },
  pix: { label: 'PIX', icon: <MdPix />, disabled: false },
  cartao_credito: { label: 'Cartão de Crédito', icon: <MdCreditCard />, disabled: false },
  cartao_debito: { label: 'Cartão de Débito', icon: <RiBankCardLine />, disabled: false },
  a_prazo: { label: 'A Prazo', icon: <RiQuestionAnswerLine />, disabled: true },
}

const EMPTY_FORM = {
  cliente_id: '',
  equipamento_id: '',
  status: 'aberto',
  observacoes: '',
  problema_reclamado: '',
  condicao_pagamento: '',
  metodo_pagamento: '',
}

export default function OrdemServicoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'nova'

  const [form, setForm] = useState(EMPTY_FORM)
  const [clientes, setClientes] = useState([])
  const [produtosDisp, setProdutosDisp] = useState([])
  const [servicosDisp, setServicosDisp] = useState([])
  const [itensProdutos, setItensProdutos] = useState([])
  const [origItensProdutos, setOrigItensProdutos] = useState([])
  const [itensServicos, setItensServicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showProblemaModal, setShowProblemaModal] = useState(false)
  const [showItensResumoModal, setShowItensResumoModal] = useState(false)
  const [showCliEqpInfoModal, setShowCliEqpInfoModal] = useState(false)

  const [qtyModal, setQtyModal] = useState({ open: false, temp_id: '', quantidade: 1 })

  const confirmResolverRef = useRef(null)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    content: null,
    confirmText: 'Sim',
    cancelText: 'Não',
    confirmClassName: 'btn btn-success'
  })

  const [estoqueBaixado, setEstoqueBaixado] = useState(false)
  
  const [equipamentos, setEquipamentos] = useState([])
  const [showEqpModal, setShowEqpModal] = useState(false)
  const [novoEqp, setNovoEqp] = useState({ modelo: '', marca: '', numero_serie: '', voltagem: '' })

  const [showClienteModal, setShowClienteModal] = useState(false)
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', endereco: '' })

  // Item Dropdown
  const [addItem, setAddItem] = useState({ temp_id: '' })

  const [expandedItemKey, setExpandedItemKey] = useState(null)

  const clienteFieldRef = useRef(null)
  const equipamentoFieldRef = useRef(null)
  const itemFieldRef = useRef(null)

  const menuPortalTarget = typeof document !== 'undefined' ? document.body : null

  const scrollFieldIntoView = useCallback((ref) => {
    const el = ref?.current
    if (!el) return
    // pequeno delay para deixar o teclado abrir antes de calcular
    setTimeout(() => {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {
        el.scrollIntoView(true)
      }
    }, 60)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const updateKeyboardOffset = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0))
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(overlap)}px`)
    }

    updateKeyboardOffset()
    vv.addEventListener('resize', updateKeyboardOffset)
    vv.addEventListener('scroll', updateKeyboardOffset)

    const onFocusIn = () => updateKeyboardOffset()
    const onFocusOut = () => setTimeout(updateKeyboardOffset, 100)

    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)

    return () => {
      vv.removeEventListener('resize', updateKeyboardOffset)
      vv.removeEventListener('scroll', updateKeyboardOffset)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      document.documentElement.style.setProperty('--keyboard-offset', `0px`)
    }
  }, [])

  useEffect(() => { fetchInit() }, [])

  useEffect(() => {
    if (form.cliente_id) {
      supabase.from('equipamentos').select('*').eq('cliente_id', form.cliente_id).order('created_at', { ascending: false })
        .then(({ data }) => setEquipamentos(data || []))
    } else {
      setEquipamentos([])
      setForm(f => ({ ...f, equipamento_id: '' }))
    }
  }, [form.cliente_id])

  async function fetchInit() {
    setLoading(true)
    const [{ data: cls }, { data: prodsView, error: prodsViewErr }, { data: servs }] = await Promise.all([
      supabase.from('clientes').select('id, nome, telefone, endereco').order('nome'),
      supabase.from('vw_produtos_estoque').select('id, nome, preco, unidade, estoque, estoque_reservado, estoque_livre').order('nome'),
      supabase.from('servicos').select('id, nome, preco').order('nome'),
    ])
    setClientes(cls || [])
    if (!prodsViewErr) {
      setProdutosDisp(prodsView || [])
    } else {
      const { data: prodsFallback } = await supabase.from('produtos').select('id, nome, preco, unidade, estoque').order('nome')
      setProdutosDisp((prodsFallback || []).map(p => ({ ...p, estoque_reservado: 0, estoque_livre: Number(p.estoque) || 0 })))
    }
    setServicosDisp(servs || [])

    if (!isNew) {
      const { data: os } = await supabase.from('ordens_servico').select('*').eq('id', id).single()
      if (os) {
        setSavedOsId(os.id)
        setEstoqueBaixado(Boolean(os.estoque_baixado))
        setForm({ 
          cliente_id: os.cliente_id, 
          equipamento_id: os.equipamento_id || '',
          status: os.status, 
          observacoes: os.observacoes || '', 
          problema_reclamado: os.problema_reclamado || '',
          condicao_pagamento: os.condicao_pagamento || '',
          metodo_pagamento: os.metodo_pagamento || '' 
        })
      }
      const [{ data: op }, { data: oss }] = await Promise.all([
        supabase.from('ordem_produtos').select('*, produtos(nome, unidade)').eq('ordem_id', id),
        supabase.from('ordem_servicos').select('*, servicos(nome)').eq('ordem_id', id),
      ])
      setItensProdutos(op || [])
      setOrigItensProdutos(op || [])
      setItensServicos(oss || [])
    }

    setLoading(false)
  }

  const isLocked = !isNew && estoqueBaixado === true

  const selectedCliente = useMemo(
    () => clientes.find(c => Number(c.id) === Number(form.cliente_id)) || null,
    [clientes, form.cliente_id]
  )

  const selectedEquipamento = useMemo(
    () => equipamentos.find(e => Number(e.id) === Number(form.equipamento_id)) || null,
    [equipamentos, form.equipamento_id]
  )

  const origQtyByProduto = useMemo(() => {
    const map = {}
    for (const i of origItensProdutos) {
      const pid = Number(i.produto_id)
      map[pid] = (map[pid] || 0) + Number(i.quantidade || 0)
    }
    return map
  }, [origItensProdutos])

  function getDisponivelParaEstaOS(produtoId) {
    const pid = Number(produtoId)
    const prod = produtosDisp.find(p => Number(p.id) === pid)
    if (!prod) return Infinity
    const livre = Number(prod.estoque_livre ?? (Number(prod.estoque) || 0))
    const orig = Number(origQtyByProduto[pid] || 0)
    // "livre" considera reservas (inclui a reserva antiga desta OS); somamos a quantidade original para permitir edição
    return livre + orig
  }

  function getTotalAtualNaOS(produtoId, itens = itensProdutos) {
    const pid = Number(produtoId)
    return itens
      .filter(i => Number(i.produto_id) === pid)
      .reduce((acc, i) => acc + Number(i.quantidade || 0), 0)
  }

  const totalProdutos = itensProdutos.reduce((acc, i) => acc + (Number(i.preco_unitario) * Number(i.quantidade)), 0)
  const totalServicos = itensServicos.reduce((acc, i) => acc + (Number(i.preco_unitario) * Number(i.quantidade)), 0)
  const total = totalProdutos + totalServicos

  const totalQtdProdutos = itensProdutos.reduce((acc, i) => acc + Number(i.quantidade || 0), 0)
  const totalQtdServicos = itensServicos.reduce((acc, i) => acc + Number(i.quantidade || 0), 0)

  const handleSalvarEquipamento = async (e) => {
    e.preventDefault()
    if (!form.cliente_id) return toast.error('Selecione um cliente primeiro.')
    setSaving(true)
    const { data, error } = await supabase.from('equipamentos').insert([{
      cliente_id: form.cliente_id,
      modelo: novoEqp.modelo,
      marca: novoEqp.marca,
      numero_serie: novoEqp.numero_serie,
      voltagem: novoEqp.voltagem
    }]).select().single()

    if (error) { toast.error('Erro ao salvar equipamento'); setSaving(false); return }
    
    setEquipamentos(prev => [data, ...prev])
    setForm(f => ({ ...f, equipamento_id: data.id }))
    setShowEqpModal(false)
    setNovoEqp({ modelo: '', marca: '', numero_serie: '', voltagem: '' })
    setSaving(false)
    toast.success('Equipamento adicionado!')
  }

  const handleSalvarCliente = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('clientes').insert([{
      nome: novoCliente.nome,
      telefone: novoCliente.telefone,
      endereco: novoCliente.endereco || null,
    }]).select().single()

    if (error) { toast.error('Erro ao salvar cliente'); setSaving(false); return }
    
    setClientes(prev => [...prev, data].sort((a,b) => a.nome.localeCompare(b.nome)))
    setForm(f => ({ ...f, cliente_id: data.id }))
    setShowClienteModal(false)
    setNovoCliente({ nome: '', telefone: '', endereco: '' })
    setSaving(false)
    toast.success('Cliente adicionado!')
  }

  function openQtyModal() {
    if (!addItem.temp_id) return toast.error('Selecione um item')
    setQtyModal({ open: true, temp_id: addItem.temp_id, quantidade: 1 })
  }

  function getItemNameFromTempId(tempId) {
    if (!tempId) return ''
    const [tipo, strId] = String(tempId).split('-')
    const realId = Number(strId)
    if (tipo === 'prod') return produtosDisp.find(p => Number(p.id) === realId)?.nome || ''
    if (tipo === 'serv') return servicosDisp.find(s => Number(s.id) === realId)?.nome || ''
    return ''
  }

  function adicionarItemComQuantidade(tempId, quantidade) {
    if (!tempId) return toast.error('Selecione um item')

    const q = Number(quantidade) || 1
    if (!Number.isFinite(q) || q <= 0 || q !== Math.trunc(q)) {
      return toast.error('Quantidade deve ser um número inteiro maior que zero')
    }

    const [tipo, strId] = String(tempId).split('-')
    const realId = Number(strId)

    if (tipo === 'prod') {
      const prod = produtosDisp.find(p => p.id === realId)
      if (!prod) return

      const totalAtual = getTotalAtualNaOS(prod.id)
      const disponivel = getDisponivelParaEstaOS(prod.id)
      const nextTotal = totalAtual + q
      if (nextTotal > disponivel) {
        const restante = Math.max(0, disponivel - totalAtual)
        return toast.error(`Estoque livre insuficiente. Disponível para reservar: ${restante}`)
      }

      setItensProdutos(prev => [...prev, {
        _tempId: Date.now(),
        produto_id: prod.id,
        quantidade: q,
        preco_unitario: prod.preco,
        produtos: { nome: prod.nome, unidade: prod.unidade }
      }])
    } else if (tipo === 'serv') {
      const serv = servicosDisp.find(s => s.id === realId)
      if (!serv) return
      setItensServicos(prev => [...prev, {
        _tempId: Date.now(),
        servico_id: serv.id,
        quantidade: q,
        preco_unitario: serv.preco,
        servicos: { nome: serv.nome }
      }])
    }

    setAddItem({ temp_id: '' })
    setQtyModal({ open: false, temp_id: '', quantidade: 1 })
  }

  function removerProduto(key) {
    if (isLocked) return
    setItensProdutos(prev => prev.filter(i => (i.id || i._tempId) !== key))
  }
  function removerServico(key) {
    if (isLocked) return
    setItensServicos(prev => prev.filter(i => (i.id || i._tempId) !== key))
  }
  function updateProduto(key, field, value) {
    if (isLocked) return

    setItensProdutos(prev => {
      const next = prev.map(i => (i.id || i._tempId) === key ? { ...i, [field]: value } : i)

      if (field === 'quantidade') {
        const edited = next.find(i => (i.id || i._tempId) === key)
        const pid = edited?.produto_id
        if (!pid) return prev

        const totalNext = getTotalAtualNaOS(pid, next)
        const disponivel = getDisponivelParaEstaOS(pid)
        if (totalNext > disponivel) {
          toast.error(`Estoque livre insuficiente. Máximo para esta OS: ${disponivel}`)
          return prev
        }
      }

      return next
    })
  }
  function updateServico(key, field, value) {
    if (isLocked) return
    setItensServicos(prev => prev.map(i => (i.id || i._tempId) === key ? { ...i, [field]: value } : i))
  }

  const [savedOsId, setSavedOsId] = useState(null)

  function askConfirm({ title, content, confirmText = 'Sim', cancelText = 'Não', confirmClassName = 'btn btn-success' }) {
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

  async function baixarPdfOs({ osId, abrirParaImprimir } = {}) {
    const finalId = Number(osId || savedOsId || id)
    if (!finalId || Number.isNaN(finalId)) throw new Error('OS inválida')

    const cliente = clientes.find(c => c.id === form.cliente_id)
    const eq = equipamentos.find(e => e.id === form.equipamento_id)

    const itens = [
      ...itensProdutos.map(i => ({
        tipo: 'PROD',
        descricao: i.produtos?.nome || 'Produto',
        unidade: i.produtos?.unidade || 'un',
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
      ...itensServicos.map(i => ({
        tipo: 'SERV',
        descricao: i.servicos?.nome || 'Serviço',
        unidade: '',
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
    ]

    await gerarPdfOrdemServico({
      os: {
        id: finalId,
        status: form.status,
        total,
        created_at: new Date().toISOString(),
        problema_reclamado: form.problema_reclamado,
        observacoes: form.observacoes,
        condicao_pagamento: form.condicao_pagamento,
        metodo_pagamento: form.metodo_pagamento,
      },
      cliente,
      equipamento: eq,
      itens,
      abrirParaImprimir,
    })
  }

  async function handleSelectStatus(nextStatus) {
    if (isLocked) return
    if (nextStatus === 'concluido') {
      const ok = await askConfirm({
        title: 'Confirmação',
        content: (
          <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA CONTINUAR?</p>
            <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>Marcar a OS como <strong>CONCLUÍDO</strong>.</p>
          </div>
        ),
        confirmText: 'Sim',
        cancelText: 'Não',
        confirmClassName: 'btn btn-success'
      })
      if (!ok) return
    }
    setForm(f => ({ ...f, status: nextStatus }))
  }

  function handleGerarOrcamentoWhatsapp() {
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const eqp = equipamentos.find(e => e.id === form.equipamento_id)
    
    let text = `*Orçamento de Serviço - Eletroced*\n\n`
    if (cliente) text += `*Cliente:* ${cliente.nome}\n`
    if (eqp) text += `*Equipamento:* ${eqp.modelo} ${eqp.marca ? `- ${eqp.marca}` : ''}\n`
    if (form.problema_reclamado) text += `*Problema Relatado:* ${form.problema_reclamado}\n`
    
    text += `\n*Itens do Orçamento:*\n`
    itensProdutos.forEach(i => {
      text += `- [PROD] ${i.produtos?.nome} - ${i.quantidade}x ${fmt(i.preco_unitario)} = ${fmt(i.quantidade * i.preco_unitario)}\n`
    })
    itensServicos.forEach(i => {
      text += `- [SERV] ${i.servicos?.nome} - ${i.quantidade}x ${fmt(i.preco_unitario)} = ${fmt(i.quantidade * i.preco_unitario)}\n`
    })
    
    text += `\n*TOTAL: ${fmt(total)}*\n`
    
    if (form.condicao_pagamento) {
      text += `\n*Condição de Pagamento:* ${form.condicao_pagamento}\n`
    }
    
    const encoded = encodeURIComponent(text)
    const telCode = cliente?.telefone ? cliente.telefone.replace(/\D/g, '') : ''
    // Adiciona o 55 do Brasil se for número brasileiro padrão para evitar erro link wa.me
    const finalTel = telCode.length >= 10 ? `55${telCode}` : telCode
    window.open(`https://wa.me/${finalTel ? finalTel : ''}?text=${encoded}`, '_blank')
  }

  async function handleSave(overrideStatus) {
    if (!form.cliente_id) return toast.error('Selecione um cliente')
    if (isLocked) return toast.error('OS concluída e bloqueada. Use "Estornar" para reabrir.')

    setSaving(true)
    const status = overrideStatus || form.status

    if (status === 'concluido') {
      if (!form.metodo_pagamento || form.metodo_pagamento === 'a_prazo') {
        setSaving(false)
        return toast.error('Selecione a forma de pagamento em "Pagar e Finalizar"')
      }

      const ok = await askConfirm({
        title: 'Confirmação',
        content: (
          <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA CONTINUAR?</p>
            <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>Concluir esta OS e <strong>bloquear</strong> edição.</p>
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
    }

    if (status !== 'cancelado') {
      for (const i of itensProdutos) {
        const q = Number(i.quantidade || 0)
        if (!Number.isFinite(q) || q <= 0 || q !== Math.trunc(q)) {
          setSaving(false)
          return toast.error('Quantidade de produto deve ser um número inteiro maior que zero')
        }
      }

      // Validação de reserva de estoque (estoque_livre + quantidade original desta OS)
      const totals = new Map()
      for (const i of itensProdutos) {
        const pid = Number(i.produto_id)
        totals.set(pid, (totals.get(pid) || 0) + Number(i.quantidade || 0))
      }

      for (const [pid, qtd] of totals.entries()) {
        const disponivel = getDisponivelParaEstaOS(pid)
        if (Number(qtd) > Number(disponivel)) {
          setSaving(false)
          return toast.error(`Estoque livre insuficiente para o produto #${pid}. Máximo para esta OS: ${disponivel}`)
        }
      }
    }

    try {
      let osId = id && !isNew ? Number(id) : null

      const payload = {
        cliente_id: Number(form.cliente_id),
        equipamento_id: form.equipamento_id ? Number(form.equipamento_id) : null,
        status,
        observacoes: form.observacoes,
        problema_reclamado: form.problema_reclamado,
        condicao_pagamento: form.condicao_pagamento,
        total,
        metodo_pagamento: form.metodo_pagamento
      }

      if (isNew) {
        const { data, error } = await supabase.from('ordens_servico').insert([payload]).select().single()
        if (error) throw error
        osId = data.id
      } else {
        const { error } = await supabase.from('ordens_servico').update(payload).eq('id', osId)
        if (error) throw error

        // Delete existing items to re-insert
        await supabase.from('ordem_produtos').delete().eq('ordem_id', osId)
        await supabase.from('ordem_servicos').delete().eq('ordem_id', osId)
      }
      setSavedOsId(osId)

      // Notificação (PWA Push) ao abrir uma OS
      if (isNew && status === 'aberto') {
        const informar = await askConfirm({
          title: 'Confirmação',
          content: (
            <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA INFORMAR?</p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>
                Enviar notificação para quem estiver com o app, avisando que a OS <strong>#{String(osId).padStart(4, '0')}</strong> foi aberta.
              </p>
            </div>
          ),
          confirmText: 'Sim',
          cancelText: 'Não',
          confirmClassName: 'btn btn-success'
        })

        if (informar) {
          try {
            const { data: cli } = await supabase
              .from('clientes')
              .select('nome, endereco')
              .eq('id', Number(form.cliente_id))
              .single()

            const { data: fnData, error: fnErr } = await supabase.functions.invoke('notify-os', {
              body: {
                action: 'push_os_opened',
                osId,
                numero: String(osId).padStart(4, '0'),
                cliente: cli?.nome || null,
                endereco: cli?.endereco || null,
                url: `/ordens/${osId}`,
              }
            })
            if (fnErr) throw fnErr

            const sent = Number(fnData?.sent ?? 0)
            const errorsCount = Number(fnData?.errorsCount ?? 0)
            if (sent > 0) {
              toast.success(
                errorsCount > 0
                  ? `Notificação enviada (${sent}) com falhas (${errorsCount}).`
                  : `Notificação enviada (${sent})!`
              )
            } else {
              const firstError = fnData?.errors?.[0]?.error
              toast.error(
                errorsCount > 0
                  ? `Falha ao enviar: ${firstError || 'verifique logs da função'}`
                  : 'Nenhum dispositivo inscrito para receber'
              )
            }
          } catch (e) {
            console.error(e)
            toast.error('Não foi possível enviar a notificação')
          }
        }
      }

      // Insert products
      if (itensProdutos.length > 0) {
        const prodRows = itensProdutos.map(i => ({
          ordem_id: osId,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        }))
        const { error } = await supabase.from('ordem_produtos').insert(prodRows)
        if (error) throw error
      }

      // Insert services
      if (itensServicos.length > 0) {
        const servRows = itensServicos.map(i => ({
          ordem_id: osId,
          servico_id: i.servico_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        }))
        const { error } = await supabase.from('ordem_servicos').insert(servRows)
        if (error) throw error
      }

      // Baixa automática de estoque ao concluir (atômico no banco)
      if (status === 'concluido') {
        const { error: baixaErr } = await supabase.rpc('concluir_ordem_servico', { p_ordem_id: osId })
        if (baixaErr) throw baixaErr
        setEstoqueBaixado(true)
      }

      // Sync With Cash Register if Completed
      if (status === 'concluido' && form.metodo_pagamento && form.metodo_pagamento !== 'a_prazo') {
        const { data: extCaixa } = await supabase.from('caixa_movimentos').select('id').eq('ordem_id', osId).single()
        if (!extCaixa) {
          await supabase.from('caixa_movimentos').insert([{
            ordem_id: osId,
            descricao: `Ordem de Serviço #${String(osId).padStart(4,'0')}`,
            tipo: 'receita',
            metodo_pagamento: form.metodo_pagamento,
            valor: total
          }])
        }
      }

      if (overrideStatus) {
        toast.success('OS atualizada com sucesso! ✅')
      } else {
        toast.success(isNew ? 'OS criada com sucesso!' : 'OS atualizada!')
      }

      const pagamentoRealizado = status === 'concluido' && form.metodo_pagamento && form.metodo_pagamento !== 'a_prazo'
      if (pagamentoRealizado) {
        const imprimir = await askConfirm({
          title: 'Confirmação',
          content: (
            <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA IMPRIMIR?</p>
              <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>O sistema vai baixar o <strong>PDF</strong>.</p>
            </div>
          ),
          confirmText: 'Sim',
          cancelText: 'Não',
          confirmClassName: 'btn btn-success'
        })

        try {
          await baixarPdfOs({ osId, abrirParaImprimir: Boolean(imprimir) })
        } catch (e) {
          console.error(e)
          toast.error('Não foi possível gerar o PDF')
        }
      }

      navigate('/ordens')

    } catch (err) {
      console.error(err)
      if (err?.code === '23514' && String(err?.message || '').includes('ordens_servico_status_check')) {
        toast.error('Banco não aceita status "aberto". Aplique a migração de status (ABERTO) no Supabase.')
      } else {
        toast.error('Erro ao salvar a OS')
      }
    }
    setSaving(false)
  }

  async function handleEstornar() {
    if (!savedOsId) return
    const ok = await askConfirm({
      title: 'Confirmação',
      content: (
        <div style={{ background: 'var(--dark-3)', border: '1px solid var(--white-border)', borderRadius: 10, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>DESEJA CONTINUAR?</p>
          <p style={{ margin: '8px 0 0 0', color: 'var(--gray-light)', fontSize: 13 }}>Estornar a OS e voltar para <strong>ABERTO</strong>.</p>
        </div>
      ),
      confirmText: 'Sim',
      cancelText: 'Não',
      confirmClassName: 'btn btn-danger'
    })
    if (!ok) return

    setSaving(true)
    try {
      const { error } = await supabase.rpc('estornar_ordem_servico', { p_ordem_id: Number(savedOsId) })
      if (error) throw error

      toast.success('OS estornada e reaberta!')
      setEstoqueBaixado(false)
      setForm(f => ({ ...f, status: 'aberto', metodo_pagamento: '' }))
      fetchInit()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao estornar a OS')
    }
    setSaving(false)
  }

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  if (loading) return <div className="empty-state" style={{ paddingTop: 80 }}><p>Carregando...</p></div>

  const isOrcamento = form.status === 'orcamento' || form.status === 'aberto'

  const showOrcamentoBtn = isOrcamento && !isNew
  const showPagamentoBtn = form.status === 'concluido'
  const showSalvarBtn = !showPagamentoBtn
  const showEstornarBtn = isLocked
  const mainActionButtonsCount =
    (showOrcamentoBtn ? 1 : 0) +
    (showPagamentoBtn ? 1 : 0) +
    (showSalvarBtn ? 1 : 0) +
    (showEstornarBtn ? 1 : 0)

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.nome }))
  const itemOptions = [
    {
      label: 'Produtos',
      options: produtosDisp.map(p => ({
        value: `prod-${p.id}`,
        label: `${p.nome} — ${fmt(p.preco)} — Qtd: ${p.estoque_livre ?? 0}`
      }))
    },
    {
      label: 'Serviços',
      options: servicosDisp.map(s => ({ value: `serv-${s.id}`, label: `${s.nome} — ${fmt(s.preco)}` }))
    }
  ]

  return (
    <React.Fragment>
      <div className="os-form">
        {/* Header */}
        <div className="os-form-header">
          <div className="os-form-title">
            <button className="btn btn-secondary btn-icon" onClick={() => navigate('/ordens')}>
              <RiArrowLeftLine />
            </button>
            <div>
              <div className="os-form-title-inline">
                <h2>{isNew ? 'Nova Ordem de Serviço' : `OS #${String(id).padStart(4, '0')}`}</h2>
                {!isNew && (
                  <div className="os-form-inline-total" aria-label="Total da ordem de serviço">
                    <span>Total</span>
                    <strong>{fmt(total)}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="os-header-right">
            <div className="os-actions-row">
              <button
                type="button"
                className={`os-actions-pill os-status-pill badge badge-${form.status}`}
                onClick={() => setShowStatusModal(true)}
                disabled={isLocked}
                title={isLocked ? 'OS bloqueada' : 'Alterar status'}
              >
                {STATUS_LABELS[form.status]}
              </button>

              <button
                type="button"
                className="os-actions-pill os-whatsapp-pill"
                title="Enviar orçamento por WhatsApp"
                onClick={handleGerarOrcamentoWhatsapp}
                disabled={(itensProdutos.length === 0 && itensServicos.length === 0) || isLocked}
              >
                <RiWhatsappLine />
              </button>
            </div>

            <div className="card os-actions-card">
              <div className={`os-actions-main-row${mainActionButtonsCount === 1 ? ' single' : ''}`}>
                {showOrcamentoBtn && (
                  <button
                    className="btn btn-info os-actions-main"
                    onClick={() => handleSave('aprovado')}
                    disabled={saving || isLocked}
                  >
                    <RiCheckboxCircleLine />
                    Orçamento
                  </button>
                )}

                {showPagamentoBtn ? (
                  <button
                    className="btn btn-success os-actions-main"
                    onClick={() => setShowPayModal(true)}
                    disabled={saving || isLocked}
                  >
                    <RiMoneyDollarCircleLine />
                    Pagamento
                  </button>
                ) : (
                  <button
                    className="btn btn-success os-actions-main"
                    onClick={() => handleSave()}
                    disabled={saving || isLocked}
                  >
                    <RiSaveLine />
                    Salvar
                  </button>
                )}

                {showEstornarBtn && (
                  <button
                    className="btn btn-danger os-actions-main"
                    onClick={handleEstornar}
                    disabled={saving}
                    title="Reabrir OS e devolver estoque"
                  >
                    Estornar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="os-form-body">
        {/* Left column */}
        <div className="os-col-main">
          {/* Cliente & Status */}
          <div className="card">
            <h3 className="section-title">Informações da OS</h3>
            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                <label>Cliente <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>*</span></label>
                <div className="os-compact-field-row">
                  <div ref={clienteFieldRef} style={{ flex: 1 }} onFocusCapture={() => scrollFieldIntoView(clienteFieldRef)}>
                    <Select
                      options={clienteOptions}
                      styles={customSelectStyles}
                      placeholder="Buscar cliente..."
                      value={clienteOptions.find(o => o.value === form.cliente_id) || null}
                      onChange={sel => setForm(f => ({ ...f, cliente_id: sel ? sel.value : '' }))}
                      isClearable
                      isDisabled={isLocked}
                      noOptionsMessage={() => "Nenhum cliente"}
                      menuPortalTarget={menuPortalTarget}
                      menuPosition="fixed"
                      onMenuOpen={() => scrollFieldIntoView(clienteFieldRef)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon os-btn-compact"
                    onClick={() => setShowCliEqpInfoModal(true)}
                    title="Ver dados completos"
                    disabled={!form.cliente_id}
                  >
                    <RiEyeLine />
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-icon os-btn-compact" 
                    onClick={() => setShowClienteModal(true)} 
                    title="Cadastrar Novo Cliente"
                    disabled={isLocked}
                  >
                    <RiAddLine />
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                <label>Equipamento (Requer Cliente)</label>
                <div className="os-compact-field-row">
                  <div ref={equipamentoFieldRef} style={{ flex: 1 }} onFocusCapture={() => scrollFieldIntoView(equipamentoFieldRef)}>
                    <Select
                      options={equipamentos.map(e => ({ value: e.id, label: `${e.modelo} ${e.marca ? `- ${e.marca}` : ''} ${e.voltagem ? `[${e.voltagem}]` : ''}` }))}
                      styles={customSelectStyles}
                      placeholder="Selecione o equipamento..."
                      value={equipamentos.map(e => ({ value: e.id, label: `${e.modelo} ${e.marca ? `- ${e.marca}` : ''} ${e.voltagem ? `[${e.voltagem}]` : ''}` })).find(o => o.value === form.equipamento_id) || null}
                      onChange={sel => setForm(f => ({ ...f, equipamento_id: sel ? sel.value : '' }))}
                      isClearable
                      isDisabled={!form.cliente_id || isLocked}
                      noOptionsMessage={() => "Nenhum equipamento cadastrado"}
                      menuPortalTarget={menuPortalTarget}
                      menuPosition="fixed"
                      onMenuOpen={() => scrollFieldIntoView(equipamentoFieldRef)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon os-btn-compact"
                    onClick={() => setShowCliEqpInfoModal(true)}
                    title="Ver dados completos"
                    disabled={!form.cliente_id}
                  >
                    <RiEyeLine />
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-icon os-btn-compact" 
                    disabled={!form.cliente_id || isLocked} 
                    onClick={() => setShowEqpModal(true)} 
                    title="Cadastrar Novo Equipamento"
                  >
                    <RiAddLine />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card os-problema-card">
            <div className="os-card-header-row">
              <h3 className="section-title" style={{ margin: 0 }}>Defeito / Problema Reclamado</h3>
              <button
                type="button"
                className="btn btn-secondary btn-icon os-btn-compact"
                title="Ver tudo"
                onClick={() => setShowProblemaModal(true)}
                disabled={isLocked}
              >
                <RiEyeLine />
              </button>
            </div>
            <textarea
              className="form-control os-textarea-compact"
              placeholder="Descreva o problema relatado pelo cliente (Ex: Não liga, tela quebrada...)"
              rows={2}
              value={form.problema_reclamado}
              onChange={e => setForm(f => ({ ...f, problema_reclamado: e.target.value }))}
              disabled={isLocked}
              style={{ marginTop: 12 }}
            />
          </div>

          {/* Produtos e Serviços Unificados */}
          <div className="card">
            <div className="os-itens-header">
              <h3 className="section-title" style={{ margin: 0 }}>Itens da Ordem (Produtos e Serviços)</h3>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                title="Ver resumo detalhado"
                onClick={() => setShowItensResumoModal(true)}
              >
                <RiEyeLine />
              </button>
            </div>
            
            <div className="add-item-row">
              <div ref={itemFieldRef} style={{ flex: 1 }} onFocusCapture={() => scrollFieldIntoView(itemFieldRef)}>
                <Select
                  options={itemOptions}
                  styles={customSelectStyles}
                  placeholder="Produto/Serviço"
                  value={itemOptions.flatMap(g => g.options).find(o => o.value === addItem.temp_id) || null}
                  onChange={sel => setAddItem(a => ({ ...a, temp_id: sel ? sel.value : '' }))}
                  isClearable
                  isDisabled={isLocked}
                  noOptionsMessage={() => "Nenhum item encontrado"}
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  onMenuOpen={() => scrollFieldIntoView(itemFieldRef)}
                />
              </div>
              <button className="btn btn-success btn-icon os-btn-compact" title="Adicionar Item" onClick={openQtyModal} disabled={isLocked}><RiAddLine size={18} /></button>
            </div>

            {itensProdutos.length > 0 || itensServicos.length > 0 ? (
              <>
                <div className="os-items-mobile-list" style={{ marginTop: 20 }}>
                  <div className="os-mobile-grid-header">
                    <div className="os-mobile-grid-cell os-mobile-grid-name">Item</div>
                    <div className="os-mobile-grid-cell os-mobile-grid-num">Qtd</div>
                    <div className="os-mobile-grid-cell os-mobile-grid-num">Preço</div>
                    <div className="os-mobile-grid-cell os-mobile-grid-num">Total</div>
                  </div>

                  {itensProdutos.map(i => {
                    const key = i.id || i._tempId
                    const itemKey = `prod-${key}`
                    const expanded = expandedItemKey === itemKey
                    return (
                      <div key={itemKey} className={`os-mobile-grid-item ${expanded ? 'expanded' : ''}`}>
                        <button
                          type="button"
                          className="os-mobile-grid-row"
                          onClick={() => setExpandedItemKey(prev => (prev === itemKey ? null : itemKey))}
                        >
                          <div className="os-mobile-grid-cell os-mobile-grid-name" title={i.produtos?.nome || ''}>
                            {i.produtos?.nome}
                          </div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num">{Number(i.quantidade || 0)}</div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num">{fmt(i.preco_unitario)}</div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num fw-600 text-red">{fmt(i.quantidade * i.preco_unitario)}</div>
                        </button>

                        {expanded && (
                          <div className="os-mobile-grid-edit" onClick={e => e.stopPropagation()}>
                            <div className="os-mobile-grid-edit-row">
                              <div className="os-mobile-edit-field">
                                <div className="os-mobile-edit-label">Quantidade</div>
                                <div className="os-item-qty">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="form-control table-input"
                                    value={i.quantidade}
                                    onChange={e => updateProduto(key, 'quantidade', e.target.value)}
                                    disabled={isLocked}
                                  />
                                  <span className="os-item-unit">{i.produtos?.unidade}</span>
                                </div>
                              </div>

                              <div className="os-mobile-edit-field">
                                <div className="os-mobile-edit-label">Preço</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control table-input"
                                  value={i.preco_unitario}
                                  onChange={e => updateProduto(key, 'preco_unitario', e.target.value)}
                                  disabled={isLocked}
                                />
                              </div>
                            </div>

                            <div className="os-mobile-grid-edit-actions">
                              <button
                                type="button"
                                className="btn btn-danger btn-icon"
                                onClick={() => removerProduto(key)}
                                title="Remover"
                                disabled={isLocked}
                              >
                                <RiDeleteBinLine />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {itensServicos.map(i => {
                    const key = i.id || i._tempId
                    const itemKey = `serv-${key}`
                    const expanded = expandedItemKey === itemKey
                    return (
                      <div key={itemKey} className={`os-mobile-grid-item ${expanded ? 'expanded' : ''}`}>
                        <button
                          type="button"
                          className="os-mobile-grid-row"
                          onClick={() => setExpandedItemKey(prev => (prev === itemKey ? null : itemKey))}
                        >
                          <div className="os-mobile-grid-cell os-mobile-grid-name" title={i.servicos?.nome || ''}>
                            {i.servicos?.nome}
                          </div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num">{Number(i.quantidade || 0)}</div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num">{fmt(i.preco_unitario)}</div>
                          <div className="os-mobile-grid-cell os-mobile-grid-num fw-600 text-red">{fmt(i.quantidade * i.preco_unitario)}</div>
                        </button>

                        {expanded && (
                          <div className="os-mobile-grid-edit" onClick={e => e.stopPropagation()}>
                            <div className="os-mobile-grid-edit-row">
                              <div className="os-mobile-edit-field">
                                <div className="os-mobile-edit-label">Quantidade</div>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  className="form-control table-input"
                                  value={i.quantidade}
                                  onChange={e => updateServico(key, 'quantidade', e.target.value)}
                                  disabled={isLocked}
                                />
                              </div>

                              <div className="os-mobile-edit-field">
                                <div className="os-mobile-edit-label">Preço</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control table-input"
                                  value={i.preco_unitario}
                                  onChange={e => updateServico(key, 'preco_unitario', e.target.value)}
                                  disabled={isLocked}
                                />
                              </div>
                            </div>

                            <div className="os-mobile-grid-edit-actions">
                              <button
                                type="button"
                                className="btn btn-danger btn-icon"
                                onClick={() => removerServico(key)}
                                title="Remover"
                                disabled={isLocked}
                              >
                                <RiDeleteBinLine />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="table-wrapper os-items-table-wrapper" style={{ marginTop: 20 }}>
                  <table className="os-items-table">
                    <colgroup>
                      <col style={{ width: 92 }} />
                      <col />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 56 }} />
                    </colgroup>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th>Preço Unit.</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Linhas de Produtos */}
                    {itensProdutos.map(i => {
                      const key = i.id || i._tempId
                      return (
                        <tr key={key}>
                          <td><span className="badge badge-warning os-item-badge">PRODUTO</span></td>
                          <td className="fw-600 os-item-name" title={i.produtos?.nome || ''}>{i.produtos?.nome}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input 
                                type="number" 
                                min="1"
                                step="1"
                                className="form-control table-input table-input-qty" 
                                value={i.quantidade} 
                                onChange={e => updateProduto(key, 'quantidade', e.target.value)} 
                                disabled={isLocked}
                              />
                              <span style={{ fontSize: 13, color: 'var(--gray-light)' }}>{i.produtos?.unidade}</span>
                            </div>
                          </td>
                          <td>
                             <input 
                                type="number" 
                                step="0.01"
                                className="form-control table-input table-input-price" 
                                value={i.preco_unitario} 
                                onChange={e => updateProduto(key, 'preco_unitario', e.target.value)} 
                                disabled={isLocked}
                              />
                          </td>
                          <td className="fw-600 text-red">{fmt(i.quantidade * i.preco_unitario)}</td>
                          <td><button className="btn btn-danger btn-icon" onClick={() => removerProduto(key)} title="Remover" disabled={isLocked}><RiDeleteBinLine /></button></td>
                        </tr>
                      )
                    })}
                    
                    {/* Linhas de Serviços */}
                    {itensServicos.map(i => {
                      const key = i.id || i._tempId
                      return (
                        <tr key={key}>
                          <td><span className="badge badge-info os-item-badge">SERVIÇO</span></td>
                          <td className="fw-600 os-item-name" title={i.servicos?.nome || ''}>{i.servicos?.nome}</td>
                          <td>
                            <input 
                              type="number" 
                              min="1"
                              step="1"
                              className="form-control table-input table-input-qty" 
                              value={i.quantidade} 
                              onChange={e => updateServico(key, 'quantidade', e.target.value)} 
                              disabled={isLocked}
                            />
                          </td>
                          <td>
                             <input 
                                type="number" 
                                step="0.01"
                                className="form-control table-input table-input-price" 
                                value={i.preco_unitario} 
                                onChange={e => updateServico(key, 'preco_unitario', e.target.value)} 
                                disabled={isLocked}
                              />
                          </td>
                          <td className="fw-600 text-red">{fmt(i.quantidade * i.preco_unitario)}</td>
                          <td><button className="btn btn-danger btn-icon" onClick={() => removerServico(key)} title="Remover" disabled={isLocked}><RiDeleteBinLine /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '32px 0', fontSize: 13 }}>
                <p>Nenhum item adicionado à Ordem de Serviço</p>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="section-title">Condições de Pagamento</h3>
            <input
              className="form-control"
              type="text"
              style={{ marginTop: 12, width: '100%' }}
              placeholder="Ex: Em 3x de R$ 50, Metade na entrada, À vista..."
              value={form.condicao_pagamento}
              onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
              disabled={isLocked}
            />
          </div>

          {/* Observações */}
          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="section-title">Observações</h3>
            <textarea
              className="form-control"
              placeholder="Digite aqui observações extras sobre a ordem de serviço..."
              rows={4}
              style={{ marginTop: 12 }}
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              disabled={isLocked}
            />
          </div>
        </div>

        {/* Right - Totals */}
        <div className="os-col-side">
          <div className="card">
            <h3 className="section-title">Ações</h3>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isOrcamento && !isNew && (
                <button className="btn btn-info" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleSave('aprovado')} disabled={saving || isLocked}>
                  <RiCheckboxCircleLine /> Orçamento
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Finalizar e Pagar</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPayModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--gray-light)', marginBottom: 16 }}>
                Selecione a forma de pagamento prestada para finalizar a O.S e lançá-la automaticamente no caixa.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(METODOS_PAGAMENTO).map(([v, info]) => (
                  <button
                     key={v}
                     className={`pay-btn ${form.metodo_pagamento === v ? 'active' : ''}`}
                     onClick={() => setForm(f => ({ ...f, metodo_pagamento: v }))}
                     disabled={info.disabled}
                     style={{
                       display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                       padding: '16px 10px', borderRadius: 10, background: 'var(--dark-3)', 
                       border: `1px solid ${form.metodo_pagamento === v ? 'var(--red)' : 'var(--white-border)'}`,
                       color: info.disabled ? 'var(--dark-5)' : 'var(--white)', cursor: info.disabled ? 'not-allowed' : 'pointer',
                       opacity: info.disabled ? 0.3 : 1, transition: '0.2s ease', height: '100%'
                     }}
                  >
                     <span style={{ fontSize: 26, marginBottom: 8, color: form.metodo_pagamento === v ? 'var(--red)' : 'inherit' }}>{info.icon}</span>
                     <span style={{ fontSize: 11, textAlign: 'center', fontWeight: 600 }}>{info.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancelar</button>
               <button className="btn btn-success" disabled={!form.metodo_pagamento || saving} onClick={() => { setShowPayModal(false); handleSave(); }}>
                 {saving ? 'Registrando...' : 'Confirmar e Lançar'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Status da OS</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowStatusModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <button
                    key={v}
                    className={`status-btn ${form.status === v ? 'active' : ''}`}
                    onClick={async () => {
                      await handleSelectStatus(v)
                      setShowStatusModal(false)
                    }}
                    disabled={isLocked}
                  >
                    <span className={`status-dot status-${v}`}></span>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showProblemaModal && (
        <div className="modal-overlay" onClick={() => setShowProblemaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Defeito / Problema Reclamado</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowProblemaModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <textarea
                className="form-control"
                rows={8}
                value={form.problema_reclamado}
                onChange={e => setForm(f => ({ ...f, problema_reclamado: e.target.value }))}
                disabled={isLocked}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProblemaModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showCliEqpInfoModal && (
        <div className="modal-overlay" onClick={() => setShowCliEqpInfoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Dados do Cliente e Equipamento</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowCliEqpInfoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="os-info-block">
                <div className="os-info-block-title">Cliente</div>
                <div className="os-info-grid">
                  <div className="os-info-row"><span>Nome</span><strong>{selectedCliente?.nome || '—'}</strong></div>
                  <div className="os-info-row"><span>Telefone</span><strong>{selectedCliente?.telefone || '—'}</strong></div>
                  <div className="os-info-row"><span>Endereço</span><strong>{selectedCliente?.endereco || '—'}</strong></div>
                </div>
              </div>

              <div className="os-info-block" style={{ marginTop: 14 }}>
                <div className="os-info-block-title">Equipamento</div>
                <div className="os-info-grid">
                  <div className="os-info-row"><span>Modelo</span><strong>{selectedEquipamento?.modelo || '—'}</strong></div>
                  <div className="os-info-row"><span>Marca</span><strong>{selectedEquipamento?.marca || '—'}</strong></div>
                  <div className="os-info-row"><span>Nº Série</span><strong>{selectedEquipamento?.numero_serie || '—'}</strong></div>
                  <div className="os-info-row"><span>Voltagem</span><strong>{selectedEquipamento?.voltagem || '—'}</strong></div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCliEqpInfoModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showItensResumoModal && (
        <div className="modal-overlay" onClick={() => setShowItensResumoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>Resumo de Itens</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowItensResumoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="os-resumo-grid">
                <div className="os-resumo-kpi">
                  <span>Produtos</span>
                  <strong>{fmt(totalProdutos)}</strong>
                  <em>{itensProdutos.length} item(ns) • {totalQtdProdutos} un.</em>
                </div>
                <div className="os-resumo-kpi">
                  <span>Serviços</span>
                  <strong>{fmt(totalServicos)}</strong>
                  <em>{itensServicos.length} item(ns) • {totalQtdServicos} un.</em>
                </div>
                <div className="os-resumo-kpi total">
                  <span>Total</span>
                  <strong>{fmt(total)}</strong>
                  <em>Desconto: —</em>
                </div>
              </div>

              <div className="os-resumo-section">
                <h4>Produtos</h4>
                {itensProdutos.length === 0 ? (
                  <div className="empty-state" style={{ padding: '14px 0', fontSize: 13 }}>
                    <p>Nenhum produto</p>
                  </div>
                ) : (
                  <div className="os-resumo-list">
                    {itensProdutos.map((i, idx) => (
                      <div key={(i.id || i._tempId) ?? idx} className="os-resumo-row">
                        <div className="os-resumo-main">
                          <div className="os-resumo-title" title={i.produtos?.nome || ''}>{i.produtos?.nome || '—'}</div>
                          <div className="os-resumo-sub">
                            Qtd: <strong>{Number(i.quantidade || 0)}</strong>{i.produtos?.unidade ? ` ${i.produtos.unidade}` : ''} • Unit.: <strong>{fmt(i.preco_unitario)}</strong>
                          </div>
                        </div>
                        <div className="os-resumo-right">
                          <div className="os-resumo-total">{fmt(Number(i.quantidade || 0) * Number(i.preco_unitario || 0))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="os-resumo-section" style={{ marginTop: 16 }}>
                <h4>Serviços</h4>
                {itensServicos.length === 0 ? (
                  <div className="empty-state" style={{ padding: '14px 0', fontSize: 13 }}>
                    <p>Nenhum serviço</p>
                  </div>
                ) : (
                  <div className="os-resumo-list">
                    {itensServicos.map((i, idx) => (
                      <div key={(i.id || i._tempId) ?? idx} className="os-resumo-row">
                        <div className="os-resumo-main">
                          <div className="os-resumo-title" title={i.servicos?.nome || ''}>{i.servicos?.nome || '—'}</div>
                          <div className="os-resumo-sub">
                            Qtd: <strong>{Number(i.quantidade || 0)}</strong> • Unit.: <strong>{fmt(i.preco_unitario)}</strong>
                          </div>
                        </div>
                        <div className="os-resumo-right">
                          <div className="os-resumo-total">{fmt(Number(i.quantidade || 0) * Number(i.preco_unitario || 0))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowItensResumoModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {qtyModal.open && (
        <div className="modal-overlay" onClick={() => setQtyModal(m => ({ ...m, open: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Quantidade</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setQtyModal(m => ({ ...m, open: false }))}>×</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                adicionarItemComQuantidade(qtyModal.temp_id, qtyModal.quantidade)
              }}
            >
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--gray-light)', marginBottom: 14, background: 'var(--dark-3)', padding: 10, borderRadius: 8, border: '1px solid var(--white-border)' }}>
                  Item: <strong style={{ color: 'var(--white)' }}>{getItemNameFromTempId(qtyModal.temp_id) || '—'}</strong>
                </p>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="form-control"
                    value={qtyModal.quantidade}
                    onChange={e => setQtyModal(m => ({ ...m, quantidade: e.target.value }))}
                    disabled={isLocked}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setQtyModal(m => ({ ...m, open: false }))}>Cancelar</button>
                <button type="submit" className="btn btn-success" disabled={isLocked}>Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEqpModal && (
        <div className="modal-overlay" onClick={() => setShowEqpModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Cadastrar Novo Equipamento</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowEqpModal(false)}>×</button>
            </div>
            <form onSubmit={handleSalvarEquipamento}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 16, background: 'var(--dark-3)', padding: 10, borderRadius: 8 }}>
                  Este equipamento será vinculado permanentemente ao cliente <strong>{clientes.find(c => c.id === form.cliente_id)?.nome}</strong>.
                </p>
                <div className="form-group">
                  <label>Modelo <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>*</span></label>
                  <input required className="form-control" placeholder="Ex: iPhone 15, TV 50', Geladeira..." value={novoEqp.modelo} onChange={e => setNovoEqp(Eq => ({ ...Eq, modelo: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Marca</label>
                    <input className="form-control" placeholder="Ex: Apple, LG, Brastemp..." value={novoEqp.marca} onChange={e => setNovoEqp(Eq => ({ ...Eq, marca: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Voltagem</label>
                    <select className="form-control" value={novoEqp.voltagem} onChange={e => setNovoEqp(Eq => ({ ...Eq, voltagem: e.target.value }))}>
                      <option value="">(Nenhuma)</option>
                      <option value="110V">110V</option>
                      <option value="220V">220V</option>
                      <option value="Bivolt">Bivolt (110V/220V)</option>
                      <option value="VDC">VDC (Baixa Tensão)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Número de Série</label>
                  <input className="form-control" placeholder="ABC123456789..." value={novoEqp.numero_serie} onChange={e => setNovoEqp(Eq => ({ ...Eq, numero_serie: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button type="button" className="btn btn-secondary" onClick={() => setShowEqpModal(false)}>Cancelar</button>
                 <button type="submit" className="btn btn-primary" disabled={saving}>
                   {saving ? 'Salvando...' : 'Salvar Equipamento'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClienteModal && (
        <div className="modal-overlay" onClick={() => setShowClienteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Cadastrar Novo Cliente</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowClienteModal(false)}>×</button>
            </div>
            <form onSubmit={handleSalvarCliente}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>*</span></label>
                  <input required className="form-control" placeholder="João da Silva" value={novoCliente.nome} onChange={e => setNovoCliente(c => ({ ...c, nome: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Telefone</label>
                  <input className="form-control" placeholder="(00) 00000-0000" value={novoCliente.telefone} onChange={e => setNovoCliente(c => ({ ...c, telefone: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Endereço</label>
                  <input className="form-control" placeholder="Rua, número, bairro, cidade" value={novoCliente.endereco || ''} onChange={e => setNovoCliente(c => ({ ...c, endereco: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button type="button" className="btn btn-secondary" onClick={() => setShowClienteModal(false)}>Cancelar</button>
                 <button type="submit" className="btn btn-primary" disabled={saving}>
                   {saving ? 'Salvando...' : 'Salvar Cliente'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="modal-overlay" onClick={() => closeConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => closeConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              {confirmModal.content}
            </div>
            <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16, paddingBottom: 16, borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => closeConfirm(false)}>{confirmModal.cancelText}</button>
              <button className={confirmModal.confirmClassName} onClick={() => closeConfirm(true)}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* BLoco de Impressão A4 */}
      <div className="print-container">
        <div style={{ padding: 40, fontFamily: 'sans-serif', color: 'black' }}>
          <div style={{ borderBottom: '2px solid #333', paddingBottom: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
             <div>
               <h1 style={{ margin: 0, fontSize: 24 }}>ELETROCED</h1>
               <p style={{ margin: '5px 0 0 0', fontSize: 14 }}>Ordem de Serviço: #{String(savedOsId || id).padStart(5, '0')}</p>
             </div>
             <div style={{ textAlign: 'right' }}>
               <p style={{ margin: 0 }}>Data: {new Date().toLocaleDateString()}</p>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
             <div>
               <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>DADOS DO CLIENTE</h4>
               <p style={{ margin: '4px 0' }}><strong>Nome:</strong> {clientes.find(c => c.id === form.cliente_id)?.nome}</p>
               <p style={{ margin: '4px 0' }}><strong>Telefone:</strong> {clientes.find(c => c.id === form.cliente_id)?.telefone || 'N/A'}</p>
             </div>
             <div>
               <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>EQUIPAMENTO / DETALHES</h4>
               {form.equipamento_id ? (() => {
                 const eq = equipamentos.find(e => e.id === form.equipamento_id)
                 return (
                   <>
                     <p style={{ margin: '4px 0' }}><strong>Modelo:</strong> {eq?.modelo}</p>
                     <p style={{ margin: '4px 0' }}><strong>Marca:</strong> {eq?.marca}</p>
                     <p style={{ margin: '4px 0' }}><strong>Voltagem:</strong> {eq?.voltagem}</p>
                   </>
                 )
               })() : <p style={{ margin: '4px 0' }}>Nenhum equipamento vinculado.</p>}
               <p style={{ margin: '8px 0 4px 0' }}><strong>Problema:</strong> {form.problema_reclamado}</p>
               <p style={{ margin: '4px 0' }}><strong>Condições:</strong> {form.condicao_pagamento}</p>
             </div>
          </div>

          <h4 style={{ margin: '20px 0 10px 0' }}>ITENS DA ORDEM</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'left' }}>Item</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>Qtd</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>V. Unit</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {itensProdutos.map((i, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{i.produtos?.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>{i.quantidade}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{fmt(i.preco_unitario)}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{fmt(i.quantidade * i.preco_unitario)}</td>
                </tr>
              ))}
              {itensServicos.map((i, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{i.servicos?.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>{i.quantidade}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{fmt(i.preco_unitario)}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{fmt(i.quantidade * i.preco_unitario)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', padding: 8, fontWeight: 'bold' }}>TOTAL GERAL</td>
                <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}>{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>

          {form.observacoes && (
            <div style={{ marginTop: 20 }}>
               <h4 style={{ margin: '0 0 8px 0' }}>OBSERVAÇÕES</h4>
               <p style={{ margin: 0, padding: 10, background: '#f5f5f5', border: '1px solid #ccc' }}>{form.observacoes}</p>
            </div>
          )}
          
          <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center' }}>
             <div>
                <div style={{ borderBottom: '1px solid black', margin: '0 20px 5px 20px' }}></div>
                <p style={{ margin: 0 }}>Assinatura Eletroced</p>
             </div>
             <div>
                <div style={{ borderBottom: '1px solid black', margin: '0 20px 5px 20px' }}></div>
                <p style={{ margin: 0 }}>Assinatura do Cliente</p>
             </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  )
}
