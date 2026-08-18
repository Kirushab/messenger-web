export interface User {
  id: string; email: string; display_name: string;
  avatar_url: string | null; bio: string;
  status: 'online' | 'offline' | 'away';
  last_seen: string; created_at: string;
  custom_status_text?: string | null;
  custom_status_color?: string | null;
  custom_status_emoji?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'blocked' | 'deleted';
  blocked_at?: string | null;
  blocked_reason?: string | null;
  deleted_at?: string | null;
  encrypted_chat_access?: boolean;
  gmat_access?: boolean;
  notes_access?: boolean;
  fedya_access?: boolean;
  tinder_access?: boolean;
  voice_fx_access?: boolean;
}
export interface Conversation {
  id: string; type: 'direct' | 'group'; name: string | null;
  avatar_url: string | null; created_by: string;
  pinned_message_id: string | null;
  is_encrypted?: boolean | null;
  enc_check?: string | null;
  is_saved?: boolean | null;
  saved_owner_id?: string | null;
  created_at: string; updated_at: string;
}
export interface ConversationMember {
  conversation_id: string; user_id: string;
  role: 'admin' | 'member'; joined_at: string; last_read_at: string | null;
}
export interface StoryReplySnapshot {
  story_id: string;
  author_id: string;
  author_name: string;
  media_url: string | null;
  preview_url?: string | null;
  media_type: 'image' | 'video';
  caption?: string | null;
  story_created_at?: string | null;
}
export interface Message {
  id: string; conversation_id: string; sender_id: string;
  content: string; type: 'text' | 'image' | 'file' | 'voice' | 'album' | 'system' | 'location' | 'poll' | 'call';
  reply_to_id: string | null; created_at: string;
  is_encrypted?: boolean | null;
  forwarded_from_name?: string | null; forwarded_from_id?: string | null;
  story_reply_snapshot?: StoryReplySnapshot | null;
  updated_at: string; deleted_at: string | null;
}
export interface FileAttachment {
  id: string; message_id: string; file_url: string;
  file_name: string; file_size: number; mime_type: string;
  thumbnail_url: string | null;
  width?: number | null; height?: number | null;
}
export interface CallLog {
  id: string; conversation_id: string; initiated_by: string;
  type: 'audio' | 'video'; status: 'missed' | 'answered' | 'declined' | 'ongoing';
  started_at: string; ended_at: string | null; participants: string[];
}
export interface Reaction { id: string; message_id: string; user_id: string; emoji: string; }
export interface Poll {
  id: string; conversation_id: string; created_by: string;
  question: string; is_anonymous: boolean; is_multiple: boolean;
  options: PollOption[]; votes: PollVote[];
}
export interface PollOption { id: string; poll_id: string; text: string; sort_order: number; }
export interface PollVote { id: string; poll_id: string; option_id: string; user_id: string; }
export interface ConversationWithDetails extends Conversation {
  members: (ConversationMember & { user: User })[];
  last_message: Message | null; unread_count: number;
  is_pinned?: boolean; is_muted?: boolean; is_archived?: boolean;
}
export interface MessageWithSender extends Message {
  sender: User; reply_to: any; attachments: FileAttachment[];
  reactions?: Reaction[];
}

// ============== Posts / Feed ==============
export interface Post {
  id: string;
  author_id: string;
  caption: string;
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
  event_id?: string | null;
}
export interface PostMedia {
  id: string;
  post_id: string;
  file_url: string;
  mime_type: string;
  position: number;
  preview_url?: string | null;
  width?: number | null;
  height?: number | null;
}
export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: string;
}
export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: string;
}
export interface PostWithDetails extends Post {
  author: User;
  media: PostMedia[];
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  event?: { id: string; title: string; type: string; cover_url?: string | null } | null;
  liked_by_preview?: User[];
  comments_preview?: PostCommentWithAuthor[];
}
export interface PostCommentWithAuthor extends PostComment {
  author: User;
}
