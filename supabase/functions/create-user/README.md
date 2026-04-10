# Supabase Edge Function: create-user

Esta função é necessária para sistemas web de Administração porque se você usar a função padrão do banco via client (`supabase.auth.signUp()`), o Supabase Auth sempre fará "login automático" da nova conta criada, deslogando o administrador que estava no sistema.

Essa Edge Function resolve o problema, rodando de modo protegido no Backend e manipulando a Admin API (`auth.admin.createUser`) em total invisibilidade do seu front-end react.

### Como Implantar (Deploy):
1. Abra um terminal na pasta raíz do seu projeto (`mina_os`).
2. Conecte com `npx supabase login` 
3. Execute o comando:
```bash
npx supabase functions deploy create-user --project-ref niexjensniqqfekfhwow
```
Pronto, o seu sistema React na nuvem passará a bater nesta URL em vez de usar as APIs inseguras, permitindo seus admins criarem senhas customizadas.
