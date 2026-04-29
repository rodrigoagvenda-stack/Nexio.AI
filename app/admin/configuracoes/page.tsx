export const dynamic = 'force-dynamic';

import { getPlatformConfigForAdmin } from '@/lib/platform-config';
import { PlatformConfigContent } from '@/components/admin/PlatformConfigContent';

export default async function AdminConfiguracoesPage() {
  const config = await getPlatformConfigForAdmin();
  return <PlatformConfigContent initialConfig={config} />;
}
