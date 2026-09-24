// Conteúdo da documentação da Ajuda. Formato do texto de cada resposta:
//   ## Título        subtítulo (vira linha de definição quando vem com uma frase logo abaixo)
//   1. passo         passo numerado
//   • item           lista
//   **negrito**      destaque
//   [TIP] [AVISO] [INFO] [ADMIN] ... [/TIP]   caixa de destaque

export interface HelpItem { question: string; answer: string }
export interface HelpSection { id: string; title: string; description: string; items: HelpItem[] }

export const sections: HelpSection[] = [
  {
    id:  'visao-geral',
    title:  'Visão Geral',
    description:  'Introdução à plataforma e primeiros passos',
    items:  [
      {
        question:  'O que é o Zaapply?',
        answer:
`O Zaapply é uma plataforma de CRM e automação de vendas com IA nativa integrada ao WhatsApp. Todo o fluxo: desde captar o lead até fechar a venda: acontece em um único ambiente.

## Módulos principais
• **Dashboard**: KPIs em tempo real com comparativos vs período anterior
• **CRM**: Funil de vendas com Kanban drag & drop e visualização em planilha
• **Atendimento**: Chat WhatsApp com Agente IA e inbox multi-atendente
• **Agente SDR**: Configuração de persona, base de conhecimento e objeções
• **Follow-up**: Sequências automáticas de mensagens com gatilhos por estágio
• **Trial SaaS**: Gestão do ciclo de vida de trials com automações
• **Métricas**: Analytics completo de follow-up, trial e remarketing
• **Membros**: Gestão de equipe com permissões por função
• **Briefing**: Formulário público personalizado com sua marca
[INFO]
Todas as funcionalidades funcionam dentro da mesma plataforma. Não são necessárias integrações externas complexas além do WhatsApp e, opcionalmente, o Google Calendar.
[/INFO]`,
      },
      {
        question:  'Guia de primeiros passos',
        answer:
`Configure o Zaapply em 5 etapas para começar a operar com IA:

1. **Conecte o WhatsApp**: Acesse Atendimento e escaneie o QR Code com o celular
2. **Configure o Agente SDR**: Defina persona, base de conhecimento e modo de atendimento em Automações → Agente SDR
3. **Adicione seus leads**: Importe ou cadastre leads no CRM
4. **Ative o Agente IA**: Use o toggle global na lista de conversas em Atendimento
5. **Monitore pelo Dashboard**: Acompanhe conversões, funil e faturamento em tempo real
[TIP]
Configure a base de conhecimento com produtos, preços e principais objeções antes de ativar o agente. Quanto mais contexto, melhor a qualidade das respostas geradas.
[/TIP]`,
      },
      {
        question:  'Automações disponíveis',
        answer:
`O Zaapply oferece três tipos de automação de mensagens via WhatsApp:

## Follow-up
Sequências de mensagens enviadas automaticamente em intervalos programados. Ideal para nurturing, recuperação de leads inativos, anti-noshow e pós-venda.

## Trial SaaS
Automação dedicada para modelos com período de avaliação. Acompanha cada lead pelo ciclo completo:  início do trial → engajamento → conversão ou expiração.

## Remarketing
Re-engajamento de leads inativos com mensagens personalizadas. Configure sequências específicas com condição de estágio "Remarketing" no CRM.
[INFO]
Todas as automações podem pausar ou reativar o Agente SDR automaticamente, dependendo da configuração de cada etapa da sequência.
[/INFO]`,
      },
    ],
  },
  {
    id:  'dashboard',
    title:  'Dashboard',
    description:  'Indicadores de performance e filtros de período',
    items:  [
      {
        question:  'KPIs e métricas em tempo real',
        answer:
`O Dashboard exibe 5 indicadores principais. Os chips coloridos (↑ verde / ↓ vermelho) mostram a variação percentual vs o período anterior equivalente.

• **Novos leads**: Total de leads criados no período selecionado (todos os status)
• **Em atendimento**: Leads no estágio "Em contato" no estado atual do pipeline
• **Taxa de conversão**: Leads fechados no período ÷ leads criados no período (máx. 100%)
• **Em negociação**: Valor total em R$ de todos os leads ativos (estado atual, independe do filtro)
• **Faturamento**: Soma dos \`project_value\` dos leads fechados no período
[INFO]
"Em atendimento" e "Em negociação" refletem o estado real do pipeline agora: não variam com o filtro de período. Isso é intencional:  mostram a situação atual independente de quando os leads foram criados.
[/INFO]`,
      },
      {
        question:  'Filtros de período e deltas',
        answer:
`O seletor de período no canto superior direito controla todos os KPIs e gráficos:

• **Hoje**: 00:00 até agora, comparado com ontem
• **Semana**: Segunda-feira até hoje, comparado com a semana passada
• **Mês**: Dia 1 até hoje, comparado com o mês anterior
• **Ano**: 1 de janeiro até hoje, comparado com o ano anterior
• **Personalizado**: Qualquer intervalo; o delta usa o mesmo número de dias imediatamente anterior

Os chips de delta são calculados como:  ((atual − anterior) ÷ anterior) × 100. Um chip verde **+23%** significa crescimento de 23% vs o período anterior.
[TIP]
Use o filtro "Ano" para visão de crescimento e "Mês" para acompanhamento operacional semanal.
[/TIP]`,
      },
      {
        question:  'Gráficos:  Performance e Taxa de Conversão',
        answer:
`## Performance de Vendas
Barras duplas por intervalo de tempo. A granularidade muda automaticamente:
• Hoje → por hora (0h–23h)
• Semana → por dia da semana
• Mês → por semana
• Ano → por mês

As séries exibidas:
• **Leads gerados** (verde): leads criados no intervalo por data de criação
• **Leads fechados** (cinza): negócios fechados por data de fechamento

## Taxa de Conversão Geral
Donut interativo mostrando a proporção de leads **Fechados** vs **Em andamento** (total de leads ativos). Passe o mouse sobre cada fatia para ver os valores absolutos.`,
      },
      {
        question:  'Funil de Vendas e Vendas Recentes',
        answer:
`## Funil de Vendas
Barras horizontais mostrando a distribuição atual de leads por estágio do pipeline. Use as pills no topo para alternar entre:
• **Funil de Vendas**: estágios do CRM com contagem de leads ativos
• **Anti Noshow**: disparos das sequências de lembrete de reunião
• **Remarketing**: em breve

## Vendas Recentes
Lista dos últimos 10 leads fechados com nome da empresa, contato e valor da negociação em ordem cronológica inversa.`,
      },
    ],
  },
  {
    id:  'crm',
    title:  'CRM',
    description:  'Funil de vendas, leads e pipeline completo',
    items:  [
      {
        question:  'Os 9 estágios do funil',
        answer:
`O CRM usa um funil com 9 estágios que representam a jornada completa do lead:

• **Triagem** 🔍:Leads captados via integração aguardando avaliação de ICP
• **Outbound** 📣:Aprovados na triagem, prontos para prospecção ativa
• **Lead novo**: Adicionados manualmente, ainda não contactados
• **Em contato**: Primeiro contato realizado pelo SDR ou manualmente
• **Interessado**: Demonstrou interesse genuíno no produto/serviço
• **Proposta enviada**: Recebeu orçamento ou proposta formal
• **Fechado**: Venda concluída e valor registrado
• **Perdido**: Não converteu neste ciclo de vendas
• **Remarketing**: Em campanha de reativação futura
[TIP]
Leads em "Perdido" não são deletados. Mova-os para "Remarketing" quando quiser reengajar com uma sequência automática.
[/TIP]`,
      },
      {
        question:  'Cadastrar um lead',
        answer:
`Clique em **+ Adicionar Lead** no canto superior direito do CRM. O formulário tem 3 etapas:

1. **Empresa**: Nome (obrigatório), segmento de atuação, site ou @Instagram
2. **Contato**: Nome do contato, WhatsApp com DDD e e-mail
3. **Detalhes**: Prioridade (Alta/Média/Baixa), nível de interesse, fonte do lead, valor estimado do projeto e observações

O lead entra automaticamente no estágio **Lead novo** ao ser salvo.
[INFO]
O campo "valor do projeto" alimenta a métrica "Em negociação" no Dashboard. Preencha com o valor estimado para ter uma visão precisa do pipeline financeiro.
[/INFO]`,
      },
      {
        question:  'Planilha vs Kanban',
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
        question:  'Filtros, busca e ações em massa',
        answer:
`## Filtros disponíveis (cumulativos)
• **Busca de texto**: Nome da empresa, nome do contato ou e-mail
• **Status**: Um ou mais estágios do funil
• **Prioridade**: Alta, Média ou Baixa
• **Limpar filtros**: Remove todos de uma vez

## Deletar em massa (somente na Planilha)
1. Marque os checkboxes ao lado dos leads desejados
2. Clique em **Deletar X selecionado(s)** que aparece no topo
3. Confirme na caixa de diálogo

## Exportar CSV
Clique em **Exportar CSV** no topo da Planilha. Os filtros ativos são aplicados: você exporta apenas o que está visível.
[AVISO]
A exclusão em massa é permanente e não pode ser desfeita. Revise a seleção antes de confirmar.
[/AVISO]`,
      },
    ],
  },
  {
    id:  'atendimento',
    title:  'Atendimento',
    description:  'Chat WhatsApp com Agente IA e inbox multi-atendente',
    items:  [
      {
        question:  'Visão geral do chat WhatsApp',
        answer:
`O Atendimento é um inbox WhatsApp multi-atendente com Agente IA nativo. A tela tem 3 painéis:

• **Esquerdo**: Lista de conversas com tabs:  Minhas / Livres / Todas. Busca por nome ou número.
• **Central**: Chat em tempo real espelhando o WhatsApp do número conectado
• **Direito**: Ficha do lead:  resumo IA, notas, tags, mídia enviada e agenda de mensagens

Cada conversa fica sincronizada automaticamente com o WhatsApp conectado.`,
      },
      {
        question:  'Controlar o Agente IA',
        answer:
`O agente IA tem dois níveis de controle independentes:

## Toggle global (toda a empresa)
Localizado no topo da lista de conversas. Quando desligado, o agente não responde a nenhuma conversa de nenhum atendente.

## Toggle por conversa
Localizado no header de cada chat individual. Quando em "Agente pausado", apenas aquela conversa fica sem resposta automática: as demais continuam normais.
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
        question:  'Modos de atendimento:  Suporte vs Vendas',
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
        question:  'Tipos de mídia suportados',
        answer:
`Clique no ícone de clipe (📎) para acessar os tipos de mídia:

• **Imagens**: JPG, PNG, WebP. Legenda opcional
• **Áudio**: Grave diretamente com o microfone no sistema, visualização em onda sonora
• **Vídeos**: MP4 com player de reprodução no chat
• **Documentos**: PDF, Word (.docx), Excel (.xlsx), TXT

Todos os arquivos enviados e recebidos ficam organizados na aba **Mídia** da ficha do lead no painel direito.`,
      },
      {
        question:  'Tags',
        answer:
`Acesse a aba **Tags** na ficha do lead (painel direito):
• Crie tags com nome e cor personalizada
• Aplique múltiplas tags por conversa
• As tags aparecem como badges coloridos na lista de conversas`,
      },
    ],
  },
  {
    id:  'sdr',
    title:  'Agente SDR',
    description:  'Persona, base de conhecimento e integração com calendário',
    items:  [
      {
        question:  'Visão geral:  4 abas de configuração',
        answer:
`Acesse **Automações → Agente SDR** no menu lateral. A configuração tem 4 abas:

• **Geral**: Tipo de agente (SDR/Suporte), modo de atendimento, ativar ou desativar o agente
• **Identidade**: Nome do agente, tom de voz, empresa representada, produto, restrições e horário de atendimento
• **Conhecimento**: Base de conhecimento e base de objeções (3 formas de criar cada uma)
• **Integrações**: Google Calendar para agendamento automático de reuniões diretamente pelo agente`,
      },
      {
        question:  'Configurar identidade e persona',
        answer:
`Na aba **Identidade**, configure como o agente se apresenta e se comporta:

• **Nome**: Como o agente se identifica na conversa (ex:  "Ana", "Carlos")
• **Tom de voz**: Formal, informal, consultivo, direto
• **Empresa**: Nome e descrição resumida da empresa
• **Produto/Serviço**: O que está sendo vendido ou suportado
• **Restrições**: O que o agente NÃO deve fazer ou mencionar
• **Horário de atendimento**: Janela horária para respostas automáticas (fora do horário, o agente não responde)
[TIP]
Seja específico nas restrições. Exemplos que funcionam bem:  "Não ofereça desconto sem aprovação do gestor", "Não mencione concorrentes", "Nunca prometa prazo de entrega".
[/TIP]`,
      },
      {
        question:  'Base de conhecimento e objeções',
        answer:
`Na aba **Conhecimento**, configure duas bases separadas:

## Base de Conhecimento
O agente consulta essas informações para responder perguntas sobre o negócio. Configure pelo formulário guiado: 10 blocos de perguntas, um de cada vez, com exemplos em cada etapa.

## Base de Objeções
Scripts de resposta para objeções comuns ("é caro", "preciso pensar", "já tenho outra solução"). 3 blocos:  preço, tempo/decisão e dúvidas sobre o produto.
[AVISO]
Quanto mais detalhadas e específicas forem suas respostas, melhor o agente performa. Respostas genéricas geram um agente genérico: e um agente genérico alucina.
[/AVISO]`,
      },
      {
        question:  'Usar o Simulador de Prompt',
        answer:
`O Simulador está na aba **Conhecimento → Simulador** do Agente SDR. Permite testar como o agente responderia a leads reais **antes** de ativar com clientes de verdade.

## Dois modos de simulação
• **Básico**: Perguntas pré-definidas comuns (preço, funcionalidades, objeções frequentes). Bom para teste rápido
• **Avançado**: Você digita mensagens como se fosse o lead. Ideal para testar cenários específicos e objeções difíceis

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
Teste especialmente os cenários mais difíceis:  "Já uso outra ferramenta", "Preciso pensar", "Tá caro". Se o agente não contornar bem, a base de objeções precisa ser enriquecida.
[/TIP]`,
      },
      {
        question:  'Exemplo completo:  base bem configurada',
        answer:
`Use este exemplo como referência de qualidade. Um preenchimento assim resulta em um agente que raramente erra.

---

## Exemplo: SaaS de Gestão (Tocli)

### 1. Identidade do Agente
Você é Ana Voss, especialista comercial da Tocli: sistema de gestão para pequenos negócios.

Você não é uma assistente. Você é uma especialista que qualifica leads e encaminha para o teste grátis.

Tom:  direto, caloroso e consultivo. Nunca frio, nunca rude. Acredita no produto porque viu resultado na prática.

Nunca diga "posso ajudar?":você já está ajudando.

### 2. Produto / Serviço
Produto:  Tocli: sistema de gestão para pequenos negócios.

O que inclui:  controle de vendas, estoque, financeiro e emissão de nota fiscal em um só lugar.

Preço:  R$49,90/mês. Sem contrato, cancela quando quiser.

Teste grátis:  7 dias sem cartão de crédito.
Link do teste:  tocli.com.br/testegratis7dias

Diferencial:  único do mercado que integra NF-e no fluxo de venda, sem precisar de contador.

### 3. O que NÃO existe
- Plano anual ou desconto por antecipação
- Módulo de RH ou folha de pagamento
- Integração com marketplaces (Mercado Livre, Shopee)
- Suporte por telefone (só chat e email)
- Garantia de resultado
- Desconto por indicação

Se perguntarem algo que não existe:  "Ainda não temos isso, mas está no nosso roadmap. O que você tem hoje funciona assim:  [redirecione]."

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

Descarta:  não é o decisor sem acesso ao dono, menos de 10 produtos, já usa concorrente e está satisfeito.

### 6. Próximo Passo
Ação:  link do teste grátis por 7 dias.

Só oferecer após qualificação completa.

Script:  "Quer testar na prática? São 7 dias grátis, sem cartão. Você configura em menos de 10 minutos."

Se recusar:  "Tudo bem! Quando tiver um momento, o link fica aqui. Qualquer dúvida me chama." Não insista mais de uma vez.

### 7. Lead Sem Perfil
Sem verba:  "O Tocli foi pensado para quem já tem um volume de vendas rodando. Quando o negócio crescer um pouco mais, me chama."

Não é o decisor:  "Prefiro não tomar seu tempo sem a pessoa que decide. Quando puder trazer o dono, me chama."

Após encerrar:  nunca envie mais mensagens.

### 8. Preços e Condições
Preço:  R$49,90/mês. Pode revelar desde o início.

Script:  "São R$49,90 por mês. Mas o teste é grátis por 7 dias, sem cartão: você testa primeiro e decide depois."

Se perguntar desconto:  "No momento o preço é esse. Mas o teste grátis já dá para sentir o valor antes de pagar qualquer coisa."

Não diga "é barato" ou "é acessível":deixe o lead tirar essa conclusão.

### 9. Como o Lead Chega
- 70%: anúncios no Meta: já viram o produto no anúncio
- 20%: indicação: mais qualificados e diretos
- 10%: orgânico: mais curiosos, menos urgentes

Primeiras mensagens mais comuns:  "Vi o anúncio", "Quanto custa?", "Tem para restaurante?", "Oi" (qualifique antes de avançar).

### 10. Regras Absolutas
1. Uma pergunta por mensagem. Nunca duas juntas.
2. Nunca inventar funcionalidade, plano ou desconto que não existe.
3. Máximo 3 linhas por mensagem. Sem bloco de texto longo.
4. Sem markdown (negrito, listas com traço). WhatsApp não renderiza.
5. Nunca pressionar após a segunda recusa.
6. Nunca fingir ser humano se perguntarem diretamente.
7. Nunca falar de concorrente: nem para comparar.
8. Nunca prometer resultado ou prazo que não existe.
9. Só oferecer o link após qualificação completa.
10. Se não souber a resposta:  "Deixa eu confirmar isso para você." Não invente.

---

## Exemplo: Objeções (mesmo negócio)

### 1. Objeções de Preço
**Gatilhos: ** "Tá caro" / "É muito caro"
**Script: ** "Entendo! São R$49,90 por mês, menos de R$2 por dia. Mas o teste é grátis, sem cartão. Experimenta primeiro e decide depois."
**Nunca dizer: ** "Entendo sua preocupação, mas são apenas R$49,90...":soa defensivo.

**Gatilhos: ** "Quanto custa?" / "Qual o valor?"
**Script: ** "O Tocli custa R$49,90 por mês. Você pode testar de graça por 7 dias, sem cartão. Quer que eu envie o link?"

### 2. Objeções de Tempo e Decisão
**Gatilhos: ** "Preciso pensar" / "Vou pensar"
**Script: ** "Claro, sem pressão! Posso te mandar o link para você salvar e testar quando decidir?"
Se recusar o link:  "Tudo bem! Quando decidir, me chama aqui." Não insista.

**Gatilhos: ** "Já uso outro sistema"
**Script: ** "Entendi! Qual você usa hoje?" [espere resposta] Se for concorrente:  "Faz sentido. Se um dia sentir falta de algo: especialmente na parte fiscal: me lembra."

### 3. Dúvidas sobre o Produto
**"Tem contrato?" / "Precisa fidelidade?"**
"Não tem contrato. É mensal, cancela quando quiser. Sem burocracia."

**"É difícil de usar?"**
"É bem simples. A maioria configura sozinho em menos de 15 minutos. No teste você já vê como funciona."

**"Tem app?" / "Funciona no celular?"**
"Funciona direto pelo celular. Não precisa instalar nada: abre no navegador e já usa."`,
      },
      {
        question:  'Conectar o WhatsApp',
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
      },
    ],
  },
  {
    id:  'follow',
    title:  'Follow-up',
    description:  'Sequências automáticas de mensagens com gatilhos por estágio',
    items:  [
      {
        question:  'O que é o Follow-up automático',
        answer:
`O Follow-up é um sistema de sequências automáticas de mensagens enviadas no WhatsApp em intervalos programados, sem intervenção manual.

## Casos de uso típicos
• **Nurturing**: Mensagens educativas ao longo de dias ou semanas
• **Recuperação**: Reengajar leads que não responderam ao SDR
• **Anti-noshow**: Lembretes automáticos 24h, 2h e 15min antes de reuniões
• **Remarketing**: Re-engajar leads inativos no estágio "Remarketing"
• **Pós-venda**: Acompanhamento e onboarding após fechamento

## Como funciona
1. Você cria uma **sequência** com nome e tipo
2. Adiciona **etapas** com mensagem, intervalo e condições opcionais
3. A sequência é disparada quando o lead atinge o estágio configurado
[INFO]
As sequências podem pausar ou reativar o Agente SDR automaticamente por etapa: ideal para alternância entre automação e atendimento humano.
[/INFO]`,
      },
      {
        question:  'Criar e configurar uma sequência',
        answer:
`Acesse **Automações → Follow-up** no menu lateral.

1. Clique em **+ Nova Sequência**
2. Defina o **nome** e o **tipo** (follow, remarketing, anti-noshow, trial_saas)
3. Salve e clique na sequência para abrir o editor de etapas
4. Clique em **+ Adicionar Etapa** para cada passo da sequência

## Configuração de cada etapa
Cada etapa define:
• **Mensagem**: Texto a ser enviado (suporta quebras de linha)
• **Intervalo**: Tempo após a etapa anterior (minutos, horas ou dias)
• **Condição de estágio**: Estágio do lead que ativa esta etapa (opcional)
• **Gatilho imediato**: Dispara a etapa sem aguardar o intervalo quando a condição é atingida
• **Agente SDR**: Define se o agente é pausado (false) ou reativado (true) ao enviar esta etapa`,
      },
      {
        question:  'Gatilhos, condições e controle do SDR',
        answer:
`## Condição de estágio
Uma etapa com condição de estágio é disparada quando o lead muda para aquele estágio no CRM ou via SDR. Sem condição, a etapa respeita apenas o intervalo após a anterior.
[TIP]
Combine condição de estágio com **Gatilho imediato** para enviar mensagens instantaneamente ao mudar de estágio, sem aguardar o intervalo definido.
[/TIP]

## Controle do Agente SDR por etapa
• **Agente SDR = desativado**: Pausa o agente ao enviar esta etapa (para mensagens que não devem gerar resposta automática)
• **Agente SDR = ativado**: Reativa o agente após enviar, retomando o atendimento automático

## Teste de sequência
Use o **Modo de Teste** em Configuração → Trial SaaS para simular disparos sem criar registros reais ou impactar leads existentes.`,
      },
    ],
  },
  {
    id:  'trial',
    title:  'Trial SaaS',
    description:  'Gestão do ciclo de vida de trials com automações e métricas',
    items:  [
      {
        question:  'O que é o Trial SaaS',
        answer:
`O Trial SaaS é um módulo de gestão automática do ciclo de vida de períodos de avaliação gratuita, integrado ao WhatsApp.

Ideal para produtos SaaS ou qualquer negócio que ofereça trial. O sistema:
• Registra cada lead que inicia um trial com data e duração
• Envia mensagens automáticas por sequências vinculadas ao trial
• Acompanha o status:  \`trial_ativo\` → \`convertido\` ou \`expirado\`
• Exibe alertas de expiração (≤7 dias) no painel de Métricas → Trial SaaS

O painel de Métricas mostra taxa de conversão, tempo médio de conversão e progresso de cada trial.`,
      },
      {
        question:  'Configurar o Trial',
        answer:
`Acesse **Automações → Trial SaaS** no menu lateral. Administradores e empresas com trial ativo podem criar e configurar suas próprias sequências e fluxos normalmente.
[ADMIN]
Apenas administradores podem alterar a duração global e a sequência padrão do Trial SaaS.
[/ADMIN]

## Configurações disponíveis
• **Duração do trial**: Número de dias do período de avaliação
• **Sequência ativa**: Selecione a sequência follow-up do tipo \`trial_saas\`
• **Número de teste**: Telefone para simular o fluxo sem criar registros reais

## Como um trial é iniciado
O trial é ativado por um **webhook** disparado por um formulário externo (ex:  página de cadastro, landing page, Make, n8n). Quando o lead preenche o formulário, o webhook notifica o Zaapply que registra automaticamente:  nome, telefone, data de início, duração e status \`trial_ativo\`.`,
      },
      {
        question:  'Modo de teste',
        answer:
`O modo de teste permite validar todo o fluxo do trial sem afetar leads reais.

1. Em **Trial SaaS → Configurações**, ative o **Modo de teste**
2. Configure um **Número de teste** (use seu próprio WhatsApp)
3. Use o botão **Testar** para simular o disparo de cada etapa da sequência configurada
[TIP]
No modo de teste, o Agente SDR também é pausado e reativado conforme as etapas: você testa o fluxo completo incluindo o comportamento do agente.
[/TIP]
[AVISO]
Desative o modo de teste antes de liberar para leads reais. Com o modo ativo, nenhuma sequência de trial é disparada para leads normais.
[/AVISO]`,
      },
    ],
  },
  {
    id:  'metricas',
    title:  'Métricas',
    description:  'Analytics completo de follow-up, trial, sequências e insights',
    items:  [
      {
        question:  'Visão Geral e KPIs',
        answer:
`Acesse **Automações → Métricas** para o painel analytics de automações.

## KPIs com delta vs período anterior
• **Execuções**: Total de mensagens enviadas pelas sequências
• **Taxa de resposta**:% de leads que responderam a ao menos uma mensagem
• **Leads impactados**: Leads únicos que receberam mensagens no período
• **Em trial ativo**: Leads em período de avaliação agora

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
        question:  'As 5 abas de análise',
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
• **Heatmap de respostas**: Mapa de calor hora × dia da semana mostrando quando os leads mais respondem
• **Leads frios**: Leads com 3+ tentativas e zero respostas (candidatos a revisão manual ou descarte)

## Execuções
Histórico completo de mensagens enviadas com busca por nome/telefone e paginação de 10 por página.`,
      },
      {
        question:  'Exportar dados e auto-refresh',
        answer:
`## Exportar CSV
Cada aba tem um botão **Exportar CSV** que baixa os dados filtrados no formato compatível com Excel e Google Sheets.

## Auto-refresh
Ative o botão de **Atualização automática** no canto superior direito. Quando ativo, o painel recarrega os dados a cada 5 minutos automaticamente: ideal para deixar aberto em um monitor de acompanhamento.

O indicador mostra quando a última atualização ocorreu e uma barra de progresso do próximo ciclo.`,
      },
    ],
  },
  {
    id:  'membros',
    title:  'Membros',
    description:  'Equipe, funções, permissões e limites por plano',
    items:  [
      {
        question:  'Funções e permissões',
        answer:
`O sistema tem 4 níveis de acesso:

## SDR
Acesso ao Atendimento (chat) e às conversas atribuídas. Sem acesso ao CRM completo ou Automações.

## Closer
CRM completo e Atendimento. Sem acesso a Automações, Métricas e Membros.

## SDR + Closer
Atendimento e CRM. Sem Automações, Métricas e Membros.

## Administrador
Acesso total:  CRM, Atendimento, Automações, Métricas, Membros, Configurações e painel Admin.
[ADMIN]
Apenas administradores podem adicionar ou remover membros, configurar o WhatsApp, alterar planos e acessar dados de faturamento.
[/ADMIN]`,
      },
      {
        question:  'Convidar e gerenciar membros',
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
        question:  'Limites por plano',
        answer:
`Cada plano define a capacidade máxima de atendentes e números WhatsApp:

• **Start**:  Até 3 atendentes, 1 número WhatsApp
• **Growth**:  Até 10 atendentes, 2 números WhatsApp
[INFO]
"Atendentes" são membros com função SDR, Closer ou SDR+Closer. Administradores não entram no limite do plano.
[/INFO]

Para verificar o número de atendentes ativos e o limite do seu plano, acesse **Configuração → Plano**.`,
      },
    ],
  },
  {
    id:  'planos',
    title:  'Planos & Preços',
    description:  'Planos disponíveis, tokens de IA e como assinar',
    items:  [
      {
        question:  'Comparação de planos',
        answer:
`## Zaapply Start:  R$ 297/mês
• Agente SDR com IA 24/7
• Atendimento via chat
• CRM Kanban
• Métricas e relatórios
• 1 número WhatsApp

## Zaapply Growth:  R$ 497/mês
• Tudo do Start, mais:
• Google Calendar integrado
• 2 números WhatsApp`,
      },
      {
        question:  'Como assinar',
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
        question:  'Tokens de IA:  consumo e recargas',
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
    id:  'canvas',
    title:  'Canvas',
    description:  'Editor visual de fluxos: nodes, conexões e como montar automações',
    items:  [
      {
        question:  'O que é o Canvas de Automações?',
        answer:
`O Canvas é o editor visual de fluxos de automação do Zaapply. Em vez de configurar uma sequência passo a passo em uma lista, você **arrasta e conecta nodes** em uma tela infinita para construir fluxos completos com bifurcações, condições, esperas e múltiplos tipos de mensagem.

## Como acessar
Acesse **Automações → Follow-up**, selecione ou crie uma sequência e clique em **Abrir Canvas**.

## O que você pode construir
• Sequências lineares simples (Mensagem → Aguardar → Mensagem)
• Fluxos condicionais com bifurcações (lead respondeu? → caminho Sim ou Não)
• Roteamento por resposta de botão (Switch:  qual botão o lead clicou?)
• Fluxos com Teste A/B (dividir 50/50 entre duas mensagens diferentes)
• Integrações com sistemas externos via Webhook

## Interface do canvas
• **Barra lateral esquerda**: Paleta de nodes para adicionar ao fluxo
• **Tela central**: Área de arrastar, conectar e organizar os nodes
• **MiniMap**: Minimapa no canto inferior para navegar em fluxos grandes
• **Botão Salvar**: Persiste o fluxo e converte em etapas de sequência
[TIP]
Use Ctrl+Scroll para dar zoom, Ctrl+Shift+H para centralizar o fluxo, e arraste o fundo da tela para mover a visualização sem mover nodes.
[/TIP]`,
      },
      {
        question:  'Os nodes disponíveis e o que cada um faz',
        answer:
`O canvas tem 11 tipos de nodes. Cada um representa uma ação ou decisão no fluxo do lead:

## Trigger (início)
Ponto de entrada do fluxo: representa o evento que ativa a sequência. Em sequências comuns (follow-up, remarketing, etc.) há um único trigger com evento de entrada configurável:  novo lead, mudança de status ou webhook. Em sequências do tipo **Pagamento**, você pode ter múltiplos triggers: um por plataforma ou por evento. Use os botões **MP**, **KW** e **AS** na barra lateral do canvas para adicionar triggers adicionais. Cada trigger de pagamento pode ser removido individualmente, desde que reste ao menos um ativo no fluxo.

## Mensagem
Envia uma mensagem WhatsApp ao lead. O tipo de conteúdo é configurável:
• **Texto**: Mensagem escrita simples. Suporte a múltiplos blocos (sequência de textos)
• **Imagem / Vídeo / Documento**: Upload de arquivo com legenda opcional
• **Áudio**: Grava ou faz upload de áudio enviado como mensagem de voz (PTT)
• **Localização**: Envia um pin de mapa via URL do Google Maps
• **Botões**: Mensagem com até 3 botões de resposta rápida, URL ou chamada
• **Lista**: Menu de opções para o lead selecionar
• **Carrossel**: Sequência de cards com imagem, título e botão

Cada node Mensagem também controla o **Agente SDR**:  você pode pausar ou reativar o agente automaticamente ao enviar aquela mensagem.

## Aguardar
Pausa o fluxo por um número de dias antes de executar o próximo node. Configure a quantidade de dias e o horário em que o fluxo deve continuar. Usado para espaçar mensagens no tempo.

## Condição (Se/Senão)
Bifurca o fluxo em dois caminhos:  **Sim** e **Não**. A condição avalia uma variável:
• **respondeu**: Lead mandou alguma mensagem após a última automação?
• **resposta_botao**: O lead clicou em algum botão?
• **variável personalizada**: Compara qualquer variável do lead (igual a, contém, começa com, não está vazio)

A saída **Sim** segue se a condição for verdadeira; **Não** segue caso contrário.

## Switch (N saídas)
Roteamento por valor de botão: cria um caminho de saída para cada resposta possível de botão. Ideal após um node de Mensagem com botões:  cada botão clicado roteia para um caminho diferente do fluxo.

## Encerrar
Finaliza a sequência para aquele lead. Coloque no fim de cada caminho do fluxo que deve parar. Um fluxo pode ter vários nodes Encerrar (ex:  um para "convertido" e outro para "desistiu").

## Webhook
Faz uma chamada HTTP (POST ou GET) para uma URL externa quando o fluxo chega naquele ponto. Use para integrar com seu CRM, ERP, planilha do Google, Make, n8n ou qualquer outro sistema.

## Lead Score
Bifurca o fluxo baseado na pontuação do lead. Configure um intervalo mínimo e máximo de score. Leads dentro do intervalo seguem o caminho Sim; fora do intervalo, o caminho Não.

## Teste A/B
Divide o tráfego 50/50 entre duas variantes de mensagem. Leads são roteados alternadamente entre Variante A e Variante B. Use para testar qual mensagem converte mais.

## Agendar Call
Envia uma sequência de blocos de mensagem e ativa o agente de agendamento via WhatsApp. O agente oferece horários disponíveis ao lead e registra o compromisso automaticamente. Suporta múltiplos blocos de texto com delay humanizado entre eles.

**Use quando: ** Você quer que o próprio fluxo feche uma reunião sem intervenção humana: o lead recebe os horários disponíveis e confirma pelo WhatsApp.
[INFO]
O node Agendar Call requer o Google Calendar conectado em Configurações → Integrações para exibir horários disponíveis reais.
[/INFO]

## Pos-Condicao
Aguarda o lead responder ou clicar em um botão antes de disparar a próxima mensagem. Sem interação genuína do lead, o fluxo fica pausado indefinidamente neste ponto: o CRON não avança automaticamente.

**Diferença do node Condição: ** A Condição bifurca o fluxo em dois caminhos (Sim/Não) com base em uma variável. A Pós-Condição não bifurca: ela simplesmente bloqueia o avanço até o lead agir.

**Use quando: ** Você quer que a próxima mensagem só saia após o lead demonstrar interesse real. Coloque sempre na saída **"NAO"** do node Condição para evitar que o CRON dispare o caminho negativo sem o lead ter interagido.
[AVISO]
Nunca conecte Pós-Condição na saída "SIM" de uma Condição que verifica resposta de botão: nesse caso o lead já interagiu, e o node seria redundante.
[/AVISO]`,
      },
      {
        question:  'Como conectar nodes e montar um fluxo',
        answer:
`## Adicionar um node
1. Clique no botão **+ Adicionar node** (ou arraste da paleta lateral)
2. Selecione o tipo de node desejado
3. O node aparece na tela: arraste para posicioná-lo

## Conectar dois nodes
• Passe o mouse sobre um node até aparecer o **ponto de saída** (círculo na borda direita)
• Clique e arraste desse ponto até o **ponto de entrada** do próximo node (borda esquerda)
• Uma seta curva conecta os dois: esse é um "edge"

## Nodes com múltiplas saídas
• **Condição** tem dois pontos de saída:  Sim (verde) e Não (cinza)
• **Switch** tem um ponto de saída por caso configurado
• Conecte cada saída a um node diferente para criar bifurcações

## Configurar um node
• **Clique duplo** no node (ou clique simples no ícone de editar) para abrir o painel de configuração à direita
• Configure mensagem, intervalo, condição, etc.
• Feche o painel: as alterações são salvas no estado do canvas

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
    id:  'integracoes-pagamento',
    title:  'Integrações de Pagamento',
    description:  'Mercado Pago, Kiwify e Asaas: gatilhos automáticos por evento de pagamento',
    items:  [
      {
        question:  'O que são as integrações de pagamento?',
        answer:
`As integrações de pagamento conectam sua plataforma de cobrança ao Zaapply para disparar sequências automáticas no WhatsApp com base em eventos: venda confirmada, boleto gerado, pagamento vencido.

## Plataformas suportadas
• **Mercado Pago**: Dispara quando um pagamento é aprovado
• **Kiwify**: Dispara quando uma compra de infoproduto é confirmada
• **Asaas**: Dispara por 3 eventos:  pagamento confirmado, boleto gerado ou boleto vencido

## Como funciona
1. Você conecta a plataforma em **Configurações → Integrações**
2. Cria uma sequência do tipo **Pagamento** em **Automações → Follow-up**
3. Configura os gatilhos no canvas:  um trigger por plataforma ou por evento
4. Quando o evento ocorre na plataforma, o Zaapply recebe o webhook e dispara a sequência para o lead correspondente automaticamente
[INFO]
O lead é identificado pelo e-mail ou telefone cadastrado na plataforma de pagamento. Se o lead não existir no CRM, nenhuma sequência é disparada.
[/INFO]`,
      },
      {
        question:  'Conectar o Mercado Pago',
        answer:
`Acesse **Configurações → Integrações → Mercado Pago → Configurar**.

## O que você precisa
• **Access Token**: Gerado no painel do Mercado Pago em Suas integrações → Notificações → Webhooks
• **Chave Secreta do Webhook**: Gerada no mesmo painel para validação de assinatura

## Passos no painel do Mercado Pago
1. Acesse **Suas integrações → Notificações → Webhooks**
2. Clique em **Simular** ou **Criar webhook**
3. Cole a URL do webhook exibida no Zaapply
4. Copie a chave secreta gerada e cole no Zaapply
5. Salve: o Mercado Pago enviará um evento de teste

## Evento disparado
Quando um pagamento tem status **approved**, o Zaapply identifica o comprador pelo e-mail, move o lead para **Fechado** no CRM e dispara a sequência de pagamento configurada.
[TIP]
Guarde o valor da venda no campo **Valor do projeto** do lead preenchendo o campo no CRM antes da integração. Se não estiver preenchido, o Zaapply usa automaticamente o valor da transação do Mercado Pago.
[/TIP]`,
      },
      {
        question:  'Conectar o Kiwify',
        answer:
`Acesse **Configurações → Integrações → Kiwify → Configurar**.

## O que você precisa
• **Token de Verificação**: Gerado automaticamente ao criar um webhook no painel da Kiwify

## Passos no painel da Kiwify
1. Acesse **Apps → Webhooks**
2. Clique em **Criar webhook**
3. Cole a URL exibida no Zaapply no campo de URL do webhook
4. Copie o token gerado automaticamente pela Kiwify
5. Cole o token no campo do Zaapply e salve

## Evento disparado
Quando uma compra tem status **paid**, o Zaapply identifica o comprador pelo e-mail ou telefone, move o lead para **Fechado** e dispara a sequência configurada.
[INFO]
A Kiwify envia o nome do produto e o valor da comissão no webhook. O Zaapply usa esses dados para enriquecer o registro do lead automaticamente.
[/INFO]`,
      },
      {
        question:  'Conectar o Asaas',
        answer:
`Acesse **Configurações → Integrações → Asaas → Configurar**.

## O que você precisa
• **Chave de API**: Gerada em Menu → Integrações → Chaves de API no painel Asaas
• **Token do Webhook**: Configurado em Menu → Integrações → Configurar Webhook

## Passos no painel do Asaas
1. Acesse **Menu → Integrações → Chaves de API** e copie sua chave de produção (começa com \`$aact_prod_\`)
2. Acesse **Menu → Integrações → Configurar Webhook**
3. Cole a URL do webhook exibida no Zaapply
4. Defina um token de segurança (qualquer string que você escolher) e cole no Zaapply
5. Salve em ambos os lados

## Eventos suportados
O Asaas suporta 3 eventos independentes: cada um pode ter seu próprio fluxo no canvas:

• **Pagamento confirmado** (\`PAYMENT_RECEIVED\` / \`PAYMENT_CONFIRMED\`): lead comprou e pagou. Ideal para onboarding, boas-vindas e upsell
• **Boleto gerado** (\`PAYMENT_CREATED\` com tipo BOLETO): boleto foi emitido. Ideal para lembrete de pagamento e instruções
• **Boleto vencido** (\`PAYMENT_OVERDUE\`): boleto não foi pago no prazo. Ideal para sequência de recuperação de cobrança
[TIP]
Use uma chave de API de **sandbox** (\`$aact_hmlg_...\`) para testar sem afetar clientes reais. O Zaapply detecta automaticamente o ambiente pela chave.
[/TIP]`,
      },
      {
        question:  'Criar uma sequência de pagamento no canvas com multi-trigger',
        answer:
`Uma sequência de pagamento pode ter **múltiplos triggers**: um por plataforma ou por evento. Isso permite que o mesmo fluxo seja ativado por eventos diferentes sem duplicar a sequência.

## Passo a passo

1. Acesse **Automações → Follow-up → + Nova Sequência**
2. Nomeie a sequência e selecione o tipo **Pagamento**
3. Clique em **Abrir Canvas**
4. O canvas abre com um trigger padrão: clique nele e configure a **plataforma** (MP, Kiwify ou Asaas) e, no caso do Asaas, o **evento** (confirmado, boleto gerado ou vencido)
5. Para adicionar mais triggers, use os botões na barra lateral direita:
   - **MP** → trigger Mercado Pago
   - **KW** → trigger Kiwify
   - **AS** → trigger Asaas
6. Configure cada trigger com a plataforma e evento correspondente
7. Conecte todos os triggers ao mesmo fluxo de nodes
8. Clique em **Salvar**

## Exemplo:  fluxo de cobrança com Asaas
• Trigger 1: Asaas → Boleto gerado → "Seu boleto está disponível, clique aqui para pagar"
• Trigger 2: Asaas → Boleto vencido → "Seu boleto venceu, posso te ajudar a regularizar?"
• Trigger 3: Asaas → Pagamento confirmado → "Pagamento confirmado! Bem-vindo ao [produto]"
[INFO]
O URL de webhook para receber eventos fica disponível no painel de configuração de cada trigger, direto no canvas. Copie e cole no painel da plataforma correspondente.
[/INFO]
[AVISO]
Remover um trigger no canvas não desativa o webhook na plataforma. Acesse o painel da plataforma e remova ou atualize o webhook manualmente se não quiser mais receber aquele evento.
[/AVISO]`,
      },
    ],
  },
  {
    id:  'problemas',
    title:  'Problemas comuns',
    description:  'Soluções para os problemas mais frequentes:  WhatsApp, agente IA, mensagens e acesso',
    items:  [
      {
        question:  'WhatsApp não conecta ou desconecta',
        answer:
`## QR Code não funciona
• Verifique se o celular tem conexão com a internet durante o escaneamento
• Feche e reabra o WhatsApp antes de escanear
• O QR expira em 60 segundos: clique em **Atualizar** se expirar
• Confirme que o número não está conectado a outro serviço ou dispositivo simultaneamente

## WhatsApp desconecta sozinho
• Acontece quando o celular fica sem internet por tempo prolongado
• Reconecte pelo mesmo fluxo de QR Code
• O webhook é reconfigurado automaticamente após reconexão: não é necessário configurar novamente`,
      },
      {
        question:  'Agente IA não responde',
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
        question:  'Mensagens não aparecem no chat',
        answer:
`## Mensagens não chegam
• Verifique se o WhatsApp está conectado (status no topo do Atendimento)
• Tente **Ctrl+Shift+R** para forçar o recarregamento completo da página
• Verifique se a conversa está na tab correta:  Minhas / Livres / Todas

## Conversa sumiu
• A conversa pode ter mudado de tab: verifique em "Todas"
• Busque pelo nome ou número do contato na barra de busca da lista de conversas
• Se foi atribuída a outro atendente, aparece em "Todas" mas não em "Minhas"`,
      },
      {
        question:  'Performance lenta',
        answer:
`• **Primeiro acesso do dia**: O servidor pode levar alguns segundos para inicializar. Aguarde e recarregue a página
• **CRM com muitos leads**: Use filtros para reduzir o conjunto exibido; evite carregar todos os leads sem filtro
• **Conexão instável**: O sistema precisa de conexão estável para atualização em tempo real
• **Limpar cache**: Ctrl+Shift+R no Windows/Linux ou Cmd+Shift+R no Mac`,
      },
      {
        question:  'Recuperar senha e alterar dados',
        answer:
`## Recuperar senha
1. Na tela de login, clique em **Esqueci minha senha**
2. Digite o e-mail cadastrado
3. Verifique a caixa de entrada (e a pasta de spam)
4. Clique no link de recuperação: ele expira em 24 horas

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
