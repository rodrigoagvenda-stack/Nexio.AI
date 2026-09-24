import { redirect } from 'next/navigation';

// O cadastro vive na tela de login (aba "Criar conta"), com o mesmo layout.
export default function SignupPage() {
  redirect('/login?tab=signup');
}
