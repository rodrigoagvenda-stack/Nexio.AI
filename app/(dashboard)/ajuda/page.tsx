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
  Keyboard,
  ChevronLeft,
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
          'Para cadastrar um novo lead, siga os passos:\n\n1. Acesse **CRM** no menu lateral\n2. Clique no botão **+ Novo Lead** no topo da página\n3. Preencha as informações obrigatórias:\n   • Nome completo\n   • E-mail\n   • Telefone/WhatsApp\n   • Empresa (opcional)\n   • Origem do lead\n4. Adicione informações complementares como cargo, site, redes sociais\n5. Clique em **Salvar Lead**\n\nO lead será automaticamente adicionado ao estágio "Novo Lead" do funil.',
      },
      {
        question: 'Como organizar leads no funil de vendas?',
        answer:
          'O funil é organizado em estágios sequenciais:\n\n• **Novo Lead** — Primeiro contato realizado\n• **Qualificado** — Lead com potencial confirmado (BANT)\n• **Reunião Agendada** — Primeira reunião marcada\n• **Proposta Enviada** — Orçamento ou proposta comercial enviada\n• **Negociação** — Em processo de fechamento e ajustes\n• **Ganho** — Venda concluída com sucesso\n• **Perdido** — Não converteu (arquivado)\n\n**Como mover leads:**\n• Arraste e solte os cards entre os estágios (drag & drop)\n• Ou clique no lead > **Alterar Estágio** > Selecione o novo estágio',
      },
      {
        question: 'Como alternar entre visualização Tabela e Kanban?',
        answer:
          'No topo da página CRM você encontra dois botões:\n\n• **Tabela** — Visualização em lista com todas as informações em colunas. Ideal para análise detalhada, ordenação por coluna, exportação de dados e filtros avançados.\n\n• **Kanban** — Visualização em quadros por estágio. Ideal para movimentação rápida de leads, visão visual do pipeline, gestão ágil do funil e identificar gargalos.',
      },
      {
        question: 'Como editar informações de um lead?',
        answer:
          'Clique no card do lead (em qualquer visualização) para abrir a página de detalhes. Lá você pode:\n\n• **Editar Dados Pessoais** — Nome, e-mail, telefone, cargo\n• **Informações da Empresa** — Nome, CNPJ, site, faturamento\n• **Adicionar Notas** — Observações sobre reuniões e conversas\n• **Registrar Interações** — Ligações, e-mails, reuniões\n• **Anexar Arquivos** — Propostas, contratos, apresentações\n• **Ver Histórico Completo** — Timeline de todas as atividades\n• **Atribuir Responsável** — Definir membro da equipe responsável\n• **Adicionar Tags** — Categorizar e segmentar o lead',
      },
      {
        question: 'O que são tags e como usá-las?',
        answer:
          'Tags são etiquetas coloridas que ajudam a categorizar seus leads.\n\n**Exemplos de tags:**\n• **Por Prioridade** — Alta (vermelho), Média (amarelo), Baixa (verde)\n• **Por Origem** — Site, Indicação, Evento, Redes Sociais\n• **Por Produto** — CRM, Automação, Consultoria\n\n**Como usar:**\n1. Abra o lead\n2. Clique em **Adicionar Tag**\n3. Selecione uma tag existente ou crie uma nova\n4. Use tags para filtrar e segmentar sua lista de leads',
      },
      {
        question: 'Como usar os filtros avançados?',
        answer:
          'Na visualização em Tabela, você tem acesso a filtros poderosos:\n\n• **Por Estágio** — Filtre por um ou mais estágios do funil\n• **Por Responsável** — Veja leads de um vendedor específico\n• **Por Tag** — Filtre por uma ou múltiplas tags\n• **Por Data** — Leads criados/atualizados em um período\n• **Por Origem** — Canal de entrada do lead\n• **Por Status** — Ativo, Ganho, Perdido\n\nVocê pode combinar múltiplos filtros e salvar combinações como **Visões Personalizadas**.',
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
          'A Captação (disponível nos planos NEXIO GROWTH e NEXIO ADS) permite prospectar novos leads de forma automatizada:\n\n• Busca de empresas por filtros avançados\n• Integração com bases de dados públicas\n• Qualificação automática por IA\n• Importação em massa de leads\n• Enriquecimento de dados\n• Validação de e-mails e telefones',
      },
      {
        question: 'Como funciona a busca de empresas?',
        answer:
          'O processo de busca funciona em 4 etapas:\n\n**Etapa 1 — Defina seus critérios:**\n• Localização (cidade, estado, região)\n• Segmento de mercado (CNAE)\n• Porte da empresa (ME, EPP, Grande)\n• Faturamento estimado\n\n**Etapa 2 — Execute a busca:**\n• Clique em **Buscar Empresas** e aguarde o processamento\n\n**Etapa 3 — Analise os resultados:**\n• Visualize a lista de empresas encontradas\n• Veja o score de fit com seu ICP\n• Acesse dados de contato disponíveis\n\n**Etapa 4 — Importe para o CRM:**\n• Selecione as empresas de interesse e clique em **Importar Selecionadas**',
      },
      {
        question: 'Como importar leads em massa?',
        answer:
          'Você pode importar uma planilha (CSV ou Excel) com vários leads de uma vez.\n\n**Prepare sua planilha** com as colunas: Nome (obrigatório), E-mail (obrigatório), Telefone, Empresa, Cargo.\n\n**Passo a passo:**\n1. Acesse Captação > **Importar Planilha**\n2. Faça upload do arquivo (.csv, .xlsx, .xls)\n3. Mapeie as colunas da planilha com os campos do CRM\n4. Configure opções: pular duplicados, atribuir responsável, adicionar tags\n5. Confirme a importação e aguarde o processamento\n\nTodos os leads serão criados no estágio **Novo Lead**.',
      },
      {
        question: 'Qual a diferença entre os planos?',
        answer:
          '**NEXIO SALES** — R$ 1.600/mês\n• CRM completo, Chat IA, Funil de vendas\n• Sem recursos de captação/extração\n\n**NEXIO GROWTH** — R$ 2.000/mês\n• Tudo do Sales + 500 leads inclusos/mês\n• Busca avançada, importação em massa, enriquecimento de dados\n• Leads extras: R$ 1/lead ou R$ 400 por pacote de +500\n\n**NEXIO ADS** — R$ 2.600/mês\n• Tudo do Growth + Gestão de Tráfego Pago integrada\n• Campanhas Google Ads e Meta Ads\n• Otimização automática e relatórios de ROI',
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
          'O módulo de Atendimento centraliza todas as conversas com seus leads e clientes.\n\n**Canais Integrados:**\n• WhatsApp Business (via Uazapi)\n• Chat IA dentro do CRM\n• Telefone (registro manual)\n\n**Recursos:**\n• Histórico completo de conversas\n• Respostas rápidas (templates)\n• Chat IA para qualificação automática\n• Agendamento de follow-ups\n• Notificações em tempo real\n• Transferência entre atendentes',
      },
      {
        question: 'Como integrar o WhatsApp?',
        answer:
          '**Configuração Inicial (apenas admin):**\n1. Acesse **Configurações > Integrações > WhatsApp**\n2. Contrate uma conta no Uazapi.com\n3. Insira as credenciais: API Token, Nome da instância, Número do telefone\n4. Teste a conexão e salve as configurações\n\n**Para usar o WhatsApp integrado:**\n• Envie mensagens direto do perfil do lead\n• Receba notificações de novas mensagens\n• Veja histórico completo de conversas\n• Use templates de mensagens pré-aprovadas\n• Anexe imagens, documentos e áudios',
      },
      {
        question: 'Como funciona o Chat IA?',
        answer:
          'O Chat IA é um assistente inteligente que ajuda na qualificação de leads.\n\n**Funcionalidades:**\n• Responde perguntas frequentes automaticamente\n• Qualifica leads com perguntas estratégicas\n• Sugere próximos passos na venda\n• Analisa sentimento do lead\n• Identifica objeções e sugere respostas\n\n**Configurar IA (apenas admin):**\n• Acesse **Admin > Webhooks & APIs > Configuração de IA**\n• Escolha o provedor (OpenAI ou Anthropic)\n• Configure o modelo e insira a API Key\n• Defina o tom de voz e instruções personalizadas',
      },
      {
        question: 'Como agendar um follow-up?',
        answer:
          'Ao visualizar um lead, clique em **Agendar Follow-up**:\n\n1. Preencha: Data e Hora, Tipo (Ligação, Reunião, E-mail, WhatsApp), Assunto e Observações\n2. Clique em **Salvar**\n\nVocê receberá notificações 1 hora antes e no momento do follow-up. Gerencie todos os follow-ups no **Dashboard > Próximas Atividades**.',
      },
      {
        question: 'Como usar templates de mensagens?',
        answer:
          'Templates (ou Respostas Rápidas) aceleram seu atendimento.\n\n**Criar um template:**\n1. Acesse **Configurações > Respostas Rápidas**\n2. Clique em **+ Novo Template**\n3. Defina: Nome/Atalho (ex: /ola), Categoria, Conteúdo com variáveis dinâmicas ({{nome}}, {{empresa}})\n\n**Usar um template:**\n• Durante uma conversa, digite **/** e o atalho\n• Ou clique no ícone de template e selecione\n• As variáveis serão preenchidas automaticamente',
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
          'Apenas administradores podem adicionar novos membros.\n\n1. Acesse **Membros** no menu\n2. Clique em **+ Novo Membro**\n3. Preencha: Nome completo, E-mail corporativo, Departamento, Função/Cargo\n4. Defina as permissões\n5. Clique em **Enviar Convite**\n\nO novo membro receberá um e-mail com instruções de acesso.',
      },
      {
        question: 'Quais são os níveis de permissão?',
        answer:
          'Existem 3 níveis de permissão:\n\n**Visualizador** — Ver todos os leads e relatórios. Não pode editar ou criar. Ideal para Diretores e Analistas.\n\n**Vendedor** — Ver e editar seus próprios leads, criar novos leads, registrar interações, mover leads no funil. Ideal para Vendedores e SDRs.\n\n**Administrador** — Acesso total ao CRM da empresa. Gerenciar membros, configurar integrações, acessar relatórios completos. Ideal para Gerentes e Coordenadores.',
      },
      {
        question: 'Como atribuir leads para outros membros?',
        answer:
          '**Atribuição Individual:**\n• Abra o lead > **Atribuir para** > Selecione o membro > **Confirmar**\n\n**Atribuição em Massa:**\n• Na Tabela do CRM, selecione múltiplos leads > **Ações em Massa > Atribuir** > Selecione o responsável\n\n**Rodízio Automático (Round Robin):**\n• Acesse **Configurações > Atribuição de Leads**\n• Ative **Rodízio Automático** e defina a lista de vendedores\n• Novos leads serão distribuídos automaticamente de forma equilibrada',
      },
    ],
  },
  {
    id: 'kanban',
    title: 'Kanban',
    icon: Columns3,
    description: 'Visualizar e organizar seu pipeline',
    items: [
      {
        question: 'Como usar o Kanban efetivamente?',
        answer:
          'O Kanban é uma visualização em quadros que facilita a gestão ágil do funil.\n\n**Como usar:**\n• **Arraste e solte** leads entre colunas para mudar o estágio\n• **Clique no card** para ver detalhes e editar\n• **Use cores e tags** para identificação visual rápida\n• **Veja contadores** no topo de cada coluna\n• **Filtre** por responsável, tag ou período\n\n**Boas Práticas:**\n• Revise o Kanban diariamente\n• Identifique gargalos (colunas cheias)\n• Defina metas de conversão por estágio',
      },
      {
        question: 'Como personalizar os estágios do funil?',
        answer:
          'Administradores podem customizar os estágios em **Configurações > Funil de Vendas**.\n\n**Ações Disponíveis:**\n• **Adicionar Estágio** — Crie etapas como "Demo Agendada", "POC em Andamento"\n• **Renomear Estágio** — Adapte à sua linguagem (ex: "Qualificado" → "BANT Confirmado")\n• **Reordenar** — Arraste estágios para mudar a sequência\n• **Definir Cores** — Personalize cores de cada estágio\n• **Arquivar** — Desative estágios não utilizados\n\n**Nota:** "Ganho" e "Perdido" são fixos e não podem ser removidos.',
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
          '**Navegação:**\n• **Ctrl + H** — Ir para Dashboard\n• **Ctrl + K** — Buscar leads\n• **Ctrl + /** — Abrir esta ajuda\n\n**CRM:**\n• **Ctrl + N** — Criar novo lead\n• **Ctrl + T** — Alternar Tabela/Kanban\n\nEsses atalhos funcionam em qualquer página do sistema.',
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
