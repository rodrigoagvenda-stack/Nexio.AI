# 🚀 Deploy no Easypanel - Guia Completo

## 📋 Pré-requisitos

- Easypanel instalado na VPS
- Conta no GitHub conectada ao Easypanel
- Banco PostgreSQL (Supabase)

## 🔧 1. Criar Novo Serviço

1. Acesse o Easypanel: `https://seu-dominio.com:3000`
2. Clique em **"+ New Service"**
3. Selecione **"GitHub"**
4. Escolha o repositório: `rodrigoagvenda-stack/IPVB_sistema`
5. Selecione a branch: `claude/church-management-system-AQZ8r`

## ⚙️ 2. Configurar Build

### Build Settings
```yaml
Build Command: npm run build
Port: 3000
Dockerfile: ./Dockerfile
```

### Build Arguments (opcional)
```bash
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

## 🔐 3. Variáveis de Ambiente

Adicione estas variáveis no painel do Easypanel:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:senha@host:5432/igreja_db
NEXT_PUBLIC_SUPABASE_URL=https://seu-supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui

# n8n Webhooks
N8N_WEBHOOK_URL_BASE=https://n8n.seudominio.com
N8N_ESCALA_CONFIRMACAO_WEBHOOK=/webhook/escala-confirmacao
N8N_ENVIAR_PDF_WEBHOOK=/webhook/enviar-pdf
N8N_NOTIFICACOES_WEBHOOK=/webhook/notificacoes
N8N_WEBHOOK_SECRET=sua_string_aleatoria_super_secreta

# WhatsApp API
WHATSAPP_API_URL=https://api.uazapi.com
WHATSAPP_API_TOKEN=seu_token_whatsapp

# App
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NODE_ENV=production
STORAGE_BUCKET=igreja-arquivos
```

## 🌐 4. Configurar Domínio

### No Easypanel:
1. Vá em **"Domains"**
2. Adicione seu domínio: `igreja.seudominio.com`
3. Ative **SSL automático**

### No seu DNS:
Adicione um registro A ou CNAME apontando para o IP da VPS.

## 🗄️ 5. Criar Banco de Dados (se não tiver Supabase)

### Opção 1: Usar Supabase Cloud
1. Acesse https://supabase.com
2. Crie novo projeto
3. Copie as credenciais
4. Execute as migrations:
   - `00_initial_schema.sql`
   - `01_rls_policies.sql`
   - `02_functions.sql`

### Opção 2: PostgreSQL no Easypanel
1. Adicione serviço PostgreSQL
2. Nome: `igreja-db`
3. Versão: 15
4. Porta: 5432

#### Executar Migrations:
```bash
# Conectar ao container
docker exec -it postgres-container psql -U postgres

# Criar database
CREATE DATABASE igreja_db;

# Sair e executar migrations
psql -U postgres -d igreja_db -f supabase/migrations/00_initial_schema.sql
psql -U postgres -d igreja_db -f supabase/migrations/01_rls_policies.sql
psql -U postgres -d igreja_db -f supabase/migrations/02_functions.sql
```

## 🚀 6. Deploy

1. Clique em **"Deploy"**
2. Aguarde o build (3-5 minutos)
3. Acesse `https://seu-dominio.com`

## 📊 7. Verificar Deploy

Checklist pós-deploy:

- [ ] Site carrega em `https://seu-dominio.com`
- [ ] SSL funcionando (cadeado verde)
- [ ] Consegue fazer login
- [ ] Dashboard carrega com estatísticas
- [ ] API endpoints respondem
- [ ] Conexão com banco OK
- [ ] Logs sem erros

### Ver Logs:
```bash
# No Easypanel
Clique no serviço → "Logs" → Ver em tempo real

# Ou via terminal
docker logs -f <container-name>
```

## 🔄 8. Atualizar Aplicação

### Auto-Deploy:
Configure webhook no GitHub para deploy automático a cada push.

### Manual:
1. Push código para o GitHub
2. No Easypanel, clique em **"Redeploy"**

## 🐛 9. Troubleshooting

### Erro: "Build failed"
- Verifique se todas as variáveis de ambiente estão configuradas
- Veja os logs de build no Easypanel
- Confirme que o branch está correto

### Erro: "Can't connect to database"
- Verifique `DATABASE_URL`
- Teste conexão manual com psql
- Confirme que o banco está rodando

### Erro: "Module not found"
- Limpe cache do Docker
- Force rebuild: `docker system prune -a`
- Redeploy no Easypanel

### Página em branco
- Veja logs do container
- Verifique variáveis `NEXT_PUBLIC_*`
- Confirme que migrations foram executadas

## 📈 10. Monitoramento

### No Easypanel:
- **CPU/RAM**: Monitoramento em tempo real
- **Logs**: Acesso direto aos logs
- **Restart**: Reiniciar container se necessário

### Alertas:
Configure alertas para:
- CPU > 80%
- RAM > 90%
- Container stopped
- Falhas de deploy

## 🔐 11. Segurança

### Firewall:
```bash
# Permitir apenas portas necessárias
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

### Backup Automático:
Configure backup diário do banco:
```bash
# Cron job
0 2 * * * pg_dump -U postgres igreja_db > /backups/igreja_$(date +\%Y\%m\%d).sql
```

### SSL:
Easypanel gerencia SSL automaticamente via Let's Encrypt.

## 📞 12. Suporte

**Problemas com:**
- Easypanel: https://easypanel.io/docs
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs

**Logs importantes:**
```bash
# Ver logs do app
docker logs -f <container-name>

# Ver logs do PostgreSQL
docker logs -f postgres-container

# Ver logs do Nginx (se usar)
docker logs -f nginx-container
```

## ✅ Deploy Completo!

Seu sistema está rodando em produção! 🎉

**URLs:**
- App: `https://seu-dominio.com`
- Easypanel: `https://easypanel.seudominio.com:3000`
- Logs: No painel do Easypanel

**Próximos Passos:**
1. Configurar webhooks n8n
2. Testar todas as funcionalidades
3. Criar primeiro usuário admin
4. Cadastrar primeira igreja
5. Importar membros (se tiver)

---

**Feito com ❤️ para Igreja Pentecostal Vale da Bênção** 🔥
