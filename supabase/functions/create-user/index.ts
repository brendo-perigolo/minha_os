import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com CORS no preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, nome, is_licenca, is_administrador, is_caixa, is_vendedor } = await req.json()

    // Validação básica
    if (!email || !password || !nome) {
      return new Response(JSON.stringify({ error: "E-mail, senha e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Inicializa o cliente do Supabase usando a SERVICE_ROLE_KEY! 
    // É obrigatório usar a SERVICE_ROLE aqui nesta Edge Function para conseguir criar usuários
    // pelo backend da conta, sem "deslogar" a sessão do frontend.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Cria o usuário com e-mail e senha no serviço Auth do Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Já confirma o email automaticamente para permitir login imediato
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = authData.user.id

    // 2. Insere os dados customizados e as permissões (roles) na tabela auxiliar "usuarios"
    const { error: dbError } = await supabase.from('usuarios').insert({
      id: userId,
      email,
      nome,
      is_licenca: is_licenca ?? true,
      is_administrador: is_administrador ?? false,
      is_caixa: is_caixa ?? false,
      is_vendedor: is_vendedor ?? false,
    })

    if (dbError) {
      // Falhou em criar na tabela, podemos apagar o usuário para não deixar sujeira
      await supabase.auth.admin.deleteUser(userId)
      throw new Error(`Criou o Auth mas falhou dados: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({ message: 'Usuário cadastrado com sucesso!', user: authData.user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
