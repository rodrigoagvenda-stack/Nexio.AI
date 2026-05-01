'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Search, Send, Phone, Mail, Building2, Tag, User, Bot, PauseCircle, Mic, Paperclip, ArrowLeft, Image, FileText, Video, Download, File, UserCircle2, ExternalLink, Clock, ChevronRight, ChevronLeft, ChevronDown, X, Trash2, MoreVertical, Info, Wifi, WifiOff, Loader2 as Loader2Icon, QrCode } from 'lucide-react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils/format';
import { toast } from '@/components/ui/use-toast';
import { AudioRecorder } from '@/components/chat/AudioRecorder';
import { WhatsAppAudioPlayer } from '@/components/chat/WhatsAppAudioPlayer';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { DeleteMessageDialog } from '@/components/chat/DeleteMessageDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { AttachmentOptionsDialog } from '@/components/chat/AttachmentOptionsDialog';
import { EditMessageDialog } from '@/components/chat/EditMessageDialog';
import { ScheduleMessageDialog } from '@/components/chat/ScheduleMessageDialog';
import { QuickReplyMenu } from '@/components/chat/QuickReplyMenu';
import { AssignChatDialog } from '@/components/chat/AssignChatDialog';
import { LeadInfoSidebar } from '@/components/atendimento/LeadInfoSidebar';
import { LinkPreviewCard } from '@/components/chat/LinkPreviewCard';
import { ExpandableMessage } from '@/components/chat/ExpandableMessage';
import type { Lead } from '@/types/database.types';

const atendimentoPhotoCache = new Map<string, string | null>()

interface Conversation {
  id: number;
  numero_de_telefone: string;
  nome_do_contato: string;
  ultima_mensagem: string;
  hora_da_ultima_mensagem: string;
  contagem_nao_lida: number;
  status_da_conversa: string;
  etiquetas: string[];
  id_do_lead?: number;
  lead?: Lead;
  assigned_to?: number | null;
  whatsapp_photo_url?: string;
}

interface Message {
  id: number | string; // Permitir string para IDs temporários (UI otimista)
  company_id?: number;
  id_da_conversacao?: number;
  texto_da_mensagem: string;
  tipo_de_mensagem: string;
  direcao: 'inbound' | 'outbound';
  sender_type: 'ai' | 'human';
  sender_user_id?: string;
  status: string;
  carimbo_de_data_e_hora: string;
  url_da_midia?: string;
  reactions?: string[]; // Array de emojis
  is_edited?: boolean;
  edited_at?: string;
  is_pinned?: boolean;
  user?: {
    name: string;
  };
}

export default function AtendimentoPage() {
  const { user, company } = useUser();
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; messageId: number | string | null }>({ open: false, messageId: null });
  const [forwardDialog, setForwardDialog] = useState<{ open: boolean; messageId: number | string | null }>({ open: false, messageId: null });
  const [editDialog, setEditDialog] = useState<{ open: boolean; message: Message | null }>({ open: false, message: null });
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateMenuPosition, setTemplateMenuPosition] = useState({ top: 0, left: 0 });
  const [assignDialog, setAssignDialog] = useState(false);
  const [deleteConvDialog, setDeleteConvDialog] = useState<{ open: boolean; conv: Conversation | null }>({ open: false, conv: null });
  const [mobileLeadInfoOpen, setMobileLeadInfoOpen] = useState(false);
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiActive, setIsAiActive] = useState(true);
  const [convAgentePausado, setConvAgentePausado] = useState(false);

  // WhatsApp connection state
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waQrcode, setWaQrcode] = useState<string | null>(null);
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waLoading, setWaLoading] = useState(true);
  const [waInstanceName, setWaInstanceName] = useState<string | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WhatsApp status
  const fetchWaStatus = async () => {
    try {
      const res = await fetch('/api/sdr/status');
      if (!res.ok) return;
      const data = await res.json();
      setWaStatus(data.status ?? 'disconnected');
      setWaPhone(data.phone ?? null);
      setWaQrcode(data.qrcode ?? null);
      setWaPairingCode(data.pairingCode ?? null);
      setWaInstanceName(data.instanceName ?? null);
    } catch {} finally {
      setWaLoading(false);
    }
  };

  const handleWaConnect = async () => {
    setWaConnecting(true);
    setWaStatus('connecting');
    setWaQrcode(null);
    setWaPairingCode(null);
    try {
      const res = await fetch('/api/sdr/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao conectar WhatsApp', variant: 'destructive' });
      setWaStatus('disconnected');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleWaDisconnect = async () => {
    try {
      const res = await fetch('/api/sdr/connect', { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setWaStatus('disconnected');
      setWaPhone(null);
      setWaQrcode(null);
      setWaPairingCode(null);
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao desconectar', variant: 'destructive' });
    }
  };

  // Verifica status real na montagem
  useEffect(() => { fetchWaStatus(); }, [company?.id]);

  // Auto-connect: só dispara depois da verificação inicial confirmar desconectado
  useEffect(() => {
    if (waLoading) return;
    if (waStatus === 'disconnected' && company?.id && !waConnecting) {
      handleWaConnect();
    }
  }, [waLoading]);

  // Polling só roda enquanto não conectado E depois do status inicial ser conhecido
  useEffect(() => {
    if (waLoading || waStatus === 'connected') return;
    const interval = setInterval(fetchWaStatus, 3000);
    return () => clearInterval(interval);
  }, [waStatus, waLoading]);

  // Carregar conversas
  useEffect(() => {
    if (!company?.id) return;
    fetchConversations();

    // Inscrever para atualizações em tempo real
    const conversationsChannel = supabase
      .channel('conversas_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversas_do_whatsapp',
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [company?.id]);

  // Sincronizar estado da IA com company.is_active
  useEffect(() => {
    if (company !== null) {
      setIsAiActive(company.is_active ?? true);
    }
  }, [company]);

  // Sincroniza agente_pausado ao trocar de conversa
  useEffect(() => {
    setConvAgentePausado((selectedConversation as any)?.agente_pausado ?? false);
  }, [selectedConversation?.id]);

  // Carregar mensagens quando selecionar conversa
  useEffect(() => {
    if (!selectedConversation) return;
    fetchMessages(selectedConversation.id);

    // Inscrever para novas mensagens
    const messagesChannel = supabase
      .channel('mensagens_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens_do_whatsapp',
          filter: `id_da_conversacao=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const newMessage = payload.new as Message;
            // Evitar duplicatas: verificar por ID real ou substituir mensagem otimista (temp)
            const existsReal = prev.some(msg =>
              typeof msg.id === 'number' && msg.id === newMessage.id
            );
            if (existsReal) return prev;

            // Se é outbound, pode ser uma mensagem otimista — substituir pelo dado real
            if (newMessage.direcao === 'outbound') {
              const tempIndex = prev.findIndex(msg =>
                typeof msg.id === 'string' &&
                (msg.id as string).startsWith('temp_') &&
                msg.carimbo_de_data_e_hora === newMessage.carimbo_de_data_e_hora
              );
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = newMessage;
                return updated;
              }
            }

            return [...prev, newMessage];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    // Marcar como lido (UI Otimista + Backend)
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? { ...conv, contagem_nao_lida: 0 }
          : conv
      )
    );
    markAsRead(selectedConversation.id);

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.id]);

  // Auto scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function fetchConversations() {
    try {
      const res = await fetch('/api/sdr/conversations');
      if (!res.ok) throw new Error('Erro ao buscar conversas');
      const data = await res.json();
      const convs: Conversation[] = data.conversations ?? [];
      setConversations(convs);

      convs.forEach(conv => {
        if (!conv.numero_de_telefone) return;
        const cacheKey = conv.id_do_lead ? `lead:${conv.id_do_lead}` : conv.numero_de_telefone;
        if (conv.whatsapp_photo_url) {
          atendimentoPhotoCache.set(cacheKey, conv.whatsapp_photo_url);
          return;
        }
        if (atendimentoPhotoCache.has(cacheKey)) {
          const cached = atendimentoPhotoCache.get(cacheKey);
          if (cached) {
            setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, whatsapp_photo_url: cached } : c));
            setSelectedConversation(prev => prev?.id === conv.id ? { ...prev, whatsapp_photo_url: cached } : prev);
          }
          return;
        }
        const params = new URLSearchParams({ phone: conv.numero_de_telefone });
        if (conv.id_do_lead) params.set('leadId', String(conv.id_do_lead));
        fetch(`/api/chat/contact-photo?${params}`)
          .then(r => r.json())
          .then(d => {
            atendimentoPhotoCache.set(cacheKey, d.photo ?? null);
            if (d.photo) {
              setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, whatsapp_photo_url: d.photo } : c));
              setSelectedConversation(prev => prev?.id === conv.id ? { ...prev, whatsapp_photo_url: d.photo } : prev);
            }
          })
          .catch(() => {});
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }

  async function fetchMessages(conversationId: number) {
    try {
      const { data, error } = await supabase
        .from('mensagens_do_whatsapp')
        .select(`
          *,
          user:users(name)
        `)
        .eq('id_da_conversacao', conversationId)
        .eq('company_id', company!.id) // 🔒 Segurança: garante isolamento por empresa
        .order('carimbo_de_data_e_hora', { ascending: false })
        .limit(100); // 🚀 Performance: Carrega apenas últimas 100 mensagens

      if (error) throw error;
      setMessages((data || []).reverse()); // Reverter para ordem correta
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

  async function handleDeleteConversation(conv: Conversation) {
    setIsDeletingConv(true);
    try {
      // 1. Apaga todas as mensagens da conversa
      await supabase
        .from('mensagens_do_whatsapp')
        .delete()
        .eq('id_da_conversacao', conv.id)
        .eq('company_id', company!.id);

      // 2. Apaga a conversa
      await supabase
        .from('conversas_do_whatsapp')
        .delete()
        .eq('id', conv.id)
        .eq('company_id', company!.id);

      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation(null);
        setMessages([]);
      }
      toast({ title: 'Conversa apagada' });
    } catch {
      toast({ title: 'Erro ao apagar conversa', variant: 'destructive' });
    } finally {
      setIsDeletingConv(false);
      setDeleteConvDialog({ open: false, conv: null });
    }
  }

  async function markAsRead(conversationId: number) {
    try {
      await supabase
        .from('conversas_do_whatsapp')
        .update({ contagem_nao_lida: 0 })
        .eq('id', conversationId)
        .eq('company_id', company!.id); // 🔒 Segurança: garante isolamento por empresa
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const messageText = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // UI Otimista: Adicionar mensagem imediatamente
    const optimisticMessage: Message = {
      id: tempId,
      company_id: company!.id,
      id_da_conversacao: selectedConversation.id,
      texto_da_mensagem: messageText,
      tipo_de_mensagem: 'text',
      direcao: 'outbound',
      sender_type: 'human',
      sender_user_id: user.auth_user_id,
      status: 'sending', // Status temporário
      carimbo_de_data_e_hora: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setLoading(true);
    scrollToBottom();

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          phoneNumber: selectedConversation.numero_de_telefone,
          message: messageText,
          companyId: company!.id,
          userId: user.auth_user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Atualizar mensagem otimista com dados reais do servidor
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...data.data, status: 'sent' } : msg
        )
      );
      toast({ title: 'Mensagem enviada!' });
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText); // Restaurar texto
      toast({ title: error.message || 'Erro ao enviar mensagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Mensagem copiada!' });
    } catch (error) {
      toast({ title: 'Erro ao copiar mensagem', variant: 'destructive' });
    }
  }

  async function handleDeleteForMe(messageId: number | string) {
    if (typeof messageId === 'string') return;

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          deleteForEveryone: false,
          companyId: company!.id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({ title: 'Mensagem apagada para você' });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      toast({ title: error.message || 'Erro ao apagar mensagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteForEveryone(messageId: number | string) {
    if (typeof messageId === 'string') return;

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          deleteForEveryone: true,
          companyId: company!.id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({ title: 'Mensagem apagada para todos' });
    } catch (error: any) {
      console.error('Error deleting message for everyone:', error);
      toast({ title: error.message || 'Erro ao apagar mensagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleForwardMessage(selectedConversationIds: number[]) {
    if (!forwardDialog.messageId || typeof forwardDialog.messageId === 'string') return;

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: forwardDialog.messageId,
          conversationIds: selectedConversationIds,
          companyId: company!.id,
          userId: user!.user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: data.message });
      setForwardDialog({ open: false, messageId: null });
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      toast({ title: error.message || 'Erro ao encaminhar mensagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleReactToMessage(messageId: number | string, emoji: string) {
    if (typeof messageId === 'string') return; // Não reagir a mensagens otimistas

    // Atualizar UI imediatamente (otimista)
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = msg.reactions || [];
          const hasReaction = currentReactions.includes(emoji);
          return {
            ...msg,
            reactions: hasReaction
              ? currentReactions.filter(r => r !== emoji)
              : [...currentReactions, emoji]
          };
        }
        return msg;
      })
    );

    // Enviar reação via API para WhatsApp
    try {
      const response = await fetch('/api/whatsapp/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          emoji,
          companyId: company!.id,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error('Error sending reaction:', error);
      toast({ title: error.message || 'Erro ao enviar reação', variant: 'destructive' });
      // Reverter mudança otimista em caso de erro
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || [];
            const hasReaction = currentReactions.includes(emoji);
            return {
              ...msg,
              reactions: hasReaction
                ? currentReactions.filter(r => r !== emoji)
                : [...currentReactions, emoji]
            };
          }
          return msg;
        })
      );
    }
  }

  async function handleSendAudio(audioBlob: Blob, duration: number) {
    if (!selectedConversation || !user) return;

    const tempId = `temp_audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setLoading(true);
    try {
      // 1. Upload do áudio para o Supabase Storage
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `${company!.id}/whatsapp/${selectedConversation.id}/${fileName}`;

      const { data: uploadData, error: uploadError} = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // 2. Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      // UI Otimista: Adicionar mensagem de áudio imediatamente
      const optimisticMessage: Message = {
        id: tempId,
        company_id: company!.id,
        id_da_conversacao: selectedConversation.id,
        texto_da_mensagem: '🎵 Áudio',
        tipo_de_mensagem: 'audio',
        direcao: 'outbound',
        sender_type: 'human',
        sender_user_id: user.auth_user_id,
        status: 'sending',
        carimbo_de_data_e_hora: new Date().toISOString(),
        url_da_midia: publicUrl,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setShowAudioRecorder(false);
      scrollToBottom();

      // 3. Enviar via API
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          phoneNumber: selectedConversation.numero_de_telefone,
          message: '🎵 Áudio',
          messageType: 'audio',
          mediaUrl: publicUrl,
          companyId: company!.id,
          userId: user.auth_user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Atualizar mensagem otimista com dados reais do servidor
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...data.data, status: 'sent' } : msg
        )
      );
      toast({ title: 'Áudio enviado!' });
    } catch (error: any) {
      console.error('Error sending audio:', error);
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      toast({ title: error.message || 'Erro ao enviar áudio', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendFile(file: File, type: 'image' | 'document' | 'video', caption?: string) {
    if (!selectedConversation || !user) return;

    const tempId = `temp_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const defaultMessage = type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Documento' : '🎥 Vídeo';

    setLoading(true);
    try {
      // 1. Upload do arquivo para o Supabase Storage
      const ext = file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${ext}`;
      const filePath = `${company!.id}/whatsapp/${selectedConversation.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // 2. Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      // UI Otimista: Adicionar mensagem imediatamente
      const optimisticMessage: Message = {
        id: tempId,
        company_id: company!.id,
        id_da_conversacao: selectedConversation.id,
        texto_da_mensagem: caption || defaultMessage,
        tipo_de_mensagem: type,
        direcao: 'outbound',
        sender_type: 'human',
        sender_user_id: user.auth_user_id,
        status: 'sending',
        carimbo_de_data_e_hora: new Date().toISOString(),
        url_da_midia: publicUrl,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();

      // 3. Enviar via API
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          phoneNumber: selectedConversation.numero_de_telefone,
          message: caption || defaultMessage,
          messageType: type,
          mediaUrl: publicUrl,
          filename: file.name,
          companyId: company!.id,
          userId: user.auth_user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Atualizar mensagem otimista com dados reais do servidor
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...data.data, status: 'sent' } : msg
        )
      );
      toast({ title: `${type === 'image' ? 'Imagem' : type === 'document' ? 'Documento' : 'Vídeo'} enviado!` });
    } catch (error: any) {
      console.error(`Error sending ${type}:`, error);
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      toast({ title: error.message || `Erro ao enviar ${type}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(type: 'image' | 'document' | 'video') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.txt' : 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Se for imagem, mostrar preview
        if (type === 'image') {
          const url = URL.createObjectURL(file);
          setImagePreview({ file, url });
          setImageCaption('');
        } else {
          // Senão, enviar diretamente
          await handleSendFile(file, type);
        }
      }
    };
    input.click();
  }

  async function handleSendImageWithPreview() {
    if (!imagePreview) return;

    const file = imagePreview.file;
    const captionText = imageCaption;
    const previewUrl = imagePreview.url;

    // Limpar preview imediatamente para UX responsiva
    setImagePreview(null);
    setImageCaption('');

    try {
      await handleSendFile(file, 'image', captionText);
      URL.revokeObjectURL(previewUrl);
    } catch (error) {
      console.error('Error sending image:', error);
    }
  }

  function handleCancelImagePreview() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview.url);
      setImagePreview(null);
      setImageCaption('');
    }
  }

  // Handler para editar mensagem
  async function handleEditMessage(messageId: number | string, newMessage: string) {
    if (typeof messageId === 'string') return;

    try {
      const response = await fetch(`/api/whatsapp/messages/${messageId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newMessage,
          companyId: company!.id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Atualizar mensagem localmente
      setMessages(prev =>
        prev.map(msg => msg.id === messageId ? data.data : msg)
      );
      toast({ title: 'Mensagem editada!' });
    } catch (error: any) {
      console.error('Error editing message:', error);
      toast({ title: error.message || 'Erro ao editar mensagem', variant: 'destructive' });
      throw error;
    }
  }

  // Handler para fixar/desfixar mensagem
  async function handlePinMessage(messageId: number | string, isPinned: boolean) {
    if (typeof messageId === 'string') return;

    try {
      const response = await fetch(`/api/whatsapp/messages/${messageId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPinned,
          companyId: company!.id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Atualizar mensagem localmente
      setMessages(prev =>
        prev.map(msg => msg.id === messageId ? data.data : msg)
      );
      toast({ title: isPinned ? 'Mensagem fixada!' : 'Mensagem desafixada!' });
    } catch (error: any) {
      console.error('Error pinning message:', error);
      toast({ title: error.message || 'Erro ao fixar mensagem', variant: 'destructive' });
    }
  }

  // Handler para enviar status "digitando..."
  function handleTyping() {
    if (!selectedConversation) return;

    // Limpar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Enviar status de digitando
    fetch('/api/whatsapp/presence/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: selectedConversation.numero_de_telefone,
        companyId: company!.id,
      }),
    }).catch(error => {
      console.error('Error sending typing status:', error);
    });

    // Configurar timeout para parar de enviar após 3 segundos
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000);
  }

  // Handler para agendar mensagem
  async function handleScheduleMessage(date: string, time: string) {
    if (!selectedConversation || !newMessage.trim()) return;

    const scheduledFor = new Date(`${date}T${time}`).toISOString();

    try {
      const response = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedConversation.id,
          leadId: selectedConversation.id_do_lead,
          content: newMessage.trim(),
          type: 'text',
          scheduledFor,
          companyId: company!.id,
          userId: user!.user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: 'Mensagem agendada com sucesso!' });
      setNewMessage('');
    } catch (error: any) {
      console.error('Error scheduling message:', error);
      toast({ title: error.message || 'Erro ao agendar mensagem', variant: 'destructive' });
      throw error;
    }
  }

  // Template handling functions
  function handleMessageInputChange(value: string) {
    setNewMessage(value);
    handleTyping();

    // Detectar se usuário digitou "/"
    if (value.startsWith('/') && inputRef.current) {
      // Calcular posição do menu
      const rect = inputRef.current.getBoundingClientRect();
      setTemplateMenuPosition({
        top: rect.top - 320, // Posicionar acima do input
        left: rect.left,
      });
      setShowTemplateMenu(true);
    } else {
      setShowTemplateMenu(false);
    }
  }

  function substituteVariables(content: string): string {
    let result = content;

    // Variáveis disponíveis
    const variables: Record<string, string> = {
      nome: selectedConversation?.nome_do_contato || selectedConversation?.numero_de_telefone || '',
      empresa: selectedConversation?.lead?.company_name || '',
      telefone: selectedConversation?.numero_de_telefone || '',
      usuario: user?.name || '',
      minha_empresa: company?.name || '',
    };

    // Substituir todas as variáveis
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, value);
    });

    return result;
  }

  async function handleTemplateSelect(template: any) {
    // Substituir variáveis no conteúdo do template
    const contentWithVariables = substituteVariables(template.content);

    // Inserir no campo de mensagem
    setNewMessage(contentWithVariables);
    setShowTemplateMenu(false);

    // Incrementar contador de uso
    try {
      await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company!.id }),
      });
    } catch (error) {
      console.error('Error incrementing template usage:', error);
    }

    // Focar no input
    inputRef.current?.focus();
  }

  const filteredConversations = conversations.filter((conv) =>
    conv.nome_do_contato?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.numero_de_telefone.includes(searchQuery) ||
    conv.lead?.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const parts: { type: 'text' | 'url'; content: string }[] = [];
    let lastIndex = 0;
    const regex = /https?:\/\/[^\s]+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'url', content: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }
    if (parts.length === 0) parts.push({ type: 'text', content: text });

    const content = (
      <div className="space-y-1">
        {parts.map((part, i) =>
          part.type === 'text'
            ? (part.content ? <p key={i} className="text-sm whitespace-pre-wrap">{part.content}</p> : null)
            : <LinkPreviewCard key={i} url={part.content} />
        )}
      </div>
    );

    return <ExpandableMessage text={text}>{content}</ExpandableMessage>;
  };

  const renderMessageContent = (msg: Message) => {
    // Se tem mídia, renderiza o preview
    if (msg.url_da_midia) {
      switch (msg.tipo_de_mensagem) {
        case 'image':
          return (
            <div className="space-y-2">
              <img
                src={msg.url_da_midia}
                alt="Imagem enviada"
                className="rounded-lg max-h-96 max-w-md object-contain"
                loading="lazy"
              />
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('📷') && msg.texto_da_mensagem !== '[Imagem]' && (
                <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
              )}
            </div>
          );

        case 'video':
          return (
            <div className="space-y-2">
              <video
                src={msg.url_da_midia}
                controls
                className="max-w-full rounded-lg max-h-96"
              >
                Seu navegador não suporta vídeo.
              </video>
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('🎥') && msg.texto_da_mensagem !== '[Vídeo]' && (
                <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
              )}
            </div>
          );

        case 'audio':
          return (
            <div className="space-y-2">
              <WhatsAppAudioPlayer
                src={msg.url_da_midia}
                isOutbound={msg.direcao === 'outbound'}
              />
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('🎵') && msg.texto_da_mensagem !== '[Áudio]' && (
                <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
              )}
            </div>
          );

        case 'document':
          const fileName = msg.url_da_midia.split('/').pop() || 'documento';
          return (
            <div className="space-y-2">
              <a
                href={msg.url_da_midia}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
              >
                <File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Clique para baixar</p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </a>
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('📄') && msg.texto_da_mensagem !== '[Documento]' && msg.texto_da_mensagem !== '[PDF]' && (
                <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
              )}
            </div>
          );

        default:
          return renderTextWithLinks(msg.texto_da_mensagem || '');
      }
    }

    // Se não tem mídia, só renderiza o texto
    return renderTextWithLinks(msg.texto_da_mensagem || '');
  };

  // ── Aguarda verificação inicial para não piscar QR em quem já está conectado ──
  if (waLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Tela de conexão WhatsApp (estilo WhatsApp Web) ────────────────────────
  if (waStatus !== 'connected') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-background">
        <div className="w-full max-w-2xl mx-4">
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Lado esquerdo — instruções */}
              <div className="flex-1 p-8 flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-light text-foreground mb-1">Use o WhatsApp no computador</h1>
                  <p className="text-sm text-muted-foreground">Conecte seu número para começar a atender conversas</p>
                </div>
                <ol className="space-y-4">
                  {[
                    'Abra o WhatsApp no seu celular',
                    'Toque em Mais opções → Aparelhos conectados',
                    'Toque em Conectar um aparelho',
                    'Aponte o celular para esta tela para capturar o QR code',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/40 text-xs font-medium text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <button
                  onClick={handleWaConnect}
                  disabled={waConnecting || waStatus === 'connecting'}
                  className="text-sm text-primary underline underline-offset-4 hover:opacity-70 transition-opacity text-left disabled:opacity-40"
                >
                  {waConnecting ? 'Gerando QR Code…' : 'Gerar novo QR Code'}
                </button>
              </div>

              {/* Lado direito — QR Code */}
              <div className="flex items-center justify-center p-8 bg-muted/30 border-t md:border-t-0 md:border-l border-border min-h-[260px]">
                {waQrcode ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-white rounded-xl shadow-sm border">
                      <NextImage
                        src={`data:image/png;base64,${waQrcode}`}
                        alt="QR Code WhatsApp"
                        width={200}
                        height={200}
                        className="rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2Icon className="w-3 h-3 animate-spin" />
                      Aguardando leitura…
                    </div>
                  </div>
                ) : waPairingCode ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs text-muted-foreground text-center max-w-[160px]">Digite este código no WhatsApp</p>
                    <div className="px-6 py-4 bg-white rounded-xl shadow-sm border">
                      <p className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">{waPairingCode}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2Icon className="w-3 h-3 animate-spin" />
                      Aguardando confirmação…
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-[200px] h-[200px] bg-muted rounded-xl flex items-center justify-center">
                      <Loader2Icon className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Gerando QR Code…</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            🔒 Suas mensagens são protegidas com criptografia de ponta a ponta
          </p>
          <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
            <p className="font-semibold">⚠️ Importante — API não oficial do WhatsApp</p>
            <p>Esta integração usa uma API de terceiros não homologada pelo WhatsApp/Meta. Ao usar este recurso, você está ciente de que:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>O WhatsApp pode suspender ou banir o número conectado a qualquer momento, sem aviso prévio.</li>
              <li>Não há garantia de disponibilidade (SLA) — interrupções no servidor intermediário podem desconectar o número.</li>
              <li>O uso desta API viola os Termos de Serviço do WhatsApp.</li>
              <li>Recomendamos não usar o número principal da empresa — prefira um número dedicado.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full grid grid-cols-12 gap-2 overflow-hidden">
        {/* Lista de Conversas */}
        <Card className={`col-span-12 lg:col-span-3 flex flex-col overflow-hidden rounded-none md:rounded-lg border-0 md:border ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversas
              </div>
              {/* WhatsApp status dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full hover:bg-green-500/20 transition-colors self-start sm:self-auto">
                    <Wifi className="h-3 w-3" />
                    Conectado
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Número conectado</p>
                    <p className="text-sm font-medium font-mono">{waPhone ?? '—'}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={() => setDisconnectConfirmOpen(true)}
                  >
                    <WifiOff className="h-4 w-4 mr-2" />
                    Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto space-y-2 scrollbar-minimal">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conversa encontrada
              </p>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group w-full text-left p-3 rounded-lg border transition-colors relative ${
                    selectedConversation?.id === conv.id
                      ? 'bg-muted border-border'
                      : 'hover:bg-accent'
                  }`}
                >
                  <button
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                    title="Apagar conversa"
                    onClick={(e) => { e.stopPropagation(); setDeleteConvDialog({ open: true, conv }); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                  <button className="w-full text-left" onClick={() => setSelectedConversation(conv)}>
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={conv.whatsapp_photo_url ?? undefined} />
                        <AvatarFallback>
                          {getInitials(conv.nome_do_contato || conv.numero_de_telefone)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.contagem_nao_lida > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold">
                          {conv.contagem_nao_lida}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center mb-1">
                        <p className="font-semibold truncate">
                          {conv.nome_do_contato || conv.numero_de_telefone}
                        </p>
                      </div>
                      {conv.lead && (
                        <div className="flex items-center gap-1 mb-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lead.company_name}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-1 line-clamp-2">
                        {conv.ultima_mensagem}
                      </p>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {conv.assigned_to && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">
                            <UserCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            Atribuído
                          </Badge>
                        )}
                        {conv.etiquetas?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{
                              borderColor: tag === 'VIP' ? '#22c55e' : undefined,
                              color: tag === 'VIP' ? '#22c55e' : undefined
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {conv.lead && (
                          <>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {conv.lead.status}
                            </Badge>
                            {conv.lead.priority && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  conv.lead.priority === 'Alta' ? 'border-red-500 text-red-600' :
                                  conv.lead.priority === 'Média' ? 'border-primary text-primary' :
                                  'border-gray-400 text-gray-600'
                                }`}
                              >
                                {conv.lead.priority}
                              </Badge>
                            )}
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-auto">
                          {new Date(conv.hora_da_ultima_mensagem).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className={`col-span-12 ${selectedConversation ? (isSidebarOpen ? 'md:col-span-8 lg:col-span-6' : 'md:col-span-8 lg:col-span-9') : 'lg:col-span-6'} flex flex-col overflow-hidden rounded-none md:rounded-lg border-0 md:border ${!selectedConversation ? 'hidden lg:flex' : 'flex'} transition-all duration-300`}>
          {selectedConversation ? (
            <>
              {/* Header da Conversa */}
              <CardHeader className="border-b flex-shrink-0 px-3 py-3">
                <div className="flex items-center gap-2">
                  {/* Voltar (mobile) */}
                  <Button variant="ghost" size="icon" className="lg:hidden flex-shrink-0 -ml-1" onClick={() => setSelectedConversation(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  {/* Avatar */}
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={selectedConversation.whatsapp_photo_url ?? undefined} />
                    <AvatarFallback className="text-sm">
                      {getInitials(selectedConversation.nome_do_contato || selectedConversation.numero_de_telefone)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Nome + empresa */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {selectedConversation.nome_do_contato || selectedConversation.numero_de_telefone}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedConversation.lead?.company_name || selectedConversation.numero_de_telefone}
                    </p>
                  </div>

                  {/* Ações desktop */}
                  <div className="hidden lg:flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={async () => {
                        if (!selectedConversation) return;
                        const novoPausado = !convAgentePausado;
                        setConvAgentePausado(novoPausado);
                        try {
                          const res = await fetch(`/api/conversations/${selectedConversation.id}/agent`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pausado: novoPausado }),
                          });
                          if (!res.ok) { setConvAgentePausado(!novoPausado); toast({ title: 'Erro ao atualizar agente', variant: 'destructive' }); }
                          else toast({ title: novoPausado ? 'Agente pausado nesta conversa' : 'Agente ativo nesta conversa' });
                        } catch { setConvAgentePausado(!novoPausado); }
                      }}
                      className={!convAgentePausado ? 'border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10' : 'border-amber-500/50 text-amber-600 hover:bg-amber-500/10'}
                    >
                      {!convAgentePausado ? <><Bot className="h-4 w-4 mr-1.5" /><span className="text-xs">Agente ativo</span></> : <><PauseCircle className="h-4 w-4 mr-1.5" /><span className="text-xs">Agente pausado</span></>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setScheduleDialog(true)} title="Agendar"><Clock className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setAssignDialog(true)}>
                      <UserCircle2 className="h-4 w-4 mr-1.5" />
                      {selectedConversation.assigned_to ? 'Transferir' : 'Atribuir'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                      {isSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Ações mobile: info + more */}
                  <div className="flex lg:hidden items-center gap-1">
                    {selectedConversation.lead && (
                      <Button variant="outline" size="sm" className="flex-shrink-0 gap-1.5 text-xs h-8" onClick={() => setMobileLeadInfoOpen(true)}>
                        <Info className="h-3.5 w-3.5" />
                        Lead
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={async () => {
                          if (!selectedConversation) return;
                          const novoPausado = !convAgentePausado;
                          setConvAgentePausado(novoPausado);
                          try {
                            const res = await fetch(`/api/conversations/${selectedConversation.id}/agent`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ pausado: novoPausado }),
                            });
                            if (!res.ok) { setConvAgentePausado(!novoPausado); toast({ title: 'Erro ao atualizar agente', variant: 'destructive' }); }
                            else toast({ title: novoPausado ? 'Agente pausado nesta conversa' : 'Agente ativo nesta conversa' });
                          } catch { setConvAgentePausado(!novoPausado); }
                        }}>
                          {convAgentePausado ? <><Bot className="h-4 w-4 mr-2 text-emerald-500" />Ativar agente</> : <><PauseCircle className="h-4 w-4 mr-2 text-amber-500" />Pausar agente</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setScheduleDialog(true)}>
                          <Clock className="h-4 w-4 mr-2" />Agendar mensagem
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setAssignDialog(true)}>
                          <UserCircle2 className="h-4 w-4 mr-2" />{selectedConversation.assigned_to ? 'Transferir' : 'Atribuir'}
                        </DropdownMenuItem>
                        {selectedConversation.numero_de_telefone && (
                          <DropdownMenuItem onClick={() => window.open(`https://wa.me/${selectedConversation.numero_de_telefone.replace(/\D/g, '')}`, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2" />Abrir no WhatsApp
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              {/* Mensagens */}
              <CardContent className="flex-1 overflow-y-auto p-[20px] space-y-4 scrollbar-minimal chat-background">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${
                      msg.direcao === 'outbound' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.direcao === 'inbound' && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedConversation.whatsapp_photo_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedConversation.nome_do_contato || 'C')}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <MessageContextMenu
                      isOutbound={msg.direcao === 'outbound'}
                      onReact={(emoji) => handleReactToMessage(msg.id, emoji)}
                      onCopy={() => handleCopyMessage(msg.texto_da_mensagem)}
                      onEdit={msg.direcao === 'outbound' ? () => setEditDialog({ open: true, message: msg }) : undefined}
                      onForward={() => setForwardDialog({ open: true, messageId: msg.id })}
                      onPin={() => handlePinMessage(msg.id, !msg.is_pinned)}
                      onDelete={msg.direcao === 'outbound' ? () => setDeleteDialog({ open: true, messageId: msg.id }) : undefined}
                      className={msg.direcao === 'outbound' && (msg.tipo_de_mensagem === 'image' || msg.tipo_de_mensagem === 'video') ? 'ml-auto' : ''}
                    >
                        <div
                          className={`${
                            msg.tipo_de_mensagem === 'image' || msg.tipo_de_mensagem === 'video'
                              ? 'w-fit'
                              : 'w-full max-w-full'
                          } rounded-2xl p-4 cursor-pointer ${
                            msg.direcao === 'outbound'
                              ? 'bg-green-500/30 text-foreground border border-green-500/20'
                              : 'bg-muted'
                          } ${msg.status === 'sending' ? 'opacity-60' : ''}`}
                        >
                        {msg.direcao === 'outbound' && (
                          <div className="flex items-center gap-1 mb-1 text-xs opacity-80">
                            {msg.sender_type === 'ai' ? (
                              <>
                                <Bot className="h-3 w-3" />
                                IA
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3" />
                                {msg.user?.name || 'Você'}
                              </>
                            )}
                          </div>
                        )}
                        {msg.is_pinned && (
                          <Badge variant="secondary" className="mb-2 text-xs">
                            📌 Fixada
                          </Badge>
                        )}
                        {renderMessageContent(msg)}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {msg.reactions.map((reaction, idx) => (
                              <span key={idx} className="text-base">
                                {reaction}
                              </span>
                            ))}
                          </div>
                        )}
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${
                            msg.direcao === 'outbound' ? 'opacity-80' : 'text-muted-foreground'
                          }`}
                        >
                          {formatDateTime(msg.carimbo_de_data_e_hora)}
                          {msg.is_edited && ' • Editada'}
                          {msg.status === 'sending' && ' • Enviando...'}
                        </p>
                      </div>
                    </MessageContextMenu>
                    {msg.direcao === 'outbound' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary text-white">
                          {msg.sender_type === 'ai' ? (
                            <Bot className="h-4 w-4" />
                          ) : (
                            getInitials(msg.user?.name || user?.name || 'U')
                          )}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input de Mensagem */}
              <div className="border-t p-4 flex-shrink-0">
                {imagePreview ? (
                  <div className="space-y-3">
                    <div className="relative rounded overflow-hidden bg-black/5">
                      <img
                        src={imagePreview.url}
                        alt="Preview"
                        className="max-h-64 w-full object-contain"
                      />
                      <button
                        onClick={handleCancelImagePreview}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        placeholder="Adicione uma legenda..."
                        className="flex-1"
                        disabled={loading}
                      />
                      <Button
                        onClick={handleSendImageWithPreview}
                        disabled={loading}
                        className="bg-[#005c4b] hover:bg-[#004d3d]"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : showAudioRecorder ? (
                  <AudioRecorder
                    onSendAudio={handleSendAudio}
                    onCancel={() => setShowAudioRecorder(false)}
                  />
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAttachmentOptions(true)}
                      disabled={loading}
                      title="Anexar"
                      className="text-muted-foreground"
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      ref={inputRef}
                      placeholder="Digite sua mensagem... (/ para templates)"
                      value={newMessage}
                      onChange={(e) => handleMessageInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newMessage.trim()) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                      disabled={loading}
                    />
                    <Button
                      type={newMessage.trim() ? 'submit' : 'button'}
                      onClick={() => {
                        if (!newMessage.trim()) {
                          setShowAudioRecorder(true);
                        }
                      }}
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90 rounded-full h-12 w-12 min-h-12 min-w-12 p-0 flex items-center justify-center shrink-0"
                    >
                      {newMessage.trim() ? (
                        <Send className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Selecione uma conversa para começar
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Lead Info Sidebar */}
        {isSidebarOpen && (
          selectedConversation?.lead ? (
            <LeadInfoSidebar
              lead={selectedConversation.lead}
              phone={selectedConversation.numero_de_telefone}
              companyId={company!.id}
              userId={user!.user_id}
              chatId={selectedConversation.id}
              tags={selectedConversation.etiquetas || []}
              onLeadUpdate={(updatedLead) => {
                // Atualizar o lead na conversa selecionada
                setSelectedConversation((prev) =>
                  prev
                    ? {
                        ...prev,
                        lead: updatedLead,
                      }
                    : prev
                );
                // Recarregar conversas para atualizar Kanban via Realtime
                fetchConversations();
              }}
              onTagsUpdate={(updatedTags) => {
                // Atualizar tags na conversa selecionada
                setSelectedConversation((prev) =>
                  prev
                    ? {
                        ...prev,
                        etiquetas: updatedTags,
                      }
                    : prev
                );
                // Recarregar conversas para atualizar sidebar
                fetchConversations();
              }}
            />
          ) : (
            <Card className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col overflow-hidden">
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">
                  Selecione uma conversa para ver as informações do lead
                </p>
              </div>
            </Card>
          )
        )}
      </div>

      {/* Mobile Lead Info Sheet */}
      <Sheet open={mobileLeadInfoOpen} onOpenChange={setMobileLeadInfoOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 lg:hidden rounded-t-2xl">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="text-sm">Informações do Lead</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-20">
            {selectedConversation?.lead && (
              <LeadInfoSidebar
                lead={selectedConversation.lead}
                phone={selectedConversation.numero_de_telefone}
                companyId={company!.id}
                userId={user!.user_id}
                chatId={selectedConversation.id}
                tags={selectedConversation.etiquetas || []}
                className="flex flex-col h-full overflow-hidden border-0 shadow-none rounded-none"
                onLeadUpdate={(updatedLead) => {
                  setSelectedConversation((prev) => prev ? { ...prev, lead: updatedLead } : prev);
                  fetchConversations();
                }}
                onTagsUpdate={(updatedTags) => {
                  setSelectedConversation((prev) => prev ? { ...prev, etiquetas: updatedTags } : prev);
                  fetchConversations();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Attachment Options Dialog */}
      <AttachmentOptionsDialog
        open={showAttachmentOptions}
        onOpenChange={setShowAttachmentOptions}
        onSelectDocument={() => handleFileSelect('document')}
        onSelectImage={() => handleFileSelect('image')}
        onSelectVideo={() => handleFileSelect('video')}
        onSelectCamera={() => toast({ title: 'Câmera em breve' })}
        onSelectAudio={() => setShowAudioRecorder(true)}
        onSelectContact={() => toast({ title: 'Contato em breve' })}
        onSelectPoll={() => toast({ title: 'Enquete em breve' })}
        onSelectEvent={() => toast({ title: 'Evento em breve' })}
        onSelectSticker={() => toast({ title: 'Figurinha em breve' })}
      />

      {/* Delete Message Dialog */}
      <DeleteMessageDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, messageId: null })}
        onDeleteForMe={() => {
          if (deleteDialog.messageId) handleDeleteForMe(deleteDialog.messageId);
          setDeleteDialog({ open: false, messageId: null });
        }}
        onDeleteForEveryone={() => {
          if (deleteDialog.messageId) handleDeleteForEveryone(deleteDialog.messageId);
          setDeleteDialog({ open: false, messageId: null });
        }}
        canDeleteForEveryone={true}
      />

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={forwardDialog.open}
        onOpenChange={(open) => setForwardDialog({ open, messageId: null })}
        conversations={conversations}
        onForward={handleForwardMessage}
        isLoading={loading}
      />

      {/* Edit Message Dialog */}
      {editDialog.message && (
        <EditMessageDialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog({ open, message: null })}
          message={editDialog.message.texto_da_mensagem}
          onSave={(newMessage) => handleEditMessage(editDialog.message!.id, newMessage)}
        />
      )}

      {/* Schedule Message Dialog */}
      <ScheduleMessageDialog
        open={scheduleDialog}
        onOpenChange={setScheduleDialog}
        message={newMessage}
        onSchedule={handleScheduleMessage}
      />

      {/* Quick Reply Template Menu */}
      {showTemplateMenu && company && (
        <QuickReplyMenu
          companyId={company.id}
          searchQuery={newMessage}
          position={templateMenuPosition}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateMenu(false)}
        />
      )}

      {/* Assign Chat Dialog */}
      {selectedConversation && user && company && (
        <AssignChatDialog
          open={assignDialog}
          onOpenChange={setAssignDialog}
          chatId={selectedConversation.id}
          chatName={selectedConversation.nome_do_contato || selectedConversation.numero_de_telefone}
          currentAssignedTo={selectedConversation.assigned_to}
          companyId={company.id}
          userId={user.id}
          onSuccess={fetchConversations}
        />
      )}

      {/* AlertDialog — Desconectar WhatsApp */}
      <AlertDialog open={disconnectConfirmOpen} onOpenChange={setDisconnectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja desconectar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { handleWaDisconnect(); setDisconnectConfirmOpen(false); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog — Apagar conversa */}
      <AlertDialog open={deleteConvDialog.open} onOpenChange={(open) => !open && setDeleteConvDialog({ open: false, conv: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens com <strong>{deleteConvDialog.conv?.nome_do_contato || deleteConvDialog.conv?.numero_de_telefone}</strong> serão apagadas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingConv}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConvDialog.conv && handleDeleteConversation(deleteConvDialog.conv)}
              disabled={isDeletingConv}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingConv ? 'Apagando...' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
