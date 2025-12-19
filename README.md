# vend.AI - CRM Inteligente com IA

Quem já queimou os barcos, entra por aqui. 🚀

## 📋 Sobre

vend.AI é um CRM inteligente que transforma leads em vendas através de automação com IA, WhatsApp em tempo real, extração de leads do Google Maps e sistema de qualificação ICP (Ideal Customer Profile).

## 🚀 Tecnologias

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS + shadcn/ui
- **Banco de Dados:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth
- **Automação:** N8N Webhooks
- **Deploy:** VPS (Hostinger) + PM2 + Nginx

## 📦 Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta Supabase
- Servidor VPS (opcional para produção)

### Desenvolvimento Local

1. Clone o repositório:
```bash
git clone <repo-url>
cd Venda.AI
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
N8N_WEBHOOK_BASE_URL=https://seu-n8n.com
N8N_WEBHOOK_SECRET=seu-webhook-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
NODE_ENV=development
```

4. Execute as migrations do banco:
```bash
# Acesse o Supabase SQL Editor e execute:
# database/briefing-tables.sql
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

Acesse:
- App Cliente: http://localhost:3000
- Formulário Briefing: http://localhost:3000/brief

## 🏗️ Estrutura do Projeto

```
/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Páginas de autenticação
│   ├── (dashboard)/         # Páginas do cliente
│   ├── admin/               # Páginas admin
│   ├── brief/               # Formulário público
│   └── api/                 # API Routes
├── components/
│   ├── ui/                  # Componentes shadcn/ui
│   ├── layout/              # Layout components
│   ├── dashboard/           # Dashboard components
│   └── admin/               # Admin components
├── lib/
│   ├── supabase/            # Supabase clients
│   ├── n8n/                 # N8N integrations
│   ├── utils/               # Utilities
│   └── hooks/               # Custom hooks
├── types/                   # TypeScript types
├── database/                # SQL migrations
└── public/                  # Static assets
```

## 📝 Features Implementadas

### Cliente (app.vendai.com.br)

✅ **Autenticação**
- Login com Supabase Auth
- Middleware de proteção de rotas

✅ **Dashboard**
- Métricas de leads (novos, em atendimento, conversão, faturamento)
- Funil de vendas visual

✅ **CRM**
- Visualização Kanban e Tabela
- 6 status de leads (Lead novo → Fechado/Perdido)
- Filtros e busca

✅ **Captação (prospect.AI)**
- Extração de leads do Google Maps
- Integração com N8N
- Modal de progresso animado

✅ **Configurações**
- Edição de perfil do usuário
- Alteração de senha (em breve)

### Admin (admin.vendai.com.br)

✅ **Briefing Form**
- Formulário público em /brief (12 perguntas progressivas)
- Lista de respostas com busca
- Visualização detalhada de cada resposta
- Configuração de webhook para integração
- Teste de webhook

### API Routes

✅ `/api/auth/callback` - Callback Supabase Auth
✅ `/api/extraction/maps` - Extração Google Maps
✅ `/api/briefing/submit` - Submeter briefing
✅ `/api/briefing/responses` - Listar respostas (admin)
✅ `/api/briefing/responses/[id]` - Detalhes resposta (admin)
✅ `/api/briefing/config` - Configuração webhook (admin)
✅ `/api/briefing/config/test` - Testar webhook (admin)

## 🔐 Segurança

- Row Level Security (RLS) configurado no Supabase
- Webhooks protegidos com secrets
- Autenticação obrigatória para áreas privadas
- Validação de admin para áreas administrativas

## 🌐 Deploy

### Configuração do VPS (Hostinger)

1. Instale as dependências no servidor:
```bash
# Node.js, npm, PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. Clone o projeto:
```bash
cd /home/u920217121/domains/vendai.com.br/public_html
git clone <repo-url> Appvendai
cd Appvendai
```

3. Configure variáveis de ambiente:
```bash
nano .env.local
# Cole as variáveis de produção
```

4. Dê permissão ao script de deploy:
```bash
chmod +x deploy.sh
```

5. Execute o deploy:
```bash
./deploy.sh
```

6. Configure PM2 para iniciar com o sistema:
```bash
pm2 startup systemd
pm2 save
```

### Configuração Nginx

```nginx
# /etc/nginx/sites-available/vendai

server {
    listen 80;
    server_name app.vendai.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin.vendai.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site:
```bash
sudo ln -s /etc/nginx/sites-available/vendai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL com Certbot

```bash
sudo certbot --nginx -d app.vendai.com.br -d admin.vendai.com.br
```

## 📊 Banco de Dados

O projeto usa Supabase (PostgreSQL). Execute o SQL em `database/briefing-tables.sql` no Supabase SQL Editor.

Principais tabelas:
- `briefing_config` - Configuração do webhook
- `briefing_responses` - Respostas do formulário
- `leads` - Leads do CRM
- `users` - Usuários do sistema
- `companies` - Empresas cadastradas
- `admin_users` - Usuários admin

## 🔗 Links Úteis

- **N8N Webhook Secret:** `874b3d43f82c9fc7ae0577ee36318a005413c29a1c329d81581504a916625143`
- **Supabase URL:** `https://dkvznmmiiiljyrkopiqx.supabase.co`
- **App Cliente:** https://app.vendai.com.br
- **Admin:** https://admin.vendai.com.br
- **Formulário Briefing:** https://app.vendai.com.br/brief

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção local
npm run start

# Deploy
./deploy.sh

# PM2
pm2 status
pm2 logs vendai-app
pm2 restart all
pm2 stop all
```

## 📝 TODO (Próximas Features)

- [ ] WhatsApp em tempo real (Atendimento)
- [ ] Lead PRO - VendAgro (ICP)
- [ ] Gestão de Membros/Equipes
- [ ] Dashboard Admin completo
- [ ] Gestão de Empresas (CRUD)
- [ ] Sistema de Logs
- [ ] PDF Generator para Briefing
- [ ] Financeiro e Assinaturas

## 📄 Licença

Propriedade de vend.AI - Todos os direitos reservados.

---

**Quem já queimou os barcos, entra por aqui. 🚀**
