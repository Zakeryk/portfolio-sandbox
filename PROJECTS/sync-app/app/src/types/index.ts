export type User = {
  id: string;
  phone: string;
  username?: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  last_seen_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  source: 'contact' | 'link';
  created_at: string;
};

export type SyncRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: 'call' | 'ping';
  status: 'seeking' | 'matched' | 'expired';
  created_at: string;
  expires_at: string;
  matched_at?: string;
};

export type Friend = User & {
  friendship_id: string;
  is_online: boolean;
};
