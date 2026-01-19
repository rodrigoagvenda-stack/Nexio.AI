'use client';

import { OrbitCard, OrbitCardContent, OrbitCardDescription, OrbitCardHeader, OrbitCardTitle } from '@/components/ui/orbit-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Activity,
  Shield,
  HelpCircle,
  Webhook,
  DollarSign,
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
            'O Dashboard do Admin é a página inicial que fornece uma visão geral de todas as atividades do sistema:\n\n**Métricas Principais:**\n• Total de Empresas cadastradas\n• Usuários Ativos no sistema\n• Respostas de Briefing recebidas\n• Logs do Sistema registrados\n\n**Gráficos e Relatórios:**\n• MRR (Monthly Recurring Revenue)\n• Evolução de receita mensal\n• Distribuição de empresas por plano\n• Taxa de churn e retenção\n• Filtros por período (mensal, trimestral, anual)',
        },
        {
          question: 'Como interpretar os gráficos de MRR?',
          answer:
            'Os gráficos de MRR mostram a receita recorrente mensal:\n\n**MRR Total:**\nSoma de todas as mensalidades ativas:\n• NEXIO SALES: R$ 1.600/empresa\n• NEXIO GROWTH: R$ 2.000/empresa\n• NEXIO ADS: R$ 2.600/empresa\n\n**Gráfico de Evolução:**\n• Linha temporal mostrando crescimento do MRR\n• Compare períodos diferentes\n• Identifique sazonalidades\n• Projete receita futura\n\n**Distribuição por Plano:**\n• Gráfico de pizza mostrando % de cada plano\n• Identifique qual plano tem mais adesão\n• Planeje estratégias de upsell',
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
            '1. Acesse "Empresas" no menu lateral\n2. Clique em "+ Nova Empresa"\n3. Preencha os dados obrigatórios:\n   • Nome da empresa\n   • E-mail de contato\n   • Telefone\n4. Preencha dados complementares:\n   • CNPJ\n   • Endereço completo\n   • Site\n   • Segmento de atuação\n5. Selecione o plano:\n   • NEXIO SALES (R$ 1.600/mês)\n   • NEXIO GROWTH (R$ 2.000/mês)\n   • NEXIO ADS (R$ 2.600/mês)\n6. Configure limites:\n   • Número de usuários permitidos\n   • Cota de leads (para NEXIO GROWTH)\n7. Clique em "Salvar Empresa"',
        },
        {
          question: 'Quais são os planos disponíveis?',
          answer:
            '**NEXIO SALES - R$ 1.600/mês**\n• CRM Completo\n• Chat IA integrado\n• Funil de Vendas\n• Gestão de Leads ilimitada\n• Sem recursos de captação/extração\n• Ideal para: Empresas que já têm geração de leads própria\n\n**NEXIO GROWTH - R$ 2.000/mês**\n• Tudo do NEXIO SALES\n• + 500 leads inclusos por mês\n• Captação e prospecção automatizada\n• Leads extras:\n  - R$ 1,00 por lead adicional\n  - Ou R$ 400 por pacote de +500 leads\n• Enriquecimento de dados\n• Validação de contatos\n• Ideal para: Empresas em crescimento que precisam escalar\n\n**NEXIO ADS - R$ 2.600/mês**\n• Tudo do NEXIO GROWTH\n• + Gestão de Tráfego Pago integrada\n• Campanhas Google Ads e Meta Ads\n• Otimização automática por IA\n• Relatórios de ROI e performance\n• Dashboard de anúncios\n• Ideal para: Empresas que investem em mídia paga',
        },
        {
          question: 'Como definir o ICP de uma empresa?',
          answer:
            'ICP (Ideal Customer Profile) define o perfil de cliente ideal da empresa:\n\n**Configurar ICP:**\n1. Acesse Empresas > [Selecione a Empresa] > "Configurar ICP"\n2. Defina critérios de qualificação:\n\n**Segmento de Mercado:**\n• CNAEs primários e secundários\n• Indústrias de interesse\n• Nichos específicos\n\n**Localização:**\n• Estados prioritários\n• Cidades-alvo\n• Regiões de atuação\n\n**Porte da Empresa:**\n• Faturamento anual (mínimo e máximo)\n• Número de funcionários\n• Classificação (MEI, ME, EPP, Grande)\n\n**Características Adicionais:**\n• Budget médio para produtos/serviços\n• Ciclo de venda típico\n• Sinais de compra (pain points)\n• Tecnologias que usam\n\n3. Salve as configurações\n\n**Como o ICP é usado:**\n• Sistema calcula score de fit para cada lead (0-100)\n• Captação automatizada busca empresas similares ao ICP\n• Lead PRO prioriza leads com alto fit\n• Relatórios mostram desvios do perfil ideal',
        },
        {
          question: 'Como gerenciar limites de leads do NEXIO GROWTH?',
          answer:
            'Empresas no plano NEXIO GROWTH têm cota mensal de leads:\n\n**Monitorar Uso:**\n1. Acesse Empresas > [Empresa] > Aba "Consumo"\n2. Veja métricas:\n   • Leads inclusos no plano: 500/mês\n   • Leads já utilizados no mês\n   • Leads restantes\n   • Histórico de consumo\n\n**Quando ultrapassa a cota:**\n• Sistema alerta a empresa via e-mail\n• Captação é pausada automaticamente\n• Empresa pode:\n  1. Comprar leads avulsos (R$ 1,00/lead)\n  2. Comprar pacote de +500 (R$ 400)\n  3. Aguardar próximo ciclo de cobrança\n\n**Configurar Alertas:**\n• Defina % de uso para alerta (ex: 80%)\n• Notifique empresa quando atingir limite\n• Configure renovação automática de pacotes',
        },
        {
          question: 'Como editar ou excluir uma empresa?',
          answer:
            '**Editar Empresa:**\n1. Acesse Empresas > Clique na empresa desejada\n2. Clique em "Editar" no topo da página\n3. Modifique as informações necessárias\n4. Altere o plano se aplicável\n5. Salve as alterações\n\n**Excluir Empresa:**\n⚠️ **ATENÇÃO**: Esta ação é IRREVERSÍVEL!\n\n1. Acesse Empresas > Empresa desejada\n2. Clique em "Excluir Empresa"\n3. Sistema mostrará aviso sobre dados que serão removidos:\n   • Todos os usuários da empresa\n   • Todos os leads e pipeline\n   • Histórico de conversas\n   • Arquivos anexados\n   • Configurações e integrações\n4. Digite "CONFIRMAR EXCLUSÃO" para confirmar\n5. Clique em "Excluir Permanentemente"\n\n**Alternativa - Desativar:**\nPara manter histórico mas suspender acesso:\n• Marque empresa como "Inativa"\n• Usuários não conseguirão fazer login\n• Dados ficam preservados\n• Pode reativar a qualquer momento',
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
            '1. Acesse "Usuários" no menu administrativo\n2. Clique em "+ Novo Usuário"\n3. Preencha o formulário:\n\n**Dados Pessoais:**\n• Nome completo\n• E-mail corporativo (será o login)\n• CPF (opcional)\n\n**Vinculação:**\n• Selecione a Empresa\n• Departamento (Vendas, Marketing, TI, etc.)\n• Cargo/Função\n\n**Credenciais:**\n• Senha temporária (usuário deverá alterar no primeiro acesso)\n• Ou envie link de ativação por e-mail\n\n**Permissões:**\n• Nível de acesso (Visualizador, Vendedor, Admin)\n• Recursos disponíveis\n• Restrições específicas\n\n4. Clique em "Criar Usuário"\n5. Usuário recebe e-mail com instruções de acesso',
        },
        {
          question: 'Como filtrar usuários por empresa?',
          answer:
            'Na página de Usuários, você tem várias opções de filtro:\n\n**Filtro por Empresa:**\n1. Use o dropdown "Filtrar por Empresa" no topo\n2. Selecione a empresa desejada\n3. Lista atualiza automaticamente\n\n**Filtros Avançados:**\n• **Por Status**: Ativo, Inativo, Pendente\n• **Por Departamento**: Vendas, Marketing, etc.\n• **Por Nível de Acesso**: Admin, Vendedor, Visualizador\n• **Por Data de Cadastro**: Últimos 7 dias, 30 dias, etc.\n\n**Busca Rápida:**\n• Use a barra de busca para procurar por:\n  - Nome do usuário\n  - E-mail\n  - Empresa\n\n**Exportar Lista:**\n• Clique em "Exportar" para baixar lista filtrada\n• Formatos: CSV, Excel, PDF\n• Inclui todos os dados visíveis na tabela',
        },
        {
          question: 'Como desativar um usuário?',
          answer:
            '**Desativar (Suspender Acesso):**\n1. Encontre o usuário na lista\n2. Clique em "Editar"\n3. Altere o status para "Inativo"\n4. Salve as alterações\n\n**Resultado:**\n• Usuário não consegue mais fazer login\n• Dados e histórico são preservados\n• Leads continuam atribuídos ao usuário\n• Pode ser reativado a qualquer momento\n\n**Excluir Permanentemente:**\n⚠️ Use com cautela!\n1. Clique em "Excluir" na lista de usuários\n2. Sistema solicita confirmação\n3. Escolha o que fazer com leads atribuídos:\n   • Transferir para outro vendedor\n   • Deixar sem responsável\n   • Excluir junto com o usuário\n4. Confirme a exclusão\n\n**Boas Práticas:**\n• Desative ao invés de excluir (para manter histórico)\n• Transfira leads antes de desativar\n• Documente motivo da desativação',
        },
        {
          question: 'Qual a diferença entre usuário comum e admin?',
          answer:
            'Existem diferentes níveis de permissão:\n\n**Usuário Comum (Vendedor/Visualizador):**\n• Acessa apenas o CRM da sua empresa\n• Vê e gerencia seus próprios leads\n• Registra interações e move leads no funil\n• Acessa relatórios básicos\n• Não tem acesso ao painel admin\n• Não pode alterar configurações da empresa\n\n**Admin da Empresa:**\n• Acesso total ao CRM da empresa\n• Gerencia todos os leads (de todos os vendedores)\n• Adiciona e remove membros da equipe\n• Configura integrações (WhatsApp, IA, etc.)\n• Define ICP e regras de qualificação\n• Acessa relatórios avançados e dashboard executivo\n• Ainda NÃO tem acesso ao painel super admin\n\n**Super Admin (Administrador do Sistema):**\n• Acesso ao painel administrativo global\n• Gerencia TODAS as empresas do sistema\n• Cria e edita empresas\n• Gerencia todos os usuários\n• Acessa webhooks e configurações globais\n• Monitor N8N e logs do sistema\n• Define planos e preços\n• Controle total sobre a plataforma',
        },
        {
          question: 'Como resetar a senha de um usuário?',
          answer:
            '**Método 1 - Pelo Painel Admin:**\n1. Acesse Usuários > Encontre o usuário\n2. Clique em "Redefinir Senha"\n3. Sistema gera senha temporária ou link de redefinição\n4. Copie a senha/link\n5. Envie ao usuário de forma segura (e-mail, WhatsApp)\n6. Usuário deve alterar no próximo login\n\n**Método 2 - Envio Automático:**\n1. Clique em "Enviar Link de Redefinição"\n2. Sistema envia e-mail automático ao usuário\n3. Link é válido por 24 horas\n4. Usuário clica no link e define nova senha\n\n**Método 3 - Usuário Solicita:**\n1. Usuário clica em "Esqueci minha senha" na tela de login\n2. Informa seu e-mail\n3. Recebe link de redefinição\n4. Define nova senha\n\n**Segurança:**\n• Senhas devem ter no mínimo 8 caracteres\n• Recomendado: letras, números e símbolos\n• Sistema força alteração de senhas temporárias\n• Histórico de senhas para evitar reutilização',
        },
      ],
    },
    {
      title: 'Webhooks & APIs',
      icon: Webhook,
      description: 'Integrações e configurações de APIs',
      items: [
        {
          question: 'O que é a página Webhooks & APIs?',
          answer:
            'Centraliza TODAS as configurações de integrações e APIs do sistema:\n\n**Seções Disponíveis:**\n\n**1. Configuração de IA**\n• Provedor (OpenAI ou Anthropic)\n• Modelo (GPT-4, Claude Opus, etc.)\n• API Key\n• Parâmetros de temperatura e tokens\n\n**2. Configuração Uazapi (WhatsApp)**\n• API Token do Uazapi\n• Nome da instância\n• Número do telefone\n• Configurações de webhook\n\n**3. Webhooks Personalizados**\n• Lista de webhooks cadastrados\n• Adicionar novo webhook\n• Editar URL e segredo\n• Testar conexão\n• Ver logs de envio',
        },
        {
          question: 'Como configurar a IA do sistema?',
          answer:
            '1. Acesse Admin > Webhooks & APIs\n2. Seção "Configuração de IA"\n\n**Escolher Provedor:**\n• **OpenAI**: GPT-3.5, GPT-4, GPT-4 Turbo\n• **Anthropic**: Claude 3 Opus, Claude 3.5 Sonnet\n\n**Configurar API:**\n1. Selecione o provedor\n2. Escolha o modelo:\n   • GPT-4: Mais inteligente, mais caro\n   • GPT-3.5-turbo: Mais rápido, mais barato\n   • Claude Opus: Excelente para análises complexas\n3. Cole sua API Key (mantida segura e criptografada)\n4. Teste a conexão\n5. Salve as configurações\n\n**Onde a IA é Usada:**\n• Chat IA para qualificação de leads\n• Análise de sentimento em conversas\n• Sugestões de respostas automáticas\n• Score de conversão (Lead PRO)\n• Análise de erros N8N\n• Recomendações de ações',
        },
        {
          question: 'Como integrar o WhatsApp via Uazapi?',
          answer:
            '**Pré-requisito:**\n• Conta ativa no Uazapi.com\n• Número de WhatsApp Business\n\n**Configuração:**\n1. Acesse Admin > Webhooks & APIs\n2. Seção "Configuração Uazapi"\n3. Preencha:\n   • **API Token**: Obtido no painel Uazapi\n   • **Nome da Instância**: Nome configurado no Uazapi\n   • **Número do Telefone**: Com código do país (+55)\n4. Clique em "Testar Conexão"\n5. Se OK, clique em "Salvar Configuração"\n\n**Configurar Webhook no Uazapi:**\n1. Acesse painel Uazapi\n2. Configure webhook apontando para:\n   `https://seudominio.com/api/webhooks/uazapi`\n3. Defina eventos:\n   • message.received\n   • message.sent\n   • message.read\n\n**Recursos Disponíveis:**\n• Envio de mensagens direto do CRM\n• Recebimento em tempo real\n• Histórico sincronizado\n• Anexos (imagens, documentos, áudios)\n• Templates pré-aprovados',
        },
        {
          question: 'Como criar webhooks personalizados?',
          answer:
            'Webhooks permitem enviar dados para sistemas externos:\n\n**Casos de Uso:**\n• Notificar sistema externo sobre novo lead\n• Integrar com ferramentas de marketing\n• Enviar dados para BI/Analytics\n• Sincronizar com ERP\n\n**Criar Webhook:**\n1. Acesse Admin > Webhooks & APIs\n2. Seção "Webhooks" > "+ Adicionar Webhook"\n3. Preencha:\n   • **Nome**: Identificação do webhook\n   • **Tipo**: Evento que dispara (lead_created, deal_won, etc.)\n   • **URL**: Endpoint que receberá os dados\n   • **Secret**: Chave secreta para validação\n4. Teste o webhook\n5. Salve\n\n**Eventos Disponíveis:**\n• `lead.created` - Novo lead cadastrado\n• `lead.updated` - Lead atualizado\n• `deal.won` - Venda ganha\n• `deal.lost` - Venda perdida\n• `briefing.submitted` - Formulário enviado\n• `message.received` - Mensagem recebida\n\n**Payload Enviado:**\n```json\n{\n  "event": "lead.created",\n  "timestamp": "2026-01-17T10:30:00Z",\n  "data": {\n    "id": "123",\n    "name": "João Silva",\n    "email": "joao@empresa.com",\n    ...\n  }\n}\n```',
        },
      ],
    },
    {
      title: 'Monitor N8N',
      icon: Activity,
      description: 'Monitoramento de workflows e automações',
      items: [
        {
          question: 'O que é o Monitor N8N?',
          answer:
            'O Monitor N8N rastreia e gerencia instâncias de automação N8N:\n\n**Funcionalidades:**\n• Dashboard com estatísticas em tempo real\n• Listagem de todas as instâncias N8N\n• Histórico completo de erros\n• Análise de erros por IA\n• Alertas e notificações\n• Gestão de uptime e disponibilidade\n\n**Métricas Monitoradas:**\n• Total de instâncias ativas\n• Erros nas últimas 24 horas\n• Uptime médio das instâncias\n• Workflows com problemas\n• Performance e latência',
        },
        {
          question: 'Como adicionar uma instância N8N?',
          answer:
            '1. Acesse Admin > Monitor N8N\n2. Clique em "+ Nova Instância"\n3. Preencha os dados:\n\n**Informações Básicas:**\n• **Nome da Instância**: Ex: "N8N Produção"\n• **URL**: https://n8n.seudominio.com\n• **API Key**: Chave de acesso do N8N\n\n**Configurações:**\n• **Intervalo de Verificação**: De quantos em quantos minutos verificar (padrão: 5 min)\n• **Status Inicial**: Ativa ou Inativa\n\n4. Teste a conexão\n5. Salve a instância\n\n**Sistema Monitora:**\n• Disponibilidade da instância\n• Erros em execuções de workflows\n• Performance e tempo de resposta\n• Webhooks que falharam',
        },
        {
          question: 'Como visualizar e resolver erros?',
          answer:
            '**Visualizar Erros:**\n1. Acesse Monitor N8N\n2. Veja a seção "Histórico de Erros"\n3. Use filtros:\n   • Por instância\n   • Por severidade (Baixa, Média, Alta, Crítica)\n   • Por status (Resolvido, Pendente)\n   • Por período\n\n**Detalhes do Erro:**\nClique em um erro para ver:\n• Nome do workflow que falhou\n• Node específico com problema\n• Mensagem de erro completa\n• Stack trace técnico\n• Timestamp da ocorrência\n• Análise IA (se disponível)\n\n**Análise por IA:**\n• Clique em "Analisar com IA"\n• Sistema usa GPT-4 ou Claude para:\n  - Identificar causa raiz\n  - Sugerir correções\n  - Explicar erro em linguagem simples\n  - Recomendar próximos passos\n\n**Resolver Erro:**\n1. Após corrigir no N8N, clique em "Resolver"\n2. Ou clique em "Ignorar" se não é relevante\n3. Ou "Reprocessar" para tentar executar novamente',
        },
        {
          question: 'Como interpretar níveis de severidade?',
          answer:
            'Erros são classificados automaticamente:\n\n**🔵 Baixa (Low):**\n• Erros esporádicos não críticos\n• Workflows que falharam mas têm retry\n• Avisos e warnings\n• Não requer ação imediata\n\n**🟡 Média (Medium):**\n• Erros que afetam funcionalidades secundárias\n• Problemas intermitentes\n• Requer investigação em até 24h\n\n**🟠 Alta (High):**\n• Erros em workflows importantes\n• Afeta funcionalidades principais\n• Múltiplas falhas consecutivas\n• Requer ação em até 4h\n\n**🔴 Crítica (Critical):**\n• Sistema completamente indisponível\n• Perda de dados possível\n• Afeta produção e clientes\n• AÇÃO IMEDIATA NECESSÁRIA\n\n**Configurar Alertas:**\n• Defina quais severidades geram notificação\n• Configure canais (e-mail, Slack, WhatsApp)\n• Estabeleça escalação automática',
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
            'O Briefing é um formulário de qualificação que potenciais clientes preenchem:\n\n**Informações Coletadas:**\n\n**Dados de Contato:**\n• Nome completo\n• E-mail\n• Telefone/WhatsApp\n• Cargo na empresa\n\n**Informações da Empresa:**\n• Nome da empresa\n• CNPJ\n• Segmento de atuação\n• Número de funcionários\n• Faturamento anual\n• Site e redes sociais\n\n**Qualificação:**\n• Objetivos e metas\n• Desafios atuais\n• Budget disponível para investimento\n• Ferramentas que já utiliza\n• Prazo para implementação\n• Como conheceu a solução\n\n**Uso do Briefing:**\n• Qualificar leads antes do contato comercial\n• Segmentar leads por perfil e necessidade\n• Personalizar abordagem de vendas\n• Calcular fit score automaticamente',
        },
        {
          question: 'Como acessar as respostas do Briefing?',
          answer:
            '1. Acesse Admin > Briefing no menu\n2. Visualize a lista de todas as respostas\n\n**Informações Visíveis:**\n• Nome e empresa do lead\n• Data de preenchimento\n• Segmento e porte\n• Budget informado\n• Status (Novo, Em análise, Convertido)\n\n**Ações Disponíveis:**\n• **Ver Detalhes**: Abre resposta completa\n• **Baixar PDF**: Gera PDF formatado\n• **Enviar para CRM**: Cria lead automaticamente\n• **Marcar como Lido**: Organização\n• **Arquivar**: Remove da lista principal\n\n**Busca e Filtros:**\n• Buscar por nome, empresa ou e-mail\n• Filtrar por:\n  - Data (últimos 7 dias, 30 dias, etc.)\n  - Segmento\n  - Faixa de budget\n  - Status de análise\n• Ordenar por data, nome ou empresa',
        },
        {
          question: 'Como baixar uma resposta em PDF?',
          answer:
            '1. Na lista de Briefings, clique em "Ver Detalhes"\n2. No topo da página, clique em "Baixar PDF"\n3. Sistema gera PDF formatado incluindo:\n   • Logo do Nexio.AI\n   • Data de preenchimento\n   • Dados de contato completos\n   • Informações da empresa\n   • Todas as respostas do formulário\n   • Análise de fit score\n   • Recomendações de abordagem\n\n**PDF Profissional:**\n• Design limpo e organizado\n• Seções bem delimitadas\n• Fácil de compartilhar com equipe comercial\n• Pode ser anexado em propostas\n\n**Uso Recomendado:**\n• Envie PDF para vendedor responsável\n• Anexe em reunião de qualificação\n• Arquive em pasta do cliente\n• Use para preparação pré-reunião',
        },
        {
          question: 'Como compartilhar o link do formulário?',
          answer:
            'O formulário tem um link público que pode ser compartilhado:\n\n**Obter o Link:**\n1. Acesse Admin > Briefing\n2. No topo, veja o link do formulário em destaque\n3. Clique no ícone de "Copiar" ao lado\n\nFormato: `https://nexio.ai/briefing`\n\n**Onde Compartilhar:**\n\n**Website:**\n• Botão de CTA no header\n• Pop-up de saída\n• Landing pages específicas\n• Footer com link\n\n**Redes Sociais:**\n• Link na bio do Instagram\n• Posts no LinkedIn\n• Stories com swipe up\n• Tweet fixado\n\n**E-mail Marketing:**\n• Campanhas de nutrição\n• Assinatura de e-mail\n• Automações de follow-up\n\n**WhatsApp:**\n• Mensagens de primeiro contato\n• Status/Stories\n• Grupos relevantes\n\n**QR Code:**\n• Gere QR Code do link\n• Use em materiais impressos\n• Eventos e feiras\n• Cartões de visita',
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
            'Os Logs registram TODAS as atividades importantes do sistema:\n\n**Eventos Registrados:**\n\n**Autenticação:**\n• Login de usuários (admin e comum)\n• Logout\n• Tentativas de login falhas\n• Redefinições de senha\n• Sessões expiradas\n\n**Gestão de Dados:**\n• Criação de empresas\n• Edição de dados de empresas\n• Exclusão de empresas\n• Cadastro de novos usuários\n• Alteração de permissões\n• Desativação de usuários\n\n**Atividades do Sistema:**\n• Envios de briefing\n• Criação de leads\n• Alterações de estágio no funil\n• Integrações acionadas\n• Webhooks enviados\n• Erros de API\n• Alterações em configurações globais\n\n**Para Cada Log:**\n• Timestamp preciso\n• Usuário responsável\n• IP de origem\n• Ação executada\n• Dados antes/depois (quando aplicável)',
        },
        {
          question: 'Como filtrar os logs?',
          answer:
            'Use os filtros disponíveis na página de Logs:\n\n**Filtro por Tipo de Ação:**\n• Login/Logout\n• Criar\n• Editar\n• Excluir\n• Visualizar\n• Erro\n\n**Filtro por Usuário:**\n• Selecione usuário específico\n• Veja todas ações dele\n• Útil para auditoria individual\n\n**Filtro por Período:**\n• Última hora\n• Últimas 24 horas\n• Últimos 7 dias\n• Últimos 30 dias\n• Personalizado (data inicial e final)\n\n**Filtro por Empresa:**\n• Veja apenas logs de uma empresa\n• Útil para troubleshooting específico\n\n**Filtro por Severidade:**\n• Info: Informações normais\n• Warning: Avisos\n• Error: Erros que ocorreram\n• Critical: Erros críticos\n\n**Busca por Texto:**\n• Busque por palavras-chave\n• Encontre ações específicas\n• Use aspas para busca exata',
        },
        {
          question: 'Por quanto tempo os logs ficam armazenados?',
          answer:
            '**Retenção de Dados:**\n\n**Logs Ativos (Últimos 90 dias):**\n• Disponíveis na interface do admin\n• Busca e filtros em tempo real\n• Exportação ilimitada\n\n**Logs Arquivados (90 dias - 2 anos):**\n• Armazenados em arquivo comprimido\n• Acesso mediante solicitação\n• Tempo de recuperação: 24-48h\n• Exportação em CSV\n\n**Logs Antigos (> 2 anos):**\n• Removidos automaticamente\n• Exceto logs críticos (auditoria legal)\n• Logs de segurança mantidos por 5 anos\n\n**Por que 90 dias?**\n• Otimiza performance do banco de dados\n• Reduz custo de armazenamento\n• Mantém interface rápida e responsiva\n• Atende requisitos de auditoria\n\n**Exportar Logs:**\n• Para guardar por mais tempo, exporte regularmente\n• Formato CSV compatível com Excel/Google Sheets\n• Inclui todos os campos e metadados',
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
            '**Boas Práticas de Segurança:**\n\n**Senhas Fortes:**\n• Mínimo 8 caracteres (recomendado: 12+)\n• Combinar letras maiúsculas e minúsculas\n• Incluir números e símbolos\n• Evitar palavras do dicionário\n• Não reutilizar senhas de outros sistemas\n• Usar gerenciador de senhas\n\n**Acesso Administrativo:**\n• NUNCA compartilhe credenciais de super admin\n• Use autenticação em dois fatores (2FA)\n• Limite número de super admins (máx 2-3)\n• Revise lista de admins mensalmente\n\n**Gestão de Usuários:**\n• Revise regularmente lista de usuários ativos\n• Desative IMEDIATAMENTE usuários que saíram\n• Remova permissões desnecessárias\n• Aplique princípio do menor privilégio\n\n**Monitoramento:**\n• Revise logs de login regularmente\n• Investigue tentativas de login falhas\n• Configure alertas para atividades suspeitas\n• Audite mudanças em configurações críticas\n\n**Dados Sensíveis:**\n• API Keys são criptografadas no banco\n• Senhas usam hash bcrypt\n• Comunicações via HTTPS (TLS 1.3)\n• Backups diários criptografados',
        },
        {
          question: 'Como investigar atividade suspeita?',
          answer:
            'Se detectar comportamento anormal:\n\n**1. Identificar a Atividade:**\n• Acesse Admin > Logs do Sistema\n• Filtre por:\n  - Usuário suspeito\n  - Período específico\n  - Tipo de ação (especialmente "Excluir", "Editar")\n\n**2. Analisar Padrões:**\n• Múltiplos logins de IPs diferentes?\n• Logins fora do horário normal?\n• Muitas tentativas de login falhas?\n• Ações em massa (edição/exclusão)?\n• Acesso a dados sensíveis?\n\n**3. Verificar IP de Origem:**\n• Compare com IPs conhecidos do usuário\n• IPs estrangeiros (se usuário é BR)?\n• Use ferramentas de geolocalização\n\n**4. Ações Imediatas:**\n• **Se confirmar invasão:**\n  1. Desative conta comprometida IMEDIATAMENTE\n  2. Force logout de todas as sessões\n  3. Resete senha\n  4. Revogue tokens de API\n  5. Notifique usuário legítimo\n\n• **Se for falso positivo:**\n  1. Entre em contato com usuário\n  2. Documente a situação\n  3. Ajuste regras de alerta se necessário\n\n**5. Investigação Detalhada:**\n• Exporte logs do período\n• Documente todas as ações suspeitas\n• Verifique se dados foram acessados/exfiltrados\n• Notifique empresas afetadas se aplicável',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold flex items-center gap-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          <HelpCircle className="h-8 w-8 text-purple-400" />
          Central de Ajuda - Administrador
        </h1>
        <p className="text-muted-foreground mt-2">
          Guia completo sobre como usar o painel administrativo do Nexio.AI
        </p>
      </div>

      <div className="grid gap-6">
        {sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <OrbitCard key={index}>
              <OrbitCardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <OrbitCardTitle>{section.title}</OrbitCardTitle>
                    <OrbitCardDescription>{section.description}</OrbitCardDescription>
                  </div>
                </div>
              </OrbitCardHeader>
              <OrbitCardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item, itemIndex) => (
                    <AccordionItem key={itemIndex} value={`item-${index}-${itemIndex}`}>
                      <AccordionTrigger className="text-left hover:text-primary transition-colors">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </OrbitCardContent>
            </OrbitCard>
          );
        })}
      </div>

      <OrbitCard className="border-primary/20">
        <OrbitCardHeader>
          <OrbitCardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Precisa de mais ajuda?
          </OrbitCardTitle>
        </OrbitCardHeader>
        <OrbitCardContent>
          <p className="text-sm text-muted-foreground">
            Se você não encontrou a resposta para sua dúvida, entre em contato com o suporte técnico através do e-mail{' '}
            <strong className="text-primary">suporte@nexio.ai</strong> ou pelo WhatsApp{' '}
            <strong className="text-primary">(11) 99999-9999</strong>
          </p>
        </OrbitCardContent>
      </OrbitCard>
    </div>
  );
}
