const STATUS_LABELS = {
  aberto: 'Aberto',
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const brandImageCache = new Map()

function fmtMoney(v) {
  return v != null
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '—'
}

function fmtQtd(v) {
  return v != null
    ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    : '—'
}

async function svgToPngDataUrl(svgUrl, sizePx = 256) {
  if (brandImageCache.has(svgUrl)) return brandImageCache.get(svgUrl)

  const promise = (async () => {
    const res = await fetch(svgUrl)
    if (!res.ok) throw new Error(`Falha ao carregar imagem: ${svgUrl}`)
    const svgText = await res.text()

    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const blobUrl = URL.createObjectURL(blob)

    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = blobUrl

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = sizePx
      canvas.height = sizePx

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas não suportado')

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      return canvas.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  })()

  brandImageCache.set(svgUrl, promise)
  return promise
}

function safeText(v) {
  const s = String(v ?? '').trim()
  return s.length ? s : '—'
}

function ensureArray(v) {
  return Array.isArray(v) ? v : []
}

export async function gerarPdfOrdemServico({
  os,
  cliente,
  equipamento,
  itens,
  empresaNome = 'ELETROCED',
  brandMarkUrl = '/brand/mark.svg',
  abrirParaImprimir = false,
} = {}) {
  if (!os?.id) throw new Error('OS inválida')

  const [{ jsPDF }, brandPng] = await Promise.all([
    import('jspdf'),
    svgToPngDataUrl(brandMarkUrl, 256).catch(() => null),
  ])

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  const pageW = 210
  const pageH = 297
  const marginX = 14
  const contentW = pageW - marginX * 2

  let y = 14

  const setText = (size, style = 'normal') => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }

  const hr = (yy) => {
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.line(marginX, yy, marginX + contentW, yy)
  }

  const box = ({ x, y, w, h, title }) => {
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 2, 2)
    if (title) {
      setText(10, 'bold')
      doc.text(title, x + 3, y + 5)
    }
  }

  // Header
  const markSize = 16
  if (brandPng) {
    doc.addImage(brandPng, 'PNG', marginX, y, markSize, markSize)
  } else {
    // Fallback: just a placeholder box
    doc.setDrawColor(210)
    doc.rect(marginX, y, markSize, markSize)
  }

  setText(18, 'bold')
  doc.text(empresaNome, marginX + markSize + 6, y + 10)
  setText(10, 'normal')
  doc.setTextColor(120)
  doc.text('Ordem de Serviço', marginX + markSize + 6, y + 15)
  doc.setTextColor(0)

  const osNum = String(os.id).padStart(5, '0')
  const dataOs = os.created_at ? new Date(os.created_at) : new Date()
  const dataStr = dataOs.toLocaleDateString('pt-BR')

  const rightX = marginX + contentW
  const infoW = 64
  const infoH = 18
  box({ x: rightX - infoW, y, w: infoW, h: infoH })
  setText(10, 'bold')
  doc.text(`OS #${osNum}`, rightX - infoW + 4, y + 7)
  setText(9, 'normal')
  doc.setTextColor(120)
  doc.text(dataStr, rightX - infoW + 4, y + 13)
  doc.setTextColor(0)

  y += 22
  hr(y)
  y += 6

  // Status & pagamento
  const statusLabel = STATUS_LABELS[os.status] || safeText(os.status)
  setText(10, 'bold')
  doc.text('Status:', marginX, y)
  setText(10, 'normal')
  doc.text(statusLabel, marginX + 16, y)

  if (os.metodo_pagamento) {
    setText(10, 'bold')
    doc.text('Pagamento:', marginX + 80, y)
    setText(10, 'normal')
    doc.text(safeText(os.metodo_pagamento), marginX + 104, y)
  }

  y += 8

  // Cliente / Equipamento boxes
  const colGap = 6
  const colW = (contentW - colGap) / 2
  const boxH = 34

  box({ x: marginX, y, w: colW, h: boxH, title: 'Cliente' })
  setText(10, 'normal')
  doc.text(`Nome: ${safeText(cliente?.nome)}`, marginX + 3, y + 12)
  doc.text(`Telefone: ${safeText(cliente?.telefone)}`, marginX + 3, y + 19)

  box({ x: marginX + colW + colGap, y, w: colW, h: boxH, title: 'Equipamento' })
  const eqX = marginX + colW + colGap + 3
  doc.text(`Modelo: ${safeText(equipamento?.modelo)}`, eqX, y + 12)
  const marca = equipamento?.marca ? `Marca: ${equipamento.marca}` : null
  const volt = equipamento?.voltagem ? `Voltagem: ${equipamento.voltagem}` : null
  const ns = equipamento?.numero_serie ? `Nº Série: ${equipamento.numero_serie}` : null
  const extra = [marca, volt, ns].filter(Boolean)
  if (extra.length) {
    doc.setTextColor(120)
    doc.text(extra.join('  |  '), eqX, y + 19)
    doc.setTextColor(0)
  }

  y += boxH + 8

  // Problema / condição
  if (os.problema_reclamado || os.condicao_pagamento) {
    const problemText = os.problema_reclamado ? `Problema: ${safeText(os.problema_reclamado)}` : null
    const condText = os.condicao_pagamento ? `Condições: ${safeText(os.condicao_pagamento)}` : null
    const lines = [problemText, condText].filter(Boolean)

    const h = 8 + lines.length * 6
    box({ x: marginX, y, w: contentW, h, title: 'Detalhes' })
    setText(10, 'normal')
    let yy = y + 12
    for (const t of lines) {
      const parts = doc.splitTextToSize(t, contentW - 6)
      for (const p of parts) {
        doc.text(p, marginX + 3, yy)
        yy += 6
      }
    }
    y += h + 8
  }

  // Items table
  const rows = ensureArray(itens).map(i => {
    const quantidade = Number(i.quantidade ?? 0)
    const unit = Number(i.preco_unitario ?? 0)
    return {
      tipo: i.tipo || (i.servico_id ? 'SERV' : 'PROD'),
      descricao: safeText(i.descricao || i.nome),
      unidade: i.unidade || '',
      quantidade,
      preco_unitario: unit,
      subtotal: quantidade * unit,
    }
  })

  const col = {
    desc: 86,
    tipo: 16,
    un: 12,
    qtd: 16,
    unit: 24,
    sub: 28,
  }

  const tableX = marginX
  const tableW = contentW
  const headerH = 8

  const drawTableHeader = () => {
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.setFillColor(245)
    doc.rect(tableX, y, tableW, headerH, 'F')

    setText(10, 'bold')
    doc.text('Descrição', tableX + 2, y + 5.5)
    doc.text('Tipo', tableX + col.desc + 2, y + 5.5)
    doc.text('Un', tableX + col.desc + col.tipo + 2, y + 5.5)
    doc.text('Qtd', tableX + col.desc + col.tipo + col.un + 2, y + 5.5)
    doc.text('V.Unit', tableX + col.desc + col.tipo + col.un + col.qtd + 2, y + 5.5)
    doc.text('Subtotal', tableX + col.desc + col.tipo + col.un + col.qtd + col.unit + 2, y + 5.5)

    y += headerH

    // outer border baseline
    doc.rect(tableX, y - headerH, tableW, headerH)
  }

  const drawRow = (r) => {
    const descLines = doc.splitTextToSize(r.descricao, col.desc - 4)
    const lineH = 5
    const rowH = Math.max(8, descLines.length * lineH)

    if (y + rowH > pageH - 26) {
      doc.addPage()
      y = 14
      drawTableHeader()
    }

    // Row borders
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.rect(tableX, y, tableW, rowH)

    // vertical separators
    let xx = tableX + col.desc
    doc.line(xx, y, xx, y + rowH)
    xx += col.tipo
    doc.line(xx, y, xx, y + rowH)
    xx += col.un
    doc.line(xx, y, xx, y + rowH)
    xx += col.qtd
    doc.line(xx, y, xx, y + rowH)
    xx += col.unit
    doc.line(xx, y, xx, y + rowH)

    setText(9, 'normal')

    // Description
    let ty = y + 5.5
    for (const l of descLines) {
      doc.text(l, tableX + 2, ty)
      ty += lineH
    }

    // Other columns
    const baseY = y + 5.5
    doc.text(String(r.tipo || ''), tableX + col.desc + 2, baseY)
    doc.text(String(r.unidade || ''), tableX + col.desc + col.tipo + 2, baseY)

    doc.text(fmtQtd(r.quantidade), tableX + col.desc + col.tipo + col.un + 2, baseY)

    doc.text(fmtMoney(r.preco_unitario), tableX + col.desc + col.tipo + col.un + col.qtd + 2, baseY)

    doc.text(fmtMoney(r.subtotal), tableX + col.desc + col.tipo + col.un + col.qtd + col.unit + 2, baseY)

    y += rowH
  }

  setText(11, 'bold')
  doc.text('Itens', marginX, y)
  y += 6

  drawTableHeader()

  if (rows.length === 0) {
    const r = { tipo: '', descricao: 'Nenhum item.', unidade: '', quantidade: '', preco_unitario: '', subtotal: '' }
    drawRow(r)
  } else {
    for (const r of rows) drawRow(r)
  }

  y += 8

  // Total box
  if (y + 20 > pageH - 20) {
    doc.addPage()
    y = 14
  }

  const totalW = 70
  const totalH = 18
  box({ x: marginX + contentW - totalW, y, w: totalW, h: totalH })
  setText(10, 'bold')
  doc.text('TOTAL', marginX + contentW - totalW + 4, y + 7)
  setText(12, 'bold')
  doc.text(fmtMoney(os.total), marginX + contentW - totalW + 4, y + 14)

  y += totalH + 8

  // Observações
  if (os.observacoes) {
    const obsLines = doc.splitTextToSize(safeText(os.observacoes), contentW - 6)
    const obsH = Math.min(70, 10 + obsLines.length * 5)

    if (y + obsH > pageH - 26) {
      doc.addPage()
      y = 14
    }

    box({ x: marginX, y, w: contentW, h: obsH, title: 'Observações' })
    setText(9, 'normal')
    let yy = y + 12
    for (const l of obsLines) {
      if (yy > y + obsH - 4) break
      doc.text(l, marginX + 3, yy)
      yy += 5
    }

    y += obsH + 8
  }

  // Footer
  const footerY = pageH - 22
  doc.setDrawColor(210)
  doc.setLineWidth(0.3)
  doc.line(marginX, footerY, marginX + contentW, footerY)

  setText(8, 'normal')
  doc.setTextColor(120)
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, marginX, footerY + 6)
  doc.setTextColor(0)

  const filename = `OS-${osNum}.pdf`
  doc.save(filename)

  if (abrirParaImprimir) {
    const url = doc.output('bloburl')
    const w = window.open(url, '_blank')
    if (w) {
      w.addEventListener('load', () => {
        try { w.focus(); w.print() } catch { /* noop */ }
      })
    }
  }
}
