// Отслеживание сети и автоматическая отправка очереди при появлении связи.
import { supabase } from './supabase';
import {
  getQueuedMessages, removeFromQueue, incrementQueueRetry,
} from './offlineCache';
import { notifyMessageRecipients } from './pushNotifications';

type Listener = (online: boolean) => void;

class NetworkManager {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners = new Set<Listener>();
  private syncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🟢 online');
        this.online = true;
        this.notify();
        this.syncQueue();
      });
      window.addEventListener('offline', () => {
        console.log('🔴 offline');
        this.online = false;
        this.notify();
      });
    }
  }

  isOnline(): boolean {
    return this.online;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.online);
    return () => { this.listeners.delete(fn); };
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.online));
  }

  // Отправляет все сообщения из очереди
  async syncQueue(): Promise<number> {
    if (this.syncing || !this.online) return 0;
    this.syncing = true;
    let sent = 0;

    try {
      const queue = await getQueuedMessages();
      if (!queue.length) return 0;

      console.log(`📤 syncing ${queue.length} queued messages`);

      for (const msg of queue) {
        if ((msg.retries || 0) >= 5) {
          console.warn('max retries for', msg.tempId);
          await removeFromQueue(msg.tempId);
          continue;
        }

        try {
          const insert: any = {
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            type: msg.type,
          };
          if (msg.reply_to_id) insert.reply_to_id = msg.reply_to_id;
          if (msg.story_reply_snapshot) insert.story_reply_snapshot = msg.story_reply_snapshot;

          const { data: inserted, error } = await supabase.from('messages').insert(insert).select('id').single();
          if (error) {
            console.error('queue send error:', error.message);
            await incrementQueueRetry(msg.tempId);
          } else {
            await removeFromQueue(msg.tempId);
            await supabase
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', msg.conversation_id);
            if (inserted?.id) void notifyMessageRecipients(inserted.id);
            sent++;
          }
        } catch (e) {
          console.error('queue send exception:', e);
          await incrementQueueRetry(msg.tempId);
        }
      }

      console.log(`✅ queue sync complete: ${sent}/${queue.length}`);
    } finally {
      this.syncing = false;
    }
    return sent;
  }
}

export const networkManager = new NetworkManager();
