# Configuração de Conta Admin

## Como criar sua conta de administrador

### Opção 1: Criar novo usuário admin (Recomendado)

1. Acesse o **Supabase Dashboard** do seu projeto
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo do arquivo `create-admin.sql`
4. Aguarde a mensagem de sucesso

**Credenciais:**
- Email: `admin@vendai.com.br`
- Senha: `Admin123!`

### Opção 2: Tornar um usuário existente em admin

1. Abra o arquivo `link-existing-user-to-admin.sql`
2. Substitua `'SEU_EMAIL@AQUI.COM'` pelo email do usuário desejado
3. Execute no **SQL Editor** do Supabase
4. Pronto! O usuário agora é admin

## Testar o login

1. Acesse a página de login: `/login`
2. Clique no botão **Admin** (com ícone de escudo 🛡️)
3. Faça login com as credenciais do admin
4. Você será redirecionado para `/admin`

## Níveis de Admin

O sistema suporta 3 níveis:
- `super_admin` - Acesso total
- `admin` - Administrador padrão
- `support` - Suporte

Para alterar o nível, edite a coluna `role` na tabela `admin_users`.
