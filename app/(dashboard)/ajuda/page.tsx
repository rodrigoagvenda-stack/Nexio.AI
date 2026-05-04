'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Users, MapPin, MessageSquare, UserPlus,
  Columns3, ChevronLeft, ChevronRight, BookOpen, HelpCircle,
  Megaphone, FileText, Bot, Send, X, Loader2, Sparkles,
  type LucideIcon,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface HelpItem { question: string; answer: string }
interface HelpSection { id: string; title: string; icon: LucideIcon; description: string; items: HelpItem[] }
interface ChatMessage { role: 'user' | 'assistant'; content: string }

// ── Content ────────────────────────────────────────────────────────────────

const sections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral e métricas do seu negócio em tempo real',
    items: [
      {
        question: 'O que é o Dashboard?',
        answer:
          'O Dashboard é sua página inicial com um resumo em tempo real:\n\n• **Total de leads** cadastrados na base\n• **Leads por estágio** do funil\n• **Conversões recentes** — leads que fecharam\n• **Valor total do pipeline** — soma dos valores de projeto\n• **Gráfico do funil** — distribuição por estágio\n• **Atividades recentes** — últimas movimentações',
      },
      {
        question: 'Como interpretar as métricas?',
        answer:
          'Cada card mostra uma métrica importante:\n\n• **Leads Ativos** — Total de leads que não estão em "Fechado" ou "Perdido"\n• **Taxa de Conversão** — Percentual que chegou a "Fechado"\n• **Valor do Pipeline** — Soma de todos os valores ativos\n• **Leads por Origem** — De onde seus leads vêm\n\nUse essas métricas para identificar gargalos e otimizar o funil.',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: Users,
    description: 'Gestão completa de leads e oportunidades de venda',
    items: [
      {
        question: 'Como cadastrar um novo lead?',
        answer:
          'Cadastro em 3 etapas:\n\n**Etapa 1 — Empresa:**\n1. Clique em **+ Adicionar Lead**\n2. Preencha o **Nome da Empresa** (obrigatório)\n3. Selecione o **Segmento**\n4. Adicione site ou Instagram (opcional)\n\n**Etapa 2 — Contato:**\n5. Nome, WhatsApp e e-mail do contato\n\n**Etapa 3 — Detalhes:**\n6. Prioridade, nível de interesse, fonte, valor do projeto e observações\n\nO lead entra automaticamente no estágio **Lead novo**.',
      },
      {
        question: 'Quais são os estágios do funil?',
        answer:
          'O funil tem 9 estágios:\n\n• **Triagem** 🔍 — Leads captados pelo Orbit chegam aqui para avaliação de ICP\n• **Outbound** 📣 — Leads aprovados na triagem prontos para prospecção\n• **Lead novo** 🔵 — Leads adicionados manualmente ainda não contactados\n• **Em contato** 💬 — Primeiro contato realizado\n• **Interessado** ⭐ — Demonstrou interesse\n• **Proposta enviada** 📄 — Recebeu orçamento ou proposta\n• **Fechado** ✅ — Venda concluída\n• **Perdido** ❌ — Não converteu\n• **Remarketing** 🔁 — Para reativar futuramente\n\nMova leads arrastando no Kanban ou usando o seletor no mobile.',
      },
      {
        question: 'Como alternar entre Planilha e Kanban?',
        answer:
          'No menu lateral, dentro de **CRM**, você tem dois sub-itens:\n\n• **Planilha** — Tabela com todas as colunas. Ideal para ver muitos leads, selecionar em massa, deletar em lote e exportar para CSV\n• **Kanban** — Quadros por estágio com drag & drop, valor total por coluna e contagem de leads',
      },
      {
        question: 'Como editar, deletar e exportar leads?',
        answer:
          '**Editar:** Clique no lápis no card (Kanban) ou na tabela (Planilha).\n\n**Deletar individual:** Ícone de lixeira → confirme na caixa de diálogo.\n\n**Deletar em massa** (só na Planilha):\n1. Marque os checkboxes dos leads\n2. Clique em **Deletar X selecionado(s)**\n3. Confirme — a exclusão é permanente.\n\n**Exportar CSV:** Clique em **Exportar CSV** no topo. Os filtros ativos são respeitados.',
      },
      {
        question: 'Como usar os filtros?',
        answer:
          'No topo do CRM você tem 3 filtros combináveis:\n\n• **Busca** — Nome da empresa, contato ou e-mail\n• **Status** — Filtre por estágio do funil\n• **Prioridade** — Alta, Média ou Baixa\n\nClique em **Limpar** para remover todos os filtros de uma vez.',
      },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: MessageSquare,
    description: 'Chat WhatsApp com SDR por IA integrado',
    items: [
      {
        question: 'O que é o módulo de Atendimento?',
        answer:
          'O Atendimento é um **chat espelhado do WhatsApp** dentro do CRM com um **SDR virtual por IA** que conversa automaticamente com seus leads.\n\n**O que você vê na tela:**\n• **Painel esquerdo** — Lista de conversas com tabs: Minhas / Livres / Todas\n• **Painel central** — Chat em tempo real\n• **Painel direito** — Informações do lead, resumo IA, notas, tags, mídia e agenda',
      },
      {
        question: 'Como funciona o Agente IA?',
        answer:
          'O agente IA responde mensagens automaticamente como um vendedor real.\n\n**Dois níveis de controle:**\n• **Toggle global** "Agente IA ativo/inativo" no topo da lista de conversas — desativa para toda a empresa\n• **Toggle por conversa** "Agente ativo/pausado" no header do chat — pausa apenas aquela conversa para atendimento humano\n\n**O que o agente faz:**\n• Responde e qualifica leads em tempo real\n• Coleta informações e identifica dores/objeções\n• Apresenta produtos/serviços\n• Tenta agendar reuniões ou fechar vendas\n• Gera **resumo automático** do lead com tudo coletado',
      },
      {
        question: 'Modos de atendimento: Suporte vs Vendas',
        answer:
          'Configure em **Configurações → SDR → Geral → Modo de atendimento**:\n\n• **Suporte** — Inbox compartilhado. Conversas novas ficam "Livres" e qualquer atendente pode atribuir para si\n• **Vendas** — Round-robin automático. Cada conversa nova é atribuída automaticamente ao atendente com menos conversas abertas\n\nAs tabs na lista de conversas:\n• **Minhas** — Conversas atribuídas a você\n• **Livres** — Sem atendente atribuído (modo suporte)\n• **Todas** — Todas as conversas da empresa (admin/gerente)',
      },
      {
        question: 'Que tipos de mídia posso enviar?',
        answer:
          '5 tipos de mídia suportados:\n\n• **Texto** — Shift+Enter para quebrar linha\n• **Imagens** — Qualquer formato, com legenda opcional\n• **Áudio** — Grave direto no sistema com player de ondas sonoras\n• **Vídeos** — Player de reprodução no chat\n• **Documentos** — PDF, Word, Excel, TXT\n\nTodos os arquivos ficam na aba **Mídia** do painel lateral.',
      },
      {
        question: 'Como usar Respostas Rápidas (Templates)?',
        answer:
          '**Durante uma conversa:**\n• Digite **/** na caixa de texto\n• Selecione o template com ↑↓ e Enter\n\n**Variáveis dinâmicas:**\n• **{{nome}}** — Nome do contato\n• **{{empresa}}** — Nome da empresa\n• **{{telefone}}** — Telefone\n• **{{usuario}}** — Seu nome\n• **{{minha_empresa}}** — Nome da sua empresa',
      },
      {
        question: 'Como agendar mensagens e usar Tags?',
        answer:
          '**Agendar mensagens:**\n1. Clique no ícone de calendário no header do chat\n2. Selecione data, hora e mensagem\n3. Gerencie agendamentos na aba **Agenda** do painel lateral\n\n**Tags:**\n• Acesse a aba **Tags** no painel lateral\n• Adicione, remova ou crie tags com cores customizadas\n• As tags aparecem na lista de conversas para identificação visual rápida',
      },
    ],
  },
  {
    id: 'captacao',
    title: 'Orbit (Captação)',
    icon: MapPin,
    description: 'Prospecção e extração automática de leads',
    items: [
      {
        question: 'O que é o Orbit?',
        answer:
          'O Orbit é a ferramenta de **captação e extração de leads** do Zaapli.\n\nCom ele você busca empresas por localização e segmento e importa diretamente para o CRM.\n\nLeads captados pelo Orbit entram no estágio **Triagem** do funil — não em Lead novo — para você avaliar o ICP antes de avançar.',
      },
      {
        question: 'Qual o fluxo correto depois de captar leads?',
        answer:
          'O fluxo ideal após captar pelo Orbit:\n\n1. 🔍 **Triagem** — Leads chegam aqui automaticamente\n2. Avalie se o lead se encaixa no seu **ICP (Perfil de Cliente Ideal)**\n3. ✅ Aprovado → arraste para **Outbound** para iniciar prospecção\n4. ❌ Reprovado → mova para **Perdido** ou delete\n\nEssa etapa garante que o agente só aborde empresas que realmente fazem sentido, aumentando a taxa de conversão.',
      },
    ],
  },
  {
    id: 'membros',
    title: 'Membros',
    icon: UserPlus,
    description: 'Gerenciar equipe, funções e permissões',
    items: [
      {
        question: 'Como adicionar membros à equipe?',
        answer:
          'Apenas administradores podem adicionar membros.\n\n1. Acesse **Membros** no menu lateral\n2. Clique em **+ Novo Membro**\n3. Preencha nome e e-mail\n4. Defina a função\n5. Clique em **Enviar Convite**\n\nO membro recebe um e-mail com instruções para criar senha e acessar o sistema.\n\n**Limites por plano:**\n• Starter — até 3 atendentes\n• Pro — até 10 atendentes\n• Scale — ilimitado',
      },
      {
        question: 'Quais são os níveis de permissão?',
        answer:
          '**Vendedor** — CRM, seus leads, chat de atendimento, movimentação no funil.\n\n**Gerente** — Tudo do Vendedor + vê leads de toda equipe, relatórios completos, atribuição entre vendedores, tabs "Todas" no atendimento.\n\n**Administrador** — Acesso total. Gerencia membros, configura WhatsApp e SDR, acessa painel Admin, configura planos.',
      },
      {
        question: 'Como atribuir conversas para membros?',
        answer:
          'No Atendimento, clique em **Atribuir** no header do chat, selecione o membro (veja quantos chats ativos cada um tem) e confirme.\n\nPara transferir, clique em **Transferir** e selecione o novo responsável.\n\nNo modo vendas, a atribuição é automática via round-robin — o sistema escolhe o atendente com menos conversas abertas.',
      },
    ],
  },
  {
    id: 'kanban',
    title: 'Kanban',
    icon: Columns3,
    description: 'Visualização em quadros do funil de vendas',
    items: [
      {
        question: 'Como usar o Kanban?',
        answer:
          'O Kanban mostra leads em colunas por estágio.\n\n**Cada coluna mostra:**\n• Nome do estágio, contador de leads e valor total em R$\n\n**Cada card mostra:**\n• Empresa, contato, tags, prioridade, interesse, segmento, telefone e valor\n\n**Mover um lead:**\n• Clique, segure e arraste para a nova coluna — salva automaticamente\n\n**No celular:**\n• Use o seletor de status no card (não tem drag & drop no mobile)',
      },
      {
        question: 'O que é a coluna Triagem e por que ela existe?',
        answer:
          'A **Triagem** é a porta de entrada dos leads captados pelo Orbit.\n\nO objetivo é separar os leads antes de iniciar qualquer prospecção — você avalia quais se encaixam no seu ICP e quais não valem o esforço.\n\n**Fluxo:** Triagem → aprovado no ICP → Outbound (prospecção inicia) → Em contato → … → Fechado',
      },
    ],
  },
  {
    id: 'outbound',
    title: 'Outbound',
    icon: Megaphone,
    description: 'Campanhas em massa, templates e configurações de disparo',
    items: [
      {
        question: 'O que é o módulo Outbound?',
        answer:
          'O Outbound gerencia **campanhas de mensagens em massa via WhatsApp**.\n\n• **Campanhas** — Veja status, enviados, respondidos e erros com paginação\n• **Templates** — Gerencie templates globais e da empresa\n• **Configurações** — Defina o limite diário de disparos\n\nAcesse pelo menu lateral em **Automações → Outbound**.',
      },
      {
        question: 'Como configurar o limite diário de disparos?',
        answer:
          'Em **Outbound → Configurações**, defina o número máximo de mensagens por dia.\n\n**Boas práticas:**\n• Comece com 50–100/dia e aumente gradualmente\n• Muitos disparos de uma vez ativam proteção do WhatsApp\n• Monitore a taxa de erros nas campanhas\n• Se erros aumentarem, reduza o limite',
      },
      {
        question: 'Por que o Orbit.AI só opera em horário comercial?',
        answer:
          'O sistema opera de **segunda a sexta, das 9h às 18h** (horário de Brasília).\n\nPor quê:\n• Contatos fora do horário comercial geram experiência negativa\n• Aumenta risco de bloqueio e denúncias\n• Taxas de resposta são maiores no horário comercial\n\nFora desse período o sistema entra em repouso e retoma automaticamente.',
      },
    ],
  },
  {
    id: 'briefing',
    title: 'Briefing',
    icon: FileText,
    description: 'Formulário público personalizado da sua empresa',
    items: [
      {
        question: 'O que é o Briefing?',
        answer:
          'O Briefing é um **formulário público personalizado** com URL única da sua empresa.\n\n• URL no formato `nexioai.online/briefing/sua-empresa`\n• Branding com sua logo e cor primária\n• Perguntas totalmente customizáveis\n• Download de respostas em PDF\n• Acessível sem login por qualquer pessoa com o link',
      },
      {
        question: 'Como configurar e compartilhar o Briefing?',
        answer:
          'Acesse **Briefing** no menu lateral.\n\n**3 abas:**\n• **Respostas** — Lista de respostas com opção de ver detalhes ou baixar PDF\n• **Formulário** — Adicione/edite perguntas (texto, seleção, múltipla escolha, checkbox)\n• **Configurações** — Slug, tema, cor primária, logo\n\n**Compartilhar:**\nCopie a URL no topo da página e envie por WhatsApp, e-mail ou proposta comercial.',
      },
    ],
  },
  {
    id: 'sdr',
    title: 'Configuração SDR',
    icon: Bot,
    description: 'Configurar o agente, persona e base de conhecimento',
    items: [
      {
        question: 'Como configurar o agente SDR?',
        answer:
          'Acesse **Configuração → SDR** no menu lateral. A configuração tem 4 abas:\n\n• **Geral** — Tipo de agente, modo de atendimento (suporte/vendas), ativar/desativar agente\n• **Identidade** — Persona: nome do agente, tom, empresa, produto, restrições, horário\n• **Conhecimento** — Base de conhecimento (template, formulário ou PDF) e base de objeções\n• **Integrações** — Google Calendar para agendamentos automáticos',
      },
      {
        question: 'Como adicionar base de conhecimento?',
        answer:
          'Na aba **Conhecimento**, você tem 3 formas de criar a base:\n\n• **Template por nicho** — Escolha seu nicho e preencha as variáveis (produto, preço, link, etc.)\n• **Formulário livre** — Adicione perguntas e respostas manualmente\n• **PDF** — Faça upload de um documento e o sistema processa automaticamente\n\nAo trocar de base, o sistema pede confirmação antes de substituir o conteúdo existente.\n\nA mesma lógica vale para a **Base de Objeções**.',
      },
      {
        question: 'Como conectar o WhatsApp?',
        answer:
          'Acesse **Atendimento** no menu lateral. Se o WhatsApp não estiver conectado, a tela de conexão aparece automaticamente.\n\n1. Abra o WhatsApp no celular\n2. Toque em **Mais opções → Aparelhos conectados**\n3. Toque em **Conectar um aparelho**\n4. Aponte o celular para o QR Code na tela\n\nApós conectar, o webhook é configurado automaticamente — nenhuma configuração manual necessária.',
      },
    ],
  },
  {
    id: 'planos',
    title: 'Planos',
    icon: Sparkles,
    description: 'Planos disponíveis e limites de cada um',
    items: [
      {
        question: 'Quais são os planos disponíveis?',
        answer:
          '**Starter — R$ 397/mês**\n• 1 número WhatsApp conectado\n• Agente SDR (atendimento + venda)\n• CRM Kanban completo\n• Até 3 atendentes\n• Follow-up automático\n• Base de conhecimento RAG\n• 5M tokens de IA/mês\n\n**Pro — R$ 597/mês**\n• Tudo do Starter\n• Agente SDR + agendamento Google Calendar\n• Até 10 atendentes\n• Relatórios de desempenho\n• 15M tokens de IA/mês\n\n**Scale — R$ 997/mês**\n• Até 10 números WhatsApp\n• Tudo do Pro\n• Atendentes ilimitados\n• 50M tokens de IA/mês\n• Suporte prioritário\n\n**Número adicional:** R$ 97/mês por número extra',
      },
      {
        question: 'Como assinar um plano?',
        answer:
          'Acesse **Configuração → Plano** no menu lateral.\n\n1. Escolha o plano desejado\n2. Informe o CPF ou CNPJ da empresa (necessário para emissão de cobrança)\n3. Clique em **Escolher plano**\n4. Você será redirecionado para a página de pagamento do Asaas (PIX, boleto ou cartão)\n\nApós o pagamento confirmado, o plano é ativado automaticamente.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Dúvidas Frequentes',
    icon: HelpCircle,
    description: 'Problemas comuns e como resolver',
    items: [
      {
        question: 'O sistema está lento, o que fazer?',
        answer:
          '• **Primeiro acesso do dia** — Pode demorar alguns segundos enquanto o servidor inicializa\n• **CRM com muitos leads** — Use os filtros para encontrar leads específicos\n• **Conexão lenta** — O sistema precisa de conexão estável\n• **Limpar cache** — Pressione Ctrl+Shift+R para forçar atualização',
      },
      {
        question: 'Não estou recebendo mensagens do WhatsApp no chat',
        answer:
          'Verifique:\n\n1. WhatsApp está conectado? (tela de Atendimento mostra "Conectado" no topo)\n2. O Agente IA está ativo? (toggle no topo da lista de conversas)\n3. A conversa não está com "Agente pausado"?\n\nSe tudo estiver correto, desconecte e reconecte o WhatsApp. O webhook é reconfigurado automaticamente.',
      },
      {
        question: 'Como alterar os dados da minha empresa?',
        answer:
          'Apenas administradores podem alterar dados da empresa.\n\nAcesse **Configuração → Perfil** no menu lateral, edite os campos e salve.',
      },
      {
        question: 'Perdi minha senha, como recuperar?',
        answer:
          'Na tela de login:\n\n1. Clique em **Esqueci minha senha**\n2. Digite seu e-mail cadastrado\n3. Verifique a caixa de entrada (e spam)\n4. Clique no link de recuperação — expira em 24 horas',
      },
    ],
  },
];

// ── FormatText ─────────────────────────────────────────────────────────────

function FormatText({ text }: { text: string }) {
  const elements = useMemo(() => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) { result.push(<div key={i} className="h-2" />); continue; }

      const renderInline = (str: string) =>
        str.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        );

      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        result.push(
          <div key={i} className="flex gap-3 mt-1.5 ml-1">
            <span className="text-primary/70 font-mono text-xs mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
            <span className="text-muted-foreground text-sm">{renderInline(numMatch[2])}</span>
          </div>
        );
        continue;
      }
      if (trimmed.startsWith('•')) {
        const indent = line.search(/\S/);
        result.push(
          <div key={i} className={cn('flex gap-2.5 mt-1.5', indent > 2 ? 'ml-7' : 'ml-1')}>
            <span className="text-primary/50 mt-1.5 text-[6px]">●</span>
            <span className="text-muted-foreground text-sm">{renderInline(trimmed.slice(1).trim())}</span>
          </div>
        );
        continue;
      }
      if (/^\s*-\s/.test(line)) {
        result.push(
          <div key={i} className="flex gap-2.5 ml-7 mt-0.5">
            <span className="text-muted-foreground/50">–</span>
            <span className="text-muted-foreground text-sm">{renderInline(trimmed.slice(1).trim())}</span>
          </div>
        );
        continue;
      }
      result.push(
        <p key={i} className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      );
    }
    return result;
  }, [text]);

  return <>{elements}</>;
}

// ── AiChat ─────────────────────────────────────────────────────────────────

function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const history = messages.slice(-6);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Erro ao responder.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105 active:scale-95',
          open && 'hidden'
        )}
        style={{ width: 52, height: 52 }}
        title="Chat com IA"
      >
        <Bot className="w-5 h-5" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-xl flex flex-col overflow-hidden" style={{ height: 480 }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-primary/5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Assistente Zaapli</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tire dúvidas sobre o sistema</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Olá! Como posso ajudar?</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Pergunte sobre qualquer funcionalidade do Zaapli</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Digite sua pergunta…"
              disabled={loading}
              className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function AjudaPage() {
  const [activeId, setActiveId] = useState(sections[0].id);

  const activeSection = sections.find((s) => s.id === activeId) || sections[0];
  const activeIdx = sections.findIndex((s) => s.id === activeId);
  const ActiveIcon = activeSection.icon;

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-3 md:-m-6">

      {/* ── Conteúdo principal (scroll aqui) ───────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-8 md:py-12">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Docs</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{activeSection.title}</span>
          </nav>

          {/* Título */}
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
                <h2 className="text-base font-semibold mb-4 text-foreground">{item.question}</h2>
                <div className="leading-relaxed">
                  <FormatText text={item.answer} />
                </div>
                {index < activeSection.items.length - 1 && <Separator className="mt-12" />}
              </article>
            ))}
          </div>

          {/* Navegação entre seções */}
          <div className="mt-16 pt-8 border-t border-border/30 flex justify-between">
            {activeIdx > 0 ? (
              <button onClick={() => setActiveId(sections[activeIdx - 1].id)} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                {sections[activeIdx - 1].title}
              </button>
            ) : <div />}
            {activeIdx < sections.length - 1 ? (
              <button onClick={() => setActiveId(sections[activeIdx + 1].id)} className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {sections[activeIdx + 1].title}
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : <div />}
          </div>
        </div>
      </div>

      {/* ── Sidebar direita (fixo — não scrolla) ───────────────────── */}
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
                  onClick={() => setActiveId(section.id)}
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

        {/* Footer fixo */}
        <div className="border-t border-border/40 p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Precisa de ajuda?{' '}
            <a href="mailto:contato@nexioai.online" className="text-primary font-medium hover:underline">
              contato@nexioai.online
            </a>
          </p>
          <a
            href="https://wa.me/5577988650528"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar no WhatsApp
          </a>
        </div>
      </aside>

      {/* Chat IA flutuante */}
      <AiChat />
    </div>
  );
}
