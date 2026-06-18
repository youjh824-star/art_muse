import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useParentLinks } from "./useAuth.js";
import { useAcademy, useAcademyMutations, useAcademyOptions } from "./useAcademy.js";
import { useStudents, useStudentMutations } from "./useStudents.js";
import { useArtworks, useArtworkMutations } from "./useArtworks.js";
import { useFeedbacks, useFeedbackMutations } from "./useFeedbacks.js";
import { useNotices, useNoticeMutations } from "./useNotices.js";
import { useSchedules, useScheduleMutations } from "./useSchedules.js";
import { useFeeNoticeWatch } from "./useFeeNoticeWatch.js";
import { useAttendanceNotifyWatch } from "./useAttendanceNotifyWatch.js";
import { useFeedbackNotifyWatch } from "./useFeedbackNotifyWatch.js";
import { useNoticeNotifyWatch } from "./useNoticeNotifyWatch.js";
import { filterNoticesForParent } from "../lib/feeNotice.js";
import { useInvites, useInviteMutations, peekInvite } from "./useInvites.js";
import { useLinkedParents, useLinkedParentMutations, useDisconnectedParents } from "./useLinkedParents.js";
import { useAttendance, useAttendanceMutations, attendanceToMap } from "./useAttendance.js";
import { useRealtimeSync } from "./useRealtimeSync.js";
import { requireSupabase } from "../lib/supabase.js";
import { mapStudent } from "../lib/mappers.js";
import { applyGradePromotion, stripGradePromotionMeta } from "../lib/studentGrade.js";
import { queryKeys } from "./queryKeys.js";
import { logBackgroundError } from "../lib/reportError.js";
import { authErrorMessage } from "../lib/authErrors.js";
import { showAlert } from "../lib/showAlert.js";

const PARENT_CHILD_STORAGE_KEY = "artlog_parent_student_id";

function readStoredParentStudentId() {
  try {
    return localStorage.getItem(PARENT_CHILD_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredParentStudentId(id) {
  try {
    if (id) localStorage.setItem(PARENT_CHILD_STORAGE_KEY, id);
    else localStorage.removeItem(PARENT_CHILD_STORAGE_KEY);
  } catch { /* ignore */ }
}

const offlineQueue = { items: [], listeners: [] };
export const subscribeQueue = (fn) => {
  offlineQueue.listeners.push(fn);
  return () => { offlineQueue.listeners = offlineQueue.listeners.filter((l) => l !== fn); };
};
const notifyQueue = () => offlineQueue.listeners.forEach((fn) => fn([...offlineQueue.items]));
export const enqueueAttendance = (item) => {
  const entry = { ...item, queuedAt: new Date().toISOString(), id: `q_${Date.now()}` };
  offlineQueue.items.push(entry);
  notifyQueue();
  return entry;
};
const dequeueAll = () => {
  const items = [...offlineQueue.items];
  offlineQueue.items = [];
  notifyQueue();
  return items;
};

export function useNetworkStatus(academyId, syncBatch) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncCount, setSyncCount] = useState(0);
  const [queueLen, setQueueLen] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const unsub = subscribeQueue((items) => setQueueLen(items.length));
    return unsub;
  }, []);

  const goOffline = useCallback(() => setOnline(false), []);

  const goOnline = useCallback(async () => {
    setOnline(true);
    const pending = dequeueAll();
    if (pending.length > 0 && academyId && syncBatch) {
      try {
        const n = await syncBatch.mutateAsync(pending);
        setSyncCount((c) => c + n);
      } catch (e) {
        pending.forEach((p) => offlineQueue.items.push(p));
        notifyQueue();
        showAlert(e?.message || "출결 동기화에 실패했습니다.");
      }
    }
  }, [academyId, syncBatch]);

  useEffect(() => {
    if (online && queueLen > 0 && academyId) goOnline();
  }, [online, queueLen, academyId, goOnline]);

  return { online, queueLen, syncCount, goOffline, goOnline };
}

export function useArtlogAppState({ appRole, mergeHolidaySchedules }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const parentLinksQuery = useParentLinks(auth.user?.id);
  const profileAcademyId = auth.profile?.academyId ?? null;
  const linkAcademyId = parentLinksQuery.data?.[0]?.academy_id ?? null;
  const isParentRole = auth.profile?.role === "parent" || appRole === "parent";
  const academyId = profileAcademyId ?? (isParentRole ? linkAcademyId : null);
  const isAdmin = auth.profile?.role === "admin";
  const isParent = isParentRole;

  useEffect(() => {
    if (!auth.user?.id || !parentLinksQuery.data?.length) return;
    if (auth.profile?.academyId) return;
    const sb = requireSupabase();
    const aid = parentLinksQuery.data[0]?.academy_id;
    (async () => {
      try {
        await sb.rpc("sync_parent_profile_from_links");
        qc.invalidateQueries({ queryKey: queryKeys.profile(auth.user.id) });
        if (aid) qc.invalidateQueries({ queryKey: queryKeys.notices(aid) });
      } catch (e) {
        logBackgroundError("학부모 프로필 동기화", e);
      }
    })();
  }, [auth.user?.id, auth.profile?.academyId, parentLinksQuery.data, qc]);

  useRealtimeSync(academyId, auth.user?.id);

  const academyQuery = useAcademy(academyId);
  const optionsQuery = useAcademyOptions(academyId);
  const studentsQuery = useStudents(academyId, { persistGradePromotion: isAdmin });
  const artworksQuery = useArtworks(academyId);
  const feedbacksQuery = useFeedbacks(academyId, { refetchInterval: isParent ? 60000 : false });
  const noticesQuery = useNotices(academyId, { refetchInterval: isParent ? 20000 : false });
  const schedulesQuery = useSchedules(academyId, { refetchInterval: isParent ? 20000 : false });
  const invitesQuery = useInvites(academyId);
  const linkedQuery = useLinkedParents(academyId);
  const disconnectedQuery = useDisconnectedParents(academyId);
  const attendanceQuery = useAttendance(academyId, { refetchInterval: isParent ? 15000 : false });

  const { updateAcademy, updateOptions } = useAcademyMutations(academyId);
  const studentMut = useStudentMutations(academyId);
  const artworkMut = useArtworkMutations(academyId);
  const feedbackMut = useFeedbackMutations(academyId);
  const noticeMut = useNoticeMutations(academyId);
  const scheduleMut = useScheduleMutations(academyId, studentsQuery.data ?? []);
  const inviteMut = useInviteMutations(academyId);
  const linkedMut = useLinkedParentMutations(academyId);
  const attendanceMut = useAttendanceMutations(academyId);

  const network = useNetworkStatus(academyId, attendanceMut.syncBatch);

  const [parentStudentId, setParentStudentIdState] = useState(readStoredParentStudentId);

  const setParentStudentId = useCallback((id) => {
    setParentStudentIdState(id);
    writeStoredParentStudentId(id);
  }, []);

  useEffect(() => {
    const links = parentLinksQuery.data;
    if (!links?.length) return;
    const validIds = new Set(links.map((l) => l.student_id));
    if (parentStudentId && validIds.has(parentStudentId)) return;
    setParentStudentId(links[0].student_id);
  }, [parentLinksQuery.data, parentStudentId, setParentStudentId]);

  const students = studentsQuery.data ?? [];
  const artworks = artworksQuery.data ?? [];
  const feedbacks = feedbacksQuery.data ?? [];
  const notices = noticesQuery.data ?? [];
  const rawSchedules = schedulesQuery.data ?? [];
  const schedules = useMemo(
    () => (mergeHolidaySchedules ? mergeHolidaySchedules(rawSchedules) : rawSchedules),
    [rawSchedules, mergeHolidaySchedules]
  );
  const invites = invitesQuery.data ?? [];
  const linkedParents = linkedQuery.data ?? [];
  const disconnectedParents = disconnectedQuery.data ?? [];
  const academy = academyQuery.data;
  const academyOptions = optionsQuery.data;
  const attendMap = useMemo(
    () => attendanceToMap(attendanceQuery.data ?? []),
    [attendanceQuery.data]
  );

  const parentChildren = useMemo(() => {
    const links = parentLinksQuery.data;
    if (!links?.length) return [];
    return links
      .map((link) => {
        const fromList = students.find((s) => s.id === link.student_id);
        if (fromList) return fromList;
        if (link.students) return stripGradePromotionMeta(applyGradePromotion(mapStudent(link.students), link.students));
        return null;
      })
      .filter(Boolean);
  }, [students, parentLinksQuery.data]);

  const parentChild = useMemo(() => {
    const links = parentLinksQuery.data;
    const id = parentStudentId ?? links?.[0]?.student_id;
    if (!id) return null;

    const fromList = students.find((s) => s.id === id);
    if (fromList) return fromList;

    const link = links?.find((l) => l.student_id === id);
    if (link?.students) return stripGradePromotionMeta(applyGradePromotion(mapStudent(link.students), link.students));

    return null;
  }, [students, parentStudentId, parentLinksQuery.data]);

  const parentFilteredNotices = useMemo(
    () => (parentChild ? filterNoticesForParent(notices, parentChild.id) : []),
    [notices, parentChild?.id]
  );
  useFeeNoticeWatch(isParent ? parentChild : null, parentFilteredNotices);
  useNoticeNotifyWatch(isParent ? parentChild : null, parentFilteredNotices);
  useFeedbackNotifyWatch(isParent ? parentChild : null, feedbacks, { enabled: isParent });

  const parentAttendPushEnabled =
    academy?.notifs?.attendPush !== false &&
    (parentLinksQuery.data ?? []).some((l) => l.push_enabled !== false);
  useAttendanceNotifyWatch(isParent ? parentChild : null, attendanceQuery.data ?? [], {
    enabled: parentAttendPushEnabled,
  });

  const dataLoading =
    auth.authReady &&
    !!auth.session &&
    (auth.profileLoading ||
      (isParent
        ? parentLinksQuery.isLoading ||
          ((parentLinksQuery.data?.length ?? 0) > 0 &&
            (!academyId || studentsQuery.isLoading || academyQuery.isLoading))
        : academyQuery.isLoading ||
          studentsQuery.isLoading ||
          artworksQuery.isLoading));

  const handleVerifyParentInvite = useCallback(async (rawCode, email, password, isSignUp) => {
    const code = rawCode.trim().toUpperCase();
    const sb = requireSupabase();

    if (isSignUp) {
      if (code.length < 9) {
        return { ok: false, error: "초대 코드 9자리를 입력해 주세요." };
      }
      let peek;
      try {
        peek = await peekInvite(code);
      } catch (e) {
        return { ok: false, error: authErrorMessage(e) };
      }
      if (!peek?.ok) {
        const err = peek?.error ?? "유효하지 않은 코드입니다.";
        if (err.includes("이미 사용")) {
          return { ok: false, error: "이미 사용된 코드입니다. 이전에 가입하셨다면 ‘로그인’ 탭에서 이메일과 비밀번호만 입력해 주세요." };
        }
        return { ok: false, error: err };
      }
      try {
        await auth.signUpParent.mutateAsync({ email, password });
        const { data: sess } = await sb.auth.getSession();
        if (!sess.session) {
          return { ok: false, error: "이메일 확인 후 다시 로그인해 주세요." };
        }
        const linked = await auth.linkParentInvite.mutateAsync(code);
        setParentStudentId(linked?.student_id ?? peek.student_id);
        return {
          ok: true,
          student: {
            id: linked?.student_id ?? peek.student_id,
            name: linked?.student_name ?? peek.student_name,
            art: linked?.student_art ?? peek.student_art,
          },
        };
      } catch (e) {
        const msg = e?.message ?? "";
        if (msg.includes("already registered") || msg.includes("Already registered")) {
          return { ok: false, error: "이미 가입된 이메일입니다. ‘로그인’ 탭으로 전환해 주세요." };
        }
        return { ok: false, error: authErrorMessage(e) };
      }
    }

    // 로그인: 초대 코드 없이도 기존 연결 계정 가능
    try {
      await auth.signInParent.mutateAsync({ email, password });
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) {
        return { ok: false, error: "이메일 확인 후 다시 로그인해 주세요." };
      }
      const userId = sess.session.user.id;

      if (code.length >= 9) {
        const linked = await auth.linkParentInvite.mutateAsync(code);
        setParentStudentId(linked?.student_id);
        return {
          ok: true,
          student: {
            id: linked?.student_id,
            name: linked?.student_name,
            art: linked?.student_art,
          },
        };
      }

      const { data: links, error: linksErr } = await sb
        .from("parent_student_links")
        .select("student_id, students(id, name, art_emoji)")
        .eq("parent_user_id", userId);
      if (linksErr) throw linksErr;
      if (!links?.length) {
        return { ok: false, error: "연결된 자녀가 없습니다. 처음 연결 시 초대 코드를 입력해 주세요." };
      }
      const first = links[0];
      setParentStudentId(first.student_id);
      return {
        ok: true,
        student: {
          id: first.student_id,
          name: first.students?.name ?? "",
          art: first.students?.art_emoji ?? "🎨",
        },
      };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  }, [auth]);

  const handleUploadSave = useCallback(async (payload) => {
    await artworkMut.createArtwork.mutateAsync(payload);
  }, [artworkMut]);

  const handleUpdateArtwork = useCallback(async (id, studentId, patch) => {
    await artworkMut.updateArtwork.mutateAsync({ id, studentId, patch });
  }, [artworkMut]);

  const handleAttendSave = useCallback(async (studentId, status, classTime, studentName) => {
    const payload = {
      studentId,
      studentName,
      status,
      classTime,
      date: new Date().toISOString().slice(0, 10),
    };
    if (!network.online) {
      enqueueAttendance({
        student_id: studentId,
        student_name: studentName,
        status,
        class_time: classTime,
        date: payload.date,
      });
      return { queued: true };
    }
    await attendanceMut.upsertAttendance.mutateAsync(payload);
    return { queued: false };
  }, [network.online, attendanceMut]);

  const updateStudent = useCallback(async (id, patch) => {
    await studentMut.updateStudent.mutateAsync({ id, patch });
  }, [studentMut]);

  const addStudent = useCallback(async (student) => {
    await studentMut.addStudent.mutateAsync(student);
  }, [studentMut]);

  const deleteStudent = useCallback(async (id) => {
    await studentMut.deleteStudent.mutateAsync(id);
  }, [studentMut]);

  const handleWithdraw = useCallback(async () => {
    const sb = requireSupabase();
    if (isAdmin && academyId) {
      const { error } = await sb.from("academies").delete().eq("id", academyId);
      if (error) throw error;
    }
    await auth.signOut();
  }, [auth, isAdmin, academyId]);

  const handleWithdrawParent = useCallback(async () => {
    await auth.withdrawParent.mutateAsync();
    if (academyId) {
      qc.invalidateQueries({ queryKey: queryKeys.students(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.linkedParents(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.disconnectedParents(academyId) });
    }
    await auth.signOut();
  }, [auth, academyId, qc]);

  const setInvites = useCallback(() => {
    console.warn("setInvites deprecated — use createInvite mutation");
  }, []);

  const createInvite = useCallback(async (student) => {
    return inviteMut.createInvite.mutateAsync({
      studentId: student.id,
      studentName: student.name,
      studentArt: student.art,
    });
  }, [inviteMut]);

  const handleConnectParentInvite = useCallback(async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (code.length < 9) {
      return { ok: false, error: "초대 코드 9자리를 입력해 주세요." };
    }
    try {
      const linked = await auth.linkParentInvite.mutateAsync(code);
      setParentStudentId(linked?.student_id);
      return {
        ok: true,
        student: {
          id: linked?.student_id,
          name: linked?.student_name,
          art: linked?.student_art,
        },
      };
    } catch (e) {
      return { ok: false, error: e?.message ?? "연결에 실패했습니다." };
    }
  }, [auth, setParentStudentId]);

  return {
    auth,
    isAdmin,
    isParent,
    academyId,
    academy,
    academyOptions,
    students,
    artworks,
    feedbacks,
    notices,
    schedules,
    invites,
    linkedParents,
    disconnectedParents,
    attendMap,
    attendanceRecords: attendanceQuery.data ?? [],
    parentChild,
    parentChildren,
    parentStudentId,
    setParentStudentId,
    parentLinks: parentLinksQuery.data ?? [],
    dataLoading,
    network,
    updateAcademy,
    updateOptions,
    updateStudent,
    addStudent,
    deleteStudent,
    handleUploadSave,
    handleUpdateArtwork,
    handleAttendSave,
    handleVerifyParentInvite,
    handleConnectParentInvite,
    parentLinksLoading: parentLinksQuery.isLoading,
    handleWithdraw,
    handleWithdrawParent,
    createInvite,
    setInvites,
    feedbackMut,
    noticeMut,
    scheduleMut,
    linkedMut,
    inviteMut,
  };
}
