'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  LayoutDashboard,
  Users,
  MapPin,
  MessageSquare,
  Target,
  UserPlus,
  HelpCircle,
} from 'lucide-react';

export default function AjudaPage() {
  const sections = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Visão geral do seu CRM',
      items: [
        {
          question: 'O que é o Dashboard?',
          answer:
            'O Dashboard é sua página inicial, onde você encontra um resumo das principais métricas do seu CRM:\n\n• Total de leads cadastrados\n• Conversões recentes\n• Atendimentos em andamento\n• Próximas tarefas e compromissos',
        },
        {
          question: 'Como usar os gráficos e métricas?',
          answer:
            'Os gráficos mostram a evolução do seu funil de vendas ao longo do tempo. Você pode filtrar por período para analisar seu desempenho semanal, mensal ou anual.',
        },
      ],
    },
    {
      title: 'CRM',
      icon: Users,
      description: 'Gestão de leads e clientes',
      items: [
        {
          question: 'Como cadastrar um novo lead?',
          answer:
            '1. Acesse "CRM" no menu lateral\n2. Clique em "Novo Lead"\n3. Preencha as informações:\n   • Nome completo\n   • E-mail\n   • Telefone/WhatsApp\n   • Empresa\n   • Origem do lead\n4. Clique em "Salvar"\n\nO lead será automaticamente adicionado ao funil de vendas.',
        },
        {
          question: 'Como organizar leads no funil de vendas?',
          answer:
            'Os leads são organizados em estágios:\n\n• Novo Lead: Primeiro contato\n• Qualificado: Lead com potencial confirmado\n• Proposta: Orçamento enviado\n• Negociação: Em processo de fechamento\n• Ganho: Venda concluída\n• Perdido: Não converteu\n\nArraste e solte os leads entre os estágios conforme progridem.',
        },
        {
          question: 'Como editar informações de um lead?',
          answer:
            'Clique no card do lead para abrir seus detalhes. Lá você pode:\n• Editar informações de contato\n• Adicionar notas e observações\n• Registrar interações\n• Anexar arquivos\n• Ver histórico completo',
        },
        {
          question: 'O que são tags e como usá-las?',
          answer:
            'Tags são etiquetas que ajudam a categorizar seus leads. Você pode criar tags personalizadas como:\n• Por produto de interesse\n• Por prioridade (alta, média, baixa)\n• Por origem (site, indicação, evento)\n\nUse tags para filtrar e segmentar sua lista de leads facilmente.',
        },
      ],
    },
    {
      title: 'Captação',
      icon: MapPin,
      description: 'Prospecção e captação de leads',
      items: [
        {
          question: 'O que é a ferramenta de Captação?',
          answer:
            'A Captação permite você prospectar novos leads de forma automatizada. O sistema busca empresas que correspondem ao seu perfil de cliente ideal (ICP) e sugere contatos qualificados.',
        },
        {
          question: 'Como funciona a busca de empresas?',
          answer:
            '1. Defina seus critérios de busca:\n   • Localização (cidade, estado, região)\n   • Segmento de mercado\n   • Porte da empresa\n   • Outros filtros\n2. Clique em "Buscar"\n3. O sistema apresentará uma lista de empresas\n4. Selecione as empresas de interesse\n5. Importe para o CRM como novos leads',
        },
        {
          question: 'Como importar leads em massa?',
          answer:
            'Você pode importar uma planilha (CSV ou Excel) com vários leads de uma vez:\n1. Prepare sua planilha com as colunas necessárias\n2. Acesse Captação > Importar\n3. Faça upload do arquivo\n4. Mapeie as colunas\n5. Confirme a importação\n\nTodos os leads serão criados automaticamente no CRM.',
        },
      ],
    },
    {
      title: 'Atendimento',
      icon: MessageSquare,
      description: 'Comunicação com leads e clientes',
      items: [
        {
          question: 'Como funciona o Atendimento?',
          answer:
            'O módulo de Atendimento centraliza todas as conversas com seus leads e clientes. Você pode:\n• Enviar mensagens via WhatsApp\n• Registrar ligações telefônicas\n• Agendar follow-ups\n• Ver histórico completo de interações',
        },
        {
          question: 'Como integrar o WhatsApp?',
          answer:
            '1. Acesse Configurações > Integrações\n2. Clique em "Conectar WhatsApp"\n3. Escaneie o QR Code com seu celular\n4. Pronto! Agora você pode:\n   • Enviar mensagens direto do CRM\n   • Receber notificações de novas mensagens\n   • Ver histórico de conversas',
        },
        {
          question: 'Como agendar um follow-up?',
          answer:
            'Ao visualizar um lead:\n1. Clique em "Agendar Follow-up"\n2. Defina data e hora\n3. Escolha o tipo (ligação, reunião, e-mail)\n4. Adicione observações\n5. Salve\n\nVocê receberá uma notificação no horário agendado.',
        },
        {
          question: 'Como registrar uma ligação?',
          answer:
            'Após falar com um lead por telefone:\n1. Abra o perfil do lead\n2. Clique em "Registrar Interação"\n3. Selecione "Ligação"\n4. Anote o resultado da conversa\n5. Atualize o estágio se necessário\n6. Salve o registro',
        },
      ],
    },
    {
      title: 'Lead PRO',
      icon: Target,
      description: 'Recursos avançados de qualificação',
      items: [
        {
          question: 'O que é o Lead PRO?',
          answer:
            'Lead PRO é uma funcionalidade premium disponível para empresas com plano VendAgro. Oferece:\n\n• Qualificação automatizada de leads\n• Score de conversão baseado em IA\n• Recomendações de ações\n• Insights avançados\n• Priorização inteligente',
        },
        {
          question: 'Como funciona o score de conversão?',
          answer:
            'O sistema analisa diversos fatores e atribui uma pontuação (0-100) para cada lead, indicando a probabilidade de conversão:\n\n• 80-100: Alta probabilidade (prioridade máxima)\n• 60-79: Média probabilidade\n• 40-59: Baixa probabilidade\n• 0-39: Muito baixa probabilidade\n\nUse o score para priorizar seus esforços.',
        },
        {
          question: 'Como ativar o Lead PRO?',
          answer:
            'O Lead PRO é ativado automaticamente para empresas com plano VendAgro. Se você não tem acesso, entre em contato com o administrador da sua conta para verificar a disponibilidade do plano.',
        },
      ],
    },
    {
      title: 'Membros',
      icon: UserPlus,
      description: 'Gerenciar equipe e permissões',
      items: [
        {
          question: 'Como adicionar membros à equipe?',
          answer:
            'Apenas administradores podem adicionar novos membros. Se você precisa adicionar alguém, solicite ao admin da sua empresa através do menu Membros.',
        },
        {
          question: 'Como atribuir leads para outros membros?',
          answer:
            '1. Abra o lead que deseja atribuir\n2. Clique em "Atribuir para"\n3. Selecione o membro da equipe\n4. Confirme\n\nO membro receberá uma notificação e o lead aparecerá em sua lista.',
        },
        {
          question: 'Como ver os leads da minha equipe?',
          answer:
            'No CRM, use o filtro "Responsável" para visualizar:\n• Apenas meus leads\n• Leads de um membro específico\n• Todos os leads da equipe\n\nVocê pode também usar a visualização em kanban para acompanhar o pipeline completo.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          Central de Ajuda
        </h1>
        <p className="text-muted-foreground mt-2">
          Aprenda a usar todas as funcionalidades do vend.AI CRM
        </p>
      </div>

      <div className="grid gap-6">
        {sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item, itemIndex) => (
                    <AccordionItem key={itemIndex} value={`item-${index}-${itemIndex}`}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Precisa de mais ajuda?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Se você não encontrou a resposta para sua dúvida, entre em contato com o suporte através do e-mail <strong>suporte@vend.ai</strong> ou pelo WhatsApp{' '}
            <strong>(14) 99999-9999</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atalhos de Teclado</CardTitle>
          <CardDescription>Trabalhe mais rápido com esses atalhos úteis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Criar novo lead</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + N</kbd>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Buscar leads</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + K</kbd>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Ir para Dashboard</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + H</kbd>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Abrir esta ajuda</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + /</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
