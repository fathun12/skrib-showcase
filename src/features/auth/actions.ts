"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit } from "@/features/ratelimit/check";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_USERNAMES, USERNAME_REGEX } from "@/lib/constants";
import { reportError } from "@/lib/report-error";
import { safeNext } from "./safe-next";

export type OnboardingState = { error: string | null };

// email and displayName are sent back so the form can refill them after an error.
export type AuthFormState = {
  error: string | null;
  email?: string;
  displayName?: string;
};

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_REGEX,
    "Use 3 to 30 characters: lowercase letters, numbers, - or _.",
  )
  .refine(
    (value) => !(RESERVED_USERNAMES as readonly string[]).includes(value),
    "That username is reserved.",
  );

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = usernameSchema.safeParse(String(formData.get("username") ?? ""));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const limit = await checkRateLimit(supabase, "onboarding");
  if (!limit.ok) {
    return { error: limit.error };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: parsed.data })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation (username already taken)
    if (error.code === "23505") {
      return { error: "That username is already taken." };
    }
    reportError("completeOnboarding", error);
    return { error: "Something went wrong. Please try again." };
  }

    redirect(safeNext(formData.get("next")));
}

function authErrorMessage(code: string | undefined, where: string): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in, or use Continue with Google if you signed up that way.";
    case "weak_password":
      return "That password is too weak. Try a longer or less common one.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email before signing in.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "same_password":
      return "Choose a password that is different from your current one.";
    case "reauthentication_needed":
      return "For your security, sign out, sign in again, and then change your password.";
    default:
      // An unexpected code (for example an email rate limit) would otherwise
      // be invisible. Only the code is sent, never the message: an Auth
      // message is not proven free of the visitor's email address.
      reportError(where, { code });
      return "Something went wrong. Please try again.";
  }
}

const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(50, "Name is too long (max 50 characters)."),
  email: z
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    // bcrypt (used by Supabase Auth) handles at most 72 bytes.
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Password is too long (max 72 characters).",
    ),
});

const signInSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(200, "Password is too long."),
});

export async function signUpWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "");

  const parsed = signUpSchema.safeParse({
    displayName,
    email,
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email, displayName };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // The handle_new_user trigger reads full_name for profiles.display_name.
    options: { data: { full_name: parsed.data.displayName } },
  });

  if (error) {
    return {
      error: authErrorMessage(error.code, "signUpWithEmail"),
      email,
      displayName,
    };
  }

  // Confirm email ON returns no session: ask the user to check their inbox.
  if (!data.session) {
    redirect("/login?message=check-email");
  }

  // New account has no username yet.
  redirect(`/onboarding?next=${encodeURIComponent(next)}`);
}

export async function signInWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const parsed = signInSchema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: authErrorMessage(error.code, "signInWithEmail"), email };
  }

  // The login page already sends a signed-in user to /onboarding (no username)
  // or to `next` (has username), so we reuse that logic here.
  redirect(`/login?next=${encodeURIComponent(next)}`);
}


export type ForgotPasswordState = {
  error: string | null;
  // True once the request was accepted (see requestPasswordReset).
  sent: boolean;
  email?: string;
};

export type ResetPasswordState = {
  error: string | null;
  done: boolean;
};

const forgotPasswordSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
});

const resetPasswordSchema = z
  .object({
    // The same rules as a new account (8 to 72 bytes).
    password: signUpSchema.shape.password,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });

// Sends the reset email. Supabase answers success also for an email that has
// no account, and the screen says the same thing either way, so nobody can use
// this form to find out who has an account.
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, sent: false, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      // The link in the email signs the person in through the same callback
      // as Google, then lands on the page where the new password is chosen.
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent("/login/reset")}`,
    },
  );

  if (error) {
    return {
      error: authErrorMessage(error.code, "requestPasswordReset"),
      sent: false,
      email,
    };
  }

  return { error: null, sent: true, email };
}

// Sets the new password for the person who followed the email link (or any
// signed-in person who opens /login/reset).
export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login/forgot?error=expired");

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, done: false };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      error: authErrorMessage(error.code, "updatePassword"),
      done: false,
    };
  }

  // A new password also ends every other session: someone who got in with the
  // old password is signed out. This session stays.
  await supabase.auth.signOut({ scope: "others" });

  return { error: null, done: true };
}