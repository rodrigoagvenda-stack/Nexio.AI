'use client';

import { useState, type FormEvent } from 'react';
import { OrbitCard, OrbitCardContent, OrbitCardDescription, OrbitCardHeader, OrbitCardTitle } from '@/components/ui/orbit-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  Shield,
  HelpCircle,
  Webhook,
  DollarSign,
  Ticket,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function SupportTicketForm() {
  const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const inputClass = 'w-full h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors';

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-semibold">Ticket enviado!</p>
        <p className="text-xs text-muted-foreground">Você receberá uma confirmação por e-mail com o número do protocolo. Retornamos em até 24 horas úteis.</p>
        <button onClick={() => { setStatus('idle'); setForm({ nome: '', email: '', assunto: '', mensagem: '' }); }} className="mt-2 text-xs text-primary hover:underline">
          Abrir novo ticket
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Nome <span className="text-red-500">*</span></label>
          <input name="nome" required value={form.nome} onChange={handleChange} placeholder="Seu nome" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">E-mail <span className="text-red-500">*</span></label>
          <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="seu@email.com" className={inputClass} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Categoria <span className="text-red-500">*</span></label>
        <select name="assunto" required value={form.assunto} onChange={handleChange} className={`${inputClass} cursor-pointer`}>
          <option value="" disabled>Selecione...</option>
          <option value="Problema técnico">Problema técnico</option>
          <option value="WhatsApp / Conexão">WhatsApp / Conexão</option>
          <option value="Agente IA não responde">Agente IA não responde</option>
          <option value="Cobrança / Pagamento">Cobrança / Pagamento</option>
          <option value="Dúvida sobre funcionalidade">Dúvida sobre funcionalidade</option>
          <option value="Acesso / Permissões">Acesso / Permissões</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Descrição <span className="text-red-500">*</span></label>
        <textarea name="mensagem" required rows={4} value={form.mensagem} onChange={handleChange} placeholder="Descreva o problema com o máximo de detalhes..." className={`${inputClass} h-auto resize-none py-2`} />
      </div>
      {status === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={status === 'loading' || !form.nome || !form.email || !form.assunto || !form.mensagem}
        className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading'
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</>
          : <><Send className="h-3.5 w-3.5" />Enviar ticket</>}
      </button>
      <p className="text-[11px] text-muted-foreground text-center">
        Urgente? <a href="mailto:suporte@zaapply.com.br" className="text-primary hover:underline">suporte@zaapply.com.br</a>
      </p>
    </form>
  );
}

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
            'Existem diferentes níveis de permissão:\n\n**Usuário Comum (Vendedor/Visualizador):**\n• Acessa apenas o CRM da sua empresa\n• Vê e gerencia seus próprios leads\n• Registra interações e move leads no funil\n• Acessa relatórios básicos\n• Não tem acesso ao painel admin\n• Não pode alterar configurações da empresa\n\n**Admin da Empresa:**\n• Acesso total ao CRM da empresa\n• Gerencia todos os leads (de todos os vendedores)\n• Adiciona e remove membros da equipe\n• Configura integrações (WhatsApp, IA, etc.)\n• Define ICP e regras de qualificação\n• Acessa relatórios avançados e dashboard executivo\n• Ainda NÃO tem acesso ao painel super admin\n\n**Super Admin (Administrador do Sistema):**\n• Acesso ao painel administrativo global\n• Gerencia TODAS as empresas do sistema\n• Cria e edita empresas\n• Gerencia todos os usuários\n• Acessa webhooks e configurações globais\n• Monitor de bugs e logs do sistema\n• Define planos e preços\n• Controle total sobre a plataforma',
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
            '1. Acesse Admin > Webhooks & APIs\n2. Seção "Configuração de IA"\n\n**Escolher Provedor:**\n• **OpenAI**: GPT-3.5, GPT-4, GPT-4 Turbo\n• **Anthropic**: Claude 3 Opus, Claude 3.5 Sonnet\n\n**Configurar API:**\n1. Selecione o provedor\n2. Escolha o modelo:\n   • GPT-4: Mais inteligente, mais caro\n   • GPT-3.5-turbo: Mais rápido, mais barato\n   • Claude Opus: Excelente para análises complexas\n3. Cole sua API Key (mantida segura e criptografada)\n4. Teste a conexão\n5. Salve as configurações\n\n**Onde a IA é Usada:**\n• Chat IA para qualificação de leads\n• Análise de sentimento em conversas\n• Sugestões de respostas automáticas\n• Score de conversão (Lead PRO)\n• Recomendações de ações',
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
        <h1 className="text-3xl font-semibold flex items-center gap-3 bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent">
          <HelpCircle className="h-8 w-8 text-green-400" />
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
            <Ticket className="h-5 w-5 text-primary" />
            Abrir ticket de suporte
          </OrbitCardTitle>
          <OrbitCardDescription>
            Não encontrou a resposta? Abra um ticket e retornamos em até 24 horas úteis.
          </OrbitCardDescription>
        </OrbitCardHeader>
        <OrbitCardContent>
          <SupportTicketForm />
        </OrbitCardContent>
      </OrbitCard>
    </div>
  );
}
