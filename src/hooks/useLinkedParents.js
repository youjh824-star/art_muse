import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import {
  mapDisconnectedParent,
  mapLinkedParent,
  mapLinkedParentRpc,
  dedupeLinkedParents,
} from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

async function fetchLinkedParents(academyId) {
  const sb = requireSupabase();

  const { data: rpcData, error: rpcError } = await sb.rpc("list_linked_parents", {
    p_academy_id: academyId,
  });

  if (!rpcError && rpcData != null) {
    const rows = Array.isArray(rpcData) ? rpcData : [];
    return dedupeLinkedParents(rows.map(mapLinkedParentRpc));
  }

  const { data, error } = await sb
    .from("parent_student_links")
    .select(`
      id, student_id, parent_user_id, joined_at, push_enabled,
      students(name, art_emoji, parent_phone)
    `)
    .eq("academy_id", academyId);
  if (error) throw error;
  return dedupeLinkedParents((data ?? []).map(mapLinkedParent).filter(Boolean));
}

export function useLinkedParents(academyId) {
  return useQuery({
    queryKey: queryKeys.linkedParents(academyId),
    queryFn: () => fetchLinkedParents(academyId),
    enabled: !!academyId,
  });
}

export function useDisconnectedParents(academyId) {
  return useQuery({
    queryKey: queryKeys.disconnectedParents(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("parent_link_history")
        .select("*")
        .eq("academy_id", academyId)
        .order("disconnected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDisconnectedParent);
    },
    enabled: !!academyId,
  });
}

export function useLinkedParentMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.linkedParents(academyId) });
    qc.invalidateQueries({ queryKey: queryKeys.disconnectedParents(academyId) });
    qc.invalidateQueries({ queryKey: queryKeys.students(academyId) });
  };

  const unlinkParent = useMutation({
    mutationFn: async (linkId) => {
      const sb = requireSupabase();
      const { error } = await sb.from("parent_student_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { unlinkParent };
}
