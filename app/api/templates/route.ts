import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const body = await request.json();
    const { name, content, shortcut, category } = body;

    if (!name || !content) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios: name, content' },
        { status: 400 }
      );
    }

    if (shortcut && !shortcut.startsWith('/')) {
      return NextResponse.json({ success: false, message: 'Atalho deve começar com /' }, { status: 400 });
    }

    if (shortcut) {
      const { data: existingShortcut } = await supabase
        .from('message_templates')
        .select('id')
        .eq('company_id', context.companyId)
        .eq('shortcut', shortcut)
        .single();

      if (existingShortcut) {
        return NextResponse.json({ success: false, message: 'Este atalho já está em uso' }, { status: 409 });
      }
    }

    const { data: template, error } = await supabase
      .from('message_templates')
      .insert({
        company_id: context.companyId,
        created_by: context.userId,
        name: name.trim(),
        content: content.trim(),
        shortcut: shortcut?.toLowerCase().trim() || null,
        category: category || 'geral',
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Template criado com sucesso', template });
  } catch (error) {
    console.error('Error in POST /api/templates:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let query = supabase
      .from('message_templates')
      .select('*')
      .eq('company_id', context.companyId)
      .order('name', { ascending: true });

    if (category && category !== 'all') query = query.eq('category', category);
    if (activeOnly) query = query.eq('is_active', true);

    const { data: templates, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, templates: templates || [] });
  } catch (error) {
    console.error('Error in GET /api/templates:', error);
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 });
  }
}
