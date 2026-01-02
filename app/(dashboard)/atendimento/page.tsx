'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Search, Send, Phone, Mail, Building2, Tag, User, Bot, Mic, Paperclip, ArrowLeft, Image, FileText, Video, Download, File } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils/format';
import { toast } from 'sonner';
import { AudioRecorder } from '@/components/chat/AudioRecorder';
import { WhatsAppAudioPlayer } from '@/components/chat/WhatsAppAudioPlayer';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { DeleteMessageDialog } from '@/components/chat/DeleteMessageDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { AttachmentOptionsDialog } from '@/components/chat/AttachmentOptionsDialog';
import { LeadInfoSidebar } from '@/components/atendimento/LeadInfoSidebar';
import type { Lead } from '@/types/database.types';

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
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          // Evitar duplicatas (UI otimista já adicionou)
          setMessages((prev) => {
            const newMessage = payload.new as Message;
            const exists = prev.some(msg =>
              typeof msg.id === 'number' && msg.id === newMessage.id
            );
            return exists ? prev : [...prev, newMessage];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    // Marcar como lido
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
      const { data, error } = await supabase
        .from('conversas_do_whatsapp')
        .select(`
          *,
          lead:leads!conversas_do_whatsapp_id_do_lead_fkey(*)
        `)
        .eq('company_id', company!.id)
        .order('hora_da_ultima_mensagem', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
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
          user:users!mensagens_do_whatsapp_sender_user_id_fkey(name)
        `)
        .eq('id_da_conversacao', conversationId)
        .eq('company_id', company!.id) // 🔒 Segurança: garante isolamento por empresa
        .order('carimbo_de_data_e_hora', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
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
      sender_user_id: user.user_id,
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
          userId: user.user_id,
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
      toast.success('Mensagem enviada!');
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText); // Restaurar texto
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensagem copiada!');
    } catch (error) {
      toast.error('Erro ao copiar mensagem');
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
      toast.success('Mensagem apagada para você');
    } catch (error: any) {
      console.error('Error deleting message:', error);
      toast.error(error.message || 'Erro ao apagar mensagem');
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
      toast.success('Mensagem apagada para todos');
    } catch (error: any) {
      console.error('Error deleting message for everyone:', error);
      toast.error(error.message || 'Erro ao apagar mensagem');
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

      toast.success(data.message);
      setForwardDialog({ open: false, messageId: null });
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      toast.error(error.message || 'Erro ao encaminhar mensagem');
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
      toast.error(error.message || 'Erro ao enviar reação');
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
          userId: user.user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setShowAudioRecorder(false);
      toast.success('Áudio enviado!');
    } catch (error: any) {
      console.error('Error sending audio:', error);
      toast.error(error.message || 'Erro ao enviar áudio');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendFile(file: File, type: 'image' | 'document' | 'video', caption?: string) {
    if (!selectedConversation || !user) return;

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

      // 3. Enviar via API
      const defaultMessage = type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Documento' : '🎥 Vídeo';
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
          userId: user.user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      toast.success(`${type === 'image' ? 'Imagem' : type === 'document' ? 'Documento' : 'Vídeo'} enviado!`);
    } catch (error: any) {
      console.error(`Error sending ${type}:`, error);
      toast.error(error.message || `Erro ao enviar ${type}`);
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

    setLoading(true);
    try {
      await handleSendFile(imagePreview.file, 'image', imageCaption);
      setImagePreview(null);
      setImageCaption('');
      URL.revokeObjectURL(imagePreview.url);
    } catch (error) {
      console.error('Error sending image:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCancelImagePreview() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview.url);
      setImagePreview(null);
      setImageCaption('');
    }
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
                className="max-w-full rounded-lg max-h-96 object-contain"
                loading="lazy"
              />
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('📷') && (
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
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('🎥') && (
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
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('🎵') && (
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
              {msg.texto_da_mensagem && !msg.texto_da_mensagem.startsWith('📄') && (
                <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
              )}
            </div>
          );

        default:
          return <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>;
      }
    }

    // Se não tem mídia, só renderiza o texto
    return <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>;
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full grid grid-cols-12 gap-2 overflow-hidden">
        {/* Lista de Conversas */}
        <Card className={`col-span-12 lg:col-span-3 flex flex-col overflow-hidden ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversas
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
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedConversation?.id === conv.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(conv.nome_do_contato || conv.numero_de_telefone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold truncate">
                          {conv.nome_do_contato || conv.numero_de_telefone}
                        </p>
                        {conv.contagem_nao_lida > 0 && (
                          <Badge className="ml-2">{conv.contagem_nao_lida}</Badge>
                        )}
                      </div>
                      {conv.lead && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lead.company_name}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {conv.ultima_mensagem}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(conv.hora_da_ultima_mensagem)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className={`col-span-12 lg:col-span-6 flex flex-col overflow-hidden ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Header da Conversa */}
              <CardHeader className="border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedConversation(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {getInitials(
                          selectedConversation.nome_do_contato ||
                            selectedConversation.numero_de_telefone
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {selectedConversation.nome_do_contato ||
                          selectedConversation.numero_de_telefone}
                      </h3>
                      {selectedConversation.lead && (
                        <p className="text-sm text-muted-foreground">
                          {selectedConversation.lead.company_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {selectedConversation.status_da_conversa}
                    </Badge>
                    {selectedConversation.etiquetas?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedConversation.lead && (
                  <div className="flex gap-4 mt-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {selectedConversation.numero_de_telefone}
                    </div>
                    {selectedConversation.lead.email && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {selectedConversation.lead.email}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Tag className="h-4 w-4" />
                      <Badge variant="outline">{selectedConversation.lead.status}</Badge>
                    </div>
                  </div>
                )}
              </CardHeader>

              {/* Mensagens */}
              <CardContent className="flex-1 overflow-y-auto p-[20px] space-y-4 scrollbar-minimal">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.direcao === 'outbound' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.direcao === 'inbound' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedConversation.nome_do_contato || 'C')}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <MessageContextMenu
                      isOutbound={msg.direcao === 'outbound'}
                      onReact={(emoji) => handleReactToMessage(msg.id, emoji)}
                      onCopy={() => handleCopyMessage(msg.texto_da_mensagem)}
                      onForward={() => setForwardDialog({ open: true, messageId: msg.id })}
                      onDelete={msg.direcao === 'outbound' ? () => setDeleteDialog({ open: true, messageId: msg.id }) : undefined}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[70%] rounded-lg p-3 cursor-pointer ${
                          msg.direcao === 'outbound'
                            ? 'bg-[#005c4b] text-white'
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
                          {msg.status === 'sending' && ' • Enviando...'}
                        </p>
                      </div>
                    </MessageContextMenu>
                    {msg.direcao === 'outbound' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-green-600 text-white">
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
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
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
                      size="icon"
                      onClick={() => {
                        if (!newMessage.trim()) {
                          setShowAudioRecorder(true);
                        }
                      }}
                      disabled={loading}
                      className="bg-[#005c4b] hover:bg-[#004d3d]"
                    >
                      {newMessage.trim() ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
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
        {selectedConversation?.lead ? (
          <LeadInfoSidebar
            lead={selectedConversation.lead}
            phone={selectedConversation.numero_de_telefone}
            companyId={company!.id}
            userId={user!.user_id}
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
          <Card className="hidden lg:flex lg:col-span-3 flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground text-center">
                Selecione uma conversa para ver as informações do lead
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Attachment Options Dialog */}
      <AttachmentOptionsDialog
        open={showAttachmentOptions}
        onOpenChange={setShowAttachmentOptions}
        onSelectDocument={() => handleFileSelect('document')}
        onSelectImage={() => handleFileSelect('image')}
        onSelectVideo={() => handleFileSelect('video')}
        onSelectCamera={() => toast.info('Câmera em breve')}
        onSelectAudio={() => setShowAudioRecorder(true)}
        onSelectContact={() => toast.info('Contato em breve')}
        onSelectPoll={() => toast.info('Enquete em breve')}
        onSelectEvent={() => toast.info('Evento em breve')}
        onSelectSticker={() => toast.info('Figurinha em breve')}
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
    </div>
  );
}
