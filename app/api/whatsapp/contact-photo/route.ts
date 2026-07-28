import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc00:|fd)/i;

function isPrivateUrl(rawUrl: string): boolean {
  try { const { hostname } = new URL(rawUrl); return PRIVATE_IP.test(hostname); }
  catch { return true; }
}

// Chamado internamente pelo webhook handler — protegido pelo mesmo secret
// Body: { sender_pn, owner, image_preview_url }
export async function POST(request: NextRequest) {
  // Endpoint interno — requer NEXIO_WEBHOOK_SECRET via header
  const expectedSecret = process.env.NEXIO_WEBHOOK_SECRET
  const receivedSecret = request.headers.get('x-webhook-secret') ?? request.nextUrl.searchParams.get('secret')
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    // Últimos 10 dígitos (DDD + 8 dígitos) para casar independente do 9 na frente
    const phoneSuffix = phone.slice(-10);

    // Buscar conversa pelo sufixo do número
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id, company_id, whatsapp_photo_url')
      .ilike('numero_de_telefone', `%${phoneSuffix}`)
      .single();

    if (!conv) {
      return NextResponse.json(
        { success: false, message: 'Conversa não encontrada para esse número' },
        { status: 404 }
      );
    }

    // Já tem foto salva — não re-faz upload
    if (conv.whatsapp_photo_url) {
      return NextResponse.json({ success: true, photo_url: conv.whatsapp_photo_url, cached: true });
    }

    if (isPrivateUrl(image_preview_url)) {
      return NextResponse.json({ success: false, message: 'URL não permitida' }, { status: 400 });
    }

    // Baixar a imagem do WhatsApp
    const response = await fetch(image_preview_url, {
      signal: AbortSignal.timeout(8000),
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
    const filePath = `contact-photos/${conv.company_id}/${conv.id}.jpg`;

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
