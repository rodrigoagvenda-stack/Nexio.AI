import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('company_id', context.companyId)
      .order('tag_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao buscar tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { tagName, tagColor } = body;

    if (!tagName) {
      return NextResponse.json({ success: false, message: 'tagName é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tags')
      .insert({ company_id: context.companyId, tag_name: tagName, tag_color: tagColor || '#6366f1' })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, message: 'Esta tag já existe' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Tag criada com sucesso', data });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro ao criar tag' }, { status: 500 });
  }
}
