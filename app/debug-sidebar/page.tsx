import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DebugSidebarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  // Fetch company data if company_id exists
  let companyData = null;
  let companyError = null;

  if (userData?.company_id) {
    const result = await supabase
      .from('companies')
      .select('*')
      .eq('id', userData.company_id)
      .single();

    companyData = result.data;
    companyError = result.error;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Debug: Sidebar Company Info</h1>
        <p className="text-muted-foreground mb-6">
          Esta página mostra os dados que deveriam aparecer no sidebar.
        </p>

        {/* Auth User Info */}
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">✅ Usuário Autenticado</h2>
            <div className="bg-muted/50 p-4 rounded-md font-mono text-sm space-y-1">
              <p><strong>Auth User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
            </div>
          </div>

          {/* Users Table Data */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">
              {userData ? '✅' : '❌'} Registro na Tabela Users
            </h2>
            {userError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-2">
                <strong>Erro:</strong> {JSON.stringify(userError, null, 2)}
              </div>
            )}
            {userData ? (
              <div className="bg-muted/50 p-4 rounded-md font-mono text-sm space-y-1">
                <p><strong>ID:</strong> {userData.id}</p>
                <p><strong>User ID:</strong> {userData.user_id}</p>
                <p><strong>Name:</strong> {userData.name || '(vazio)'}</p>
                <p><strong>Email:</strong> {userData.email || '(vazio)'}</p>
                <p><strong>Company ID:</strong> {userData.company_id || '(NULL - PROBLEMA!)'}</p>
                <p><strong>Auth User ID:</strong> {userData.auth_user_id || '(NULL - PROBLEMA!)'}</p>
                <p><strong>Is Active:</strong> {userData.is_active ? 'true' : 'false'}</p>
              </div>
            ) : (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                ❌ Nenhum registro encontrado na tabela users para este auth_user_id!
                <br />
                <strong>Solução:</strong> Execute o script database/fix-complete.sql
              </div>
            )}
          </div>

          {/* Company Data */}
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">
              {companyData ? '✅' : '❌'} Dados da Empresa
            </h2>
            {!userData?.company_id ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                ❌ O campo company_id está NULL na tabela users!
                <br />
                <strong>Solução:</strong> Execute o script database/fix-complete.sql
              </div>
            ) : companyError ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                <strong>Erro ao buscar empresa:</strong> {JSON.stringify(companyError, null, 2)}
              </div>
            ) : companyData ? (
              <div className="bg-muted/50 p-4 rounded-md font-mono text-sm space-y-1">
                <p><strong>ID:</strong> {companyData.id}</p>
                <p><strong>Name:</strong> {companyData.name || '(vazio - PROBLEMA!)'}</p>
                <p><strong>Email:</strong> {companyData.email || '(vazio - PROBLEMA!)'}</p>
                <p><strong>Image URL:</strong> {companyData.image_url || '(nenhuma imagem)'}</p>
                <p><strong>Plan Type:</strong> {companyData.plan_type || '(vazio)'}</p>
                <p><strong>VendAgro Plan:</strong> {companyData.vendagro_plan || '(nenhum)'}</p>
                <p><strong>Is Active:</strong> {companyData.is_active ? 'true' : 'false'}</p>
              </div>
            ) : (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                ❌ Empresa não encontrada com ID {userData.company_id}!
              </div>
            )}
          </div>

          {/* What Should Appear in Sidebar */}
          <div>
            <h2 className="text-lg font-semibold mb-2">📋 O que deve aparecer no Sidebar</h2>
            <div className="bg-primary/10 p-4 rounded-md space-y-2">
              <p>
                <strong>Nome da Empresa:</strong>{' '}
                <span className={!companyData?.name ? 'text-destructive' : ''}>
                  {companyData?.name || 'Empresa (fallback porque está vazio)'}
                </span>
              </p>
              <p>
                <strong>Email da Empresa:</strong>{' '}
                <span className={!companyData?.email ? 'text-destructive' : ''}>
                  {companyData?.email || 'empresa@vend.ai (fallback porque está vazio)'}
                </span>
              </p>
              <p>
                <strong>Imagem da Empresa:</strong>{' '}
                {companyData?.image_url ? (
                  <a href={companyData.image_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Ver imagem
                  </a>
                ) : (
                  <span className="text-muted-foreground">(nenhuma - mostra inicial do nome)</span>
                )}
              </p>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-md">
            <h2 className="text-lg font-semibold mb-2">🔧 Próximos Passos</h2>
            <div className="space-y-2 text-sm">
              {!userData && (
                <p>1. ❌ Execute o script: <code className="bg-muted px-2 py-1 rounded">database/fix-complete.sql</code></p>
              )}
              {userData && !userData.company_id && (
                <p>2. ❌ Execute o script: <code className="bg-muted px-2 py-1 rounded">database/fix-complete.sql</code></p>
              )}
              {userData && userData.company_id && !companyData && (
                <p>3. ❌ Execute o script: <code className="bg-muted px-2 py-1 rounded">database/seed-test-user.sql</code></p>
              )}
              {companyData && !companyData.name && (
                <p>4. ⚠️ Preencha o campo 'name' na tabela companies (ID: {companyData.id})</p>
              )}
              {companyData && !companyData.email && (
                <p>5. ⚠️ Preencha o campo 'email' na tabela companies (ID: {companyData.id})</p>
              )}
              {companyData && companyData.name && companyData.email && (
                <p className="text-green-600">✅ Todos os dados estão corretos! O sidebar deve funcionar.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2"
        >
          Voltar ao Dashboard
        </a>
      </div>
    </div>
  );
}
