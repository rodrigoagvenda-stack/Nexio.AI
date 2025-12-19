import { redirect } from 'next/navigation';

export default function SignupPage() {
  // Signup desabilitado no MVP - redireciona para login
  redirect('/login');
}
