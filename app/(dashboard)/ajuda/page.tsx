'use client';

import { useState, useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Users,
  MapPin,
  MessageSquare,
  UserPlus,
  Columns3,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Megaphone,
  FileText,
  type LucideIcon,
} from 'lucide-react';

interface HelpItem {
  question: string;
  answer: string;
}

interface HelpSection {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  items: HelpItem[];
}

const sections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral do seu CRM',
    items: [
      {
        question: 'O que é o Dashboard?',
        answer:
          'O Dashboard é sua página inicial com um resumo em tempo real do seu CRM:\n\n• **Total de leads** cadastrados na base\n• **Leads por estágio** do funil (Lead novo, Em contato, Interessado, etc.)\n• **Conversões recentes** — leads que fecharam\n• **Valor total do pipeline** — soma dos valores de projeto\n• **Gráfico do funil** — visualização da distribuição por estágio\n• **Atividades recentes** — últimas movimentações no CRM',
      },
      {
        question: 'Como interpretar as métricas?',
        answer:
          'Cada card do Dashboard mostra uma métrica importante:\n\n• **Leads Ativos** — Total de leads que não estão em "Fechado" ou "Perdido"\n• **Taxa de Conversão** — Percentual de leads que chegaram a "Fechado"\n• **Valor do Pipeline** — Soma de todos os valores de projeto ativos\n• **Leads por Origem** — De onde seus leads estão vindo (PEG, LinkedIn, Meta Ads, etc.)\n\nUse essas métricas para identificar gargalos e otimizar seu funil de vendas.',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: Users,
    description: 'Gestão de leads e oportunidades',
    items: [
      {
        question: 'Como cadastrar um novo lead?',
        answer:
          'O cadastro é feito em 3 etapas simples:\n\n**Etapa 1 — Empresa:**\n1. Clique em **+ Adicionar Lead** no topo da página\n2. Preencha o **Nome da Empresa** (obrigatório)\n3. Selecione o **Segmento** (E-commerce, Saúde, Educação, Tecnologia, etc.)\n4. Adicione o site ou Instagram (opcional)\n\n**Etapa 2 — Contato:**\n5. Nome do contato, WhatsApp e e-mail\n\n**Etapa 3 — Detalhes:**\n6. Prioridade (Alta, Média, Baixa)\n7. Nível de interesse (Quente, Morno, Frio)\n8. Fonte de importação (PEG, LinkedIn, Meta Ads, Google Ads, etc.)\n9. Valor do projeto em R$\n10. Observações\n\nO lead será criado automaticamente no estágio **Lead novo**.',
      },
      {
        question: 'Quais são os estágios do funil?',
        answer:
          'O funil possui 7 estágios:\n\n• **Lead novo** — Acabou de entrar na base\n• **Em contato** — Primeiro contato foi realizado\n• **Interessado** — Demonstrou interesse no produto/serviço\n• **Proposta enviada** — Recebeu orçamento ou proposta comercial\n• **Fechado** — Venda concluída com sucesso\n• **Perdido** — Não converteu\n• **Remarketing** — Para reativar no futuro\n\n**Como mover leads:**\n• No **Kanban**: arraste e solte o card entre as colunas\n• No **Mobile**: use o seletor de status dentro do card\n• A mudança é salva automaticamente no banco de dados',
      },
      {
        question: 'Como alternar entre Planilha e Kanban?',
        answer:
          'No menu lateral, dentro de **CRM**, você tem dois sub-itens:\n\n• **Planilha** — Visualização em tabela com todas as colunas. Ideal para:\n   • Ver muitos leads de uma vez\n   • Selecionar múltiplos leads (checkbox)\n   • Deletar em massa\n   • Exportar para CSV\n   • Paginação com 9 leads por página\n\n• **Kanban** — Visualização em quadros por estágio. Ideal para:\n   • Arrastar leads entre estágios (drag & drop)\n   • Ver o valor total por coluna\n   • Visão rápida do pipeline\n   • Contagem de leads por estágio',
      },
      {
        question: 'Como editar ou deletar um lead?',
        answer:
          '**Editar:**\n• No Kanban: passe o mouse sobre o card e clique no ícone de lápis\n• Na Planilha: clique no ícone de lápis na coluna "Ações"\n• O formulário de 3 etapas abrirá com os dados preenchidos\n\n**Deletar individual:**\n• Clique no ícone de lixeira no card ou na tabela\n• Confirme na caixa de diálogo\n\n**Deletar em massa (só na Planilha):**\n1. Marque os checkboxes dos leads que deseja deletar\n2. Clique no botão **Deletar X selecionado(s)**\n3. Confirme a exclusão\n\n**Atenção:** A exclusão é permanente e não pode ser desfeita.',
      },
      {
        question: 'Como exportar leads para CSV?',
        answer:
          'Na página do CRM, clique no botão **Exportar CSV** no topo.\n\nO arquivo exportado inclui:\n• Nome da Empresa e Nome do Contato\n• Segmento e Status\n• Website/Instagram\n• WhatsApp e E-mail\n• Prioridade e Nível de Interesse\n• Valor do Projeto\n• Fonte de Importação\n• Observações\n• Data de Criação\n\nOs filtros ativos (busca, status, prioridade) são respeitados na exportação. Se você filtrou por "Alta prioridade", só esses leads serão exportados.',
      },
      {
        question: 'Como usar os filtros?',
        answer:
          'No topo da página do CRM você tem 3 filtros:\n\n• **Busca** — Pesquise por nome da empresa, nome do contato ou e-mail\n• **Status** — Filtre por estágio do funil (Lead novo, Em contato, Interessado, etc.)\n• **Prioridade** — Filtre por Alta, Média ou Baixa\n\nVocê pode combinar os filtros. Por exemplo: buscar "Tecnologia" + Status "Interessado" + Prioridade "Alta".\n\nClique em **Limpar** para remover todos os filtros de uma vez.',
      },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: MessageSquare,
    description: 'Chat WhatsApp integrado com SDR por IA',
    items: [
      {
        question: 'O que é o módulo de Atendimento?',
        answer:
          'O Atendimento é um **chat espelhado do WhatsApp** dentro do CRM, voltado 100% para **conversão de leads**.\n\nEle funciona com um **SDR virtual (IA)** que conversa com seus leads automaticamente pelo WhatsApp, coletando informações, identificando dores, quebrando objeções e qualificando o lead para a equipe comercial.\n\n**O que você vê na tela:**\n• **Painel esquerdo** — Lista de todas as conversas do WhatsApp\n• **Painel central** — Chat em tempo real (mensagens da IA e do lead)\n• **Painel direito** — Informações do lead, resumo IA, notas, tags, mídia e agenda',
      },
      {
        question: 'Como funciona o SDR por IA?',
        answer:
          'O SDR (Sales Development Representative) é uma **IA que conversa pelo WhatsApp** como se fosse um vendedor real.\n\n**O que ele faz automaticamente:**\n• Responde mensagens dos leads em tempo real\n• Faz perguntas estratégicas para qualificar o lead\n• Coleta informações: nome, empresa, cargo, necessidades\n• Identifica **dores e objeções** do lead\n• Apresenta seus produtos/serviços\n• Tenta agendar reuniões ou fechar vendas\n\n**Resumo do Lead (o ouro):**\n• O SDR gera automaticamente um **resumo completo** do lead\n• Inclui: informações coletadas, dores identificadas, objeções levantadas, nível de interesse\n• Esse resumo fica disponível na aba lateral do chat\n• Você pode copiar o resumo e compartilhar com a equipe\n\nAs mensagens enviadas pela IA aparecem com o ícone de **robô** e a tag **"IA"** no chat.',
      },
      {
        question: 'Como interromper o SDR e enviar mensagem manualmente?',
        answer:
          'Você pode **assumir a conversa** a qualquer momento:\n\n1. Abra a conversa no Atendimento\n2. Digite sua mensagem na caixa de texto na parte inferior\n3. Clique em **Enviar** ou pressione **Enter**\n\nSua mensagem será enviada como **humano** (aparece com ícone de pessoa no chat, sem a tag "IA").\n\n**Para atribuir/transferir o chat:**\n• Clique no botão **Atribuir** no topo do chat\n• Selecione o membro da equipe que vai assumir\n• Adicione uma nota explicando o motivo (opcional)\n• O chat mostrará o badge "Atribuído" na lista\n\nIsso é útil quando o lead precisa de atendimento humano personalizado ou quando a IA não consegue resolver uma objeção específica.',
      },
      {
        question: 'Que tipos de mídia posso enviar?',
        answer:
          'Você pode enviar 5 tipos de mídia pelo chat:\n\n• **Texto** — Mensagens de texto normais. Use Shift+Enter para quebrar linha.\n\n• **Imagens** — Fotos e prints. Aceita qualquer formato de imagem. Você pode adicionar uma legenda antes de enviar.\n\n• **Áudios** — Grave áudios direto pelo sistema. Clique no microfone, grave, pause se precisar, ouça antes de enviar e confirme. O áudio aparece com um player de ondas sonoras.\n\n• **Vídeos** — Envie vídeos curtos. Aparece com player de reprodução no chat.\n\n• **Documentos** — PDFs, Word, Excel, TXT. Ideal para enviar propostas, contratos e orçamentos. O documento fica disponível para download.\n\nTodos os arquivos são salvos de forma segura e ficam disponíveis na aba **Mídia** do painel lateral.',
      },
      {
        question: 'Como gravar e enviar áudios?',
        answer:
          'Para gravar um áudio:\n\n1. Clique no ícone de **microfone** ao lado da caixa de texto\n2. A gravação inicia automaticamente com um timer\n3. Você pode **pausar** e **retomar** a gravação\n4. Ao finalizar, **ouça o áudio** antes de enviar\n5. Clique em **Enviar** para mandar ou no **X** para descartar\n\nNo chat, o áudio aparece com um **player visual com ondas sonoras**, botão play/pause e a duração total.',
      },
      {
        question: 'O que é o Resumo do Lead?',
        answer:
          'O Resumo do Lead é o **recurso mais valioso** do Atendimento.\n\nÉ um texto gerado automaticamente pela IA com tudo que foi coletado durante a conversa:\n\n• **Informações do contato** — Nome, empresa, cargo, segmento\n• **Necessidades identificadas** — O que o lead precisa\n• **Dores e problemas** — Quais são as frustrações do lead\n• **Objeções levantadas** — Preço, prazo, concorrência, etc.\n• **Nível de interesse** — Quente, morno ou frio\n• **Próximos passos** — O que foi combinado\n\n**Onde ver o resumo:**\n• No painel lateral direito do chat, seção **"nexio.ai resumo"**\n• O resumo tem um badge **"IA"** e a nota **"Gerado automaticamente"**\n• Você pode **copiar** o resumo com um clique\n\nEsse resumo permite que qualquer vendedor da equipe pegue a conversa e saiba exatamente onde parou, sem precisar ler todas as mensagens.',
      },
      {
        question: 'Como usar Respostas Rápidas (Templates)?',
        answer:
          'Templates aceleram o atendimento com mensagens pré-prontas.\n\n**Para usar durante uma conversa:**\n• Digite **/** na caixa de texto\n• Uma lista de templates aparece filtrada pelo que você digitar\n• Use as setas **↑↓** para navegar e **Enter** para selecionar\n• O template é inserido automaticamente\n\n**Variáveis dinâmicas disponíveis:**\n• **{{nome}}** — Nome do contato\n• **{{empresa}}** — Nome da empresa do lead\n• **{{telefone}}** — Telefone do lead\n• **{{usuario}}** — Seu nome\n• **{{minha_empresa}}** — Nome da sua empresa\n\n**Categorias de templates:**\n• Saudação, Follow-up, Preço, Agendamento, Encerramento, Geral\n\n**Criar templates:**\n• Acesse o gerenciador de templates dentro do Atendimento\n• Defina: nome, atalho (ex: /ola), categoria e conteúdo',
      },
      {
        question: 'Como agendar mensagens?',
        answer:
          'Você pode programar mensagens para serem enviadas em um horário específico:\n\n1. Clique no ícone de **calendário** no topo do chat\n2. Selecione a **data** e o **horário** de envio\n3. Digite a **mensagem** que será enviada\n4. Confirme o agendamento\n\n**Regras:**\n• A data/hora deve ser no futuro\n• O sistema avisa se o horário for fora do comercial (8h-18h)\n• Você pode confirmar mesmo fora do horário comercial\n\n**Gerenciar agendamentos:**\n• Na aba **Agenda** do painel lateral, veja todas as mensagens programadas\n• Cada agendamento mostra: data, tipo (texto ou mídia), preview e quem agendou\n• Você pode **cancelar** agendamentos pendentes',
      },
      {
        question: 'Como usar Tags nas conversas?',
        answer:
          'Tags ajudam a organizar e categorizar seus leads visualmente.\n\n**Na aba Tags do painel lateral:**\n• Veja as tags já atribuídas ao lead\n• Clique em **+** para adicionar uma tag existente\n• Clique em **X** para remover uma tag\n• Crie novas tags com nome e cor personalizada\n\n**16 cores disponíveis** incluindo vermelho, verde, azul, roxo Nexio, rosa, entre outras.\n\nAs tags aparecem na lista de conversas para identificação visual rápida. Por exemplo: "VIP" em verde para clientes prioritários.',
      },
      {
        question: 'Onde vejo as mídias enviadas e recebidas?',
        answer:
          'Na aba **Mídia** do painel lateral direito, você encontra uma galeria com todos os arquivos trocados na conversa.\n\n**Filtros disponíveis:**\n• **Todas** — Todos os tipos de mídia\n• **Imagens** — Fotos e prints (com preview e lightbox)\n• **Vídeos** — Vídeos enviados e recebidos\n• **Áudio** — Áudios gravados\n• **Documentos** — PDFs, Word, Excel, etc.\n\nCada item tem botão de **download** e as imagens podem ser ampliadas em tela cheia.',
      },
    ],
  },
  {
    id: 'captacao',
    title: 'Orbit (Captação)',
    icon: MapPin,
    description: 'Prospecção e extração de leads',
    items: [
      {
        question: 'O que é o Orbit?',
        answer:
          'O Orbit é a ferramenta de **captação e extração de leads** do Nexio. Disponível apenas nos planos **NEXIO GROWTH** e **NEXIO ADS**.\n\nCom ele você pode buscar empresas por localização e segmento, e importar diretamente para o seu CRM.\n\nSe você está no plano **NEXIO SALES**, o menu Orbit não aparece no sistema.',
      },
      {
        question: 'Qual a diferença entre os planos?',
        answer:
          '**NEXIO SALES** — R$ 1.600/mês\n• CRM completo com Planilha e Kanban\n• Chat WhatsApp com SDR por IA\n• Funil de vendas e Dashboard\n• Sem acesso ao Orbit (captação/extração)\n\n**NEXIO GROWTH** — R$ 2.000/mês\n• Tudo do Sales + acesso ao Orbit\n• 500 leads inclusos por mês\n• Busca por localização e segmento\n• Leads extras: R$ 1/lead ou R$ 400 por pacote de +500\n\n**NEXIO ADS** — R$ 2.600/mês\n• Tudo do Growth + Gestão de Tráfego Pago\n• Campanhas Google Ads e Meta Ads integradas\n• Otimização automática e relatórios de ROI',
      },
    ],
  },
  {
    id: 'membros',
    title: 'Membros',
    icon: UserPlus,
    description: 'Gerenciar equipe e permissões',
    items: [
      {
        question: 'Como adicionar membros à equipe?',
        answer:
          'Apenas administradores podem adicionar novos membros.\n\n1. Acesse **Membros** no menu lateral\n2. Clique em **+ Novo Membro**\n3. Preencha nome completo e e-mail corporativo\n4. Defina a função e permissões\n5. Clique em **Enviar Convite**\n\nO novo membro receberá um e-mail com instruções para criar sua senha e acessar o sistema.',
      },
      {
        question: 'Quais são os níveis de permissão?',
        answer:
          'Existem 3 níveis de permissão:\n\n**Vendedor** — Acessa o CRM, vê e edita seus leads, usa o chat de Atendimento, move leads no funil. Ideal para vendedores e SDRs.\n\n**Gerente** — Tudo do Vendedor + vê leads de toda a equipe, acessa relatórios completos, pode atribuir leads entre vendedores.\n\n**Administrador** — Acesso total. Gerencia membros, configura integrações (WhatsApp, IA), acessa painel Admin, configura planos e dados da empresa.',
      },
      {
        question: 'Como atribuir conversas para membros da equipe?',
        answer:
          'No módulo de Atendimento, cada conversa pode ser atribuída a um membro:\n\n1. Abra a conversa no chat\n2. Clique no botão **Atribuir** no topo\n3. Selecione o membro da equipe (veja quantos chats ativos cada um tem)\n4. Adicione uma nota explicando o motivo (opcional)\n5. Confirme a atribuição\n\nO chat mostrará o badge **"Atribuído"** na lista de conversas. Para transferir para outro membro, clique em **Transferir** e selecione o novo responsável.',
      },
    ],
  },
  {
    id: 'kanban',
    title: 'Kanban',
    icon: Columns3,
    description: 'Visualização em quadros do funil',
    items: [
      {
        question: 'Como usar o Kanban?',
        answer:
          'O Kanban mostra seus leads organizados em colunas por estágio do funil.\n\n**Cada coluna mostra:**\n• Nome do estágio com ícone\n• Contador de leads\n• Valor total em R$ dos leads naquele estágio\n\n**Cada card mostra:**\n• Iniciais da empresa\n• Nome da empresa e contato\n• Tags de prioridade (Alta, Média, Baixa)\n• Nível de interesse (Quente, Morno, Frio)\n• Segmento\n• Telefone e valor do projeto\n• Data de criação\n\n**Para mover um lead:**\n• Clique e segure o card\n• Arraste para a coluna do novo estágio\n• Solte — a mudança é salva automaticamente\n• Um toast confirma: "Lead movido para [estágio]"',
      },
      {
        question: 'Como funciona no celular?',
        answer:
          'No celular o Kanban se adapta para uma **lista vertical** em vez de colunas horizontais.\n\n**Cada card no mobile mostra:**\n• Nome da empresa e contato\n• Telefone e valor do projeto\n• **Seletor de status** — um dropdown para mudar o estágio diretamente\n• Prioridade e nível de interesse\n• Segmento\n• Botões de editar e deletar\n\nComo não dá pra arrastar no celular, o seletor de status substitui o drag & drop. A mudança é salva automaticamente ao selecionar o novo estágio.',
      },
    ],
  },
  {
    id: 'outbound',
    title: 'Outbound',
    icon: Megaphone,
    description: 'Campanhas, templates e limites de disparo',
    items: [
      {
        question: 'O que é o módulo Outbound?',
        answer:
          'O Outbound é o módulo de **campanhas de mensagens em massa** via WhatsApp. Com ele você pode:\n\n• **Campanhas** — Visualize todas as campanhas disparadas, veja status (enviado, respondido, erro), expanda cada campanha para ver os erros detalhados com paginação\n• **Templates** — Gerencie os templates de mensagem usados nas campanhas. Templates globais (disponíveis para todas as empresas) e templates da sua empresa\n• **Configurações** — Defina o limite diário de disparos para proteger sua conta WhatsApp de banimentos\n\nAcesse pelo menu lateral em **Ferramentas → Outbound**.',
      },
      {
        question: 'Como visualizar campanhas e erros?',
        answer:
          'Na aba **Campanhas**:\n\n**Cards de campanha:**\n• Nome/ID da campanha\n• Status: Ativa, Pausada, Concluída\n• Total enviadas, respondidas e erros\n• Data de criação\n\n**Expandir campanha:**\n• Clique em **Ver Erros** para ver os detalhes de falhas\n• Os erros são exibidos em páginas de 6 itens com botões Anterior/Próximo\n• Cada erro mostra: ID do lead, mensagem de erro e data/hora\n\n**Paginação de campanhas:**\n• Máximo de 6 campanhas por página\n• Use os botões **Anterior** e **Próximo** para navegar',
      },
      {
        question: 'Como gerenciar templates?',
        answer:
          'Na aba **Templates** você vê todos os templates disponíveis:\n\n• **Templates globais** (sem empresa vinculada) — disponíveis para todas as contas\n• **Templates da empresa** — exclusivos da sua conta\n\n**Cada template exibe:**\n• Nome e categoria\n• Preview do conteúdo\n• Botão de copiar conteúdo\n• Ações de editar e deletar (apenas templates da empresa)\n\nTemplates são criados e gerenciados pelo time Nexio ou admin da conta.',
      },
      {
        question: 'Como configurar o limite diário de disparos?',
        answer:
          'Na aba **Configurações**, você encontra dois cards:\n\n**Limite de Disparos:**\n• Define o número máximo de mensagens enviadas por dia\n• Recomendado: comece com valores baixos (50-100/dia) e aumente gradualmente\n• Muitos disparos de uma vez podem acionar proteção do WhatsApp\n• Clique em **Salvar limite** para aplicar\n\n**Boas Práticas:**\n• Respeite os limites do WhatsApp Business\n• Use intervalos entre disparos\n• Monitore a taxa de erros nas campanhas\n• Se a taxa de erro for alta, reduza o limite diário',
      },
      {
        question: 'Por que o Orbit.AI só opera de segunda a sexta, das 9h às 18h?',
        answer:
          'O Orbit.AI foi configurado para operar exclusivamente em **horário comercial: segunda a sexta, das 9h às 18h** (horário de Brasília/Bahia). Fora desse período, o sistema entra em repouso automaticamente e retoma as operações no próximo horário disponível.\n\n**Por que essa configuração?**\n\nContatos realizados fora do horário comercial tendem a gerar **experiências negativas para o lead** — ninguém quer receber uma abordagem comercial à noite, de madrugada ou no fim de semana. Além disso, essa prática vai contra as **boas práticas de outbound** e pode comprometer a reputação do número, aumentando o risco de bloqueios e denúncias.\n\n**Os benefícios são claros:**\n• ✅ Abordagens mais assertivas e bem recebidas\n• ✅ Taxas de resposta mais altas\n• ✅ Experiência mais profissional para o prospectado\n• ✅ Menor risco de bloqueio ou denúncia do número\n• ✅ Alinhamento com as boas práticas de prospecção ativa\n\nAo respeitar o horário comercial, garantimos que cada contato seja feito no momento certo — quando o lead está disponível, receptivo e mais propenso a responder positivamente.',
      },
    ],
  },
  {
    id: 'briefing',
    title: 'Briefing',
    icon: FileText,
    description: 'Formulário de briefing personalizado da sua empresa',
    items: [
      {
        question: 'O que é o Briefing?',
        answer:
          'O Briefing é um **formulário público personalizado** exclusivo da sua empresa, acessível por uma URL única.\n\nCom ele você coleta informações importantes de potenciais clientes antes de uma reunião ou proposta.\n\n**O que você pode configurar:**\n• URL própria no formato `nexio.ai/briefing/sua-empresa`\n• Cor primária e logo da empresa (branding)\n• Título e descrição do formulário\n• Perguntas totalmente customizadas\n• Webhook para receber respostas em tempo real\n\nO menu **Briefing** aparece no sidebar apenas se o admin ativar o briefing para sua empresa.',
      },
      {
        question: 'Como acessar e configurar o Briefing?',
        answer:
          'Acesse **Briefing** no menu lateral (seção Gestão).\n\nA página tem 3 abas:\n\n**Aba Respostas:**\n• Lista todas as respostas recebidas\n• Clique em **Ver** para ver os detalhes de uma resposta\n• Clique em **PDF** para baixar a resposta em PDF\n• Botão de lixeira para remover respostas\n\n**Aba Formulário:**\n• Adicione, edite e remova perguntas\n• Tipos de pergunta: texto curto, texto longo, seleção única, múltiplas escolhas, radio, checkbox\n• Defina se a pergunta é obrigatória\n\n**Aba Configurações:**\n• Ative/desative o briefing\n• Configure slug (parte da URL)\n• Escolha tema (claro/escuro)\n• Personalize cor primária e logo',
      },
      {
        question: 'Como compartilhar o link do Briefing?',
        answer:
          'No topo da página de Briefing, quando há um slug configurado, aparece a **URL do seu briefing**.\n\n• Clique no ícone de **copiar** para copiar o link\n• Clique no ícone de **link externo** para abrir em nova aba e visualizar o formulário\n\nO formulário público é **acessível sem login** — qualquer pessoa com o link pode preencher.\n\nCompartilhe via WhatsApp, e-mail, proposta comercial ou assinatura de e-mail.',
      },
      {
        question: 'Como baixar respostas em PDF?',
        answer:
          'Na aba **Respostas**, cada resposta tem um botão **PDF**.\n\nO PDF gerado inclui:\n• Logo e nome da empresa (branding)\n• Título e data do preenchimento\n• Todas as perguntas e respostas formatadas\n\nO download é feito direto no navegador, sem precisar de nenhuma configuração adicional.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Dúvidas Frequentes',
    icon: HelpCircle,
    description: 'Perguntas comuns e soluções',
    items: [
      {
        question: 'O sistema está lento, o que fazer?',
        answer:
          'Se o sistema estiver demorando para carregar:\n\n• **Primeira vez do dia** — O primeiro acesso pode demorar alguns segundos enquanto o servidor "acorda". Depois disso, fica rápido.\n• **CRM com muitos leads** — O sistema carrega até 100 leads por vez. Use os filtros para encontrar leads específicos.\n• **Conexão lenta** — Verifique sua internet. O sistema precisa de conexão estável para funcionar.\n• **Limpar cache** — Pressione Ctrl+Shift+R para forçar atualização.',
      },
      {
        question: 'Não estou recebendo mensagens do WhatsApp no chat',
        answer:
          'Verifique os seguintes pontos:\n\n1. A integração do WhatsApp está configurada? (Configurações > WhatsApp)\n2. O número do WhatsApp está correto nas configurações?\n3. A instância do UAZapi está ativa e conectada?\n4. O webhook está configurado corretamente?\n\nSe tudo estiver correto e ainda não funcionar, entre em contato com o suporte: **suporte@nexio.ai**',
      },
      {
        question: 'Como alterar os dados da minha empresa?',
        answer:
          'Apenas administradores podem alterar dados da empresa.\n\n1. Acesse **Configurações** no menu lateral\n2. Edite os campos: nome da empresa, e-mail, logo, etc.\n3. Salve as alterações\n\nSe você não é admin, peça para o administrador da conta fazer as alterações.',
      },
      {
        question: 'Perdi minha senha, como recuperar?',
        answer:
          'Na tela de login:\n\n1. Clique em **Esqueci minha senha**\n2. Digite seu e-mail cadastrado\n3. Verifique sua caixa de entrada (e spam)\n4. Clique no link de recuperação\n5. Defina uma nova senha\n\nO link expira em 24 horas. Se não receber o e-mail, verifique se está usando o mesmo e-mail cadastrado no sistema.',
      },
    ],
  },
];

function FormatText({ text }: { text: string }) {
  const elements = useMemo(() => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        result.push(<div key={i} className="h-3" />);
        continue;
      }

      // Parse inline bold
      const renderInline = (str: string) => {
        const parts = str.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="text-foreground font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        });
      };

      // Numbered items: "1. Text here"
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        result.push(
          <div key={i} className="flex gap-3 mt-1.5 ml-1">
            <span className="text-primary/70 font-mono text-xs mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
            <span className="text-muted-foreground">{renderInline(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Bullet points: "• Text here"
      if (trimmed.startsWith('•')) {
        const indent = line.search(/\S/);
        const content = trimmed.slice(1).trim();
        result.push(
          <div key={i} className={cn('flex gap-2.5 mt-1', indent > 2 ? 'ml-7' : 'ml-1')}>
            <span className="text-primary/50 mt-1.5 text-[6px]">●</span>
            <span className="text-muted-foreground">{renderInline(content)}</span>
          </div>
        );
        continue;
      }

      // Sub-items: "- Text" or "  - Text"
      if (/^\s*-\s/.test(line)) {
        const content = trimmed.slice(1).trim();
        result.push(
          <div key={i} className="flex gap-2.5 ml-7 mt-0.5">
            <span className="text-muted-foreground/50">–</span>
            <span className="text-muted-foreground">{renderInline(content)}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph
      result.push(
        <p key={i} className="text-muted-foreground mt-1.5 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      );
    }

    return result;
  }, [text]);

  return <>{elements}</>;
}

export default function AjudaPage() {
  const [activeId, setActiveId] = useState(sections[0].id);

  const activeSection = sections.find((s) => s.id === activeId) || sections[0];
  const activeIdx = sections.findIndex((s) => s.id === activeId);
  const ActiveIcon = activeSection.icon;

  return (
    <div className="flex -m-3 md:-m-6 min-h-[calc(100vh-80px)]">
      {/* Conteúdo principal */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-8 md:py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Docs</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{activeSection.title}</span>
          </nav>

          {/* Título da seção */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <ActiveIcon className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">{activeSection.title}</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-8">{activeSection.description}</p>
          </div>

          <Separator className="mb-10" />

          {/* Perguntas e respostas */}
          <div className="space-y-12">
            {activeSection.items.map((item, index) => (
              <article key={index}>
                <h2 className="text-base font-semibold mb-4 text-foreground">
                  {item.question}
                </h2>
                <div className="text-sm leading-relaxed">
                  <FormatText text={item.answer} />
                </div>
                {index < activeSection.items.length - 1 && (
                  <Separator className="mt-12" />
                )}
              </article>
            ))}
          </div>

          {/* Navegação entre seções */}
          <div className="mt-16 pt-8 border-t border-border/30 flex justify-between">
            {activeIdx > 0 ? (
              <button
                onClick={() => setActiveId(sections[activeIdx - 1].id)}
                className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                {sections[activeIdx - 1].title}
              </button>
            ) : (
              <div />
            )}
            {activeIdx < sections.length - 1 ? (
              <button
                onClick={() => setActiveId(sections[activeIdx + 1].id)}
                className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {sections[activeIdx + 1].title}
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents — direita, fixo */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-0 h-[calc(100vh-80px)] py-8 pr-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-3">
            Nesta página
          </p>
          <nav className="space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] rounded-md transition-colors text-left',
                    isActive
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive && 'text-primary')} />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 pl-3">
            <Separator className="mb-6" />
            <p className="text-xs text-muted-foreground">
              Precisa de ajuda?{' '}
              <span className="text-primary font-medium">suporte@nexio.ai</span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
