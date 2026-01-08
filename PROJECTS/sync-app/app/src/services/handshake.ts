import { supabase } from './supabase';
import type { SyncRequest } from '../types';

export const createSyncRequest = async (
  fromUserId: string,
  toUserId: string,
  type: 'call' | 'ping'
): Promise<SyncRequest | null> => {
  const expiresAt = new Date();
  if (type === 'call') {
    expiresAt.setMinutes(expiresAt.getMinutes() + 1);
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24);
  }

  const { data, error } = await supabase
    .from('sync_requests')
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      type,
      status: 'seeking',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating sync request:', error);
    return null;
  }

  return data;
};

export const respondToSyncRequest = async (
  requestId: string
): Promise<SyncRequest | null> => {
  const { data, error } = await supabase
    .from('sync_requests')
    .update({
      status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'seeking')
    .select()
    .single();

  if (error) {
    console.error('Error responding to sync request:', error);
    return null;
  }

  return data;
};

export const getActiveSyncRequests = async (
  userId: string
): Promise<SyncRequest[]> => {
  const { data, error } = await supabase
    .from('sync_requests')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'seeking')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching sync requests:', error);
    return [];
  }

  return data || [];
};
