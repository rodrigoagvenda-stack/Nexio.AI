'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Search, Send, Phone, Mail, Building2, Tag, User, Bot, Mic, Paperclip, ArrowLeft } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils/format';
import { toast } from 'sonner';
import { AudioRecorder } from '@/components/chat/AudioRecorder';

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
  lead?: {
    company_name: string;
    contact_name: string;
    email: string;
    status: string;
  };
}

interface Message {
  id: number;
  texto_da_mensagem: string;
  tipo_de_mensagem: string;
  direcao: 'inbound' | 'outbound';
  sender_type: 'ai' | 'human';
  sender_user_id?: string;
  status: string;
  carimbo_de_data_e_hora: string;
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
          setMessages((prev) => [...prev, payload.new as Message]);
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
          lead:leads!conversas_do_whatsapp_id_do_lead_fkey(
            company_name,
            contact_name,
            email,
            status
          )
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

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          phoneNumber: selectedConversation.numero_de_telefone,
          message: newMessage,
          companyId: company!.id,
          userId: user.user_id,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setNewMessage('');
      toast.success('Mensagem enviada!');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendAudio(audioBlob: Blob, duration: number) {
    if (!selectedConversation || !user) return;

    setLoading(true);
    try {
      // 1. Upload do áudio para o Supabase Storage
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `${company!.id}/whatsapp/${selectedConversation.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          Atendimento WhatsApp
        </h1>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-180px)] md:h-[calc(100vh-200px)]">
        {/* Lista de Conversas */}
        <Card className={`col-span-12 lg:col-span-3 flex flex-col ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <CardHeader>
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
          <CardContent className="flex-1 overflow-y-auto space-y-2">
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
        <Card className={`col-span-12 lg:col-span-6 flex flex-col ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Header da Conversa */}
              <CardHeader className="border-b">
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
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
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
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-lg p-3 ${
                        msg.direcao === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
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
                      <p className="text-sm whitespace-pre-wrap">{msg.texto_da_mensagem}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.direcao === 'outbound' ? 'opacity-80' : 'text-muted-foreground'
                        }`}
                      >
                        {formatDateTime(msg.carimbo_de_data_e_hora)}
                      </p>
                    </div>
                    {msg.direcao === 'outbound' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
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
              <div className="border-t p-4">
                {showAudioRecorder ? (
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
                      onClick={() => setShowAudioRecorder(true)}
                      disabled={loading}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={loading}
                    />
                    <Button type="submit" disabled={loading || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
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
        <Card className="hidden lg:flex lg:col-span-3 flex-col overflow-hidden">
          {selectedConversation?.lead ? (
            <>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Informações do Lead</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Company Info */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Empresa
                  </h4>
                  <p className="text-sm font-medium">{selectedConversation.lead.company_name}</p>
                  {selectedConversation.lead.contact_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Contato: {selectedConversation.lead.contact_name}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Contact Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Telefone:</span>
                  </div>
                  <p className="text-sm font-medium pl-6">
                    {selectedConversation.numero_de_telefone}
                  </p>
                </div>

                {selectedConversation.lead.email && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email:</span>
                    </div>
                    <p className="text-sm font-medium pl-6">
                      {selectedConversation.lead.email}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Status */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Status</h4>
                  <Badge variant="outline" className="w-full justify-center">
                    {selectedConversation.lead.status}
                  </Badge>
                </div>

                {/* Tags */}
                {selectedConversation.etiquetas && selectedConversation.etiquetas.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Etiquetas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedConversation.etiquetas.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Conversation Status */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Status da Conversa</h4>
                  <Badge className="w-full justify-center">
                    {selectedConversation.status_da_conversa}
                  </Badge>
                </div>

                {/* Quick Actions */}
                <div className="pt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    Ver Lead Completo
                  </Button>
                </div>
              </CardContent>
            </>
          ) : selectedConversation ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Este contato não está vinculado a um lead
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Criar Lead
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground text-center">
                Selecione uma conversa para ver as informações do lead
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
