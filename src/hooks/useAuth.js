import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapProfile } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";
import { logBackgroundError } from "../lib/reportError.js";

async function fetchProfile(userId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return mapProfile(data);
}

async function bootstrapAdminAcademy(userId, email) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("bootstrap_admin_academy", {
    p_user_id: userId,
    p_email: email,
    p_full_name: email.split("@")[0],
  });
  if (error) throw error;
  return data;
}

async function ensureAdminAcademy(user, qc) {
  if (!user?.id) return;
  const profile = await fetchProfile(user.id);
  if (profile?.academyId) return;
  const isAdmin =
    profile?.role === "admin" || user.user_metadata?.role === "admin";
  if (!isAdmin) return;
  await bootstrapAdminAcademy(user.id, user.email ?? "");
  qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
}

export function useAuth() {
  const qc = useQueryClient();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const sb = requireSupabase();
    let mounted = true;

    sb.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted) return;
      setSession(initial);
      setAuthReady(true);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (next) {
        setSession(next);
      }
      if (event === "INITIAL_SESSION") setAuthReady(true);
      qc.invalidateQueries({ queryKey: queryKeys.session });
      if (next?.user) qc.invalidateQueries({ queryKey: queryKeys.profile(next.user.id) });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [qc]);

  const userId = session?.user?.id;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => fetchProfile(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!session?.user || profileQuery.isLoading) return;
    ensureAdminAcademy(session.user, qc).catch((e) => logBackgroundError("학원 초기화", e));
  }, [session?.user?.id, profileQuery.data?.academyId, profileQuery.isLoading, qc]);

  const signInAdmin = useMutation({
    mutationFn: async ({ email, password }) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await ensureAdminAcademy(data.user, qc);
      return data;
    },
  });

  const signUpAdmin = useMutation({
    mutationFn: async ({ email, password, fullName }) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { role: "admin", full_name: fullName } },
      });
      if (error) throw error;
      if (data.user) {
        await bootstrapAdminAcademy(data.user.id, email);
        qc.invalidateQueries({ queryKey: queryKeys.profile(data.user.id) });
      }
      return data;
    },
  });

  const signInParent = useMutation({
    mutationFn: async ({ email, password }) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
  });

  const signUpParent = useMutation({
    mutationFn: async ({ email, password, fullName }) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { role: "parent", full_name: fullName ?? "학부모" } },
      });
      if (error) throw error;
      return data;
    },
  });

  const linkParentInvite = useMutation({
    mutationFn: async (inviteCode) => {
      const sb = requireSupabase();
      const { data, error } = await sb.rpc("link_parent_with_invite", {
        p_invite_code: inviteCode.trim().toUpperCase(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.parentLinks(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });

  const signOut = useCallback(async () => {
    const sb = requireSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    qc.clear();
  }, [qc]);

  const updateProfile = useMutation({
    mutationFn: async ({ fullName, phone }) => {
      const sb = requireSupabase();
      if (!userId) throw new Error("로그인이 필요합니다.");
      const patch = {};
      if (fullName !== undefined) patch.full_name = fullName;
      if (phone !== undefined) patch.phone = phone;
      const { data, error } = await sb
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return mapProfile(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });

  const updateParentPush = useMutation({
    mutationFn: async ({ linkId, enabled }) => {
      const sb = requireSupabase();
      const { error } = await sb
        .from("parent_student_links")
        .update({ push_enabled: enabled })
        .eq("id", linkId)
        .eq("parent_user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.parentLinks(userId) });
      qc.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "linked-parents",
      });
    },
  });

  const withdrawParent = useMutation({
    mutationFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb.rpc("withdraw_parent_account");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.parentLinks(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });

  return {
    session,
    authReady,
    user: session?.user ?? null,
    profile: profileQuery.data ?? null,
    profileLoading: profileQuery.isLoading,
    signInAdmin,
    signUpAdmin,
    signInParent,
    signUpParent,
    linkParentInvite,
    signOut,
    updateProfile,
    updateParentPush,
    withdrawParent,
  };
}

export function useParentLinks(userId) {
  return useQuery({
    queryKey: queryKeys.parentLinks(userId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("parent_student_links")
        .select("*, students(*)")
        .eq("parent_user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}
