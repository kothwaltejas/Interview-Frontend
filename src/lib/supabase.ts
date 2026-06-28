import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const JWT_REFRESH_SKEW_SECONDS = 60;

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, skewSeconds = JWT_REFRESH_SKEW_SECONDS): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + (skewSeconds * 1000);
}

// Auth helper functions
export const authService = {
  // Upload resume to storage
  async uploadResume(file: File, userId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/resume.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('resumes')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(fileName);
    
    return publicUrlData.publicUrl;
  },

  // Sign up with email and additional user info
  async signUp(email: string, password: string, userData: {
    fullName: string;
    phone?: string;
    dateOfBirth?: string;
    experience?: string;
    resume?: File;
  }) {
    // First create the user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.fullName,
          phone: userData.phone,
          date_of_birth: userData.dateOfBirth,
          experience_level: userData.experience,
        }
      }
    });

    // If user creation successful, create user profile and upload resume
    if (!error && data.user) {
      try {
        // Get session token for API calls
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        // Create user profile in database
        if (token) {
          const profileResponse = await fetch(`${API_BASE_URL}/api/db/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              full_name: userData.fullName,
              email: email,
              phone: userData.phone,
              experience_level: userData.experience
            })
          });
          
          if (profileResponse.ok) {
            console.log('✅ User profile created in database');
          } else {
            console.error('Failed to create user profile:', await profileResponse.text());
          }
        }

        // Upload resume if provided
        if (userData.resume) {
          const resumeUrl = await this.uploadResume(userData.resume, data.user.id);
          
          // Save resume record to database
          if (token) {
            const resumeResponse = await fetch(`${API_BASE_URL}/api/db/resume`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                file_name: userData.resume.name,
                file_url: resumeUrl,
                file_size: userData.resume.size,
                parsed_data: {} // Will be parsed later
              })
            });
            
            if (resumeResponse.ok) {
              console.log('✅ Resume saved to database');
            } else {
              console.error('Failed to save resume to database:', await resumeResponse.text());
            }
          }

          // Update user metadata with resume URL
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              full_name: userData.fullName,
              phone: userData.phone,
              date_of_birth: userData.dateOfBirth,
              experience_level: userData.experience,
              resume_url: resumeUrl,
            }
          });

          if (updateError) {
            console.error('Error updating user with resume URL:', updateError);
          }
        }
      } catch (resumeError) {
        console.error('Error during registration:', resumeError);
        // Don't fail the signup if additional steps fail
      }
    }

    return { data, error };
  },

  // Sign in with email
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  isTokenExpired(token: string, skewSeconds = JWT_REFRESH_SKEW_SECONDS) {
    return isTokenExpired(token, skewSeconds);
  },

  async getFreshSession(): Promise<{ session: Session | null; error: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { session: null, error: 'Authentication required' };
    }

    if (!this.isTokenExpired(session.access_token)) {
      return { session, error: null };
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token && !this.isTokenExpired(data.session.access_token)) {
      return { session: data.session, error: null };
    }

    await supabase.auth.signOut();
    return { session: null, error: 'Your session expired. Please sign in again.' };
  },

  async getValidAccessToken(): Promise<string> {
    const { session, error } = await this.getFreshSession();
    if (!session?.access_token) {
      throw new Error(error || 'Authentication required');
    }
    return session.access_token;
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Check if user is authenticated
  async isAuthenticated() {
    const { user } = await this.getCurrentUser();
    return !!user;
  },

  // Listen for auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};