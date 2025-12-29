import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se usuário é admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json(
        { success: false, message: 'Apenas administradores podem fazer upload de logos' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'ID da empresa não fornecido' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF' },
        { status: 400 }
      );
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'Arquivo muito grande. Máximo 2MB' },
        { status: 400 }
      );
    }

    // Nome único do arquivo (usa mesma pasta de avatars que já tem permissão)
    const fileExt = file.name.split('.').pop();
    const fileName = `company-${companyId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload para Supabase Storage (usa o mesmo bucket de user-uploads)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { success: false, message: 'Erro ao fazer upload da imagem' },
        { status: 500 }
      );
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    // Atualizar URL do logo na empresa (usa service client para bypassar RLS)
    const adminClient = createServiceClient();
    const { data: updateData, error: updateError } = await adminClient
      .from('companies')
      .update({ image_url: publicUrl })
      .eq('id', parseInt(companyId))
      .select()
      .single();

    if (updateError) {
      console.error('Error updating company logo:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar logo da empresa' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl,
    });
  } catch (error) {
    console.error('Error in upload company logo:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno' },
      { status: 500 }
    );
  }
}
