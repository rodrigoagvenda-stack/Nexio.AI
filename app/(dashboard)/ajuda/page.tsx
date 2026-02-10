'use client';

import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Users,
  MapPin,
  MessageSquare,
  UserPlus,
  HelpCircle,
  Columns3,
  Keyboard,
  ChevronRight,
  BookOpen,
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
          'O Dashboard é sua página inicial, onde você encontra um resumo das principais métricas do seu CRM:\n\n• Total de leads cadastrados\n• Conversões recentes\n• Atendimentos em andamento\n• Próximas tarefas e compromissos\n• Gráficos de desempenho e funil de vendas',
      },
      {
        question: 'Como usar os gráficos e métricas?',
        answer:
          'Os gráficos mostram a evolução do seu funil de vendas ao longo do tempo. Você pode:\n\n• Filtrar por período (semanal, mensal, anual)\n• Analisar taxa de conversão por estágio\n• Acompanhar performance da equipe\n• Identificar gargalos no funil\n• Exportar relatórios em PDF',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: Users,
    description: 'Gestão de leads e clientes',
    items: [
      {
        question: 'Como cadastrar um novo lead?',
        answer:
          '1. Acesse "CRM" no menu lateral\n2. Clique no botão "+ Novo Lead" no topo da página\n3. Preencha as informações obrigatórias:\n   • Nome completo\n   • E-mail\n   • Telefone/WhatsApp\n   • Empresa (opcional)\n   • Origem do lead\n4. Adicione informações complementares como cargo, site, redes sociais\n5. Clique em "Salvar Lead"\n\nO lead será automaticamente adicionado ao estágio "Novo Lead" do funil.',
      },
      {
        question: 'Como organizar leads no funil de vendas?',
        answer:
          'O funil é organizado em estágios sequenciais:\n\n1. **Novo Lead**: Primeiro contato realizado\n2. **Qualificado**: Lead com potencial confirmado (BANT)\n3. **Reunião Agendada**: Primeira reunião marcada\n4. **Proposta Enviada**: Orçamento ou proposta comercial enviada\n5. **Negociação**: Em processo de fechamento e ajustes\n6. **Ganho**: Venda concluída com sucesso\n7. **Perdido**: Não converteu (arquivado)\n\n**Como mover leads:**\n• Arraste e solte os cards entre os estágios (drag & drop)\n• Ou clique no lead > "Alterar Estágio" > Selecione o novo estágio',
      },
      {
        question: 'Como alternar entre visualização Tabela e Kanban?',
        answer:
          'No topo da página CRM você encontra dois botões:\n\n• **Tabela**: Visualização em lista com todas as informações em colunas. Ideal para:\n  - Análise detalhada de dados\n  - Ordenação por qualquer coluna\n  - Exportação de dados\n  - Filtros avançados\n\n• **Kanban**: Visualização em quadros por estágio. Ideal para:\n  - Movimentação rápida de leads\n  - Visão visual do pipeline\n  - Gestão ágil do funil\n  - Identificar gargalos',
      },
      {
        question: 'Como editar informações de um lead?',
        answer:
          'Clique no card do lead (em qualquer visualização) para abrir a página de detalhes. Lá você pode:\n\n• **Editar Dados Pessoais**: Nome, e-mail, telefone, cargo\n• **Informações da Empresa**: Nome, CNPJ, site, faturamento\n• **Adicionar Notas**: Observações sobre reuniões e conversas\n• **Registrar Interações**: Ligações, e-mails, reuniões\n• **Anexar Arquivos**: Propostas, contratos, apresentações\n• **Ver Histórico Completo**: Timeline de todas as atividades\n• **Atribuir Responsável**: Definir membro da equipe responsável\n• **Adicionar Tags**: Categorizar e segmentar o lead',
      },
      {
        question: 'O que são tags e como usá-las?',
        answer:
          'Tags são etiquetas coloridas que ajudam a categorizar seus leads. Você pode criar tags personalizadas como:\n\n**Por Produto/Serviço:**\n• CRM\n• Automação de Marketing\n• Consultoria\n\n**Por Prioridade:**\n• Alta Prioridade (vermelho)\n• Média Prioridade (amarelo)\n• Baixa Prioridade (verde)\n\n**Por Origem:**\n• Site\n• Indicação\n• Evento\n• Ligação Fria\n• Redes Sociais\n\n**Como usar:**\n1. Abra o lead\n2. Clique em "Adicionar Tag"\n3. Selecione uma tag existente ou crie uma nova\n4. Use tags para filtrar e segmentar sua lista de leads facilmente',
      },
      {
        question: 'Como usar os filtros avançados?',
        answer:
          'Na visualização em Tabela, você tem acesso a filtros poderosos:\n\n**Filtros Disponíveis:**\n• **Por Estágio**: Filtre por um ou mais estágios do funil\n• **Por Responsável**: Veja leads de um vendedor específico\n• **Por Tag**: Filtre por uma ou múltiplas tags\n• **Por Data**: Leads criados/atualizados em um período\n• **Por Origem**: Canal de entrada do lead\n• **Por Status**: Ativo, Ganho, Perdido\n\n**Como usar:**\n1. Clique no ícone de filtro\n2. Selecione os critérios desejados\n3. Combine múltiplos filtros\n4. Salve combinações como "Visões Personalizadas"',
      },
    ],
  },
  {
    id: 'captacao',
    title: 'Captação',
    icon: MapPin,
    description: 'Prospecção e captação de leads',
    items: [
      {
        question: 'O que é a ferramenta de Captação?',
        answer:
          'A Captação (disponível nos planos NEXIO GROWTH e NEXIO ADS) permite prospectar novos leads de forma automatizada:\n\n**Recursos:**\n• Busca de empresas por filtros avançados\n• Integração com bases de dados públicas\n• Qualificação automática por IA\n• Importação em massa de leads\n• Enriquecimento de dados\n• Validação de e-mails e telefones',
      },
      {
        question: 'Como funciona a busca de empresas?',
        answer:
          '1. **Defina seus critérios de busca:**\n   • Localização (cidade, estado, região)\n   • Segmento de mercado (CNAE)\n   • Porte da empresa (ME, EPP, Grande)\n   • Faturamento estimado\n   • Outros filtros personalizados\n\n2. **Execute a busca:**\n   • Clique em "Buscar Empresas"\n   • O sistema consultará as bases de dados\n   • Aguarde o processamento (pode levar alguns minutos)\n\n3. **Analise os resultados:**\n   • Visualize lista de empresas encontradas\n   • Veja score de fit com seu ICP\n   • Acesse dados de contato disponíveis\n\n4. **Importe para o CRM:**\n   • Selecione as empresas de interesse\n   • Clique em "Importar Selecionadas"\n   • Os leads serão criados automaticamente no CRM',
      },
      {
        question: 'Como importar leads em massa?',
        answer:
          'Você pode importar uma planilha (CSV ou Excel) com vários leads de uma vez:\n\n**Passo a passo:**\n1. Prepare sua planilha com as colunas:\n   • Nome (obrigatório)\n   • E-mail (obrigatório)\n   • Telefone\n   • Empresa\n   • Cargo\n   • Outras informações relevantes\n\n2. Acesse Captação > "Importar Planilha"\n\n3. Faça upload do arquivo (.csv, .xlsx, .xls)\n\n4. Mapeie as colunas:\n   • Relacione cada coluna da planilha com os campos do CRM\n   • Marque campos obrigatórios\n\n5. Configure opções:\n   • Pular linhas duplicadas?\n   • Atribuir para qual responsável?\n   • Adicionar tags automaticamente?\n\n6. Confirme a importação\n\n7. Aguarde o processamento\n\nTodos os leads serão criados no estágio "Novo Lead".',
      },
      {
        question: 'Qual a diferença entre os planos de captação?',
        answer:
          '**NEXIO SALES (R$ 1.600/mês):**\n• Sem recursos de captação/extração\n• CRM completo\n• Chat IA\n• Funil de vendas\n\n**NEXIO GROWTH (R$ 2.000/mês):**\n• 500 leads inclusos por mês\n• Leads extras: R$ 1/lead ou R$ 400 por pacote de +500\n• Busca avançada de empresas\n• Importação em massa\n• Enriquecimento de dados\n\n**NEXIO ADS (R$ 2.600/mês):**\n• Tudo do NEXIO GROWTH\n• + Gestão de Tráfego Pago integrada\n• Campanhas Google Ads e Meta Ads\n• Otimização automática de campanhas\n• Relatórios de ROI',
      },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: MessageSquare,
    description: 'Comunicação com leads e clientes',
    items: [
      {
        question: 'Como funciona o Atendimento?',
        answer:
          'O módulo de Atendimento centraliza todas as conversas com seus leads e clientes:\n\n**Canais Integrados:**\n• WhatsApp Business (via Uazapi)\n• Chat IA dentro do CRM\n• E-mail (em breve)\n• Telefone (registro manual)\n\n**Recursos:**\n• Histórico completo de conversas\n• Respostas rápidas (templates)\n• Chat IA para qualificação automática\n• Agendamento de follow-ups\n• Notificações em tempo real\n• Transferência entre atendentes',
      },
      {
        question: 'Como integrar o WhatsApp?',
        answer:
          '**Configuração Inicial (apenas admin):**\n1. Acesse Configurações > Integrações > WhatsApp\n2. Contrate uma conta no Uazapi.com\n3. Insira as credenciais:\n   • API Token\n   • Nome da instância\n   • Número do telefone\n4. Teste a conexão\n5. Salve as configurações\n\n**Para usar o WhatsApp integrado:**\n• Envie mensagens direto do perfil do lead\n• Receba notificações de novas mensagens\n• Veja histórico completo de conversas\n• Use templates de mensagens pré-aprovadas\n• Anexe imagens, documentos e áudios',
      },
      {
        question: 'Como funciona o Chat IA?',
        answer:
          'O Chat IA é um assistente inteligente que ajuda na qualificação de leads:\n\n**Funcionalidades:**\n• Responde perguntas frequentes automaticamente\n• Qualifica leads com perguntas estratégicas\n• Sugere próximos passos na venda\n• Analisa sentimento do lead\n• Identifica objeções e sugere respostas\n• Aprende com suas conversas\n\n**Como usar:**\n1. Abra a conversa com um lead\n2. O Chat IA analisa o contexto em tempo real\n3. Veja sugestões de respostas no painel lateral\n4. Clique para usar a sugestão ou personalize\n5. Envie a mensagem\n\n**Configurar IA (apenas admin):**\n• Acesse Admin > Webhooks & APIs > Configuração de IA\n• Escolha o provedor (OpenAI ou Anthropic)\n• Configure o modelo (GPT-4, Claude Opus, etc.)\n• Insira a API Key\n• Defina o tom de voz e instruções personalizadas',
      },
      {
        question: 'Como agendar um follow-up?',
        answer:
          'Ao visualizar um lead:\n\n1. Clique em "Agendar Follow-up" ou no ícone de calendário\n2. Preencha os detalhes:\n   • **Data e Hora**: Quando você deve retornar o contato\n   • **Tipo**: Ligação, Reunião, E-mail, WhatsApp\n   • **Assunto**: Motivo do follow-up\n   • **Observações**: Pontos importantes a abordar\n3. Clique em "Salvar"\n\n**Você receberá notificações:**\n• 1 hora antes do horário agendado\n• No momento do follow-up\n• Notificação push no navegador\n• E-mail de lembrete (se configurado)\n\n**Gerenciar follow-ups:**\n• Veja todos no Dashboard > "Próximas Atividades"\n• Marque como concluído após realizado\n• Reagende se necessário\n• Adicione notas sobre o resultado',
      },
      {
        question: 'Como registrar uma ligação?',
        answer:
          'Após falar com um lead por telefone:\n\n1. Abra o perfil do lead no CRM\n2. Clique em "Registrar Interação" ou "+" no histórico\n3. Selecione o tipo: "Ligação Telefônica"\n4. Preencha:\n   • **Duração**: Tempo de conversa\n   • **Resultado**: Atendeu / Não atendeu / Caixa postal\n   • **Resumo**: Principais pontos discutidos\n   • **Próximos passos**: O que foi combinado\n   • **Sentimento**: Positivo / Neutro / Negativo\n5. **Atualize o estágio** do lead se necessário\n6. **Agende follow-up** se aplicável\n7. Clique em "Salvar Interação"\n\nA ligação ficará registrada no histórico do lead com data e hora.',
      },
      {
        question: 'Como usar templates de mensagens?',
        answer:
          'Templates (ou "Respostas Rápidas") aceleram seu atendimento:\n\n**Criar um template:**\n1. Acesse Configurações > Respostas Rápidas\n2. Clique em "+ Novo Template"\n3. Defina:\n   • Nome/Atalho (ex: /ola, /proposta)\n   • Categoria (Saudação, Proposta, Objeção, etc.)\n   • Conteúdo da mensagem\n   • Variáveis dinâmicas: {{nome}}, {{empresa}}, {{valor}}\n4. Salve o template\n\n**Usar um template:**\n• Durante uma conversa, digite "/" e o atalho\n• Ou clique no ícone de template e selecione\n• As variáveis serão preenchidas automaticamente\n• Personalize a mensagem se necessário\n• Envie',
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
          'Apenas administradores da empresa podem adicionar novos membros:\n\n**Se você é admin:**\n1. Acesse "Membros" no menu\n2. Clique em "+ Novo Membro"\n3. Preencha:\n   • Nome completo\n   • E-mail corporativo\n   • Departamento (Vendas, Marketing, etc.)\n   • Função/Cargo\n4. Defina permissões (ver próxima pergunta)\n5. Clique em "Enviar Convite"\n\nO novo membro receberá um e-mail com instruções de acesso.\n\n**Se você NÃO é admin:**\nSolicite ao administrador da sua empresa que adicione o novo membro.',
      },
      {
        question: 'Quais são os níveis de permissão?',
        answer:
          'Existem 3 níveis de permissão por usuário:\n\n**1. Visualizador**\n• Ver todos os leads da empresa\n• Ver relatórios e dashboard\n• Não pode editar ou criar\n• Ideal para: Diretores, Analistas\n\n**2. Vendedor**\n• Ver e editar seus próprios leads\n• Criar novos leads\n• Registrar interações\n• Mover leads no funil\n• Não pode ver leads de outros vendedores\n• Ideal para: Vendedores, SDRs\n\n**3. Administrador**\n• Acesso total ao CRM da empresa\n• Ver e editar todos os leads\n• Gerenciar membros\n• Configurar integrações\n• Acessar relatórios completos\n• Definir ICP e configurações\n• Ideal para: Gerentes, Coordenadores',
      },
      {
        question: 'Como atribuir leads para outros membros?',
        answer:
          '**Atribuição Individual:**\n1. Abra o lead que deseja atribuir\n2. Clique em "Atribuir para"\n3. Selecione o membro da equipe\n4. Clique em "Confirmar"\n\nO membro receberá uma notificação e o lead aparecerá em sua lista.\n\n**Atribuição em Massa:**\n1. Na visualização em Tabela do CRM\n2. Selecione múltiplos leads (checkbox)\n3. Clique em "Ações em Massa" > "Atribuir"\n4. Selecione o responsável\n5. Confirme a atribuição\n\n**Rodízio Automático (Round Robin):**\n1. Acesse Configurações > Atribuição de Leads\n2. Ative "Rodízio Automático"\n3. Defina a lista de vendedores participantes\n4. Escolha o critério (por quantidade ou balanceamento)\n\nNovos leads serão distribuídos automaticamente de forma equilibrada.',
      },
      {
        question: 'Como ver os leads da minha equipe?',
        answer:
          'No CRM, use os filtros para visualizar diferentes visões:\n\n**Filtro "Responsável":**\n• **Meus Leads**: Apenas leads atribuídos a você\n• **[Nome do Vendedor]**: Leads de um membro específico\n• **Sem Responsável**: Leads não atribuídos\n• **Todos da Equipe**: Visão completa (apenas admin)\n\n**Visualizações Salvas:**\nCrie visões personalizadas combinando filtros:\n• "Meus Leads Quentes" (seus leads com score >70)\n• "Time SDR - Qualificação" (leads em estágio inicial do time SDR)\n• "Closers - Propostas" (leads em negociação dos closers)\n\n**Dashboard da Equipe:**\nAcesse Dashboard > "Visão da Equipe" para ver:\n• Performance individual de cada vendedor\n• Ranking de conversões\n• Leads por responsável\n• Pipeline value por membro',
      },
    ],
  },
  {
    id: 'kanban',
    title: 'Kanban e Visualizações',
    icon: Columns3,
    description: 'Visualizar e organizar seu pipeline',
    items: [
      {
        question: 'Como usar o Kanban efetivamente?',
        answer:
          'O Kanban é uma visualização em quadros que facilita a gestão ágil do funil:\n\n**Colunas Padrão:**\n• Novo Lead\n• Qualificado\n• Reunião Agendada\n• Proposta Enviada\n• Negociação\n• Ganho\n• Perdido\n\n**Como usar:**\n• **Arraste e solte** leads entre colunas para mudar o estágio\n• **Clique no card** para ver detalhes e editar\n• **Use cores e tags** para identificação visual rápida\n• **Veja contadores** no topo de cada coluna\n• **Filtre** por responsável, tag ou período\n\n**Boas Práticas:**\n• Revise o Kanban diariamente\n• Identifique gargalos (colunas cheias)\n• Defina metas de conversão por estágio\n• Use WIP limits (limite de leads por estágio)\n• Celebre vitórias ao mover para "Ganho"',
      },
      {
        question: 'Como personalizar os estágios do funil?',
        answer:
          'Administradores podem customizar os estágios do funil:\n\n**Acessar Configurações:**\n1. Configurações > Funil de Vendas > "Personalizar Estágios"\n\n**Ações Disponíveis:**\n• **Adicionar Estágio**: Crie etapas específicas do seu processo\n  Exemplo: "Demo Agendada", "POC em Andamento"\n\n• **Renomear Estágio**: Adapte nomes à sua linguagem\n  Exemplo: "Qualificado" → "BANT Confirmado"\n\n• **Reordenar**: Arraste estágios para mudar a sequência\n\n• **Definir Cores**: Personalize cores de cada estágio\n\n• **Arquivar**: Desative estágios não utilizados\n\n**Estágios Obrigatórios:**\n• "Ganho" e "Perdido" são fixos e não podem ser removidos\n• Todo funil deve ter ao menos 3 estágios ativos',
      },
    ],
  },
  {
    id: 'atalhos',
    title: 'Atalhos de Teclado',
    icon: Keyboard,
    description: 'Trabalhe mais rápido com atalhos',
    items: [
      {
        question: 'Quais atalhos estão disponíveis?',
        answer:
          '**Navegação:**\n• Ctrl + H → Ir para Dashboard\n• Ctrl + K → Buscar leads\n• Ctrl + / → Abrir esta ajuda\n\n**CRM:**\n• Ctrl + N → Criar novo lead\n• Ctrl + T → Alternar Tabela/Kanban\n\n**Dica:** Esses atalhos funcionam em qualquer página do sistema.',
      },
    ],
  },
];

function formatAnswer(text: string) {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) return <br key={i} />;

    // Bold text: **text**
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} className="text-foreground font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    // Numbered items (1. 2. etc)
    if (/^\d+\./.test(trimmed)) {
      return (
        <div key={i} className="flex gap-2 ml-1 mt-1">
          <span className="text-primary font-medium min-w-[20px]">{trimmed.match(/^\d+\./)?.[0]}</span>
          <span>{formatted.slice(1)}</span>
        </div>
      );
    }

    // Bullet points with •
    if (trimmed.startsWith('•')) {
      const indent = line.indexOf('•');
      return (
        <div key={i} className={cn('flex gap-2 mt-0.5', indent > 2 ? 'ml-6' : 'ml-1')}>
          <span className="text-primary mt-1 text-xs">●</span>
          <span>{formatted.map((f) => typeof f === 'string' ? f.replace(/^•\s*/, '') : f)}</span>
        </div>
      );
    }

    // Sub-items with -
    if (trimmed.startsWith('-') || trimmed.startsWith('  -')) {
      return (
        <div key={i} className="flex gap-2 ml-6 mt-0.5">
          <span className="text-muted-foreground">–</span>
          <span>{formatted.map((f) => typeof f === 'string' ? f.replace(/^-\s*/, '') : f)}</span>
        </div>
      );
    }

    return (
      <p key={i} className="mt-1">
        {formatted}
      </p>
    );
  });
}

export default function AjudaPage() {
  const [activeId, setActiveId] = useState(sections[0].id);

  const activeSection = sections.find((s) => s.id === activeId) || sections[0];
  const ActiveIcon = activeSection.icon;

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ '--sidebar-width': '16rem' } as React.CSSProperties}
    >
      <SidebarInset>
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          {/* Header da seção */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <BookOpen className="h-3.5 w-3.5" />
              Documentação
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{activeSection.title}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ActiveIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{activeSection.title}</h2>
                <p className="text-muted-foreground mt-0.5">{activeSection.description}</p>
              </div>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Items da seção */}
          <div className="space-y-10">
            {activeSection.items.map((item, index) => (
              <article key={index} id={`${activeId}-${index}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal px-2 py-0.5">
                    {index + 1}
                  </Badge>
                  {item.question}
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed pl-1">
                  {formatAnswer(item.answer)}
                </div>
                {index < activeSection.items.length - 1 && (
                  <Separator className="mt-10" />
                )}
              </article>
            ))}
          </div>

          {/* Navegação entre seções */}
          <div className="mt-16 pt-8 border-t border-border/50">
            <div className="flex justify-between">
              {sections.findIndex((s) => s.id === activeId) > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const idx = sections.findIndex((s) => s.id === activeId);
                    setActiveId(sections[idx - 1].id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                  {sections[sections.findIndex((s) => s.id === activeId) - 1].title}
                </Button>
              ) : (
                <div />
              )}
              {sections.findIndex((s) => s.id === activeId) < sections.length - 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const idx = sections.findIndex((s) => s.id === activeId);
                    setActiveId(sections[idx + 1].id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {sections[sections.findIndex((s) => s.id === activeId) + 1].title}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Sidebar direita - Table of Contents */}
      <Sidebar side="right" collapsible="none" className="border-l">
        <SidebarHeader className="p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            Central de Ajuda
          </h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Table of Contents</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <SidebarMenuItem key={section.id}>
                      <SidebarMenuButton
                        isActive={activeId === section.id}
                        onClick={() => setActiveId(section.id)}
                        tooltip={section.description}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{section.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-medium text-foreground">Precisa de mais ajuda?</p>
            <p className="text-xs text-muted-foreground">
              Entre em contato pelo e-mail{' '}
              <span className="text-primary font-medium">suporte@nexio.ai</span>
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
