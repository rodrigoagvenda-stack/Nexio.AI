# Sistema de Gestão para Igrejas

Sistema completo de gestão para igrejas que permite controlar membros, finanças, escalas de cultos automatizadas, frequência e comunicação via WhatsApp.

## 🚀 Tecnologias

- **Frontend:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Automação:** n8n
- **WhatsApp:** UAZapi / Evolution API

## 📋 Funcionalidades

### 👥 Gestão de Membros
- Cadastro completo de membros
- Controle de ministérios
- Histórico de frequência
- Controle de dízimos

### 📅 Escalas Automatizadas
- Geração automática de escalas
- Confirmação via WhatsApp
- Notificações automáticas
- Export para PDF

### 💰 Controle Financeiro
- Lançamentos de entrada/saída
- Controle de dízimos
- Contas a pagar/receber
- Relatórios financeiros (DRE, Balancete)
- Fluxo de caixa
- Conciliação bancária
- Orçamento anual

### 📊 Frequência
- Controle de presença em cultos
- Relatórios de frequência
- Estatísticas por período

### 🎉 Eventos
- Gestão de eventos
- Controle de inscrições
- Pagamentos

### 💬 Comunicação
- Mensagens em massa via WhatsApp
- Segmentação de público
- Histórico de mensagens

## 🛠️ Instalação

```bash
# Clone o repositório
git clone <repo-url>

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local

# Execute o projeto
npm run dev
```

## 📦 Variáveis de Ambiente

Veja `.env.example` para todas as variáveis necessárias.

## 🐳 Deploy

Instruções de deploy para VPS com Docker disponíveis em `/docs/deploy.md`

## 📄 Licença

Privado - Todos os direitos reservados
