import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseService = await createServiceClient();

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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Tipo de arquivo não permitido. Use JPG, PNG ou WEBP' },
        { status: 400 }
      );
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'Arquivo muito grande. Máximo 5MB' },
        { status: 400 }
      );
    }

    // Nome único do arquivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload para Supabase Storage (usando serviceClient para bypass de permissões)
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('user-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Verificar se o bucket existe
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json(
          { success: false, message: 'Bucket de storage não encontrado. Crie o bucket "user-uploads" no Supabase.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Erro ao fazer upload da imagem: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabaseService.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    // Atualizar URL da foto no perfil do usuário (usando serviceClient)
    const { error: updateError } = await supabaseService
      .from('users')
      .update({ photo_url: publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating user photo:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar perfil' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      photoUrl: publicUrl,
    });
  } catch (error) {
    console.error('Error in upload profile photo:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno' },
      { status: 500 }
    );
  }
}
