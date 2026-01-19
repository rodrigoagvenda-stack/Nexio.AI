import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User as AuthUser } from '@supabase/supabase-js';
import { User, Company } from '@/types/database.types';

export function useUser() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchUserAndCompany(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchUserAndCompany(session.user.id);
      } else {
        setUser(null);
        setCompany(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserAndCompany(authUserId: string) {
    const supabase = createClient();

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (userError) throw userError;
      setUser(userData);

      if (userData?.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name, email, plan_name, plan_price, is_active')
          .eq('id', userData.company_id)
          .single();

        if (companyError) {
          console.error('Error fetching company:', companyError);
        }

        if (companyData) {
          setCompany(companyData);
        }
      }
    } catch (error) {
      console.error('Error fetching user/company:', error);
    } finally {
      setLoading(false);
    }
  }

  return { authUser, user, company, loading };
}
