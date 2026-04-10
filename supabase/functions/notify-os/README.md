# Como usar a Edge Function de Notificação

Criamos um código Edge Function (`index.ts`) que recebe eventos de novas ordens de serviço e envia a notificação ao cliente.

Para configurar, siga este passo a passo usando a Supabase CLI e o Painel (Dashboard):

> Importante: o app (React) chama esta função via `supabase.functions.invoke('notify-os')` enviando `action: "push_os_opened"`.
> Para esse modo funcionar, você **precisa** configurar as secrets `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no Supabase.

## 1. Fazer o Deploy da Função

Se você não tem o CLI do Supabase instalado, baixe e faça login `npx supabase login`.

No terminal, estando na raiz do seu projeto `mina_os`:
```bash
npx supabase functions deploy notify-os --project-ref niexjensniqqfekfhwow
```

O projeto de referência (`niexjensniqqfekfhwow`) é o identificador único do seu projeto conectado.

## 2. Gerar as chaves VAPID (para Web Push)

No terminal (na raiz do projeto), gere as chaves VAPID:

```bash
npx web-push generate-vapid-keys
```

Isso vai mostrar algo como:

- Public Key: `...`
- Private Key: `...`

Guarde as duas.

## 3. Configurar as secrets da Edge Function

Configure no Supabase (via CLI) as secrets usadas pela função:

```bash
npx supabase secrets set \
   VAPID_PUBLIC_KEY="SUA_PUBLIC_KEY" \
   VAPID_PRIVATE_KEY="SUA_PRIVATE_KEY" \
   VAPID_SUBJECT="mailto:contato@eletroced.local" \
   --project-ref niexjensniqqfekfhwow
```

`VAPID_SUBJECT` pode ser um `mailto:` ou uma URL do seu site.

## 4. Configurar o Frontend (Vite)

No frontend, crie um `.env.local` (ou configure no ambiente de deploy) com:

```bash
VITE_VAPID_PUBLIC_KEY=SUA_PUBLIC_KEY
```

Essa **tem que ser a mesma Public Key** do passo anterior.

## 5. Aplicar a migration da tabela de subscriptions

No Supabase Dashboard (SQL Editor), rode o arquivo `migration_push_subscriptions.sql` para criar a tabela `push_subscriptions`.

## 2. Configurar o Webhook no Painel do Supabase

Com a função no ar, o próximo passo é fazer o banco de dados enviar as informações quando uma OS for criada:

1. Acesse o **Supabase Dashboard**.
2. Vá em **Database** (no menu lateral) > **Webhooks**.
3. Clique em **Create Webhook**.
4. Configure assim:
   - **Name:** `Webhook Notifica Nova OS`
   - **Table:** `ordens_servico`
   - **Events:** Marque apenas `Insert`.
   - **Type:** Escolha `Edge Function` (abaixo de HTTP Request).
   - **Edge Function:** Selecione `notify-os` (a função que você subiu no passo 1).
   - **Method:** `POST`.

Pronto! Salve o Webhook. Agora, toda vez que o sistema salvar uma O.S. nova, ele vai chamar automaticamente a Edge Function com os dados do cliente, sem você precisar mexer no React 👍.

> Observação: o webhook acima chama a função no modo “legado” (payload com `table/type/record`).
> No código atual, esse modo **não envia Push Notification** (apenas faz log e é um ponto para integrar WhatsApp/E-mail).
> Para Push, use o modo do app (`action: "push_os_opened"`).
