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

      // Import dinâmico para não travar o preflight (OPTIONS) em cold start.
      // Em alguns ambientes, imports npm no topo podem demorar e causar 504.
      const webpushModule: any = await import('https://esm.sh/web-push@3.6.7?target=deno')
      const wp: any = webpushModule?.default ?? webpushModule

      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@eletroced.local'

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      wp.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

      const osId = payload?.osId
      const numero = payload?.numero ? String(payload.numero) : String(osId ?? '').padStart(4, '0')
      const cliente = payload?.cliente ? String(payload.cliente) : '—'
      const endereco = payload?.endereco ? String(payload.endereco) : '—'
      const url = payload?.url ? String(payload.url) : `/ordens/${osId}`

      const title = `Nova OS #${numero}`
      const body = `Cliente: ${cliente} | Endereço: ${endereco}`

      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')

      if (subsErr) throw subsErr

      let sent = 0
      let removed = 0
      const errors: Array<{ id: string; statusCode?: number; error: string }> = []

      await Promise.all((subs || []).map(async (s: any) => {
        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        }
        try {
          await wp.sendNotification(subscription, JSON.stringify({
            title,
            body,
            url,
            tag: `os-${numero}`,
          }))
          sent += 1
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
