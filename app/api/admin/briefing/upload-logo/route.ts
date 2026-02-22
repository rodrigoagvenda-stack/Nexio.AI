import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const service = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });

    const { data: adminUser } = await service
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) return NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ success: false, message: 'Nenhum arquivo enviado' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const filePath = `briefing-logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
