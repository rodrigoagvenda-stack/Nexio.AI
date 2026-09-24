import { redirect } from 'next/navigation';

// Os chamados agora ficam na aba Chamados da Ajuda
export default function SuportePage() {
  redirect('/ajuda?tab=chamados');
}
