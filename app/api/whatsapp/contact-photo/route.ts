import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Chamado pelo n8n ao receber mensagem inbound com imagePreview
// Body: { sender_pn, owner, image_preview_url }
// sender_pn = "557781680532@s.whatsapp.net" (telefone do contato)
// owner     = "559992225748" (telefone da instância/empresa)
export async function POST(request: NextRequest) {
  try {
    const { sender_pn, owner, image_preview_url } = await request.json();

    if (!sender_pn || !owner || !image_preview_url) {
      return NextResponse.json(
        { success: false, message: 'sender_pn, owner e image_preview_url são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Extrair só os dígitos do telefone do contato
    const phone = sender_pn.replace('@s.whatsapp.net', '').replace(/\D/g, '');

    // Buscar company pelo número da instância (owner)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('whatsapp_instance_phone', owner)
      .single();

    if (!company) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada para esse owner' },
        { status: 404 }
      );
    }

    const company_id = company.id;

    // Buscar conversa pelo telefone + company
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, whatsapp_photo_url')
      .eq('company_id', company_id)
      .ilike('numero_de_telefone', `%${phone}%`)
      .single();

    if (!conv) {
      return NextResponse.json(
        { success: false, message: 'Conversa não encontrada' },
        { status: 404 }
      );
    }

    // Já tem foto salva — não re-faz upload
    if (conv.whatsapp_photo_url) {
      return NextResponse.json({ success: true, photo_url: conv.whatsapp_photo_url, cached: true });
    }

    // Baixar a imagem do WhatsApp
    const response = await fetch(image_preview_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Falha ao baixar imagem: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    // Salvar no Supabase Storage
    const filePath = `contact-photos/${company_id}/${conv.id}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        cacheControl: '2592000',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, message: 'Erro ao salvar imagem: ' + uploadError.message },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    // Atualizar a conversa com a URL permanente
    await supabase
      .from('conversas_do_whatsapp')
      .update({ whatsapp_photo_url: publicUrl })
      .eq('id', conv.id);

    return NextResponse.json({ success: true, photo_url: publicUrl });
  } catch (error: any) {
    console.error('Erro em contact-photo:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
