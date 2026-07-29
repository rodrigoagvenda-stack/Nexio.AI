import { NextRequest, NextResponse } from 'next/server';

const store = new Map<string, { count: number; resetAt: number }>();

// Limpa entradas expiradas a cada 5 minutos para evitar crescimento ilimitado do Map
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * Interface key-based: uso direto sem middleware : retorna { success: boolean }
 * Exemplo: rateLimit({ key: `rota:${ip}`, limit: 10, windowMs: 60_000 })
 */
export function rateLimit(options: { key: string; limit: number; windowMs: number }): { success: boolean };

/**
 * Interface middleware: retorna um checker que recebe NextRequest e devolve NextResponse | null
 * Exemplo: const limiter = rateLimit({ limit: 5, windowMs: 60_000 }); limiter(request)
 */
export function rateLimit(options: { limit: number; windowMs: number }): (request: NextRequest) => NextResponse | null;

export function rateLimit(
  options: { key?: string; limit: number; windowMs: number }
): { success: boolean } | ((request: NextRequest) => NextResponse | null) {
  // Interface key-based
  if ('key' in options && options.key !== undefined) {
    const now = Date.now();
    const entry = store.get(options.key);

    if (!entry || now > entry.resetAt) {
      store.set(options.key, { count: 1, resetAt: now + options.windowMs });
      return { success: true };
    }

    entry.count++;
    return { success: entry.count <= options.limit };
  }

  // Interface middleware (compatibilidade com usos existentes)
  return function check(request: NextRequest): NextResponse | null {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const key = `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return null;
    }

    entry.count++;

    if (entry.count > options.limit) {
      return NextResponse.json(
        { success: false, message: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429 }
      );
    }

    return null;
  };
}
