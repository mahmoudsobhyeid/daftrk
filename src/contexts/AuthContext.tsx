import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRole, UserProfile } from '../lib/types';

interface AuthResult {
  error: string | null;
  data?: unknown;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  accountId: string | null;
  role: UserRole | null;
  loading: boolean;
  emailVerified: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (val: boolean) => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<AuthResult>;
  sendPhoneOtp: (phone: string) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, avatar_path, account_id, role, is_platform_admin, notify_invoice_paid, notify_invoice_overdue, notify_new_customer, notify_low_stock, notify_marketing, updated_at')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as UserProfile | null);
  };

  useEffect(() => {
    let mounted = true;

    // Check URL query and hash immediately on mount
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (searchParams.get('view') === 'reset' || hash.includes('type=recovery') || hash.includes('access_token')) {
      setIsPasswordRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setSession(session);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        if (session?.user) {
          loadProfile(session.user.id);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, _remember: boolean) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null, data };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) return { error: error.message };
    return { error: null, data };
  };

  const sendPhoneOtp = async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { error: error.message };
    return { error: null, data };
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token });
    if (error) return { error: error.message };
    return { error: null, data };
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const targetEmail = email.trim().toLowerCase();
    const redirectTo = `${window.location.origin}/auth?view=reset`;

    // 1. Supabase standard auth email
    const { data, error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo,
    });

    // 2. Also try custom Edge Function for resilient delivery
    try {
      supabase.functions.invoke('send-password-reset', {
        body: {
          email: targetEmail,
          resetUrl: redirectTo,
          lang: 'ar',
        },
      }).catch(() => {});
    } catch {
      // ignore function failure
    }

    if (error) return { error: error.message };
    return { error: null, data };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    setIsPasswordRecovery(false);
    return { error: null, data };
  };

  const resendVerification = async (email: string) => {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error: error.message };
    return { error: null, data };
  };

  const emailVerified = !!session?.user?.email_confirmed_at;
  const accountId = profile?.account_id ?? null;
  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        accountId,
        role,
        loading,
        emailVerified,
        isPasswordRecovery,
        setIsPasswordRecovery,
        signIn,
        signUp,
        sendPhoneOtp,
        verifyPhoneOtp,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
