'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Activity,
  Shield,
  HelpCircle,
} from 'lucide-react';

export default function AdminAjudaPage() {
  const sections = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Visão geral do sistema administrativo',
      items: [
        {
          question: 'O que é o Dashboard do Admin?',
          answer:
            'O Dashboard do Admin é a página inicial que fornece uma visão geral de todas as atividades do sistema. Aqui você encontra métricas importantes como número total de empresas, usuários ativos, respostas de briefing e logs do sistema.',
        },
        {
          question: 'Como interpretar as métricas?',
          answer:
            'As métricas mostram dados em tempo real:\n\n• Total de Empresas: Quantidade de empresas cadastradas\n• Usuários Ativos: Usuários com acesso ao sistema\n• Respostas de Briefing: Formulários preenchidos por leads\n• Logs do Sistema: Registro de todas as atividades',
        },
      ],
    },
    {
      title: 'Gerenciar Empresas',
      icon: Building2,
      description: 'Cadastro e gestão de empresas clientes',
      items: [
        {
          question: 'Como cadastrar uma nova empresa?',
          answer:
            '1. Acesse "Empresas" no menu lateral\n2. Clique em "Nova Empresa"\n3. Preencha os dados:\n   • Nome da empresa\n   • E-mail de contato\n   • Telefone\n   • CNPJ (opcional)\n   • Plano VendAgro (se aplicável)\n4. Clique em "Salvar"',
        },
        {
          question: 'O que é o Plano VendAgro?',
          answer:
            'O Plano VendAgro é um recurso premium que oferece funcionalidades avançadas de captação e qualificação de leads. Empresas com este plano ativo têm acesso ao Lead PRO e recursos de ICP (Ideal Customer Profile).',
        },
        {
          question: 'Como definir o ICP de uma empresa?',
          answer:
            '1. Acesse a lista de empresas\n2. Clique em "Ver Detalhes" na empresa desejada\n3. Clique em "Configurar ICP"\n4. Defina os critérios:\n   • Segmento de mercado\n   • Faturamento mínimo\n   • Localização\n   • Outros filtros relevantes\n5. Salve as configurações',
        },
        {
          question: 'Como editar ou excluir uma empresa?',
          answer:
            'Para editar: Clique no botão "Editar" na listagem ou na página de detalhes da empresa.\n\nPara excluir: Clique em "Excluir" e confirme a ação. ATENÇÃO: Essa ação é irreversível e irá remover todos os dados relacionados à empresa.',
        },
      ],
    },
    {
      title: 'Gerenciar Usuários',
      icon: Users,
      description: 'Controle de acesso e permissões',
      items: [
        {
          question: 'Como criar um novo usuário?',
          answer:
            '1. Acesse "Usuários" no menu\n2. Clique em "Novo Usuário"\n3. Preencha:\n   • Nome completo\n   • E-mail\n   • Senha temporária\n   • Empresa vinculada\n   • Departamento (opcional)\n4. O usuário receberá as credenciais de acesso',
        },
        {
          question: 'Como filtrar usuários por empresa?',
          answer:
            'Na página de Usuários, use o filtro "Filtrar por Empresa" no topo da lista. Selecione a empresa desejada e a lista será atualizada automaticamente mostrando apenas os usuários daquela empresa.',
        },
        {
          question: 'Como desativar um usuário?',
          answer:
            'Para desativar um usuário sem excluí-lo, vá até a lista de usuários, clique em "Editar" no usuário desejado e altere o status para "Inativo". Para excluir permanentemente, clique em "Excluir".',
        },
        {
          question: 'Qual a diferença entre usuário comum e admin?',
          answer:
            'Usuários comuns têm acesso ao sistema CRM de suas empresas, enquanto admins têm acesso total ao painel administrativo, podendo gerenciar todas as empresas, usuários e configurações do sistema.',
        },
      ],
    },
    {
      title: 'Briefing',
      icon: FileText,
      description: 'Formulários de qualificação de leads',
      items: [
        {
          question: 'O que é o sistema de Briefing?',
          answer:
            'O Briefing é um formulário de qualificação que os potenciais clientes preenchem. Ele coleta informações importantes como:\n• Dados de contato\n• Informações da empresa\n• Segmento de atuação\n• Faturamento e budget para marketing\n• Objetivos e expectativas',
        },
        {
          question: 'Como acessar as respostas do Briefing?',
          answer:
            '1. Acesse "Briefing" no menu\n2. Visualize a lista de todas as respostas\n3. Use a busca para encontrar respostas específicas\n4. Clique em "Ver Detalhes" para visualizar uma resposta completa',
        },
        {
          question: 'Como baixar uma resposta em PDF?',
          answer:
            'Na página de detalhes de qualquer resposta de briefing, clique no botão "Baixar PDF" no canto superior direito. O sistema irá gerar um PDF formatado com todas as informações preenchidas.',
        },
        {
          question: 'Como configurar o webhook do Briefing?',
          answer:
            '1. Na página de Briefing, clique em "Configurar Webhook"\n2. Insira a URL do seu webhook\n3. Teste a conexão\n4. Salve\n\nTodas as novas respostas serão enviadas automaticamente para o webhook configurado.',
        },
        {
          question: 'Como compartilhar o link do formulário?',
          answer:
            'Na página de Briefing, você encontrará o link do formulário em destaque. Clique no ícone de copiar para copiar o link e compartilhá-lo com seus leads via WhatsApp, e-mail ou redes sociais.',
        },
      ],
    },
    {
      title: 'Logs do Sistema',
      icon: Activity,
      description: 'Auditoria e rastreamento de atividades',
      items: [
        {
          question: 'O que são os Logs do Sistema?',
          answer:
            'Os Logs registram todas as atividades importantes do sistema, incluindo:\n• Login e logout de usuários\n• Criação e edição de empresas\n• Cadastro de novos usuários\n• Envios de briefing\n• Alterações de configurações',
        },
        {
          question: 'Como filtrar os logs?',
          answer:
            'Use os filtros disponíveis na página de Logs:\n• Por tipo de ação (login, cadastro, edição, etc.)\n• Por usuário\n• Por período (data/hora)\n• Por empresa',
        },
        {
          question: 'Por quanto tempo os logs ficam armazenados?',
          answer:
            'Os logs são mantidos por 90 dias. Após esse período, os registros mais antigos são arquivados automaticamente para otimizar o desempenho do sistema.',
        },
      ],
    },
    {
      title: 'Segurança e Permissões',
      icon: Shield,
      description: 'Controle de acesso e segurança',
      items: [
        {
          question: 'Como garantir a segurança das contas?',
          answer:
            'Boas práticas de segurança:\n• Use senhas fortes (mín. 8 caracteres)\n• Nunca compartilhe suas credenciais de admin\n• Revise regularmente a lista de usuários ativos\n• Desative imediatamente usuários que deixaram a empresa\n• Monitore os logs para detectar atividades suspeitas',
        },
        {
          question: 'Como recuperar senha de um usuário?',
          answer:
            'Se um usuário esqueceu a senha:\n1. Acesse "Usuários"\n2. Encontre o usuário\n3. Clique em "Redefinir Senha"\n4. Uma nova senha temporária será gerada\n5. Envie a nova senha ao usuário de forma segura',
        },
        {
          question: 'Posso logar como usuário comum?',
          answer:
            'Sim! Admins podem acessar tanto o painel admin quanto o dashboard de usuário. Na tela de login, selecione "Usuário" para acessar o dashboard comum ou "Admin" para o painel administrativo.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          Central de Ajuda - Administrador
        </h1>
        <p className="text-muted-foreground mt-2">
          Guia completo sobre como usar o painel administrativo do vend.AI
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
            Se você não encontrou a resposta para sua dúvida, entre em contato com o suporte técnico através do e-mail <strong>suporte@vend.ai</strong> ou pelo WhatsApp{' '}
            <strong>(14) 99999-9999</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
