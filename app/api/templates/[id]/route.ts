import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PUT /api/templates/[id]
 * Atualizar template existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const templateId = parseInt(params.id);
    const body = await request.json();
    const { companyId, name, content, shortcut, category, isActive } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se template existe e pertence à empresa
    const { data: existingTemplate } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single();

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, message: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se atalho já está em uso por outro template
    if (shortcut && shortcut !== existingTemplate.shortcut) {
      const { data: conflictingTemplate } = await supabase
        .from('message_templates')
        .select('id')
        .eq('company_id', companyId)
        .eq('shortcut', shortcut)
        .neq('id', templateId)
        .single();

      if (conflictingTemplate) {
        return NextResponse.json(
          { success: false, message: 'Este atalho já está em uso' },
          { status: 409 }
        );
      }
    }

    // Atualizar template
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (shortcut !== undefined) updateData.shortcut = shortcut?.toLowerCase().trim() || null;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: updatedTemplate, error } = await supabase
      .from('message_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar template', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template atualizado com sucesso',
      template: updatedTemplate,
    });
  } catch (error) {
    console.error('Error in PUT /api/templates/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 * Deletar template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const templateId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se template existe e pertence à empresa
    const { data: existingTemplate } = await supabase
      .from('message_templates')
      .select('id')
      .eq('id', templateId)
      .eq('company_id', parseInt(companyId))
      .single();

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, message: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // Deletar template
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', templateId)
      .eq('company_id', parseInt(companyId));

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao deletar template', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deletado com sucesso',
    });
  } catch (error) {
    console.error('Error in DELETE /api/templates/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/templates/[id]/increment-usage
 * Incrementar contador de uso do template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const templateId = parseInt(params.id);
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'companyId é obrigatório' },
        { status: 400 }
      );
    }

    // Incrementar usage_count (buscar valor atual e incrementar)
    const { data: currentTemplate } = await supabase
      .from('message_templates')
      .select('usage_count')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single();

    if (currentTemplate) {
      const { error: updateError } = await supabase
        .from('message_templates')
        .update({ usage_count: currentTemplate.usage_count + 1 })
        .eq('id', templateId)
        .eq('company_id', companyId);

      if (updateError) {
        console.error('Error incrementing usage:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Uso registrado',
    });
  } catch (error) {
    console.error('Error in PATCH /api/templates/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
