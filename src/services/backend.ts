/**
 * The app's single data entry point. Uses Supabase when the build has credentials
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY), otherwise the on-device backend.
 */
import { localBackend } from './localBackend';
import { supabaseConfigured } from './supabase';
import { supabaseBackend } from './supabaseBackend';
import type { Backend } from './types';

export const backend: Backend = supabaseConfigured ? supabaseBackend : localBackend;
export const usingSupabase = supabaseConfigured;

export { BackendError, advanceDate } from './types';
export type { Db } from './types';
