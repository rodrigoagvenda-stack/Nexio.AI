import { createServiceClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';

// POST /api/admin/n8n/sync - Sincroniza erros do n8n
export async function POST() {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[N8N-SYNC] ${msg}`);
    logs.push(msg);
  };

  try {
    // Verificar autenticação do admin
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: adminUser } = await authSupabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Buscar instâncias ativas
    const { data: instances, error: instancesError } = await supabase
      .from('n8n_instances')
      .select('*')
      .eq('active', true);

    if (instancesError) {
      log(`ERRO ao buscar instâncias: ${instancesError.message}`);
      return NextResponse.json({ error: instancesError.message, logs }, { status: 500 });
    }

    if (!instances || instances.length === 0) {
      log('Nenhuma instância ativa');
      return NextResponse.json({ message: 'Nenhuma instância ativa', newErrors: 0, logs });
    }

    log(`${instances.length} instância(s) ativa(s) encontrada(s)`);

    let totalNewErrors = 0;
    const results = [];

    for (const instance of instances) {
      try {
        // Descriptografar API key
        let apiKey: string;
        try {
          apiKey = decrypt(instance.api_key);
        } catch {
          try {
            apiKey = Buffer.from(instance.api_key, 'base64').toString('utf-8');
          } catch {
            apiKey = instance.api_key; // Tentar usar como texto puro
          }
        }

        log(`Buscando erros de "${instance.name}" em ${instance.url}`);

        // Paginar por TODAS as execuções com erro
        let allExecutions: any[] = [];
        let cursor: string | undefined;
        let pageCount = 0;
        const MAX_PAGES = 10; // Máximo 10 páginas (250 execuções por página)

        do {
          const url = new URL(`${instance.url}/api/v1/executions`);
          url.searchParams.set('status', 'error');
          url.searchParams.set('limit', '250');
          url.searchParams.set('includeData', 'true'); // OBRIGATÓRIO para receber detalhes do erro
          if (cursor) url.searchParams.set('cursor', cursor);

          const response = await fetch(url.toString(), {
            headers: { 'X-N8N-API-KEY': apiKey },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            const body = await response.text();
            log(`ERRO HTTP ${response.status} de "${instance.name}": ${body.substring(0, 200)}`);
            results.push({ instance: instance.name, status: 'error', message: `HTTP ${response.status}: ${body.substring(0, 100)}` });
            break;
          }

          const responseData = await response.json();
          log(`Resposta da API (página ${pageCount + 1}): ${JSON.stringify(Object.keys(responseData))}`);

          // N8N API pode retornar { data: [...] } ou diretamente [...]
          const executions = Array.isArray(responseData) ? responseData : (responseData.data || []);
          allExecutions = allExecutions.concat(executions);

          // Verificar se há próxima página
          cursor = responseData.nextCursor;
          pageCount++;

          log(`Página ${pageCount}: ${executions.length} execuções (cursor: ${cursor || 'fim'})`);
        } while (cursor && pageCount < MAX_PAGES);

        log(`Total de execuções com erro em "${instance.name}": ${allExecutions.length}`);

        let instanceNewErrors = 0;
        let instanceSkipped = 0;
        let instanceInsertErrors = 0;

        for (const execution of allExecutions) {
          const execId = String(execution.id);

          // Verificar se já existe
          const { data: existing } = await supabase
            .from('n8n_errors')
            .select('id')
            .eq('execution_id', execId)
            .maybeSingle(); // maybeSingle ao invés de single (não dá erro se não encontrar)

          if (existing) {
            instanceSkipped++;
            continue;
          }

          // Extrair dados do erro diretamente (includeData=true já traz tudo)
          let errorNode = 'Unknown';
          let errorMessage = 'Erro desconhecido';

          // workflowData pode estar em diferentes locais dependendo da versão do n8n
          let workflowName = execution.workflowData?.name
            || execution.workflowName
            || execution.data?.workflowData?.name
            || 'Unknown';

          // resultData com erro - verificar múltiplos formatos
          const resultData = execution.data?.resultData || execution.resultData;

          if (resultData?.error) {
            // node pode ser string OU objeto { name, type, ... }
            const nodeRef = resultData.error.node;
            errorNode = typeof nodeRef === 'string'
              ? nodeRef
              : (nodeRef?.name || nodeRef?.type || 'Unknown');
            errorMessage = resultData.error.message || 'Erro desconhecido';
          } else {
            // Fallback: procurar erro nos runData dos nodes
            const runData = resultData?.runData;
            if (runData) {
              for (const [nodeName, nodeRuns] of Object.entries(runData as Record<string, any[]>)) {
                const lastRun = nodeRuns?.[nodeRuns.length - 1];
                if (lastRun?.error) {
                  errorNode = nodeName;
                  errorMessage = lastRun.error.message || 'Erro desconhecido';
                  break;
                }
              }
            }
          }

          // Log do primeiro erro para debug do formato da API
          if (instanceNewErrors === 0 && instanceSkipped === 0 && instanceInsertErrors === 0) {
            log(`Estrutura da execução ${execId}: keys=[${Object.keys(execution).join(',')}]`);
            if (execution.data) {
              log(`execution.data keys=[${Object.keys(execution.data).join(',')}]`);
            }
            log(`Extraído: node="${errorNode}", msg="${errorMessage.substring(0, 100)}", wf="${workflowName}"`);
          }

          // Montar error_data como JSONB
          let errorData: Record<string, any> = {};
          try {
            errorData = {
              node: errorNode,
              message: errorMessage,
              severity: 'medium',
              executionUrl: `${instance.url}/execution/${execId}`,
            };
            // Adicionar detalhes do erro se existirem
            if (resultData?.error) {
              errorData.details = resultData.error;
            }
          } catch {
            errorData = { node: errorNode, message: errorMessage };
          }

          // Inserir erro - colunas reais da tabela n8n_errors
          const insertData = {
            instance_id: instance.id,
            execution_id: execId,
            workflow_id: String(execution.workflowId || execution.workflowData?.id || ''),
            workflow_name: String(workflowName).substring(0, 500),
            error_message: String(errorMessage).substring(0, 5000),
            error_data: errorData,
            status: 'open',
          };

          // Log do primeiro insert para debug
          if (instanceNewErrors === 0 && instanceSkipped === 0 && instanceInsertErrors === 0) {
            log(`INSERT DATA (primeiro): ${JSON.stringify({ ...insertData, error_data: '(truncado)' })}`);
          }

          const { error: insertError } = await supabase.from('n8n_errors').insert(insertData);

          if (insertError) {
            instanceInsertErrors++;
            if (instanceInsertErrors <= 5) {
              log(`ERRO INSERT exec ${execId}: ${insertError.message} (code: ${insertError.code}, details: ${insertError.details || 'N/A'}, hint: ${insertError.hint || 'N/A'})`);
            }
          } else {
            instanceNewErrors++;
            totalNewErrors++;
          }
        }

        // Atualizar last_check
        await supabase
          .from('n8n_instances')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', instance.id);

        const result = {
          instance: instance.name,
          status: 'success',
          totalExecutions: allExecutions.length,
          newErrors: instanceNewErrors,
          skipped: instanceSkipped,
          insertErrors: instanceInsertErrors,
        };
        results.push(result);
        log(`"${instance.name}": ${instanceNewErrors} novos, ${instanceSkipped} já existentes, ${instanceInsertErrors} falhas de insert`);

      } catch (error: any) {
        log(`ERRO em "${instance.name}": ${error.message}`);
        results.push({ instance: instance.name, status: 'error', message: error.message });
      }
    }

    // Verificar total de erros no banco após sync
    const { count: totalInDb } = await supabase
      .from('n8n_errors')
      .select('*', { count: 'exact', head: true });

    log(`Total de erros no banco após sync: ${totalInDb}`);

    return NextResponse.json({
      message: 'Sincronização concluída',
      newErrors: totalNewErrors,
      totalInDb: totalInDb || 0,
      results,
      logs,
    });
  } catch (error: any) {
    log(`ERRO GERAL: ${error.message}`);
    console.error('Erro na sincronização N8N:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na sincronização', logs },
      { status: 500 }
    );
  }
}
