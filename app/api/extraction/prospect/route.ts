import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { extractLeadsFromMaps } from '@/lib/n8n/client';

async function buildMapsUrl(nicho: string, cidade: string, estado: string): Promise<string> {
  try {
    const query = encodeURIComponent(`${cidade}, ${estado}, Brasil`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'NexioAI/1.0' } }
    );
    const json = await res.json();
    if (json?.length > 0) {
      const { lat, lon } = json[0];
      const searchQuery = `${nicho} em ${cidade}`.replace(/\s+/g, '+');
      return `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}/@${lat},${lon},14z/data=!3m1!4b1?entry=ttu`;
    }
  } catch {
    // fallback para URL simples se Nominatim falhar
  }
  return `https://www.google.com.br/maps/search/${encodeURIComponent(`${nicho} em ${cidade}, ${estado}`)}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
    }

    const { url, limit, companyId, cidade, estado, nicho } = await request.json();

    if (!limit || !companyId) {
      return NextResponse.json(
        { success: false, message: 'Dados incompletos: limite e empresa são obrigatórios' },
        { status: 400 }
      );
    }

    if (!url && (!cidade || !estado || !nicho)) {
      return NextResponse.json(
        { success: false, message: 'Forneça uma URL do Google Maps ou preencha cidade, estado e nicho' },
        { status: 400 }
      );
    }

    let finalUrl = url;
    if (!finalUrl && cidade && estado && nicho) {
      finalUrl = await buildMapsUrl(nicho, cidade, estado);
    }

    const googleMapsPattern = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
    if (!googleMapsPattern.test(finalUrl)) {
      return NextResponse.json(
        { success: false, message: 'URL inválida. Use uma URL do Google Maps (.com ou .com.br)' },
        { status: 400 }
      );
    }

    const { data: company } = await supabase.from('companies').select('id, name').eq('id', companyId).single();
    if (!company) {
      return NextResponse.json({ success: false, message: 'Empresa não encontrada' }, { status: 404 });
    }

    const leadsToExtract = Math.min(limit, 500);

    // Criar sessão de extração para rastrear progresso em tempo real
    const serviceSupabase = createServiceClient();
    const { data: sessionData, error: sessionError } = await serviceSupabase
      .from('extraction_sessions')
      .insert({ company_id: companyId, requested: leadsToExtract, inserted: 0, status: 'running' })
      .select('id')
      .single();

    if (sessionError || !sessionData) {
      console.error('[Prospect] Erro ao criar sessão:', sessionError);
      return NextResponse.json({ success: false, message: 'Erro ao iniciar sessão de extração' }, { status: 500 });
    }

    const sessionId = sessionData.id;

    // Acionar n8n passando o session_id para callbacks
    const extractionResult = await extractLeadsFromMaps(finalUrl, leadsToExtract, companyId, sessionId);

    if (!extractionResult.success) {
      await serviceSupabase
        .from('extraction_sessions')
        .update({ status: 'error', completed_at: new Date().toISOString() })
        .eq('id', sessionId);

      return NextResponse.json(
        { success: false, message: extractionResult.message || 'Erro ao extrair leads via n8n' },
        { status: 500 }
      );
    }

    // activity_logs não tem policy de INSERT pra usuário autenticado : usa service role,
    // mesmo padrão de app/api/activity-logs/route.ts
    await serviceSupabase.from('activity_logs').insert({
      user_id: user.id,
      company_id: companyId,
      action: 'prospect_extraction',
      description: `Extraiu ${leadsToExtract} leads via prospect.AI`,
      metadata: { url: finalUrl, limit, extracted: leadsToExtract, cidade, estado, nicho, session_id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Extração iniciada',
      sessionId,
      requested: leadsToExtract,
    });
  } catch (error: any) {
    console.error('Prospect extraction error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
