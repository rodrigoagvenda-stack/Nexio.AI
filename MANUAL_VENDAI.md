# 📘 MANUAL COMPLETO DO VENDA.AI
## Guia de Funcionalidades e Uso

---

## 📑 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Dashboard](#dashboard)
3. [CRM - Gestão de Leads](#crm)
4. [prospect.AI - Captação de Leads](#prospectai)
5. [Atendimento WhatsApp](#atendimento)
6. [Membros da Equipe](#membros)
7. [Configurações](#configurações)
8. [Painel Administrativo](#admin)

---

## 1. VISÃO GERAL

O **Venda.AI** é um CRM completo com inteligência artificial para automatização de vendas e gestão de leads. O sistema é **multi-tenant** (cada empresa tem seus dados isolados) e integra:

- ✅ Extração automática de leads do Google Maps
- ✅ CRM com funil visual (Kanban)
- ✅ Atendimento WhatsApp integrado
- ✅ Dashboard com métricas em tempo real
- ✅ Gestão de equipe e permissões

---

## 2. DASHBOARD

**Localização:** Menu lateral → "Overview"

### O que é:
Painel principal com visão geral do seu pipeline de vendas.

### Funcionalidades:

#### 2.1 **Filtros de Período**
- **Hoje**: Métricas das últimas 24 horas
- **Semana**: Últimos 7 dias
- **Mês**: Mês atual
- **Ano**: Ano atual
- **Personalizado**: Escolha datas específicas

#### 2.2 **Cards de Métricas**
Exibe 4 indicadores principais:

| Métrica | O que mostra |
|---------|--------------|
| **Novos Leads** | Leads com status "Lead novo" no período |
| **Em Atendimento** | Leads com status "Em contato" |
| **Taxa de Conversão** | % de leads que fecharam negócio |
| **Faturamento** | Soma dos valores de projetos fechados |

#### 2.3 **Gráfico de Performance**
Mostra evolução de leads e fechamentos ao longo do tempo:
- **Hoje**: Por hora (0h-23h)
- **Semana**: Por dia (7 dias)
- **Mês**: Por semana (4-5 semanas)
- **Ano**: Por mês (12 meses)

#### 2.4 **Gráfico de Conversão (Donut)**
Visualização circular mostrando:
- Leads fechados vs Leads em andamento

#### 2.5 **Funil de Vendas**
Visualização em funil dos estágios:
1. Lead novo
2. Em contato
3. Interessado
4. Proposta enviada
5. Fechado

**Como usar:**
1. Acesse o Dashboard
2. Selecione o período desejado nos botões de filtro
3. Veja as métricas atualizarem automaticamente
4. Use o filtro "Personalizado" para períodos específicos

---

## 3. CRM - GESTÃO DE LEADS

**Localização:** Menu lateral → "CRM"

### O que é:
Sistema completo para gerenciar seus leads com duas visualizações: **Kanban** (quadro visual) e **Tabela** (planilha).

### 3.1 **Visualizações**

#### **Modo Kanban** (Quadro Visual)
- 6 colunas representando os estágios do funil
- **Drag & Drop**: Arraste leads entre colunas para mudar o status
- Desktop: 6 colunas lado a lado
- Mobile: Lista vertical com seletor de status

**Colunas do Kanban:**
1. **Lead novo** (Azul)
2. **Em contato** (Rosa)
3. **Interessado** (Roxo)
4. **Proposta enviada** (Ciano)
5. **Fechado** (Verde escuro)
6. **Perdido** (Vermelho)

#### **Modo Tabela** (Planilha)
Visualização em tabela com colunas:
- Nome da empresa
- Segmento
- Status
- Website/Instagram
- Telefone
- Prioridade
- Fonte de importação
- Observações
- Ações (Editar/Deletar)

### 3.2 **Filtros e Busca**

**Barra de Busca:**
- Busca por nome da empresa, contato ou email

**Filtros Disponíveis:**
- **Status**: Filtra por estágio no funil
- **Prioridade**: Alta, Média ou Baixa

**Botão "Limpar":** Remove todos os filtros aplicados

### 3.3 **Adicionar Lead Manual**

**Como adicionar:**
1. Clique em "**Adicionar Lead**" (botão laranja no topo)
2. Preencha o formulário em 3 abas:

**Aba 1: Informações Básicas**
- Nome da Empresa * (obrigatório)
- Segmento *
- Site/Instagram

**Aba 2: Contato**
- Nome do Contato
- WhatsApp
- E-mail

**Aba 3: Detalhes**
- Prioridade (Alta/Média/Baixa)
- Fonte de Importação (Manual, Google Maps, PEG, Indicação)
- Valor do Projeto (R$)
- Observações (campo de texto livre)

3. Clique em "**Adicionar**"

### 3.4 **Editar Lead**

**Como editar:**
1. Na visualização Kanban ou Tabela, clique no ícone de **lápis** (✏️)
2. Modifique os campos desejados
3. Clique em "**Atualizar**"

### 3.5 **Deletar Lead**

**Como deletar:**
1. Clique no ícone de **lixeira** (🗑️)
2. Confirme a exclusão no modal
3. **Atenção:** Esta ação não pode ser desfeita!

### 3.6 **Mover Lead no Funil (Kanban)**

**Desktop:**
- Clique e arraste o card do lead para outra coluna
- Solte para atualizar o status
- O sistema salva automaticamente

**Mobile:**
- Abra o card do lead
- Use o seletor de **Status** para mudar o estágio

### 3.7 **Paginação**

Quando há muitos leads:
- **10 leads por página** na visualização Tabela
- Use os botões "< Anterior" e "Próxima >" para navegar
- Contador mostra: "Mostrando 1-10 de 45"

### 3.8 **Informações do Card (Kanban)**

Cada card exibe:
- **Nome da empresa** (título em negrito)
- **Nome do contato** (👤 ícone)
- **WhatsApp** (📞 ícone)
- **Valor do projeto** (💵 R$)
- **Badge de Prioridade** (Alta/Média/Baixa com cores)
- **Nível de Interesse** (Quente 🔥 / Morno / Frio)
- **Segmento** (🏢 ícone)

---

## 4. PROSPECT.AI - CAPTAÇÃO DE LEADS

**Localização:** Menu lateral → "Captação"

### O que é:
Ferramenta de **extração automática de leads do Google Maps** usando IA. Você busca "restaurantes em São Paulo" no Google Maps e o sistema extrai contatos automaticamente.

### 4.1 **Como Usar**

**Passo a Passo:**

1. **Faça uma busca no Google Maps**
   - Exemplo: "academias em Campinas"
   - Exemplo: "clínicas odontológicas em São Paulo"

2. **Copie a URL completa da página de resultados**
   - URL deve começar com `https://www.google.com/maps/search/...`

3. **Cole a URL no campo "URL do Google Maps"**

4. **Escolha a quantidade de leads**
   - Opções: 50, 100, 150, 200, 250 ou 300 leads

5. **Clique em "Extrair Leads"**

6. **Aguarde a extração** (30-60 segundos)
   - Modal mostra progresso em tempo real
   - Contador animado mostra quantos leads foram extraídos

7. **Conclusão**
   - Botão "Abrir CRM" aparece quando concluído
   - Leads já estão salvos no CRM automaticamente!

### 4.2 **Dados Extraídos**

O sistema extrai automaticamente:
- ✅ Nome da empresa
- ✅ Telefone/WhatsApp
- ✅ Site
- ✅ Endereço
- ✅ Segmento (categoria do Google Maps)
- ✅ Avaliação (rating)

**Fonte de Importação:** Automaticamente marcado como "Google Maps"

**Status Inicial:** Todos os leads começam como "Lead novo"

---

## 5. ATENDIMENTO WHATSAPP

**Localização:** Menu lateral → "Atendimento"

### O que é:
Sistema de **atendimento integrado com WhatsApp** em tempo real. Conversas espelhadas do WhatsApp da sua empresa para dentro do Venda.AI.

### 5.1 **Tela Principal**

A tela é dividida em **2 colunas**:

**Coluna Esquerda: Lista de Conversas**
- Todas as conversas ativas
- Foto de perfil (iniciais do contato)
- Nome do contato
- Última mensagem
- Horário da última mensagem
- Badge de mensagens não lidas (número)
- Badge de status (Ativa/Arquivada)

**Coluna Direita: Chat**
- Mensagens da conversa selecionada
- Campo para digitar nova mensagem
- Botões de ação (anexo, áudio, enviar)

### 5.2 **Buscar Conversas**

**Barra de busca no topo:**
- Digite nome do contato, número ou palavra-chave
- Busca em tempo real (conforme você digita)

### 5.3 **Visualizar Conversa**

**Informações exibidas:**
- **Nome do contato** (título)
- **Número de telefone** (📞)
- **Email** (se cadastrado) (✉️)
- **Empresa/Lead vinculado** (🏢)
- **Tags/Etiquetas** (🏷️)

**Mensagens:**
- **Mensagens recebidas**: Alinhadas à esquerda (fundo cinza)
- **Mensagens enviadas**: Alinhadas à direita (fundo azul)
- **Timestamp**: Data e hora de cada mensagem
- **Status**: Enviada/Entregue/Lida
- **Tipo de mensagem**: Texto, Imagem, Áudio, Documento

### 5.4 **Enviar Mensagem**

**Mensagem de Texto:**
1. Digite no campo de mensagem
2. Pressione Enter ou clique em "Enviar" (✉️)

**Gravar Áudio:**
1. Clique no ícone de **microfone** (🎤)
2. Grave o áudio
3. **Preview**: Ouça antes de enviar (▶️ Play / ⏸️ Pause)
4. Clique em "Enviar"
5. Ou clique em "❌" para cancelar

**Enviar Arquivo/Imagem:**
1. Clique no ícone de **anexo** (📎)
2. Selecione arquivo do computador
3. Aguarde upload
4. Mensagem enviada automaticamente

### 5.5 **Identificação do Remetente**

Cada mensagem mostra:
- **👤 Humano**: Atendente da equipe (mostra nome do usuário)
- **🤖 IA**: Resposta automática da IA
- **Você**: Suas próprias mensagens

### 5.6 **Atualização em Tempo Real**

- ✅ Novas mensagens aparecem automaticamente
- ✅ Status de leitura atualiza em tempo real
- ✅ Notificação de "digitando..." quando contato está escrevendo
- ✅ Sincronização automática com WhatsApp

### 5.7 **Vincular Lead**

Se a conversa estiver vinculada a um lead:
- Badge mostra "Lead: Nome da Empresa"
- Clique para abrir detalhes do lead no CRM

---

## 6. MEMBROS DA EQUIPE

**Localização:** Menu lateral → "Membros"

### O que é:
Gestão de usuários da sua empresa. Adicione atendentes, vendedores e gestores.

### 6.1 **Listar Membros**

**Informações exibidas:**
- Nome completo
- Email
- Cargo/Função
- Data de criação
- Status (Ativo/Inativo)
- Ações (Editar/Remover)

### 6.2 **Adicionar Membro**

**Como adicionar:**
1. Clique em "**Adicionar Membro**"
2. Preencha:
   - Nome completo
   - Email
   - Cargo
   - Permissões (Admin/Usuário)
3. Clique em "Salvar"
4. **Convite enviado por email** para o novo membro

### 6.3 **Editar Membro**

**Como editar:**
1. Clique no ícone de **lápis** (✏️)
2. Modifique cargo ou permissões
3. Clique em "Atualizar"

### 6.4 **Remover Membro**

**Como remover:**
1. Clique no ícone de **lixeira** (🗑️)
2. Confirme a remoção
3. Membro perde acesso imediatamente

---

## 7. CONFIGURAÇÕES

**Localização:** Menu lateral → "Configurações"

### 7.1 **Perfil da Empresa**

**Informações que você pode editar:**
- **Logo da empresa** (upload de imagem)
- **Nome da empresa**
- **Segmento/Ramo de atividade**
- **Site**
- **Telefone**
- **Email de contato**

**Como editar:**
1. Modifique os campos desejados
2. Clique em "Salvar Alterações"

### 7.2 **Integração WhatsApp**

**Configurar UAZapi:**
- **URL da Instância**: URL base do UAZapi
- **Token**: Token de autenticação

**Como configurar:**
1. Cole a URL da instância UAZapi
2. Cole o token de autenticação
3. Clique em "Testar Conexão"
4. Se OK, clique em "Salvar"

### 7.3 **Perfil do Usuário**

**Informações pessoais:**
- **Foto de perfil** (upload)
- **Nome completo**
- **Email**
- **Cargo**

**Como editar:**
1. Clique em "Editar Perfil"
2. Modifique os campos
3. Clique em "Salvar"

### 7.4 **Notificações**

**Preferências de notificação:**
- ✅ Novas mensagens WhatsApp
- ✅ Novos leads
- ✅ Mudanças de status
- ✅ Atividades da equipe

**Como configurar:**
1. Marque/desmarque as opções
2. Clique em "Salvar Preferências"

---

## 8. PAINEL ADMINISTRATIVO

**Localização:** Menu lateral → "Admin" (apenas para Super Admin)

### 8.1 **Gerenciar Empresas**

**Listar todas as empresas:**
- Nome
- Plano contratado
- Data de criação
- Status (Ativa/Suspensa)
- Número de usuários
- Ações

**Adicionar Nova Empresa:**
1. Clique em "Nova Empresa"
2. Preencha dados da empresa
3. Defina plano
4. Crie usuário admin da empresa
5. Clique em "Criar"

**Editar Empresa:**
- Mudar plano
- Ativar/Desativar
- Ver logs de atividade

### 8.2 **Gerenciar Usuários**

**Listar todos os usuários (todas as empresas):**
- Nome
- Email
- Empresa
- Cargo
- Último acesso
- Ações

**Ações disponíveis:**
- Editar permissões
- Resetar senha
- Desativar conta
- Ver histórico de atividades

### 8.3 **Logs do Sistema**

**Visualizar logs:**
- Tipo de ação (login, criação de lead, etc.)
- Usuário que executou
- Data e hora
- Detalhes da ação
- IP de origem

**Filtros:**
- Por usuário
- Por empresa
- Por tipo de ação
- Por data

### 8.4 **Configuração n8n**

**Configurar webhooks:**
- URL do webhook n8n para WhatsApp
- URL do webhook para automações
- Segredo do webhook (autenticação)

**Testar integração:**
- Botão "Testar n8n" envia requisição de teste

---

## 9. ATALHOS E DICAS

### Atalhos de Teclado:
- `Enter` no chat: Envia mensagem
- `Esc`: Fecha modais
- `Ctrl + K`: Busca global

### Dicas de Uso:

**CRM:**
- Use **tags/etiquetas** para organizar leads
- Arraste leads no Kanban para atualizar status rapidamente
- Use filtros para focar em leads prioritários

**Atendimento:**
- Vincule conversas a leads para histórico completo
- Use respostas rápidas (canned responses) para agilizar
- Grave áudios para explicações complexas

**Dashboard:**
- Use filtro personalizado para apresentações
- Compare semanas/meses para ver evolução
- Exporte relatórios (em breve)

---

## 10. SUPORTE

**Problemas comuns e soluções:**

**1. "Não consigo ver minhas conversas do WhatsApp"**
- Verifique se a integração UAZapi está configurada
- Vá em Configurações → Integração WhatsApp
- Teste a conexão

**2. "Leads do Google Maps não aparecem"**
- Verifique se a URL é válida
- URL deve ser de uma busca do Google Maps
- Aguarde até 60 segundos para extração

**3. "Não consigo enviar mensagens"**
- Verifique conexão com internet
- Verifique se o token UAZapi está válido
- Teste a integração nas Configurações

**4. "Dashboard não atualiza"**
- Atualize a página (F5)
- Limpe cache do navegador
- Verifique se há filtros aplicados

---

## 11. GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **Lead** | Potencial cliente/oportunidade de venda |
| **CRM** | Customer Relationship Management (gestão de relacionamento) |
| **Kanban** | Quadro visual com colunas para organizar tarefas/leads |
| **Funil** | Etapas do processo de vendas |
| **UAZapi** | Serviço de API para WhatsApp |
| **n8n** | Plataforma de automação de workflows |
| **Webhook** | URL que recebe notificações automáticas |
| **Multi-tenant** | Sistema que atende várias empresas isoladamente |

---

**🎉 Fim do Manual!**

**Versão:** 1.0
**Data:** 30/12/2025
**Criado por:** Venda.AI Team

Se precisar de ajuda adicional, acesse a página "Ajuda" no menu lateral ou entre em contato com o suporte.
