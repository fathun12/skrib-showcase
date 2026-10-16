import { z } from "zod";
import { EMPTY_DOC, type OwnPost } from "@/features/posts/queries";
import { docSchema } from "@/features/posts/schemas";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";

export type CollaboratorStatus = "pending" | "accepted";

export type CollaboratorRole = "coauthor" | "editor";

export type Collaborator = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: CollaboratorStatus;
  role: CollaboratorRole;
  // Only meaningful for an editor.
  showCredit: boolean;
  // Editor only: the author allowed this editor to publish the story.
  canPublish: boolean;
  createdAt: string;
};

// The people invited to one post, for the owner's Collaborators dialog.
// RLS shows the owner every row; anyone else only sees their own row.
// Returns null when the query fails, so the dialog can say so instead of
// showing an empty list that looks like "nobody is invited".
export async function listCollaborators(
  postId: string,
): Promise<Collaborator[] | null> {
  if (!z.uuid().safeParse(postId).success) return null;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("post_collaborators")
    .select("user_id, status, role, show_credit, can_publish, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !rows) {
    console.error("listCollaborators failed:", error);
    return null;
  }
  if (rows.length === 0) return [];

  // A second small query for the people (same approach as the feed).
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in(
      "id",
      rows.map((row) => row.user_id),
    );

  if (profilesError || !profiles) {
    console.error("listCollaborators (profiles) failed:", profilesError);
    return null;
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const result: Collaborator[] = [];
  for (const row of rows) {
    const profile = profileById.get(row.user_id);
    if (!profile || !profile.username) continue;
    result.push({
      userId: row.user_id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: safeAvatarUrl(profile.avatar_url),
      status: row.status === "accepted" ? "accepted" : "pending",
      role: row.role === "editor" ? "editor" : "coauthor",
      showCredit: row.show_credit,
      canPublish: row.can_publish,
      createdAt: row.created_at,
    });
  }
  return result;
}

export type MyInvite = {
  postId: string;
  // Empty string when the draft has no title yet.
  postTitle: string;
  // What the invitation is for. showCredit only matters for an editor.
  role: CollaboratorRole;
  showCredit: boolean;
  ownerDisplayName: string;
  ownerUsername: string;
  createdAt: string;
};

// The pending invitations of the signed-in user. A pending invitee may only
// see the title and who invited them, so this goes through the database
// function list_my_invites and not through the posts table.
export async function listMyInvites(): Promise<MyInvite[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_invites");

  if (error || !data) {
    console.error("listMyInvites failed:", error);
    return null;
  }

  const result: MyInvite[] = [];
  for (const row of data) {
    if (!row.owner_username) continue;
    result.push({
      postId: row.post_id,
      postTitle: row.post_title,
      role: row.invite_role === "editor" ? "editor" : "coauthor",
      showCredit: row.show_credit,
      ownerDisplayName: row.owner_display_name,
      ownerUsername: row.owner_username,
      createdAt: row.created_at,
    });
  }
  return result;
}

export type SharedPostItem = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  // Last edit for drafts; publish date for published posts.
  date: string;
  ownerUsername: string;
  ownerDisplayName: string;
  // How the user is involved in the post.
  role: CollaboratorRole;
};

// The posts the user co-authors (accepted invitations), newest first.
// RLS lets an accepted co-author read the post (policy from migration 0009).
const SHARED_LIMIT = 100;

export async function listSharedWithMe(
  userId: string,
): Promise<SharedPostItem[] | null> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("post_collaborators")
    .select("post_id, role")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(SHARED_LIMIT);

  if (error || !rows) {
    console.error("listSharedWithMe failed:", error);
    return null;
  }
  if (rows.length === 0) return [];

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, title, slug, status, updated_at, published_at, author_id")
    .in(
      "id",
      rows.map((row) => row.post_id),
    );

  if (postsError || !posts) {
    console.error("listSharedWithMe (posts) failed:", postsError);
    return null;
  }

  const roleByPost = new Map<string, CollaboratorRole>();
  for (const row of rows) {
    roleByPost.set(row.post_id, row.role === "editor" ? "editor" : "coauthor");
  }

  const ownerIds = [...new Set(posts.map((post) => post.author_id))];
  const { data: owners, error: ownersError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ownerIds);

  if (ownersError || !owners) {
    console.error("listSharedWithMe (owners) failed:", ownersError);
    return null;
  }

  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const result: SharedPostItem[] = [];
  for (const post of posts) {
    const owner = ownerById.get(post.author_id);
    if (!owner || !owner.username) continue;
    const published = post.status === "published";
    result.push({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: published ? "published" : "draft",
      date: (published ? post.published_at : null) ?? post.updated_at,
      ownerUsername: owner.username,
      ownerDisplayName: owner.display_name,
      role: roleByPost.get(post.id) ?? "coauthor",
    });
  }

  result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return result;
}

export type EditablePost = OwnPost & {
  // True when moderation hid the post. The editor must not open it.
  moderated: boolean;
  role: "owner" | CollaboratorRole;
  // True when the post has at least one accepted co-author. Only a shared
  // post uses the edit lock; a solo post makes no lock calls at all.
  shared: boolean;
  // Owner only: the post has an accepted editor to hand the story to.
  hasEditor: boolean;
  // Editor only: the author allowed this editor to publish the story.
  canPublish: boolean;
  // The author of the post (the URL owner), whoever is looking at it.
  owner: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

// Loads one post for the editor and the preview page: the owner, or an
// accepted co-author. Returns null for a malformed id, a missing post, a
// pending invitee and anyone else, so all of them look like a 404.
// The explicit check below is needed: RLS lets everybody read a PUBLISHED
// post, so the query alone would also return it to a stranger.
export async function getEditablePost(
  id: string,
  userId: string,
): Promise<EditablePost | null> {
  // `id` comes from the URL: validate before it reaches Postgres.
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, subtitle, content, language, status, slug, cover_image_url, tags, scheduled_for",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getEditablePost failed:", error);
    return null;
  }
  if (!data) return null;

  const isOwner = data.author_id === userId;
  // Filled below for a non-owner; the owner never reads it.
  let collaboratorRole: CollaboratorRole = "coauthor";
  let canPublish = false;

  if (!isOwner) {
    // Only an ACCEPTED invitation counts; a pending one gives no access.
    const { data: row, error: rowError } = await supabase
      .from("post_collaborators")
      .select("status, role, can_publish")
      .eq("post_id", id)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .maybeSingle();

    if (rowError) {
      console.error("getEditablePost (collaborator) failed:", rowError);
      return null;
    }
    if (!row) return null;
    collaboratorRole = row.role === "editor" ? "editor" : "coauthor";
    canPublish = row.role === "editor" && row.can_publish;
  }

  // A co-author is accepted by definition, so the post is shared for them.
  // For the owner, count the accepted rows (RLS shows the owner every row).
  let shared = !isOwner;
  // Only the owner uses this: is there an accepted editor to hand over to?
  let hasEditor = false;
  if (isOwner) {
    const { data: accepted, error: countError } = await supabase
      .from("post_collaborators")
      .select("role")
      .eq("post_id", id)
      .eq("status", "accepted");

    if (countError || !accepted) {
      console.error("getEditablePost (shared) failed:", countError);
      return null;
    }
    shared = accepted.length > 0;
    hasEditor = accepted.some((row) => row.role === "editor");
  }

  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", data.author_id)
    .maybeSingle();

  if (ownerError || !owner || !owner.username) {
    console.error("getEditablePost (owner) failed:", ownerError);
    return null;
  }

  const parsed = docSchema.safeParse(data.content);
  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle ?? "",
    content: parsed.success ? parsed.data : EMPTY_DOC,
    // The column is a plain string in the DB; narrow it instead of casting.
    status: data.status === "published" ? "published" : "draft",
    moderated: data.status === "hidden",
    slug: data.slug,
    coverImageUrl: data.cover_image_url,
    tags: data.tags,
    scheduledFor: data.scheduled_for,
    language: data.language,
    role: isOwner ? "owner" : collaboratorRole,
    shared,
    hasEditor,
    canPublish,
    owner: {
      username: owner.username,
      displayName: owner.display_name,
      avatarUrl: safeAvatarUrl(owner.avatar_url),
    },
  };
}