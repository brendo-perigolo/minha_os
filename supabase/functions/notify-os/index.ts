import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      // Preflight request
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Garantir que a requisição seja disparada pelo Webhook (POST)
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }

    // O payload pode vir do APP (invoke) ou via Database Webhook
    let payload: any = {}
    try {
      const raw = await req.text()
      payload = raw ? JSON.parse(raw) : {}
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return new Response(JSON.stringify({ error: 'Missing JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Inicializar cliente do Supabase usando chaves de ambiente que já vêm pro Edge Function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ================================
    // MODO APP: Push Notification
    // ================================
    if (payload?.action === 'push_os_opened') {
      const auth = req.headers.get('authorization') || ''
      if (!auth.toLowerCase().startsWith('bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Import dinâmico para reduzir cold start.
      // Usamos uma lib compatível com WebCrypto (Supabase Edge / Deno).
      // A lib `web-push` (Node) falha no Edge com: "Not implemented: crypto.ECDH".
      const { buildPushPayload } = await import('npm:@block65/webcrypto-web-push@1.0.2')

      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@eletroced.local'

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const vapid = {
        subject: vapidSubject,
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      }

      const osId = payload?.osId
      const numero = payload?.numero ? String(payload.numero) : String(osId ?? '').padStart(4, '0')
      const cliente = payload?.cliente ? String(payload.cliente) : '—'
      const endereco = payload?.endereco ? String(payload.endereco) : '—'
      const equipamento = payload?.equipamento ? String(payload.equipamento) : ''
      const defeito = payload?.defeito ? String(payload.defeito) : ''
      const total = payload?.total != null ? Number(payload.total) : null
      const url = payload?.url ? String(payload.url) : `/ordens/${osId}`

      const title = `Nova OS #${numero}`

      const parts: string[] = []
      if (cliente && cliente !== '—') parts.push(`Cliente: ${cliente}`)
      if (equipamento) parts.push(`Equip.: ${equipamento}`)
      if (endereco && endereco !== '—') parts.push(`End.: ${endereco}`)
      if (defeito) {
        const cleaned = defeito.replace(/\s+/g, ' ').trim()
        parts.push(`Defeito: ${cleaned.length > 90 ? cleaned.slice(0, 90) + '…' : cleaned}`)
      }
      if (Number.isFinite(total as number) && (total as number) >= 0) {
        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total as number)
        parts.push(`Total: ${fmt}`)
      }

      const body = parts.length > 0 ? parts.join('\n') : 'Toque para abrir'

      // Assets servidos pelo app (PWA)
      const icon = '/brand/mark.svg'
      // Android: badge deve ser monocromático (evita o "quadrado branco" no topo)
      const badge = '/brand/badge-e.svg'

      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')

      if (subsErr) throw subsErr

      let sent = 0
      let removed = 0
      const errors: Array<{ id: string; statusCode?: number; error: string }> = []

      await Promise.all((subs || []).map(async (s: any) => {
        try {
          const subscription = {
            endpoint: String(s.endpoint),
            expirationTime: null,
            keys: {
              p256dh: String(s.p256dh),
              auth: String(s.auth),
            },
          }

          const message = {
            data: JSON.stringify({
              title,
              body,
              url,
              icon,
              badge,
              tag: `os-${numero}`,
              data: {
                osId,
                numero,
                cliente,
                equipamento: equipamento || null,
                endereco,
              }
            }),
            options: {
              ttl: 60 * 60, // 1h
              urgency: 'high',
              topic: `os-${numero}`,
            },
          }

          const requestInit = await buildPushPayload(message, subscription, vapid)
          const resp = await fetch(subscription.endpoint, requestInit)
          if (resp.ok) {
            sent += 1
            return
          }

          const text = await resp.text().catch(() => '')
          const statusCode = resp.status
          const msg = text || resp.statusText || 'Erro ao enviar'
          errors.push({ id: s.id, statusCode, error: String(msg) })

          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id)
            removed += 1
          }
        } catch (e: any) {
          const statusCode = e?.statusCode
          const msg = e?.message || e?.body || 'Erro ao enviar'
          errors.push({ id: s.id, statusCode, error: String(msg) })

          // Remove subscriptions expiradas
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id)
            removed += 1
          }
        }
      }))

      return new Response(
        JSON.stringify({
          success: true,
          subscriptionCount: (subs || []).length,
          sent,
          removed,
          errorsCount: errors.length,
          errors: errors.slice(0, 5),
          // Debug seguro: não expõe chave privada
          vapidPublicKeyPrefix: vapidPublicKey ? vapidPublicKey.slice(0, 8) : null,
          vapidPublicKeyLength: vapidPublicKey ? vapidPublicKey.length : 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ================================
    // MODO WEBHOOK (legado)
    // ================================
    const { type, record, table } = payload

    if (table !== 'ordens_servico' || type !== 'INSERT' || !record) {
      return new Response(JSON.stringify({ message: "Ignorado (Não é INSERT em ordens_servico)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Buscar as informações do cliente relacionado a esta O.S.
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('nome, telefone, email')
      .eq('id', record.cliente_id)
      .single()

    if (error || !cliente) {
      throw new Error(`Cliente não encontrado para a OS ${record.id}`)
    }

    // ==========================================
    // LÓGICA DE NOTIFICAÇÃO 
    // Aqui você pode integrar uma API externa (WhatsApp / Evolution API / SendGrid / etc)
    // ==========================================
    
    const osNumero = String(record.id).padStart(4, '0')
    const totalFormatado = Number(record.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const statusFormatado = record.status === 'orcamento' ? 'em Orçamento' : record.status

    const mensagemNotificacao = `
Olá, *${cliente.nome}*!

Sua Ordem de Serviço na *ELETROCED* foi aberta com sucesso.
OS Nº: *#${osNumero}*
Status: *${statusFormatado}*
Valor Total Estimado: *${totalFormatado}*

Agradecemos a preferência!
`.trim()

    // Simulando o envio (Imprime no log do Edge Function)
    console.log(`\n========== NOTIFICAÇÃO ==========`)
    console.log(`Para: ${cliente.telefone || cliente.email}`)
    console.log(`Mensagem:\n${mensagemNotificacao}`)
    console.log(`=================================`)

    // Exemplo de integração externa (Descomente e ajuste os dados da sua API e Token):
    /*
    await fetch('https://api.wahtsapp.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer MEU_TOKEN`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telefone: cliente.telefone,
        mensagem: mensagemNotificacao
      })
    })
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação processada',
        cliente: cliente.nome,
        os: record.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error('Erro ao processar Edge Function:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
