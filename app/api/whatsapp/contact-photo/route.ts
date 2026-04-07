import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Chamado pelo n8n ao receber mensagem inbound com imagePreview
// Body: { conversation_id, company_id, image_preview_url }
export async function POST(request: NextRequest) {
  try {
    const { conversation_id, company_id, image_preview_url } = await request.json();

    if (!conversation_id || !company_id || !image_preview_url) {
      return NextResponse.json(
        { success: false, message: 'conversation_id, company_id e image_preview_url são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verificar se já tem foto salva para não re-fazer upload desnecessariamente
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('whatsapp_photo_url')
      .eq('id', conversation_id)
      .eq('company_id', company_id)
      .single();

    if (conv?.whatsapp_photo_url) {
      return NextResponse.json({ success: true, photo_url: conv.whatsapp_photo_url, cached: true });
    }

    // Baixar a imagem do WhatsApp
    const response = await fetch(image_preview_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
      },
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
    const filePath = `contact-photos/${company_id}/${conversation_id}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, buffer, {
        contentType,
        cacheControl: '2592000', // 30 dias
        upsert: true,
      });

    if (uploadError) {
      console.error('Erro ao fazer upload da foto de contato:', uploadError);
      return NextResponse.json(
        { success: false, message: 'Erro ao salvar imagem: ' + uploadError.message },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    // Atualizar a conversa com a URL permanente
    const { error: updateError } = await supabase
      .from('conversas_do_whatsapp')
      .update({ whatsapp_photo_url: publicUrl })
      .eq('id', conversation_id)
      .eq('company_id', company_id);

    if (updateError) {
      console.error('Erro ao atualizar conversa com foto:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar conversa: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, photo_url: publicUrl });
  } catch (error: any) {
    console.error('Erro em contact-photo:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
