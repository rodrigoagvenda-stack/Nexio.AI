import { createServiceClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';

// POST /api/admin/n8n/sync - Sincroniza erros do n8n (chamado pelo admin)
export async function POST() {
  try {
    // Verificar autenticação do admin
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await authSupabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Usar service client para bypassar RLS
    const supabase = createServiceClient();

    // Buscar instâncias ativas
    const { data: instances } = await supabase
      .from('n8n_instances')
      .select('*')
      .eq('active', true);

    if (!instances || instances.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma instância ativa para monitorar',
        newErrors: 0,
      });
    }

    let totalNewErrors = 0;
    const results = [];

    for (const instance of instances) {
      try {
        let apiKey: string;
        try {
          apiKey = decrypt(instance.api_key);
        } catch {
          // Fallback para base64
          apiKey = Buffer.from(instance.api_key, 'base64').toString('utf-8');
        }

        // Buscar execuções com erro no n8n
        const response = await fetch(
          `${instance.url}/api/v1/executions?status=error&limit=20`,
          {
            headers: { 'X-N8N-API-KEY': apiKey },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!response.ok) {
          results.push({
            instance: instance.name,
            status: 'error',
            message: `HTTP ${response.status}`,
          });
          continue;
        }

        const data = await response.json();
        const executions = data.data || [];
        let instanceNewErrors = 0;

        for (const execution of executions) {
          // Verificar se já existe
          const { data: existing } = await supabase
            .from('n8n_errors')
            .select('id')
            .eq('execution_id', String(execution.id))
            .single();

          if (existing) continue;

          // Buscar detalhes da execução
          let errorNode = 'Unknown';
          let errorMessage = 'Erro desconhecido';
          let errorDetails = '{}';
          let workflowName = execution.workflowData?.name || 'Unknown';

          try {
            const detailResponse = await fetch(
              `${instance.url}/api/v1/executions/${execution.id}`,
              {
                headers: { 'X-N8N-API-KEY': apiKey },
                signal: AbortSignal.timeout(10000),
              }
            );

            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              errorNode = detail.data?.resultData?.error?.node || 'Unknown';
              errorMessage = detail.data?.resultData?.error?.message || 'Erro desconhecido';
              errorDetails = JSON.stringify(detail.data?.resultData?.error || {});
              workflowName = detail.data?.workflowData?.name || workflowName;
            }
          } catch {
            // Usar dados básicos se o detalhe falhar
          }

          // Determinar severidade
          let severity = 'medium';
          const msg = errorMessage.toLowerCase();
          if (msg.includes('critical') || msg.includes('fatal')) severity = 'critical';
          else if (msg.includes('timeout') || msg.includes('connection')) severity = 'high';
          else if (msg.includes('warning')) severity = 'low';

          // Inserir erro
          await supabase.from('n8n_errors').insert({
            instance_id: instance.id,
            execution_id: String(execution.id),
            workflow_id: execution.workflowId || '',
            workflow_name: workflowName,
            error_node: errorNode,
            error_message: errorMessage,
            error_details: errorDetails,
            severity,
            notified: false,
            resolved: false,
            timestamp: execution.stoppedAt || new Date().toISOString(),
          });

          instanceNewErrors++;
          totalNewErrors++;
        }

        // Atualizar last_check
        await supabase
          .from('n8n_instances')
          .update({ last_check: new Date().toISOString() })
          .eq('id', instance.id);

        results.push({
          instance: instance.name,
          status: 'success',
          newErrors: instanceNewErrors,
          totalChecked: executions.length,
        });
      } catch (error: any) {
        results.push({
          instance: instance.name,
          status: 'error',
          message: error.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Sincronização concluída',
      newErrors: totalNewErrors,
      results,
    });
  } catch (error: any) {
    console.error('Erro na sincronização N8N:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na sincronização' },
      { status: 500 }
    );
  }
}
