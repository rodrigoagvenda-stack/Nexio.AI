'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ProductDemo } from '@/components/demo/ProductDemo';
import { AtendimentoDemo } from '@/components/demo/AtendimentoDemo';
import { FollowUpDemo } from '@/components/demo/FollowUpDemo';
import { CanvasDemo } from '@/components/demo/CanvasDemo';
import { KanbanDemo } from '@/components/demo/KanbanDemo';
import { TrialSaasDemo } from '@/components/demo/TrialSaasDemo';
import { SDRWizardDemo } from '@/components/demo/SDRWizardDemo';
import { SimuladorDemo } from '@/components/demo/SimuladorDemo';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Users, MessageSquare, UserPlus,
  ChevronLeft, ChevronRight, BookOpen, HelpCircle,
  Bot, Send, X, Sparkles, Search,
  Clock, BarChart2, Home, CreditCard, ArrowRight,
  Lightbulb, AlertTriangle, Info, ShieldCheck, Ticket,
  Volume2, VolumeX, PhoneOff, RotateCcw, Copy, Check,
  type LucideIcon,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HelpItem { question: string; answer: string; demo?: React.ReactNode }
interface HelpSection { id: string; title: string; icon: LucideIcon; description: string; items: HelpItem[] }
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  buttons?: string[];
  askFeedback?: boolean;
  timestamp: number;
  isError?: boolean;
}

// ── Content ───────────────────────────────────────────────────────────────────

const sections: HelpSection[] = [
  {
    id: 'visao-geral',
    title: 'Visão Geral',
    icon: Home,
    description: 'Introdução à plataforma e primeiros passos',
    items: [
      {
        question: 'O que é o Zaapply?',
        answer:
`O Zaapply é uma plataforma de CRM e automação de vendas com IA nativa integrada ao WhatsApp. Todo o fluxo — desde captar o lead até fechar a venda — acontece em um único ambiente.

## Módulos principais
• **Dashboard** — KPIs em tempo real com comparativos vs período anterior
• **CRM** — Funil de vendas com Kanban drag & drop e visualização em planilha
• **Atendimento** — Chat WhatsApp com Agente IA e inbox multi-atendente
• **Agente SDR** — Configuração de persona, base de conhecimento e objeções
• **Follow-up** — Sequências automáticas de mensagens com gatilhos por estágio
• **Trial SaaS** — Gestão do ciclo de vida de trials com automações
• **Métricas** — Analytics completo de follow-up, trial e remarketing
• **Membros** — Gestão de equipe com permissões por função
• **Briefing** — Formulário público personalizado com sua marca
[INFO]
Todas as funcionalidades funcionam dentro da mesma plataforma. Não são necessárias integrações externas complexas além do WhatsApp e, opcionalmente, o Google Calendar.
[/INFO]`,
      },
      {
        question: 'Guia de primeiros passos',
        answer:
`Configure o Zaapply em 5 etapas para começar a operar com IA:

1. **Conecte o WhatsApp** — Acesse Atendimento e escaneie o QR Code com o celular
2. **Configure o Agente SDR** — Defina persona, base de conhecimento e modo de atendimento em Automações → Agente SDR
3. **Adicione seus leads** — Importe ou cadastre leads no CRM
4. **Ative o Agente IA** — Use o toggle global na lista de conversas em Atendimento
5. **Monitore pelo Dashboard** — Acompanhe conversões, funil e faturamento em tempo real
[TIP]
Configure a base de conhecimento com produtos, preços e principais objeções antes de ativar o agente. Quanto mais contexto, melhor a qualidade das respostas geradas.
[/TIP]`,
      },
      {
        question: 'Automações disponíveis',
        answer:
`O Zaapply oferece três tipos de automação de mensagens via WhatsApp:

## Follow-up
Sequências de mensagens enviadas automaticamente em intervalos programados. Ideal para nurturing, recuperação de leads inativos, anti-noshow e pós-venda.

## Trial SaaS
Automação dedicada para modelos com período de avaliação. Acompanha cada lead pelo ciclo completo: início do trial → engajamento → conversão ou expiração.

## Remarketing
Re-engajamento de leads inativos com mensagens personalizadas. Configure sequências específicas com condição de estágio "Remarketing" no CRM.
[INFO]
Todas as automações podem pausar ou reativar o Agente SDR automaticamente, dependendo da configuração de cada etapa da sequência.
[/INFO]`,
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Indicadores de performance e filtros de período',
    items: [
      {
        question: 'KPIs e métricas em tempo real',
        answer:
`O Dashboard exibe 5 indicadores principais. Os chips coloridos (↑ verde / ↓ vermelho) mostram a variação percentual vs o período anterior equivalente.

• **Novos leads** — Total de leads criados no período selecionado (todos os status)
• **Em atendimento** — Leads no estágio "Em contato" no estado atual do pipeline
• **Taxa de conversão** — Leads fechados no período ÷ leads criados no período (máx. 100%)
• **Em negociação** — Valor total em R$ de todos os leads ativos (estado atual, independe do filtro)
• **Faturamento** — Soma dos \`project_value\` dos leads fechados no período
[INFO]
"Em atendimento" e "Em negociação" refletem o estado real do pipeline agora — não variam com o filtro de período. Isso é intencional: mostram a situação atual independente de quando os leads foram criados.
[/INFO]`,
      },
      {
        question: 'Filtros de período e deltas',
        answer:
`O seletor de período no canto superior direito controla todos os KPIs e gráficos:

• **Hoje** — 00:00 até agora, comparado com ontem
• **Semana** — Segunda-feira até hoje, comparado com a semana passada
• **Mês** — Dia 1 até hoje, comparado com o mês anterior
• **Ano** — 1 de janeiro até hoje, comparado com o ano anterior
• **Personalizado** — Qualquer intervalo; o delta usa o mesmo número de dias imediatamente anterior

Os chips de delta são calculados como: ((atual − anterior) ÷ anterior) × 100. Um chip verde **+23%** significa crescimento de 23% vs o período anterior.
[TIP]
Use o filtro "Ano" para visão de crescimento e "Mês" para acompanhamento operacional semanal.
[/TIP]`,
      },
      {
        question: 'Gráficos: Performance e Taxa de Conversão',
        answer:
`## Performance de Vendas
Barras duplas por intervalo de tempo. A granularidade muda automaticamente:
• Hoje → por hora (0h–23h)
• Semana → por dia da semana
• Mês → por semana
• Ano → por mês

As séries exibidas:
• **Leads gerados** (verde) — leads criados no intervalo por data de criação
• **Leads fechados** (cinza) — negócios fechados por data de fechamento

## Taxa de Conversão Geral
Donut interativo mostrando a proporção de leads **Fechados** vs **Em andamento** (total de leads ativos). Passe o mouse sobre cada fatia para ver os valores absolutos.`,
      },
      {
        question: 'Funil de Vendas e Vendas Recentes',
        answer:
`## Funil de Vendas
Barras horizontais mostrando a distribuição atual de leads por estágio do pipeline. Use as pills no topo para alternar entre:
• **Funil de Vendas** — estágios do CRM com contagem de leads ativos
• **Anti Noshow** — disparos das sequências de lembrete de reunião
• **Remarketing** — em breve

## Vendas Recentes
Lista dos últimos 10 leads fechados com nome da empresa, contato e valor da negociação em ordem cronológica inversa.`,
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: Users,
    description: 'Funil de vendas, leads e pipeline completo',
    items: [
      {
        question: 'Os 9 estágios do funil',
        answer:
`O CRM usa um funil com 9 estágios que representam a jornada completa do lead:

• **Triagem** 🔍 — Leads captados via integração aguardando avaliação de ICP
• **Outbound** 📣 — Aprovados na triagem, prontos para prospecção ativa
• **Lead novo** — Adicionados manualmente, ainda não contactados
• **Em contato** — Primeiro contato realizado pelo SDR ou manualmente
• **Interessado** — Demonstrou interesse genuíno no produto/serviço
• **Proposta enviada** — Recebeu orçamento ou proposta formal
• **Fechado** — Venda concluída e valor registrado
• **Perdido** — Não converteu neste ciclo de vendas
• **Remarketing** — Em campanha de reativação futura
[TIP]
Leads em "Perdido" não são deletados. Mova-os para "Remarketing" quando quiser reengajar com uma sequência automática.
[/TIP]`,
      },
      {
        question: 'Cadastrar um lead',
        answer:
`Clique em **+ Adicionar Lead** no canto superior direito do CRM. O formulário tem 3 etapas:

1. **Empresa** — Nome (obrigatório), segmento de atuação, site ou @Instagram
2. **Contato** — Nome do contato, WhatsApp com DDD e e-mail
3. **Detalhes** — Prioridade (Alta/Média/Baixa), nível de interesse, fonte do lead, valor estimado do projeto e observações

O lead entra automaticamente no estágio **Lead novo** ao ser salvo.
[INFO]
O campo "valor do projeto" alimenta a métrica "Em negociação" no Dashboard. Preencha com o valor estimado para ter uma visão precisa do pipeline financeiro.
[/INFO]`,
      },
      {
        question: 'Planilha vs Kanban',
        answer:
`Alterne no menu lateral em **CRM → Planilha** ou **CRM → Kanban**:

## Planilha (tabela)
Todas as colunas visíveis em linha. Use para:
• Buscar e filtrar leads rapidamente
• Selecionar e deletar vários leads de uma vez
• Exportar o conjunto filtrado para CSV
• Editar campos diretamente na tabela

## Kanban (quadros)
Colunas por estágio com drag & drop. Use para:
• Visualizar o pipeline graficamente
• Mover leads entre estágios arrastando o card
• Ver o valor total e a contagem por coluna
• Identificar gargalos no funil visualmente
[INFO]
No celular, o Kanban não suporta drag & drop. Use o seletor de status dentro de cada card para mover o lead entre estágios.
[/INFO]`,
      },
      {
        question: 'Filtros, busca e ações em massa',
        answer:
`## Filtros disponíveis (cumulativos)
• **Busca de texto** — Nome da empresa, nome do contato ou e-mail
• **Status** — Um ou mais estágios do funil
• **Prioridade** — Alta, Média ou Baixa
• **Limpar filtros** — Remove todos de uma vez

## Deletar em massa (somente na Planilha)
1. Marque os checkboxes ao lado dos leads desejados
2. Clique em **Deletar X selecionado(s)** que aparece no topo
3. Confirme na caixa de diálogo

## Exportar CSV
Clique em **Exportar CSV** no topo da Planilha. Os filtros ativos são aplicados — você exporta apenas o que está visível.
[AVISO]
A exclusão em massa é permanente e não pode ser desfeita. Revise a seleção antes de confirmar.
[/AVISO]`,
        demo: <KanbanDemo />,
      },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: MessageSquare,
    description: 'Chat WhatsApp com Agente IA e inbox multi-atendente',
    items: [
      {
        question: 'Visão geral do chat WhatsApp',
        answer:
`O Atendimento é um inbox WhatsApp multi-atendente com Agente IA nativo. A tela tem 3 painéis:

• **Esquerdo** — Lista de conversas com tabs: Minhas / Livres / Todas. Busca por nome ou número.
• **Central** — Chat em tempo real espelhando o WhatsApp do número conectado
• **Direito** — Ficha do lead: resumo IA, notas, tags, mídia enviada e agenda de mensagens

Cada conversa fica sincronizada automaticamente com o WhatsApp conectado.`,
        demo: <AtendimentoDemo />,
      },
      {
        question: 'Controlar o Agente IA',
        answer:
`O agente IA tem dois níveis de controle independentes:

## Toggle global (toda a empresa)
Localizado no topo da lista de conversas. Quando desligado, o agente não responde a nenhuma conversa de nenhum atendente.

## Toggle por conversa
Localizado no header de cada chat individual. Quando em "Agente pausado", apenas aquela conversa fica sem resposta automática — as demais continuam normais.
[TIP]
Use o toggle por conversa quando quiser assumir o controle de uma negociação importante. Após fechar o negócio, reactive para que o agente continue o pós-venda.
[/TIP]

O Agente IA:
• Responde e qualifica leads 24 horas por dia
• Coleta dados, identifica dores e objeções do lead
• Apresenta o produto com base na base de conhecimento configurada
• Gera um resumo automático do lead disponível na ficha lateral`,
      },
      {
        question: 'Modos de atendimento: Suporte vs Vendas',
        answer:
`Configure em **Automações → Agente SDR → Geral → Modo de atendimento**:

## Suporte
Inbox compartilhado. Conversas novas ficam em "Livres" até um atendente se auto-atribuir.
• Tab **Minhas** → suas conversas atribuídas
• Tab **Livres** → sem atendente (disponíveis para assumir)
• Tab **Todas** → todas da empresa (visível para admin/gerente)

## Vendas
Round-robin automático. O sistema distribui novas conversas para o atendente com menos conversas abertas no momento.
[INFO]
No modo Vendas, o atendente recebe a conversa instantaneamente. No modo Suporte, qualquer atendente pode puxar a conversa disponível.
[/INFO]`,
      },
      {
        question: 'Tipos de mídia suportados',
        answer:
`Clique no ícone de clipe (📎) para acessar os tipos de mídia:

• **Imagens** — JPG, PNG, WebP. Legenda opcional
• **Áudio** — Grave diretamente com o microfone no sistema, visualização em onda sonora
• **Vídeos** — MP4 com player de reprodução no chat
• **Documentos** — PDF, Word (.docx), Excel (.xlsx), TXT

Todos os arquivos enviados e recebidos ficam organizados na aba **Mídia** da ficha do lead no painel direito.`,
      },
      {
        question: 'Tags',
        answer:
`Acesse a aba **Tags** na ficha do lead (painel direito):
• Crie tags com nome e cor personalizada
• Aplique múltiplas tags por conversa
• As tags aparecem como badges coloridos na lista de conversas`,
      },
    ],
  },
  {
    id: 'sdr',
    title: 'Agente SDR',
    icon: Bot,
    description: 'Persona, base de conhecimento e integração com calendário',
    items: [
      {
        question: 'Visão geral: 4 abas de configuração',
        answer:
`Acesse **Automações → Agente SDR** no menu lateral. A configuração tem 4 abas:

• **Geral** — Tipo de agente (SDR/Suporte), modo de atendimento, ativar ou desativar o agente
• **Identidade** — Nome do agente, tom de voz, empresa representada, produto, restrições e horário de atendimento
• **Conhecimento** — Base de conhecimento e base de objeções (3 formas de criar cada uma)
• **Integrações** — Google Calendar para agendamento automático de reuniões diretamente pelo agente`,
      },
      {
        question: 'Configurar identidade e persona',
        answer:
`Na aba **Identidade**, configure como o agente se apresenta e se comporta:

• **Nome** — Como o agente se identifica na conversa (ex: "Ana", "Carlos")
• **Tom de voz** — Formal, informal, consultivo, direto
• **Empresa** — Nome e descrição resumida da empresa
• **Produto/Serviço** — O que está sendo vendido ou suportado
• **Restrições** — O que o agente NÃO deve fazer ou mencionar
• **Horário de atendimento** — Janela horária para respostas automáticas (fora do horário, o agente não responde)
[TIP]
Seja específico nas restrições. Exemplos que funcionam bem: "Não ofereça desconto sem aprovação do gestor", "Não mencione concorrentes", "Nunca prometa prazo de entrega".
[/TIP]`,
      },
      {
        question: 'Base de conhecimento e objeções',
        answer:
`Na aba **Conhecimento**, configure duas bases separadas:

## Base de Conhecimento
O agente consulta essas informações para responder perguntas sobre o negócio. Configure pelo formulário guiado — 10 blocos de perguntas, um de cada vez, com exemplos em cada etapa.

## Base de Objeções
Scripts de resposta para objeções comuns ("é caro", "preciso pensar", "já tenho outra solução"). 3 blocos: preço, tempo/decisão e dúvidas sobre o produto.
[AVISO]
Quanto mais detalhadas e específicas forem suas respostas, melhor o agente performa. Respostas genéricas geram um agente genérico — e um agente genérico alucina.
[/AVISO]`,
        demo: <SDRWizardDemo />,
      },
      {
        question: 'Usar o Simulador de Prompt',
        answer:
`O Simulador está na aba **Conhecimento → Simulador** do Agente SDR. Permite testar como o agente responderia a leads reais **antes** de ativar com clientes de verdade.

## Dois modos de simulação
• **Básico** — Perguntas pré-definidas comuns (preço, funcionalidades, objeções frequentes). Bom para teste rápido
• **Avançado** — Você digita mensagens como se fosse o lead. Ideal para testar cenários específicos e objeções difíceis

## Como usar
1. Acesse **Agente SDR → Conhecimento → Simulador**
2. Clique em **Iniciar simulação**
3. Escolha o modo (Básico ou Avançado)
4. No modo Avançado, escreva mensagens como se fosse seu cliente
5. Veja a resposta gerada pelo agente e avalie se está alinhada com seu produto e tom de voz
6. Leia o painel de **Avaliação** com pontuação, pontos fortes e sugestões de melhoria

## O que fazer com as sugestões
Volte à aba **Conhecimento**, ajuste o texto das áreas fracas indicadas e teste novamente. Repita até o agente responder como você esperaria de um bom vendedor.
[TIP]
Teste especialmente os cenários mais difíceis: "Já uso outra ferramenta", "Preciso pensar", "Tá caro". Se o agente não contornar bem, a base de objeções precisa ser enriquecida.
[/TIP]`,
        demo: <SimuladorDemo />,
      },
      {
        question: 'Exemplo completo: base bem configurada',
        answer:
`Use este exemplo como referência de qualidade. Um preenchimento assim resulta em um agente que raramente erra.

---

## Exemplo — SaaS de Gestão (Tocli)

### 1. Identidade do Agente
Você é Ana Voss, especialista comercial da Tocli — sistema de gestão para pequenos negócios.

Você não é uma assistente. Você é uma especialista que qualifica leads e encaminha para o teste grátis.

Tom: direto, caloroso e consultivo. Nunca frio, nunca rude. Acredita no produto porque viu resultado na prática.

Nunca diga "posso ajudar?" — você já está ajudando.

### 2. Produto / Serviço
Produto: Tocli — sistema de gestão para pequenos negócios.

O que inclui: controle de vendas, estoque, financeiro e emissão de nota fiscal em um só lugar.

Preço: R$49,90/mês. Sem contrato, cancela quando quiser.

Teste grátis: 7 dias sem cartão de crédito.
Link do teste: tocli.com.br/testegratis7dias

Diferencial: único do mercado que integra NF-e no fluxo de venda, sem precisar de contador.

### 3. O que NÃO existe
- Plano anual ou desconto por antecipação
- Módulo de RH ou folha de pagamento
- Integração com marketplaces (Mercado Livre, Shopee)
- Suporte por telefone (só chat e email)
- Garantia de resultado
- Desconto por indicação

Se perguntarem algo que não existe: "Ainda não temos isso, mas está no nosso roadmap. O que você tem hoje funciona assim: [redirecione]."

### 4. Abordagem de Vendas
Vai na dor antes de falar de produto.

Perguntas de diagnóstico (uma por vez):
- "Hoje você controla o estoque de cabeça ou tem algum sistema?"
- "Quando fecha o mês, sabe exatamente quanto lucrou?"
- "Já perdeu venda por não saber que o produto estava em falta?"

Depois que o lead expor a dor, posicione o produto como solução direta para aquele problema específico.

### 5. Qualificação
1. "Qual é o seu tipo de negócio? Loja física, online ou os dois?"
2. "Quantos produtos você tem em estoque aproximadamente?"
3. "Hoje usa algum sistema para controlar as vendas?"
4. "Você é o dono ou gerencia para outra pessoa?"
5. "Teria como testar um sistema novo essa semana?"

Descarta: não é o decisor sem acesso ao dono, menos de 10 produtos, já usa concorrente e está satisfeito.

### 6. Próximo Passo
Ação: link do teste grátis por 7 dias.

Só oferecer após qualificação completa.

Script: "Quer testar na prática? São 7 dias grátis, sem cartão. Você configura em menos de 10 minutos."

Se recusar: "Tudo bem! Quando tiver um momento, o link fica aqui. Qualquer dúvida me chama." Não insista mais de uma vez.

### 7. Lead Sem Perfil
Sem verba: "O Tocli foi pensado para quem já tem um volume de vendas rodando. Quando o negócio crescer um pouco mais, me chama."

Não é o decisor: "Prefiro não tomar seu tempo sem a pessoa que decide. Quando puder trazer o dono, me chama."

Após encerrar: nunca envie mais mensagens.

### 8. Preços e Condições
Preço: R$49,90/mês. Pode revelar desde o início.

Script: "São R$49,90 por mês. Mas o teste é grátis por 7 dias, sem cartão — você testa primeiro e decide depois."

Se perguntar desconto: "No momento o preço é esse. Mas o teste grátis já dá para sentir o valor antes de pagar qualquer coisa."

Não diga "é barato" ou "é acessível" — deixe o lead tirar essa conclusão.

### 9. Como o Lead Chega
- 70%: anúncios no Meta — já viram o produto no anúncio
- 20%: indicação — mais qualificados e diretos
- 10%: orgânico — mais curiosos, menos urgentes

Primeiras mensagens mais comuns: "Vi o anúncio", "Quanto custa?", "Tem para restaurante?", "Oi" (qualifique antes de avançar).

### 10. Regras Absolutas
1. Uma pergunta por mensagem. Nunca duas juntas.
2. Nunca inventar funcionalidade, plano ou desconto que não existe.
3. Máximo 3 linhas por mensagem. Sem bloco de texto longo.
4. Sem markdown (negrito, listas com traço). WhatsApp não renderiza.
5. Nunca pressionar após a segunda recusa.
6. Nunca fingir ser humano se perguntarem diretamente.
7. Nunca falar de concorrente — nem para comparar.
8. Nunca prometer resultado ou prazo que não existe.
9. Só oferecer o link após qualificação completa.
10. Se não souber a resposta: "Deixa eu confirmar isso para você." Não invente.

---

## Exemplo — Objeções (mesmo negócio)

### 1. Objeções de Preço
**Gatilhos:** "Tá caro" / "É muito caro"
**Script:** "Entendo! São R$49,90 por mês, menos de R$2 por dia. Mas o teste é grátis, sem cartão. Experimenta primeiro e decide depois."
**Nunca dizer:** "Entendo sua preocupação, mas são apenas R$49,90..." — soa defensivo.

**Gatilhos:** "Quanto custa?" / "Qual o valor?"
**Script:** "O Tocli custa R$49,90 por mês. Você pode testar de graça por 7 dias, sem cartão. Quer que eu envie o link?"

### 2. Objeções de Tempo e Decisão
**Gatilhos:** "Preciso pensar" / "Vou pensar"
**Script:** "Claro, sem pressão! Posso te mandar o link para você salvar e testar quando decidir?"
Se recusar o link: "Tudo bem! Quando decidir, me chama aqui." Não insista.

**Gatilhos:** "Já uso outro sistema"
**Script:** "Entendi! Qual você usa hoje?" [espere resposta] Se for concorrente: "Faz sentido. Se um dia sentir falta de algo — especialmente na parte fiscal — me lembra."

### 3. Dúvidas sobre o Produto
**"Tem contrato?" / "Precisa fidelidade?"**
"Não tem contrato. É mensal, cancela quando quiser. Sem burocracia."

**"É difícil de usar?"**
"É bem simples. A maioria configura sozinho em menos de 15 minutos. No teste você já vê como funciona."

**"Tem app?" / "Funciona no celular?"**
"Funciona direto pelo celular. Não precisa instalar nada — abre no navegador e já usa."`,
      },
      {
        question: 'Conectar o WhatsApp',
        answer:
`Se o WhatsApp não estiver conectado, a tela de Atendimento exibe automaticamente o fluxo de conexão:

1. Abra o **WhatsApp** no celular
2. Toque em **Mais opções** (⋮) → **Aparelhos conectados**
3. Toque em **Conectar um aparelho**
4. Aponte a câmera para o QR Code exibido na tela do sistema

Após escanear, o webhook é configurado automaticamente. Nenhuma configuração manual adicional é necessária.
[INFO]
O QR Code expira em 60 segundos. Se expirar antes de escanear, clique em **Atualizar** para gerar um novo. O celular precisa estar com internet ativa.
[/INFO]`,
        demo: <ProductDemo />,
      },
    ],
  },
  {
    id: 'follow',
    title: 'Follow-up',
    icon: Clock,
    description: 'Sequências automáticas de mensagens com gatilhos por estágio',
    items: [
      {
        question: 'O que é o Follow-up automático',
        answer:
`O Follow-up é um sistema de sequências automáticas de mensagens enviadas no WhatsApp em intervalos programados, sem intervenção manual.

## Casos de uso típicos
• **Nurturing** — Mensagens educativas ao longo de dias ou semanas
• **Recuperação** — Reengajar leads que não responderam ao SDR
• **Anti-noshow** — Lembretes automáticos 24h, 2h e 15min antes de reuniões
• **Remarketing** — Re-engajar leads inativos no estágio "Remarketing"
• **Pós-venda** — Acompanhamento e onboarding após fechamento

## Como funciona
1. Você cria uma **sequência** com nome e tipo
2. Adiciona **etapas** com mensagem, intervalo e condições opcionais
3. A sequência é disparada quando o lead atinge o estágio configurado
[INFO]
As sequências podem pausar ou reativar o Agente SDR automaticamente por etapa — ideal para alternância entre automação e atendimento humano.
[/INFO]`,
      },
      {
        question: 'Criar e configurar uma sequência',
        answer:
`Acesse **Automações → Follow-up** no menu lateral.

1. Clique em **+ Nova Sequência**
2. Defina o **nome** e o **tipo** (follow, remarketing, anti-noshow, trial_saas)
3. Salve e clique na sequência para abrir o editor de etapas
4. Clique em **+ Adicionar Etapa** para cada passo da sequência

## Configuração de cada etapa
Cada etapa define:
• **Mensagem** — Texto a ser enviado (suporta quebras de linha)
• **Intervalo** — Tempo após a etapa anterior (minutos, horas ou dias)
• **Condição de estágio** — Estágio do lead que ativa esta etapa (opcional)
• **Gatilho imediato** — Dispara a etapa sem aguardar o intervalo quando a condição é atingida
• **Agente SDR** — Define se o agente é pausado (false) ou reativado (true) ao enviar esta etapa`,
        demo: <FollowUpDemo />,
      },
      {
        question: 'Gatilhos, condições e controle do SDR',
        answer:
`## Condição de estágio
Uma etapa com condição de estágio é disparada quando o lead muda para aquele estágio no CRM ou via SDR. Sem condição, a etapa respeita apenas o intervalo após a anterior.
[TIP]
Combine condição de estágio com **Gatilho imediato** para enviar mensagens instantaneamente ao mudar de estágio, sem aguardar o intervalo definido.
[/TIP]

## Controle do Agente SDR por etapa
• **Agente SDR = desativado** — Pausa o agente ao enviar esta etapa (para mensagens que não devem gerar resposta automática)
• **Agente SDR = ativado** — Reativa o agente após enviar, retomando o atendimento automático

## Teste de sequência
Use o **Modo de Teste** em Configuração → Trial SaaS para simular disparos sem criar registros reais ou impactar leads existentes.`,
      },
    ],
  },
  {
    id: 'trial',
    title: 'Trial SaaS',
    icon: Sparkles,
    description: 'Gestão do ciclo de vida de trials com automações e métricas',
    items: [
      {
        question: 'O que é o Trial SaaS',
        answer:
`O Trial SaaS é um módulo de gestão automática do ciclo de vida de períodos de avaliação gratuita, integrado ao WhatsApp.

Ideal para produtos SaaS ou qualquer negócio que ofereça trial. O sistema:
• Registra cada lead que inicia um trial com data e duração
• Envia mensagens automáticas por sequências vinculadas ao trial
• Acompanha o status: \`trial_ativo\` → \`convertido\` ou \`expirado\`
• Exibe alertas de expiração (≤7 dias) no painel de Métricas → Trial SaaS

O painel de Métricas mostra taxa de conversão, tempo médio de conversão e progresso de cada trial.`,
      },
      {
        question: 'Configurar o Trial',
        answer:
`Acesse **Automações → Trial SaaS** no menu lateral. Administradores e empresas com trial ativo podem criar e configurar suas próprias sequências e fluxos normalmente.
[ADMIN]
Apenas administradores podem alterar a duração global e a sequência padrão do Trial SaaS.
[/ADMIN]

## Configurações disponíveis
• **Duração do trial** — Número de dias do período de avaliação
• **Sequência ativa** — Selecione a sequência follow-up do tipo \`trial_saas\`
• **Número de teste** — Telefone para simular o fluxo sem criar registros reais

## Como um trial é iniciado
O trial é ativado por um **webhook** disparado por um formulário externo (ex: página de cadastro, landing page, Make, n8n). Quando o lead preenche o formulário, o webhook notifica o Zaapply que registra automaticamente: nome, telefone, data de início, duração e status \`trial_ativo\`.`,
        demo: <TrialSaasDemo />,
      },
      {
        question: 'Modo de teste',
        answer:
`O modo de teste permite validar todo o fluxo do trial sem afetar leads reais.

1. Em **Trial SaaS → Configurações**, ative o **Modo de teste**
2. Configure um **Número de teste** (use seu próprio WhatsApp)
3. Use o botão **Testar** para simular o disparo de cada etapa da sequência configurada
[TIP]
No modo de teste, o Agente SDR também é pausado e reativado conforme as etapas — você testa o fluxo completo incluindo o comportamento do agente.
[/TIP]
[AVISO]
Desative o modo de teste antes de liberar para leads reais. Com o modo ativo, nenhuma sequência de trial é disparada para leads normais.
[/AVISO]`,
      },
    ],
  },
  {
    id: 'metricas',
    title: 'Métricas',
    icon: BarChart2,
    description: 'Analytics completo de follow-up, trial, sequências e insights',
    items: [
      {
        question: 'Visão Geral e KPIs',
        answer:
`Acesse **Automações → Métricas** para o painel analytics de automações.

## KPIs com delta vs período anterior
• **Execuções** — Total de mensagens enviadas pelas sequências
• **Taxa de resposta** — % de leads que responderam a ao menos uma mensagem
• **Leads impactados** — Leads únicos que receberam mensagens no período
• **Em trial ativo** — Leads em período de avaliação agora

## Funil de conversão
Visualização horizontal em 4 etapas:
1. Total de leads na base
2. Engajados (responderam ao menos uma mensagem)
3. Em trial ativo
4. Convertidos (status \`convertido\`)
[TIP]
Use os filtros de período para comparar semanas ou meses. Os chips de delta mostram a variação vs o período anterior equivalente.
[/TIP]`,
      },
      {
        question: 'As 5 abas de análise',
        answer:
`## Visão Geral
KPIs, funil de conversão, gráfico por dia (execuções × respostas) e gráfico por tipo de sequência.

## Trial SaaS
Tabela de leads em trial com progresso em dias, status e valor. Alertas vermelhos para trials que expiram em ≤7 dias. Taxa de conversão e tempo médio de conversão do período.

## Sequências
Ranking de performance por sequência:
• Total de execuções, leads únicos impactados e taxa de resposta
• Ordenação por taxa de resposta decrescente

## Insights
• **Heatmap de respostas** — Mapa de calor hora × dia da semana mostrando quando os leads mais respondem
• **Leads frios** — Leads com 3+ tentativas e zero respostas (candidatos a revisão manual ou descarte)

## Execuções
Histórico completo de mensagens enviadas com busca por nome/telefone e paginação de 10 por página.`,
      },
      {
        question: 'Exportar dados e auto-refresh',
        answer:
`## Exportar CSV
Cada aba tem um botão **Exportar CSV** que baixa os dados filtrados no formato compatível com Excel e Google Sheets.

## Auto-refresh
Ative o botão de **Atualização automática** no canto superior direito. Quando ativo, o painel recarrega os dados a cada 5 minutos automaticamente — ideal para deixar aberto em um monitor de acompanhamento.

O indicador mostra quando a última atualização ocorreu e uma barra de progresso do próximo ciclo.`,
      },
    ],
  },
  {
    id: 'membros',
    title: 'Membros',
    icon: UserPlus,
    description: 'Equipe, funções, permissões e limites por plano',
    items: [
      {
        question: 'Funções e permissões',
        answer:
`O sistema tem 4 níveis de acesso:

## SDR
Acesso ao Atendimento (chat) e às conversas atribuídas. Sem acesso ao CRM completo ou Automações.

## Closer
CRM completo e Atendimento. Sem acesso a Automações, Métricas e Membros.

## SDR + Closer
Atendimento e CRM. Sem Automações, Métricas e Membros.

## Administrador
Acesso total: CRM, Atendimento, Automações, Métricas, Membros, Configurações e painel Admin.
[ADMIN]
Apenas administradores podem adicionar ou remover membros, configurar o WhatsApp, alterar planos e acessar dados de faturamento.
[/ADMIN]`,
      },
      {
        question: 'Convidar e gerenciar membros',
        answer:
`Acesse **Membros** no menu lateral.

1. Clique em **+ Novo Membro**
2. Informe o nome e o e-mail do membro
3. Selecione a função (SDR, Closer, SDR+Closer ou Administrador)
4. Clique em **Enviar Convite**

O membro recebe um e-mail com link para criar senha e acessar o sistema. O convite expira em 48 horas.

## Remover um membro
Clique no ícone de lixeira ao lado do membro e confirme. O acesso é revogado imediatamente.
[TIP]
Se o membro não acessar no prazo de 48 horas, reenvie o convite clicando em **Reenviar** na lista de membros.
[/TIP]`,
      },
      {
        question: 'Limites por plano',
        answer:
`Cada plano define a capacidade máxima de atendentes e números WhatsApp:

• **Starter** — Até 3 atendentes, 1 número WhatsApp
• **Pro** — Até 10 atendentes, 1 número WhatsApp
• **Scale** — Atendentes ilimitados, até 10 números WhatsApp (R$ 97/número adicional)
[INFO]
"Atendentes" são membros com função SDR, Closer ou SDR+Closer. Administradores não entram no limite do plano.
[/INFO]

Para verificar o número de atendentes ativos e o limite do seu plano, acesse **Configuração → Plano**.`,
      },
    ],
  },
  {
    id: 'planos',
    title: 'Planos & Preços',
    icon: CreditCard,
    description: 'Planos disponíveis, tokens de IA e como assinar',
    items: [
      {
        question: 'Comparação de planos',
        answer:
`## Zaapply Start — R$ 397/mês
• Agente SDR com IA — 24/7
• Atendimento via chat
• CRM Kanban
• Canvas → Follow-up automático
• 5M tokens/mês

## Zaapply Growth — R$ 697/mês
• Tudo do Start, mais:
• Canvas → Anti-Noshow e Remarketing
• Google Calendar integrado
• 15M tokens/mês

## Zaapply Pro — R$ 997/mês
• Tudo do Growth, mais:
• 50M tokens/mês`,
      },
      {
        question: 'Como assinar',
        answer:
`Acesse **Configuração → Plano** no menu lateral.

1. Escolha o plano desejado
2. Informe o CPF ou CNPJ da empresa (obrigatório para emissão da cobrança)
3. Clique em **Escolher plano**
4. Você é redirecionado para o Asaas para pagamento via PIX, boleto ou cartão de crédito

O plano é ativado automaticamente após a confirmação do pagamento.
[TIP]
PIX é confirmado em minutos. Boleto leva até 3 dias úteis para compensar. Para ativação imediata, prefira PIX.
[/TIP]

Para cancelar, entre em contato em **contato@zaapply.com.br**. O acesso permanece ativo até o fim do período já pago.`,
      },
      {
        question: 'Tokens de IA: consumo e recargas',
        answer:
`Tokens são a unidade de consumo do Agente IA. Cada resposta gerada consome tokens proporcionais ao tamanho da mensagem e do contexto da conversa.

## Estimativas de consumo
• Conversa curta (5 mensagens) ≈ 1.000 tokens
• Conversa média (15 mensagens) ≈ 4.000 tokens
• Conversa longa (30 mensagens) ≈ 10.000 tokens
• 5M tokens ≈ 500–1.000 conversas completas

## Recarregar tokens
Quando o saldo fica abaixo do limite, um aviso aparece no topo do sistema. Clique em **Recarregar tokens** para adicionar crédito sem aguardar a renovação mensal.
[INFO]
Tokens não utilizados no mês não acumulam para o mês seguinte. O saldo é renovado automaticamente na data de renovação do plano.
[/INFO]`,
      },
    ],
  },
  {
    id: 'canvas',
    title: 'Canvas',
    icon: HelpCircle,
    description: 'Editor visual de fluxos — nodes, conexões e como montar automações',
    items: [
      {
        question: 'O que é o Canvas de Automações?',
        answer:
`O Canvas é o editor visual de fluxos de automação do Zaapply. Em vez de configurar uma sequência passo a passo em uma lista, você **arrasta e conecta nodes** em uma tela infinita para construir fluxos completos com bifurcações, condições, esperas e múltiplos tipos de mensagem.

## Como acessar
Acesse **Automações → Follow-up**, selecione ou crie uma sequência e clique em **Abrir Canvas**.

## O que você pode construir
• Sequências lineares simples (Mensagem → Aguardar → Mensagem)
• Fluxos condicionais com bifurcações (lead respondeu? → caminho Sim ou Não)
• Roteamento por resposta de botão (Switch: qual botão o lead clicou?)
• Fluxos com Teste A/B (dividir 50/50 entre duas mensagens diferentes)
• Integrações com sistemas externos via Webhook

## Interface do canvas
• **Barra lateral esquerda** — Paleta de nodes para adicionar ao fluxo
• **Tela central** — Área de arrastar, conectar e organizar os nodes
• **MiniMap** — Minimapa no canto inferior para navegar em fluxos grandes
• **Botão Salvar** — Persiste o fluxo e converte em etapas de sequência
[TIP]
Use Ctrl+Scroll para dar zoom, Ctrl+Shift+H para centralizar o fluxo, e arraste o fundo da tela para mover a visualização sem mover nodes.
[/TIP]`,
        demo: <CanvasDemo />,
      },
      {
        question: 'Os nodes disponíveis e o que cada um faz',
        answer:
`O canvas tem 11 tipos de nodes. Cada um representa uma ação ou decisão no fluxo do lead:

## Trigger (inicio)
Criado automaticamente. É o ponto de entrada do fluxo — representa o gatilho que ativa a sequência (início automático, mudança de estágio no CRM, etc.). Só existe um por fluxo e não pode ser deletado.

## Mensagem
Envia uma mensagem WhatsApp ao lead. O tipo de conteúdo é configurável:
• **Texto** — Mensagem escrita simples. Suporte a múltiplos blocos (sequência de textos)
• **Imagem / Vídeo / Documento** — Upload de arquivo com legenda opcional
• **Áudio** — Grava ou faz upload de áudio enviado como mensagem de voz (PTT)
• **Localização** — Envia um pin de mapa via URL do Google Maps
• **Botões** — Mensagem com até 3 botões de resposta rápida, URL ou chamada
• **Lista** — Menu de opções para o lead selecionar
• **Carrossel** — Sequência de cards com imagem, título e botão

Cada node Mensagem também controla o **Agente SDR**: você pode pausar ou reativar o agente automaticamente ao enviar aquela mensagem.

## Aguardar
Pausa o fluxo por um número de dias antes de executar o próximo node. Configure a quantidade de dias e o horário em que o fluxo deve continuar. Usado para espaçar mensagens no tempo.

## Condição (Se/Senão)
Bifurca o fluxo em dois caminhos: **Sim** e **Não**. A condição avalia uma variável:
• **respondeu** — Lead mandou alguma mensagem após a última automação?
• **resposta_botao** — O lead clicou em algum botão?
• **variável personalizada** — Compara qualquer variável do lead (igual a, contém, começa com, não está vazio)

A saída **Sim** segue se a condição for verdadeira; **Não** segue caso contrário.

## Switch (N saídas)
Roteamento por valor de botão — cria um caminho de saída para cada resposta possível de botão. Ideal após um node de Mensagem com botões: cada botão clicado roteia para um caminho diferente do fluxo.

## Encerrar
Finaliza a sequência para aquele lead. Coloque no fim de cada caminho do fluxo que deve parar. Um fluxo pode ter vários nodes Encerrar (ex: um para "convertido" e outro para "desistiu").

## Webhook
Faz uma chamada HTTP (POST ou GET) para uma URL externa quando o fluxo chega naquele ponto. Use para integrar com seu CRM, ERP, planilha do Google, Make, n8n ou qualquer outro sistema.

## Lead Score
Bifurca o fluxo baseado na pontuação do lead. Configure um intervalo mínimo e máximo de score. Leads dentro do intervalo seguem o caminho Sim; fora do intervalo, o caminho Não.

## Teste A/B
Divide o tráfego 50/50 entre duas variantes de mensagem. Leads são roteados alternadamente entre Variante A e Variante B. Use para testar qual mensagem converte mais.

## Agendar Call
Envia uma sequência de blocos de mensagem e ativa o agente de agendamento via WhatsApp. O agente oferece horários disponíveis ao lead e registra o compromisso automaticamente. Suporta múltiplos blocos de texto com delay humanizado entre eles.

**Use quando:** Você quer que o próprio fluxo feche uma reunião sem intervenção humana — o lead recebe os horários disponíveis e confirma pelo WhatsApp.
[INFO]
O node Agendar Call requer o Google Calendar conectado em Configurações → Integrações para exibir horários disponíveis reais.
[/INFO]

## Pos-Condicao
Aguarda o lead responder ou clicar em um botão antes de disparar a próxima mensagem. Sem interação genuína do lead, o fluxo fica pausado indefinidamente neste ponto — o CRON não avança automaticamente.

**Diferença do node Condição:** A Condição bifurca o fluxo em dois caminhos (Sim/Não) com base em uma variável. A Pós-Condição não bifurca — ela simplesmente bloqueia o avanço até o lead agir.

**Use quando:** Você quer que a próxima mensagem só saia após o lead demonstrar interesse real. Coloque sempre na saída **"NAO"** do node Condição para evitar que o CRON dispare o caminho negativo sem o lead ter interagido.
[AVISO]
Nunca conecte Pós-Condição na saída "SIM" de uma Condição que verifica resposta de botão — nesse caso o lead já interagiu, e o node seria redundante.
[/AVISO]`,
      },
      {
        question: 'Como conectar nodes e montar um fluxo',
        answer:
`## Adicionar um node
1. Clique no botão **+ Adicionar node** (ou arraste da paleta lateral)
2. Selecione o tipo de node desejado
3. O node aparece na tela — arraste para posicioná-lo

## Conectar dois nodes
• Passe o mouse sobre um node até aparecer o **ponto de saída** (círculo na borda direita)
• Clique e arraste desse ponto até o **ponto de entrada** do próximo node (borda esquerda)
• Uma seta curva conecta os dois — esse é um "edge"

## Nodes com múltiplas saídas
• **Condição** tem dois pontos de saída: Sim (verde) e Não (cinza)
• **Switch** tem um ponto de saída por caso configurado
• Conecte cada saída a um node diferente para criar bifurcações

## Configurar um node
• **Clique duplo** no node (ou clique simples no ícone de editar) para abrir o painel de configuração à direita
• Configure mensagem, intervalo, condição, etc.
• Feche o painel — as alterações são salvas no estado do canvas

## Deletar um node ou conexão
• Clique no node/seta para selecioná-lo (fica destacado)
• Pressione **Delete** ou **Backspace**
• Ou clique no botão de lixeira que aparece no node

## Salvar o fluxo
• Clique no botão **Salvar** no canto superior direito do canvas
• O canvas é convertido em etapas de sequência salvas no banco de dados
• Um indicador verde confirma que o save foi concluído
[AVISO]
Não feche o canvas sem salvar. Alterações não salvas são perdidas ao fechar o browser ou mudar de página.
[/AVISO]

## Usar templates prontos
Ao criar uma nova sequência, o botão **Usar template** oferece fluxos pré-montados por tipo (boas-vindas, remarketing, anti-noshow). Use como ponto de partida e edite conforme necessário.`,
      },
    ],
  },
  {
    id: 'problemas',
    title: 'Problemas comuns',
    icon: AlertTriangle,
    description: 'Soluções para os problemas mais frequentes: WhatsApp, agente IA, mensagens e acesso',
    items: [
      {
        question: 'WhatsApp não conecta ou desconecta',
        answer:
`## QR Code não funciona
• Verifique se o celular tem conexão com a internet durante o escaneamento
• Feche e reabra o WhatsApp antes de escanear
• O QR expira em 60 segundos — clique em **Atualizar** se expirar
• Confirme que o número não está conectado a outro serviço ou dispositivo simultaneamente

## WhatsApp desconecta sozinho
• Acontece quando o celular fica sem internet por tempo prolongado
• Reconecte pelo mesmo fluxo de QR Code
• O webhook é reconfigurado automaticamente após reconexão — não é necessário configurar novamente`,
      },
      {
        question: 'Agente IA não responde',
        answer:
`Verifique a sequência de itens abaixo em ordem:

1. O toggle **global** do Agente IA está ativo? (ícone no topo da lista de conversas)
2. O toggle **da conversa** está em "Agente ativo"? (header do chat individual)
3. O WhatsApp está **conectado**? (status visível no topo do Atendimento)
4. A mensagem chegou dentro do **horário de atendimento** configurado em SDR → Identidade?
5. A base de conhecimento está **preenchida**? (SDR → Conhecimento)
6. O token de IA está com **saldo disponível**? (indicador no topo do sistema)
[TIP]
Se todos os itens estiverem corretos e o agente ainda não responder, acesse Admin → Monitor de Bugs para verificar erros de processamento recentes.
[/TIP]`,
      },
      {
        question: 'Mensagens não aparecem no chat',
        answer:
`## Mensagens não chegam
• Verifique se o WhatsApp está conectado (status no topo do Atendimento)
• Tente **Ctrl+Shift+R** para forçar o recarregamento completo da página
• Verifique se a conversa está na tab correta: Minhas / Livres / Todas

## Conversa sumiu
• A conversa pode ter mudado de tab — verifique em "Todas"
• Busque pelo nome ou número do contato na barra de busca da lista de conversas
• Se foi atribuída a outro atendente, aparece em "Todas" mas não em "Minhas"`,
      },
      {
        question: 'Performance lenta',
        answer:
`• **Primeiro acesso do dia** — O servidor pode levar alguns segundos para inicializar. Aguarde e recarregue a página
• **CRM com muitos leads** — Use filtros para reduzir o conjunto exibido; evite carregar todos os leads sem filtro
• **Conexão instável** — O sistema precisa de conexão estável para atualização em tempo real
• **Limpar cache** — Ctrl+Shift+R no Windows/Linux ou Cmd+Shift+R no Mac`,
      },
      {
        question: 'Recuperar senha e alterar dados',
        answer:
`## Recuperar senha
1. Na tela de login, clique em **Esqueci minha senha**
2. Digite o e-mail cadastrado
3. Verifique a caixa de entrada (e a pasta de spam)
4. Clique no link de recuperação — ele expira em 24 horas

## Alterar nome ou e-mail
Acesse **Configuração → Perfil** e edite os dados desejados.

## Alterar dados da empresa (logo, nome, e-mail)
[ADMIN]
Alterar dados da empresa requer permissão de Administrador. Acesse Configuração → Perfil da Empresa.
[/ADMIN]`,
      },
    ],
  },
];

// ── Content parsing ────────────────────────────────────────────────────────────

type Segment =
  | { kind: 'lines'; content: string[] }
  | { kind: 'callout'; type: 'TIP' | 'AVISO' | 'INFO' | 'ADMIN'; content: string[] };

function parseContent(text: string): Segment[] {
  const lines = text.split('\n');
  const segments: Segment[] = [];
  let inCallout: string | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    const open = line.trim().match(/^\[(TIP|AVISO|INFO|ADMIN)\]$/);
    const close = line.trim().match(/^\[\/(TIP|AVISO|INFO|ADMIN)\]$/);

    if (open && !inCallout) {
      if (buffer.length) segments.push({ kind: 'lines', content: buffer });
      buffer = [];
      inCallout = open[1];
    } else if (close && inCallout === close[1]) {
      segments.push({ kind: 'callout', type: inCallout as any, content: buffer });
      buffer = [];
      inCallout = null;
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length) segments.push({ kind: 'lines', content: buffer });
  return segments;
}

function renderInline(str: string, highlight?: string): React.ReactNode[] {
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={j} className="inline-flex items-center font-mono text-[12px] bg-muted border border-border/60 rounded px-1.5 py-0.5 text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) {
      const idx = part.toLowerCase().indexOf(highlight.toLowerCase());
      return (
        <span key={j}>
          {part.slice(0, idx)}
          <mark className="bg-primary/20 text-foreground rounded px-0.5">{part.slice(idx, idx + highlight.length)}</mark>
          {part.slice(idx + highlight.length)}
        </span>
      );
    }
    return <span key={j}>{part}</span>;
  });
}

// ── Callout component ─────────────────────────────────────────────────────────

const CALLOUT_CONFIG = {
  TIP:   { icon: Lightbulb,      label: 'Dica',       classes: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
  AVISO: { icon: AlertTriangle,  label: 'Atenção',    classes: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400' },
  INFO:  { icon: Info,           label: 'Info',       classes: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400' },
  ADMIN: { icon: ShieldCheck,    label: 'Admin',      classes: 'border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400' },
};

function Callout({ type, lines }: { type: keyof typeof CALLOUT_CONFIG; lines: string[] }) {
  const { icon: Icon, label, classes } = CALLOUT_CONFIG[type];
  return (
    <div className={cn('my-4 flex gap-3 rounded-xl border px-4 py-3', classes)}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</span>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground">
          {lines.filter(l => l.trim()).map((l, i) => (
            <p key={i} className="mt-0.5">{renderInline(l.trim())}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FormatText ─────────────────────────────────────────────────────────────────

function FormatText({ text, highlight }: { text: string; highlight?: string }) {
  const segments = useMemo(() => parseContent(text), [text]);

  const renderLines = (lines: string[]) => {
    const result: React.ReactNode[] = [];
    let stepCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        stepCount = 0;
        result.push(<div key={`sp-${i}`} className="h-2" />);
        continue;
      }

      // H2
      if (trimmed.startsWith('## ')) {
        stepCount = 0;
        result.push(
          <h2 key={i} className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">
            {renderInline(trimmed.slice(3), highlight)}
          </h2>
        );
        continue;
      }

      // H3
      if (trimmed.startsWith('### ')) {
        result.push(
          <h3 key={i} className="text-sm font-medium text-foreground mt-4 mb-1.5">
            {renderInline(trimmed.slice(4), highlight)}
          </h3>
        );
        continue;
      }

      // Numbered step
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        stepCount++;
        result.push(
          <div key={i} className="flex gap-3 mt-3 ml-0.5">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center mt-0.5">
              <span className="text-[10px] font-bold text-primary">{numMatch[1]}</span>
            </div>
            <span className="text-muted-foreground text-sm leading-relaxed">{renderInline(numMatch[2], highlight)}</span>
          </div>
        );
        continue;
      }

      // Bullet
      if (trimmed.startsWith('• ')) {
        stepCount = 0;
        const indent = line.search(/\S/);
        result.push(
          <div key={i} className={cn('flex gap-2.5 mt-1.5', indent > 2 ? 'ml-6' : 'ml-0.5')}>
            <span className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0 mt-2" />
            <span className="text-muted-foreground text-sm leading-relaxed">{renderInline(trimmed.slice(2), highlight)}</span>
          </div>
        );
        continue;
      }

      // Sub-bullet (- )
      if (/^\s*-\s/.test(line)) {
        result.push(
          <div key={i} className="flex gap-2.5 ml-6 mt-1">
            <span className="text-muted-foreground/50 text-xs">–</span>
            <span className="text-muted-foreground text-sm">{renderInline(trimmed.slice(1).trim(), highlight)}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph
      stepCount = 0;
      result.push(
        <p key={i} className="text-muted-foreground text-sm leading-relaxed mt-1.5">
          {renderInline(trimmed, highlight)}
        </p>
      );
    }
    return result;
  };

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === 'callout'
          ? <Callout key={i} type={seg.type} lines={seg.content} />
          : <div key={i}>{renderLines(seg.content)}</div>
      )}
    </>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  sectionIcon: LucideIcon;
  question: string;
  snippet: string;
}

function SearchResults({ query, onNavigate }: { query: string; onNavigate: (sectionId: string) => void }) {
  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const matches: SearchResult[] = [];

    for (const section of sections) {
      for (const item of section.items) {
        if (item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)) {
          const answerClean = item.answer.replace(/\[(TIP|AVISO|INFO|ADMIN|\/TIP|\/AVISO|\/INFO|\/ADMIN)\]/g, '').replace(/#{1,3}\s/g, '').replace(/\*\*/g, '').replace(/`/g, '');
          const idx = answerClean.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 30);
          const snippet = (start > 0 ? '…' : '') + answerClean.slice(start, start + 100).trim() + (answerClean.length > start + 100 ? '…' : '');
          matches.push({ sectionId: section.id, sectionTitle: section.title, sectionIcon: section.icon, question: item.question, snippet });
        }
      }
    }
    return matches.slice(0, 12);
  }, [query]);

  if (query.length < 2) return null;

  return (
    <div className="mt-3">
      {results.length === 0 ? (
        <div className="text-center py-10">
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum resultado para "{query}"</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Tente palavras diferentes ou consulte o chat de suporte</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">{results.length} resultado{results.length !== 1 && 's'} para "{query}"</p>
          {results.map((r, i) => {
            const Icon = r.sectionIcon;
            return (
              <button
                key={i}
                onClick={() => onNavigate(r.sectionId)}
                className="w-full text-left group flex items-start gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/3 transition-all duration-100"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider">{r.sectionTitle}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{r.question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{r.snippet}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-1.5 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SupportTicket ──────────────────────────────────────────────────────────────

function SupportTicketButton() {
  return (
    <a
      href="/suporte"
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20 text-primary hover:bg-primary/12 transition-colors text-[12px] font-medium"
    >
      <Ticket className="h-3.5 w-3.5 flex-shrink-0" />
      Abrir ticket de suporte
    </a>
  );
}

// ── AiChat ─────────────────────────────────────────────────────────────────────

const WELCOME_BUTTONS = ['CRM e funil', 'Agente IA', 'WhatsApp', 'Planos e preços'];

const RATING_OPTIONS = [
  { label: 'Péssimo', value: 1 },
  { label: 'Ruim',    value: 2 },
  { label: 'Ok',      value: 3 },
  { label: 'Bom',     value: 4 },
  { label: 'Ótimo',   value: 5 },
];

const CHAT_STORAGE_KEY = 'zaapply_zaia_chat';
const INACTIVITY_MS = 2 * 60 * 1000;
const CLOSE_DELAY_MS = 30 * 1000;

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* noop */ }
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function ChatText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <span key={i}>
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
              if (p.startsWith('`') && p.endsWith('`'))
                return <code key={j} className="font-mono text-[11px] bg-black/10 dark:bg-white/10 rounded px-1">{p.slice(1, -1)}</code>;
              return <span key={j}>{p}</span>;
            })}
            {i < arr.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rated, setRated] = useState(false);
  const [failedMsg, setFailedMsg] = useState<string | null>(null);
  const [inactiveWarning, setInactiveWarning] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages ?? []);
        setRated(parsed.rated ?? false);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: messages.slice(-30), rated }));
    }
  }, [messages, rated]);

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (isAtBottom()) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isAtBottom]);

  const clearInactivityTimers = useCallback(() => {
    if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimers();
    setInactiveWarning(false);
    inactiveTimer.current = setTimeout(() => {
      setInactiveWarning(true);
      closeTimer.current = setTimeout(() => {
        setIsEnding(true);
        setInactiveWarning(false);
      }, CLOSE_DELAY_MS);
    }, INACTIVITY_MS);
  }, [clearInactivityTimers]);

  useEffect(() => {
    if (open && messages.length > 0) resetInactivityTimer();
    return clearInactivityTimers;
  }, [open, messages.length, resetInactivityTimer, clearInactivityTimers]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading || isEnding) return;
    if (!text) setInput('');
    setFailedMsg(null);
    setInactiveWarning(false);
    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: Date.now() }]);
    setLoading(true);
    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || data.error || 'Não consegui responder. Tente novamente.',
        buttons: data.buttons,
        askFeedback: data.askFeedback,
        timestamp: Date.now(),
      }]);
      if (soundEnabled) playNotifSound();
      resetInactivityTimer();
    } catch {
      setFailedMsg(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao conectar. Tente novamente.',
        timestamp: Date.now(),
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleRate(r: typeof RATING_OPTIONS[number]) {
    setRated(true);
    setIsEnding(false);
    clearInactivityTimers();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Obrigada pelo feedback! Fico feliz em ajudar. Se surgir mais alguma dúvida, é só chamar.`,
      timestamp: Date.now(),
    }]);
  }

  function handleEndChat() {
    clearInactivityTimers();
    setInactiveWarning(false);
    setIsEnding(true);
  }

  function handleClearChat() {
    setMessages([]);
    setRated(false);
    setIsEnding(false);
    setFailedMsg(null);
    setInactiveWarning(false);
    clearInactivityTimers();
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  async function copyMessage(content: string, idx: number) {
    await navigator.clipboard.writeText(content);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-6 z-50 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105 active:scale-95',
          open && 'hidden'
        )}
        style={{ width: 52, height: 52 }}
        title="Falar com Zaia"
      >
        <span className="text-xl font-black tracking-tighter leading-none select-none">Z</span>
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 540 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 ring-1 ring-card" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Zaia</p>
              <p className="text-[11px] text-green-500 mt-0.5">Online agora</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSoundEnabled(v => !v)}
                title={soundEnabled ? 'Silenciar' : 'Ativar som'}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              {hasMessages && !isEnding && (
                <button
                  onClick={handleEndChat}
                  title="Encerrar atendimento"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              )}
              {hasMessages && (
                <button
                  onClick={handleClearChat}
                  title="Nova conversa"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
            {!hasMessages && (
              <div className="space-y-3">
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]">
                    Olá! Sou a <strong>Zaia</strong>, assistente do Zaapply. Sobre o que você quer saber?
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-1">
                  {WELCOME_BUTTONS.map(btn => (
                    <button
                      key={btn}
                      onClick={() => send(btn)}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className="space-y-1">
                <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : msg.isError
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-bl-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                  )}>
                    <ChatText text={msg.content} />
                    {msg.role === 'assistant' && !msg.isError && (
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        className="absolute -top-2 -right-2 hidden group-hover:flex w-6 h-6 rounded-full bg-card border border-border items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                      >
                        {copiedId === i
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className={cn('text-[10px] text-muted-foreground/40 px-1', msg.role === 'user' ? 'text-right' : 'text-left')}>
                  {formatRelativeTime(msg.timestamp)}
                </p>

                {msg.role === 'assistant' && msg.buttons && msg.buttons.length > 0 && !isEnding && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.buttons.map(btn => (
                      <button
                        key={btn}
                        onClick={() => send(btn)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                )}

                {msg.isError && failedMsg && i === messages.length - 1 && (
                  <button
                    onClick={() => { setMessages(prev => prev.slice(0, -1)); send(failedMsg); setFailedMsg(null); }}
                    className="flex items-center gap-1.5 ml-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Tentar novamente
                  </button>
                )}

                {msg.role === 'assistant' && msg.askFeedback && !rated && i === messages.length - 1 && (
                  <div className="space-y-2 pl-1">
                    <p className="text-xs text-muted-foreground">Como foi esse atendimento?</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {RATING_OPTIONS.map(r => (
                        <button key={r.value} onClick={() => handleRate(r)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-muted hover:bg-muted/80 hover:border-primary/50 transition-colors">
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {inactiveWarning && (
              <div className="flex justify-start">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm max-w-[85%]">
                  Ei, você ainda tá aí? Vou encerrar em 30 segundos…
                </div>
              </div>
            )}

            {isEnding && !rated && (
              <div className="space-y-2">
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm max-w-[85%]">
                    Tudo bem! Encerrando por aqui. Como foi esse atendimento?
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap pl-1">
                  {RATING_OPTIONS.map(r => (
                    <button key={r.value} onClick={() => handleRate(r)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-muted hover:bg-muted/80 hover:border-primary/50 transition-colors">
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* External links footer */}
          <div className="border-t border-border/40 px-3 py-1.5 flex">
            <a
              href="https://wa.me/5577988650528?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20o%20Zaapply"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-green-600 dark:text-green-400 hover:bg-green-500/8 transition-colors py-1.5 rounded-lg"
            >
              <MessageSquare className="w-3 h-3" />
              Falar com especialista
            </a>
            <div className="w-px bg-border/60 my-1" />
            <a
              href="https://zaapply.com.br/planos"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-primary hover:bg-primary/8 transition-colors py-1.5 rounded-lg"
            >
              <CreditCard className="w-3 h-3" />
              Ver planos
            </a>
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={isEnding ? 'Atendimento encerrado' : 'Digite sua dúvida…'}
              disabled={loading || isEnding}
              className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || isEnding}
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AjudaPage() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSection = sections.find(s => s.id === activeId) || sections[0];
  const activeIdx = sections.findIndex(s => s.id === activeId);
  const ActiveIcon = activeSection.icon;

  const isSearching = searchQuery.length >= 2;

  // CMD+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) setSearchQuery('');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchQuery]);

  const handleNavigate = (sectionId: string) => {
    setActiveId(sectionId);
    setSearchQuery('');
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-3 md:-m-6">

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Search bar — fixo, não scrollável */}
        <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm px-6 md:px-12 py-3">
          <div className="max-w-3xl mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Pesquisar na documentação…"
              className="w-full h-10 bg-muted/50 border border-border rounded-xl pl-10 pr-20 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-muted-foreground/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/60 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>

          {/* Search results */}
          {isSearching ? (
            <div className="max-w-3xl mx-auto px-6 md:px-12 py-8">
              <SearchResults query={searchQuery} onNavigate={handleNavigate} />
            </div>
          ) : (
            <>
              {/* Breadcrumb + section header */}
              <div className="max-w-3xl mx-auto px-6 md:px-12 pt-8 md:pt-10">
                <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Docs</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">{activeSection.title}</span>
                </nav>

                <div className="mb-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 mb-4">
                    <ActiveIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">{activeSection.title}</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">
                    {activeSection.title}
                  </h1>
                  <p className="text-muted-foreground text-base leading-relaxed">{activeSection.description}</p>
                </div>

                <Separator className="mb-10" />
              </div>

              {/* Items */}
              <div className="space-y-12 pb-10">
                {activeSection.items.map((item, index) => (
                  <article key={index} id={`item-${index}`}>
                    {/* Text content — constrained width */}
                    <div className="max-w-3xl mx-auto px-6 md:px-12">
                      <h2 className="text-lg font-semibold text-foreground mb-5">{item.question}</h2>
                      <div className="leading-relaxed">
                        <FormatText text={item.answer} />
                      </div>
                    </div>
                    {/* Demo — largura controlada */}
                    {item.demo && (
                      <div className="mt-8 px-4 md:px-6 max-w-5xl mx-auto">
                        {item.demo}
                      </div>
                    )}
                    {index < activeSection.items.length - 1 && (
                      <div className="max-w-3xl mx-auto px-6 md:px-12">
                        <Separator className="mt-12" />
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* Prev / Next navigation */}
              <div className="max-w-3xl mx-auto px-6 md:px-12 pb-10">
                <div className="pt-8 border-t border-border/30 flex justify-between">
                  {activeIdx > 0 ? (
                    <button
                      onClick={() => { setActiveId(sections[activeIdx - 1].id); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                      <div className="text-left">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Anterior</p>
                        <p>{sections[activeIdx - 1].title}</p>
                      </div>
                    </button>
                  ) : <div />}
                  {activeIdx < sections.length - 1 ? (
                    <button
                      onClick={() => { setActiveId(sections[activeIdx + 1].id); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-right"
                    >
                      <div>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Próximo</p>
                        <p>{sections[activeIdx + 1].title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : <div />}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right sidebar (unchanged layout) ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-l border-border/40">
        <div className="flex-1 overflow-y-auto py-8 px-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
            Nesta página
          </p>
          <nav className="space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => handleNavigate(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] rounded-lg transition-colors text-left',
                    isActive
                      ? 'bg-primary/8 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70')} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border/40 p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Não encontrou o que precisava?
          </p>
          <SupportTicketButton />
        </div>
      </aside>

      <AiChat />
    </div>
  );
}
