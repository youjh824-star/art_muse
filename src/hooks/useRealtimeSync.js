import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { queryKeys } from "./queryKeys.js";
import { logBackgroundError } from "../lib/reportError.js";

export function useRealtimeSync(academyId, userId) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!academyId) return undefined;
    const sb = requireSupabase();

    // 자식 테이블들: academy_id 컬럼으로 필터링
    const childChannel = sb
      .channel(`academy-children:${academyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", filter: `academy_id=eq.${academyId}` },
        (payload) => {
          const table = payload.table;
          if (table === "students") qc.invalidateQueries({ queryKey: queryKeys.students(academyId) });
          if (table === "artworks") qc.invalidateQueries({ queryKey: queryKeys.artworks(academyId) });
          if (table === "feedbacks") qc.invalidateQueries({ queryKey: queryKeys.feedbacks(academyId) });
          if (table === "notices") qc.invalidateQueries({ queryKey: queryKeys.notices(academyId) });
          if (table === "schedules") qc.invalidateQueries({ queryKey: queryKeys.schedules(academyId) });
          if (table === "invites") qc.invalidateQueries({ queryKey: queryKeys.invites(academyId) });
          if (table === "attendance") qc.invalidateQueries({ queryKey: queryKeys.attendance(academyId) });
          if (table === "parent_student_links") {
            qc.invalidateQueries({ queryKey: queryKeys.linkedParents(academyId) });
            qc.invalidateQueries({ queryKey: queryKeys.disconnectedParents(academyId) });
            if (userId) qc.invalidateQueries({ queryKey: queryKeys.parentLinks(userId) });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logBackgroundError(`realtime-children(${academyId})`, err ?? status);
        }
      });

    // academies 테이블: id 컬럼으로 필터링 (academy_id 컬럼 없음)
    const academyChannel = sb
      .channel(`academy-root:${academyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academies", filter: `id=eq.${academyId}` },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.academy(academyId) });
          qc.invalidateQueries({ queryKey: queryKeys.academyOptions(academyId) });
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logBackgroundError(`realtime-academy(${academyId})`, err ?? status);
        }
      });

    return () => {
      sb.removeChannel(childChannel);
      sb.removeChannel(academyChannel);
    };
  }, [academyId, userId, qc]);
}
