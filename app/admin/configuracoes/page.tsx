export const dynamic = 'force-dynamic';

import { getPlatformConfigForAdmin } from '@/lib/platform-config';
import { PlatformConfigContent } from '@/components/admin/PlatformConfigContent';

export default async function AdminConfiguracoesPage() {
  let config: Record<string, string> = {};
  let readError: string | undefined;

  try {
    config = await getPlatformConfigForAdmin();
  } catch (err: any) {
    readError = err.message;
  }

  return <PlatformConfigContent initialConfig={config} readError={readError} />;
}
