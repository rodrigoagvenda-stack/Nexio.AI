import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Mesmo storage/bucket que app/api/admin/briefing/upload-logo/route.ts (admin),
// só que aberto pra qualquer usuário autenticado da própria empresa : a tela
// de config do briefing é self-serve (dashboard)/briefing/page.tsx, não
// deveria exigir admin_users pra empresa fazer upload do próprio logo.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const { data: userRow } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();
    if (!userRow?.company_id) return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ success: false, message: 'Nenhum arquivo enviado' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 });
    }

    const service = createServiceClient();
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `briefing-logos/${userRow.company_id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await service.storage
      .from('user-uploads')
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ success: false, message: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = service.storage.from('user-uploads').getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
