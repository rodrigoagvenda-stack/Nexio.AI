import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/types/database.types"

export default async function DashboardPage() {
  const debugInfo: any = { steps: [] }

  try {
    debugInfo.steps.push('1. Creating Supabase client')
    const supabase = await createClient()

    debugInfo.steps.push('2. Getting user from auth')
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      debugInfo.steps.push('2a. No user found')
      return <div className="p-8">No user</div>
    }

    debugInfo.userId = user.id
    debugInfo.steps.push('2b. User found: ' + user.id)

    debugInfo.steps.push('3. Fetching profile')
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>()

    if (profileError) {
      debugInfo.profileError = profileError
      debugInfo.steps.push('3a. Profile error: ' + profileError.message)
    }

    if (!profile) {
      debugInfo.steps.push('3b. No profile found')
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold text-red-600">Erro: Perfil não encontrado</h1>
          <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">{JSON.stringify({ profileError, debugInfo }, null, 2)}</pre>
        </div>
      )
    }

    debugInfo.profile = { id: profile.id, nome: profile.nome, igreja_id: profile.igreja_id }
    debugInfo.steps.push('3c. Profile loaded: ' + profile.nome)

    debugInfo.steps.push('4. SUCCESS - Rendering simple dashboard')

    return (
      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold">Dashboard Funcionando! ✅</h1>

        <div className="bg-green-100 p-4 rounded">
          <h2 className="font-bold text-lg mb-2">Informações Carregadas:</h2>
          <ul className="space-y-1">
            <li><strong>User ID:</strong> {user.id}</li>
            <li><strong>Nome:</strong> {profile.nome}</li>
            <li><strong>Email:</strong> {profile.email}</li>
            <li><strong>Role:</strong> {profile.role}</li>
            <li><strong>Igreja ID:</strong> {profile.igreja_id || 'null'}</li>
          </ul>
        </div>

        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-bold text-lg mb-2">Passos Executados com Sucesso:</h2>
          <ul className="list-disc list-inside text-sm">
            {debugInfo.steps.map((step: string, i: number) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="bg-yellow-100 p-4 rounded">
          <h2 className="font-bold text-lg mb-2">Próximos Passos:</h2>
          <p className="text-sm">
            O profile foi carregado com sucesso! Agora vamos adicionar os componentes um por um para ver qual está quebrando.
          </p>
        </div>
      </div>
    )
  } catch (error: any) {
    debugInfo.error = {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      name: error.name,
    }

    console.error("Dashboard error:", error)

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">ERRO NO DASHBOARD</h1>

        <div className="mt-4 space-y-4">
          <div className="bg-red-100 p-4 rounded">
            <h2 className="font-bold text-lg mb-2">Passos Executados:</h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {debugInfo.steps?.map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>

          <div className="bg-red-100 p-4 rounded">
            <h2 className="font-bold text-lg mb-2">Erro:</h2>
            <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
              {JSON.stringify(error.message, null, 2)}
            </pre>
          </div>

          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-bold text-lg mb-2">Debug Completo:</h2>
            <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    )
  }
}
