import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { queryKeys } from "./queryKeys.js";
import { logBackgroundError } from "../lib/reportError.js";

function mapSystemNotice(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    important: row.important ?? false,
    date: row.posted_at?.slice(0, 10) ?? "",
    postedAt: row.posted_at,
  };
}

export function useSystemNotices() {
  return useQuery({
    queryKey: queryKeys.systemNotices,
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapSystemNotice);
    },
  });
}

export function useSystemNoticeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.systemNotices });

  async function fallbackSystemNoticePush({ title, content, important }) {
    const sb = requireSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) throw new Error("로그인 세션이 없어 시스템 공지 푸시를 보낼 수 없습니다.");

    const { data: me } = await sb
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .maybeSingle();
    const academyId = me?.academy_id ?? null;
    if (!academyId) throw new Error("academy_id를 찾지 못했습니다.");

    const tokens = new Set();

    const { data: parentRows } = await sb
      .from("parent_student_links")
      .select("push_token")
      .eq("academy_id", academyId)
      .not("push_token", "is", null);
    for (const row of parentRows ?? []) {
      if (row?.push_token) tokens.add(row.push_token);
    }

    const { data: adminRows } = await sb
      .from("profiles")
      .select("push_token")
      .eq("academy_id", academyId)
      .eq("role", "admin")
      .not("push_token", "is", null);
    for (const row of adminRows ?? []) {
      if (row?.push_token) tokens.add(row.push_token);
    }

    const tokenList = [...tokens];
    if (!tokenList.length) return { sent: 0, reason: "no_tokens" };

    const { data, error } = await sb.functions.invoke("push-notify", {
      body: {
        tokens: tokenList,
        title: important ? `📢 업데이트 공지: ${title}` : "📢 앱 업데이트 안내",
        body: content || title,
        data: { type: "system_notice", important: !!important },
      },
    });
    if (error) throw error;
    return data ?? { sent: 0 };
  }

  async function sendSystemNoticePush({ title, content, important }) {
    try {
      const sb = requireSupabase();
      const { data, error } = await sb.functions.invoke("system-notice-push", {
        body: { title, content, important: !!important },
      });
      let result = data;
      if (error) {
        result = await fallbackSystemNoticePush({ title, content, important });
      }
      if ((result?.sent ?? 0) === 0) {
        throw new Error(result?.reason || "시스템 공지 푸시 전송 대상이 없습니다.");
      }
    } catch (e) {
      logBackgroundError("system_notice_push", e);
    }
  }

  const addNotice = useMutation({
    mutationFn: async ({ title, content, important }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .insert({ title, content, important: important ?? false })
        .select()
        .single();
      if (error) throw error;
      return mapSystemNotice(data);
    },
    onSuccess: (notice) => {
      invalidate();
      sendSystemNoticePush({
        title: notice.title,
        content: notice.content,
        important: notice.important,
      });
    },
  });

  const updateNotice = useMutation({
    mutationFn: async ({ id, title, content, important }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .update({ title, content, important })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapSystemNotice(data);
    },
    onSuccess: invalidate,
  });

  const deleteNotice = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("system_notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addNotice, updateNotice, deleteNotice };
}
