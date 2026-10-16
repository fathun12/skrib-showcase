export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookmark_list_items: {
        Row: {
          created_at: string
          list_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          list_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmark_list_items_bookmark_fkey"
            columns: ["user_id", "post_id"]
            isOneToOne: false
            referencedRelation: "bookmarks"
            referencedColumns: ["user_id", "post_id"]
          },
          {
            foreignKeyName: "bookmark_list_items_list_fkey"
            columns: ["list_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bookmark_lists"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      bookmark_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmark_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          quote: string | null
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          quote?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          quote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      following_state: {
        Row: {
          seen_at: string
          user_id: string
        }
        Insert: {
          seen_at?: string
          user_id?: string
        }
        Update: {
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "following_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foryou_hides: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          tag: string | null
          user_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          tag?: string | null
          user_id?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foryou_hides_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foryou_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          block_index: number
          color: string
          created_at: string
          end_offset: number
          id: string
          note: string | null
          post_id: string
          quote: string
          start_offset: number
          user_id: string
        }
        Insert: {
          block_index: number
          color?: string
          created_at?: string
          end_offset: number
          id?: string
          note?: string | null
          post_id: string
          quote: string
          start_offset: number
          user_id?: string
        }
        Update: {
          block_index?: number
          color?: string
          created_at?: string
          end_offset?: number
          id?: string
          note?: string | null
          post_id?: string
          quote?: string
          start_offset?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_notices: {
        Row: {
          action: string
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          reason: string | null
          recipient_id: string
          subject: string | null
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          recipient_id: string
          subject?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          recipient_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_notices_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_deliveries: {
        Row: {
          send_id: string
          sent_at: string
          subscription_id: string
        }
        Insert: {
          send_id: string
          sent_at?: string
          subscription_id: string
        }
        Update: {
          send_id?: string
          sent_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_deliveries_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "newsletter_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          author_id: string
          created_at: string
          id: string
          post_id: string
          status: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          post_id: string
          status?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          author_id: string
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          last_confirm_sent_at: string | null
          status: string
          token: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          author_id: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          last_confirm_sent_at?: string | null
          status?: string
          token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          author_id?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          last_confirm_sent_at?: string | null
          status?: string
          token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriptions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_images: {
        Row: {
          alt: string | null
          height: number
          note_id: string
          position: number
          url: string
          width: number
        }
        Insert: {
          alt?: string | null
          height?: number
          note_id: string
          position: number
          url: string
          width?: number
        }
        Update: {
          alt?: string | null
          height?: number
          note_id?: string
          position?: number
          url?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_images_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_likes: {
        Row: {
          created_at: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_likes_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_mentions: {
        Row: {
          note_id: string
          user_id: string
        }
        Insert: {
          note_id: string
          user_id: string
        }
        Update: {
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_mentions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_mutes: {
        Row: {
          created_at: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_mutes_muted_id_fkey"
            columns: ["muted_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mutes_muter_id_fkey"
            columns: ["muter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          legal_hold: boolean
          note_id: string | null
          reason: string
          reporter_id: string | null
          retain_until: string | null
          snapshot: Json
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          legal_hold?: boolean
          note_id?: string | null
          reason: string
          reporter_id?: string | null
          retain_until?: string | null
          snapshot: Json
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          legal_hold?: boolean
          note_id?: string | null
          reason?: string
          reporter_id?: string | null
          retain_until?: string | null
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_reports_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_reposts: {
        Row: {
          created_at: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_reposts_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_story_quotes: {
        Row: {
          note_id: string
          quote: string
        }
        Insert: {
          note_id: string
          quote: string
        }
        Update: {
          note_id?: string
          quote?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_story_quotes_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          note_id: string
          tag: string
        }
        Insert: {
          note_id: string
          tag: string
        }
        Update: {
          note_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          quote_note_id: string | null
          quote_removed: boolean
          reply_policy: string
          reply_to_id: string | null
          search_vector: unknown
          shared_post_id: string | null
          status: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          quote_note_id?: string | null
          quote_removed?: boolean
          reply_policy?: string
          reply_to_id?: string | null
          search_vector?: unknown
          shared_post_id?: string | null
          status?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          quote_note_id?: string | null
          quote_removed?: boolean
          reply_policy?: string
          reply_to_id?: string | null
          search_vector?: unknown
          shared_post_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_quote_note_id_fkey"
            columns: ["quote_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          seen_at: string
          user_id: string
        }
        Insert: {
          seen_at?: string
          user_id?: string
        }
        Update: {
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          message: string | null
          note_id: string | null
          post_id: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          message?: string | null
          note_id?: string | null
          post_id?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          message?: string | null
          note_id?: string | null
          post_id?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_collaborators: {
        Row: {
          accepted_at: string | null
          can_publish: boolean
          created_at: string
          invited_by: string
          post_id: string
          role: string
          show_credit: boolean
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          can_publish?: boolean
          created_at?: string
          invited_by?: string
          post_id: string
          role?: string
          show_credit?: boolean
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          can_publish?: boolean
          created_at?: string
          invited_by?: string
          post_id?: string
          role?: string
          show_credit?: boolean
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_collaborators_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_credits: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string
          link: string | null
          name: string | null
          post_id: string
          role: string
          role_other: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string
          link?: string | null
          name?: string | null
          post_id: string
          role: string
          role_other?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string
          link?: string | null
          name?: string | null
          post_id?: string
          role?: string
          role_other?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_credits_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_credits_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_stats_daily: {
        Row: {
          day: string
          post_id: string
          reads: number
          views: number
        }
        Insert: {
          day: string
          post_id: string
          reads?: number
          views?: number
        }
        Update: {
          day?: string
          post_id?: string
          reads?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_stats_daily_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: Json
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          language: string
          published_at: string | null
          reading_time_min: number | null
          schedule_email: boolean
          scheduled_for: string | null
          search_vector: unknown
          slug: string
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          language?: string
          published_at?: string | null
          reading_time_min?: number | null
          schedule_email?: boolean
          scheduled_for?: string | null
          search_vector?: unknown
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          language?: string
          published_at?: string | null
          reading_time_min?: number | null
          schedule_email?: boolean
          scheduled_for?: string | null
          search_vector?: unknown
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          newsletter_enabled: boolean
          pinned_post_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          newsletter_enabled?: boolean
          pinned_post_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          newsletter_enabled?: boolean
          pinned_post_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          post_id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          post_id: string
          progress: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          post_id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repost_caption_reports: {
        Row: {
          caption_text: string
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
          repost_user_id: string
          status: string
        }
        Insert: {
          caption_text?: string
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id?: string
          repost_user_id: string
          status?: string
        }
        Update: {
          caption_text?: string
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          repost_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repost_caption_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repost_caption_reports_repost_fk"
            columns: ["repost_user_id", "post_id"]
            isOneToOne: false
            referencedRelation: "reposts"
            referencedColumns: ["user_id", "post_id"]
          },
        ]
      }
      reposts: {
        Row: {
          caption: string | null
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          post_id: string
          user_id?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          author_id: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          author_id: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          author_id?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series_posts: {
        Row: {
          position: number
          post_id: string
          series_id: string
        }
        Insert: {
          position: number
          post_id: string
          series_id: string
        }
        Update: {
          position?: number
          post_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_posts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          series_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string
          series_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          series_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_reports_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_follows: {
        Row: {
          created_at: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag: string
          user_id?: string
        }
        Update: {
          created_at?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_edit_lock: {
        Args: { p_post_id: string }
        Returns: {
          cooldown_seconds: number
          free: boolean
          holder_display_name: string
          holder_id: string
          holder_idle_seconds: number
          i_requested: boolean
          is_holder: boolean
          request_age_seconds: number
          requested_by: string
          requested_by_display_name: string
        }[]
      }
      admin_add_disclosure: {
        Args: {
          p_kind: string
          p_note_id?: string
          p_received_on: string
          p_reference?: string
          p_requester: string
          p_summary: string
          p_user_id?: string
        }
        Returns: string
      }
      admin_author_history: {
        Args: { p_author_id: string }
        Returns: {
          delete_count: number
          hide_count: number
          suspend_count: number
        }[]
      }
      admin_get_post: {
        Args: { p_post_id: string }
        Returns: {
          author_display_name: string
          author_id: string
          author_username: string
          content: Json
          language: string
          post_id: string
          published_at: string
          status: string
          subtitle: string
          title: string
        }[]
      }
      admin_list_comment_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          author_display_name: string
          author_username: string
          comment_author_id: string
          comment_id: string
          comment_quote: string
          comment_snippet: string
          latest_report_at: string
          post_id: string
          post_owner_username: string
          post_slug: string
          post_title: string
          reasons: string[]
          report_count: number
          reports: Json
        }[]
      }
      admin_list_disclosures: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          id: string
          kind: string
          note_id: string
          received_on: string
          reference: string
          requester: string
          summary: string
          user_id: string
        }[]
      }
      admin_list_hidden_posts: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          author_display_name: string
          author_id: string
          author_username: string
          hidden_at: string
          post_id: string
          post_slug: string
          post_title: string
        }[]
      }
      admin_list_note_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          author_display_name: string
          author_id: string
          author_username: string
          latest_report_at: string
          legal_hold: boolean
          note_id: string
          note_images: Json
          note_quote: Json
          note_status: string
          note_story: Json
          note_story_quote: string
          note_text: string
          parent: Json
          reasons: string[]
          report_count: number
          reports: Json
          retain_until: string
          written_at: string
        }[]
      }
      admin_list_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          author_display_name: string
          author_id: string
          author_username: string
          latest_report_at: string
          post_id: string
          post_slug: string
          post_status: string
          post_title: string
          reasons: string[]
          report_count: number
          reports: Json
        }[]
      }
      admin_list_series_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          author_display_name: string
          author_id: string
          author_username: string
          latest_report_at: string
          reasons: string[]
          report_count: number
          reports: Json
          series_description: string
          series_id: string
          series_slug: string
          series_title: string
        }[]
      }
      admin_list_suspended: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          display_name: string
          expires_at: string
          note: string
          reason: string
          suspended_at: string
          user_id: string
          username: string
        }[]
      }
      admin_moderate_comment: {
        Args: {
          p_action: string
          p_comment_id: string
          p_note?: string
          p_reason?: string
        }
        Returns: {
          author_id: string
          snippet: string
        }[]
      }
      admin_moderate_note: {
        Args: {
          p_action: string
          p_note?: string
          p_note_id: string
          p_reason?: string
        }
        Returns: {
          author_id: string
          snippet: string
        }[]
      }
      admin_moderate_post: {
        Args: {
          p_action: string
          p_note?: string
          p_post_id: string
          p_reason?: string
        }
        Returns: {
          author_id: string
          post_title: string
        }[]
      }
      admin_moderate_series: {
        Args: {
          p_action: string
          p_note?: string
          p_reason?: string
          p_series_id: string
        }
        Returns: {
          author_id: string
          title: string
        }[]
      }
      admin_open_note_report_count: { Args: never; Returns: number }
      admin_open_report_counts: {
        Args: never
        Returns: {
          comments: number
          posts: number
          series: number
        }[]
      }
      admin_prepare_email: {
        Args: { p_kind: string; p_user_id: string }
        Returns: string
      }
      admin_preview_note_report_purge: {
        Args: never
        Returns: {
          on_hold: number
          purgeable: number
          waiting: number
        }[]
      }
      admin_purge_note_reports: { Args: never; Returns: number }
      admin_set_note_legal_hold: {
        Args: { p_hold: boolean; p_note: string; p_note_id: string }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: {
          p_days?: number
          p_note?: string
          p_reason: string
          p_user_id: string
        }
        Returns: string
      }
      admin_unsuspend_user: {
        Args: { p_note?: string; p_user_id: string }
        Returns: undefined
      }
      am_i_admin: { Args: never; Returns: boolean }
      am_i_suspended: { Args: never; Returns: boolean }
      check_rate_limit: {
        Args: { p_action: string }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      confirm_newsletter: { Args: { p_token: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      editor_publish_post: {
        Args: { p_post_id: string; p_slug: string }
        Returns: undefined
      }
      get_author_insights: { Args: { p_days: number }; Returns: Json }
      get_comment_counts: {
        Args: { post_ids: string[] }
        Returns: {
          comment_count: number
          post_id: string
        }[]
      }
      get_following_feed: {
        Args: {
          p_after_at: string
          p_after_id: string
          p_author_ids: string[]
          p_limit: number
        }
        Returns: {
          event_at: string
          post_id: string
          reposter_id: string
        }[]
      }
      get_following_note_feed: {
        Args: {
          p_after_at: string
          p_after_id: string
          p_author_ids: string[]
          p_exclude: string[]
          p_limit: number
        }
        Returns: {
          activity_at: string
          note_id: string
          reposter_id: string
        }[]
      }
      get_following_notes: {
        Args: {
          p_after_at: string
          p_after_id: string
          p_author_ids: string[]
          p_limit: number
        }
        Returns: {
          created_at: string
          note_id: string
        }[]
      }
      get_for_you_post_ids: {
        Args: { p_days: number; p_limit: number }
        Returns: {
          post_id: string
        }[]
      }
      get_like_counts: {
        Args: { post_ids: string[] }
        Returns: {
          like_count: number
          post_id: string
        }[]
      }
      get_lock_state: {
        Args: { p_post_id: string }
        Returns: {
          cooldown_seconds: number
          free: boolean
          holder_display_name: string
          holder_id: string
          holder_idle_seconds: number
          i_requested: boolean
          is_holder: boolean
          request_age_seconds: number
          requested_by: string
          requested_by_display_name: string
        }[]
      }
      get_my_new_activity: {
        Args: { p_limit: number; p_since: string }
        Returns: {
          event_at: string
          post_id: string
          reposter_id: string
        }[]
      }
      get_my_new_posts: {
        Args: { p_limit: number; p_since: string }
        Returns: {
          post_id: string
          published_at: string
        }[]
      }
      get_newsletter_token_info: {
        Args: { p_token: string }
        Returns: {
          o_author_name: string
          o_author_username: string
          o_status: string
        }[]
      }
      get_note_ancestors: {
        Args: { p_note_id: string }
        Returns: {
          depth: number
          note_id: string
        }[]
      }
      get_note_like_counts: {
        Args: { note_ids: string[] }
        Returns: {
          like_count: number
          note_id: string
        }[]
      }
      get_note_reply_counts: {
        Args: { note_ids: string[] }
        Returns: {
          note_id: string
          reply_count: number
        }[]
      }
      get_note_repost_counts: {
        Args: { note_ids: string[] }
        Returns: {
          note_id: string
          repost_count: number
        }[]
      }
      get_note_tag_count: {
        Args: { p_exclude: string[]; p_tag: string }
        Returns: number
      }
      get_popular_note_ids: {
        Args: { p_days: number; p_exclude: string[]; p_limit: number }
        Returns: {
          note_id: string
        }[]
      }
      get_popular_post_ids: {
        Args: { p_days: number; p_limit: number }
        Returns: {
          post_id: string
        }[]
      }
      get_popular_tagged_note_ids: {
        Args: {
          p_days: number
          p_exclude: string[]
          p_limit: number
          p_tag: string
        }
        Returns: {
          note_id: string
        }[]
      }
      get_post_coauthors: {
        Args: { p_post_ids: string[] }
        Returns: {
          accepted_at: string
          avatar_url: string
          display_name: string
          post_id: string
          username: string
        }[]
      }
      get_post_credits: {
        Args: { p_post_id: string }
        Returns: {
          avatar_url: string
          credit_id: string
          display_name: string
          link: string
          name: string
          role: string
          role_other: string
          username: string
        }[]
      }
      get_post_editors: {
        Args: { p_post_ids: string[] }
        Returns: {
          accepted_at: string
          avatar_url: string
          display_name: string
          post_id: string
          username: string
        }[]
      }
      get_post_version: {
        Args: { p_version_id: string }
        Returns: {
          content: Json
          created_at: string
          id: string
          language: string
          post_id: string
          reason: string
          subtitle: string
          title: string
        }[]
      }
      get_published_post_ids: {
        Args: {
          p_after_at: string
          p_after_id: string
          p_author_ids: string[]
          p_exclude_id: string
          p_limit: number
        }
        Returns: {
          post_id: string
        }[]
      }
      get_repost_counts: {
        Args: { post_ids: string[] }
        Returns: {
          post_id: string
          repost_count: number
        }[]
      }
      get_tag_counts: {
        Args: { p_limit?: number; p_prefix?: string }
        Returns: {
          post_count: number
          tag: string
        }[]
      }
      get_tagged_note_ids: {
        Args: {
          p_after_at: string
          p_after_id: string
          p_exclude: string[]
          p_limit: number
          p_tag: string
        }
        Returns: {
          created_at: string
          note_id: string
        }[]
      }
      get_topics_feed: {
        Args: { p_after_at: string; p_after_id: string; p_limit: number }
        Returns: {
          event_at: string
          post_id: string
        }[]
      }
      get_trending_note_tags: {
        Args: {
          p_exclude: string[]
          p_hours: number
          p_limit: number
          p_min_authors: number
          p_min_notes: number
        }
        Returns: {
          author_count: number
          note_count: number
          tag: string
        }[]
      }
      handover_post: {
        Args: { p_message: string; p_post_id: string }
        Returns: undefined
      }
      heartbeat_edit_lock: {
        Args: { p_edited: boolean; p_post_id: string }
        Returns: {
          cooldown_seconds: number
          free: boolean
          holder_display_name: string
          holder_id: string
          holder_idle_seconds: number
          i_requested: boolean
          is_holder: boolean
          request_age_seconds: number
          requested_by: string
          requested_by_display_name: string
        }[]
      }
      hide_note_reply: {
        Args: { p_hidden: boolean; p_note_id: string }
        Returns: undefined
      }
      i_am_blocked_by: { Args: { p_author: string }; Returns: boolean }
      list_hidden_replies: {
        Args: { p_parent_id: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          id: string
        }[]
      }
      list_my_credit_invites: {
        Args: never
        Returns: {
          created_at: string
          credit_id: string
          owner_display_name: string
          owner_username: string
          post_id: string
          post_title: string
          role: string
          role_other: string
        }[]
      }
      list_my_image_urls: {
        Args: never
        Returns: {
          url: string
        }[]
      }
      list_my_invites: {
        Args: never
        Returns: {
          created_at: string
          invite_role: string
          owner_display_name: string
          owner_username: string
          post_id: string
          post_title: string
          show_credit: boolean
        }[]
      }
      list_post_versions: {
        Args: { p_post_id: string }
        Returns: {
          created_at: string
          id: string
          reason: string
          saved_by_name: string
          title: string
          word_count: number
        }[]
      }
      list_used_image_urls: {
        Args: never
        Returns: {
          url: string
        }[]
      }
      my_hidden_note_authors: { Args: never; Returns: string[] }
      my_newsletter_status: { Args: { p_author: string }; Returns: string }
      my_newsletter_subscriber_count: { Args: never; Returns: number }
      my_suspension_until: { Args: never; Returns: string }
      next_newsletter_batch: {
        Args: { p_limit: number; p_send: string }
        Returns: {
          o_email: string
          o_subscription_id: string
          o_token: string
        }[]
      }
      publish_due_posts: {
        Args: { p_limit?: number }
        Returns: {
          o_author_id: string
          o_post_id: string
          o_send_email: boolean
          o_tags: string[]
        }[]
      }
      queue_newsletter_send: {
        Args: { p_post: string; p_skip: boolean }
        Returns: string
      }
      record_post_event: {
        Args: { p_kind: string; p_post_id: string }
        Returns: undefined
      }
      refresh_search_words: { Args: never; Returns: undefined }
      release_edit_lock: { Args: { p_post_id: string }; Returns: undefined }
      release_newsletter_deliveries: {
        Args: { p_send: string; p_subscriptions: string[] }
        Returns: undefined
      }
      report_note: {
        Args: { p_details?: string; p_note_id: string; p_reason: string }
        Returns: string
      }
      request_newsletter_subscription: {
        Args: { p_author: string; p_email: string; p_user: string }
        Returns: {
          o_author_name: string
          o_email: string
          o_outcome: string
          o_token: string
        }[]
      }
      request_turn: {
        Args: { p_post_id: string }
        Returns: {
          cooldown_seconds: number
          free: boolean
          holder_display_name: string
          holder_id: string
          holder_idle_seconds: number
          i_requested: boolean
          is_holder: boolean
          request_age_seconds: number
          requested_by: string
          requested_by_display_name: string
        }[]
      }
      respond_credit: {
        Args: { p_accept: boolean; p_credit_id: string }
        Returns: undefined
      }
      respond_invite: {
        Args: { p_accept: boolean; p_post_id: string }
        Returns: undefined
      }
      respond_turn: {
        Args: { p_hand_over: boolean; p_post_id: string }
        Returns: {
          cooldown_seconds: number
          free: boolean
          holder_display_name: string
          holder_id: string
          holder_idle_seconds: number
          i_requested: boolean
          is_holder: boolean
          request_age_seconds: number
          requested_by: string
          requested_by_display_name: string
        }[]
      }
      save_post_version: {
        Args: { p_post_id: string; p_reason: string }
        Returns: boolean
      }
      save_reading_progress: {
        Args: { p_post_id: string; p_progress: number }
        Returns: undefined
      }
      save_shared_post: {
        Args: {
          p_content: Json
          p_excerpt: string
          p_expected_status: string
          p_language?: string
          p_post_id: string
          p_reading_time_min: number
          p_subtitle: string
          p_title: string
        }
        Returns: undefined
      }
      schedule_post: {
        Args: {
          p_cover?: string
          p_email?: boolean
          p_post: string
          p_slug?: string
          p_tags?: string[]
          p_when?: string
        }
        Returns: string
      }
      search_notes: {
        Args: {
          p_exclude?: string[]
          p_limit?: number
          p_offset?: number
          p_query: string
        }
        Returns: {
          note_id: string
          rank: number
        }[]
      }
      search_post_snippets: {
        Args: { p_post_ids: string[]; p_query: string }
        Returns: {
          post_id: string
          snippet: string
        }[]
      }
      search_posts: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          post_id: string
          rank: number
        }[]
      }
      set_editor_can_publish: {
        Args: { p_can_publish: boolean; p_post_id: string; p_user_id: string }
        Returns: undefined
      }
      set_editor_credit: {
        Args: { p_post_id: string; p_show_credit: boolean; p_user_id: string }
        Returns: undefined
      }
      set_pinned_post: { Args: { p_post: string }; Returns: string }
      set_shared_post_cover: {
        Args: { p_cover_url: string; p_post_id: string }
        Returns: undefined
      }
      suggest_highlight_query: { Args: { p_query: string }; Returns: string }
      suggest_search_query: { Args: { p_query: string }; Returns: string }
      unsubscribe_my_newsletter: { Args: { p_author: string }; Returns: string }
      unsubscribe_newsletter: { Args: { p_token: string }; Returns: string }
      unused_image_urls: {
        Args: { p_urls: string[] }
        Returns: {
          url: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
