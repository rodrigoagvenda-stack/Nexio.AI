import type { TourStep } from '@/components/onboarding/GuidedTour';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'whatsapp-connect',
    target: '[data-tour="whatsapp-connect"]',
    title: 'Conecte seu WhatsApp',
    description: 'O primeiro passo é conectar seu número. Acesse Configurações → Integrações e escaneie o QR Code.',
    placement: 'right',
  },
  {
    id: 'canvas-automation',
    target: '[data-tour="canvas-link"]',
    title: 'Canvas de Automações',
    description: 'Crie fluxos visuais de follow-up arrastando e conectando nodes. Selecione uma sequência e clique em "Abrir Canvas".',
    placement: 'right',
  },
  {
    id: 'atendimento-actions',
    target: '[data-tour="atendimento-link"]',
    title: 'Atendimento via WhatsApp',
    description: 'Receba e responda mensagens em tempo real. Dentro de uma conversa, use o menu "⋮" para adicionar tags, agendar mensagens e ver informações do lead.',
    placement: 'right',
  },
  {
    id: 'follow-sequences',
    target: '[data-tour="follow-link"]',
    title: 'Sequências de Follow-up',
    description: 'Crie uma sequência e depois abra o Canvas para montar o fluxo. São dois passos: criar a sequência aqui, depois editar no Canvas.',
    placement: 'right',
  },
  {
    id: 'tokens-usage',
    target: '[data-tour="tokens-card"]',
    title: 'Uso de tokens de IA',
    description: 'Cada resposta do agente SDR consome tokens. Acompanhe o uso aqui — quando chegar perto do limite, você recebe um aviso.',
    placement: 'top',
  },
];
