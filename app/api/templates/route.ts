import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/templates
 * Criar novo template de mensagem
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { companyId, userId, name, content, shortcut, category } = body;

    // Validações
    if (!companyId || !userId || !name || !content) {
      return NextResponse.json(
        { success: false, message: 'Campos obrigatórios: companyId, userId, name, content' },
        { status: 400 }
      );
    }

    if (shortcut && !shortcut.startsWith('/')) {
      return NextResponse.json(
        { success: false, message: 'Atalho deve começar com /' },
        { status: 400 }
      );
    }

    // Verificar se atalho já existe (caso fornecido)
    if (shortcut) {
      const { data: existingShortcut } = await supabase
        .from('message_templates')
        .select('id')
        .eq('company_id', companyId)
        .eq('shortcut', shortcut)
        .single();

      if (existingShortcut) {
        return NextResponse.json(
          { success: false, message: 'Este atalho já está em uso' },
          { status: 409 }
        );
      }
    }

    // Criar template
    const { data: template, error } = await supabase
      .from('message_templates')
      .insert({
        company_id: companyId,
        created_by: userId,
        name: name.trim(),
        content: content.trim(),
        shortcut: shortcut?.toLowerCase().trim() || null,
        category: category || 'geral',
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao criar template', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template criado com sucesso',
      template,
    });
  } catch (error) {
    console.error('Error in POST /api/templates:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/templates
 * Listar templates da empresa
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('message_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    // Filtrar por categoria
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Filtrar apenas ativos
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao buscar templates', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates || [],
    });
  } catch (error) {
    console.error('Error in GET /api/templates:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
