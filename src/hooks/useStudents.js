import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapStudent, mapStudentToDb } from "../lib/mappers.js";
import {
  applyGradePromotion,
  getSchoolYear,
  stripGradePromotionMeta,
} from "../lib/studentGrade.js";
import {
  applyFeeMonthReset,
  stripFeeResetMeta,
} from "../lib/studentFee.js";
import { loadDefaultStudentAvatarDataUri } from "../lib/studentAvatar.js";
import { uploadStudentPhoto } from "../lib/storage.js";
import { queryKeys } from "./queryKeys.js";

async function applyStudentPhoto(sb, academyId, studentId, photoUri) {
  if (photoUri === undefined) return null;
  if (!photoUri) {
    const { data, error } = await sb
      .from("students")
      .update({ photo_url: null, photo_path: null })
      .eq("id", studentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { photoUrl, photoPath } = await uploadStudentPhoto({ academyId, studentId, dataUri: photoUri });
  const { data, error } = await sb
    .from("students")
    .update({ photo_url: photoUrl, photo_path: photoPath })
    .eq("id", studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function resolveStudentPhotoForSave(student) {
  if (student.useEmojiAvatar) return null;
  if (student.photoUri) return student.photoUri;
  return loadDefaultStudentAvatarDataUri();
}

async function fetchStudentsWithGradePromotion(academyId, { persistGradePromotion = false } = {}) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("students")
    .select("*")
    .eq("academy_id", academyId)
    .order("name");
  if (error) throw error;

  const promoted = (data ?? []).map((row) => {
    const mapped = applyGradePromotion(mapStudent(row), row);
    return applyFeeMonthReset(mapped, row);
  });

  if (persistGradePromotion) {
    const gradeUpdates = promoted.filter((s) => s._needsGradePersist);
    const feeResets = promoted.filter((s) => s._needsFeeReset);
    for (const s of gradeUpdates) {
      const { error } = await sb
        .from("students")
        .update({ grade: s.grade, grade_as_of_year: s.gradeAsOfYear })
        .eq("id", s.id);
      if (error) throw error;
    }
    for (const s of feeResets) {
      const { error } = await sb
        .from("students")
        .update({ fee_status: "미납", fee_paid_month: null })
        .eq("id", s.id);
      if (error) throw error;
    }
  }

  return promoted.map((s) => stripFeeResetMeta(stripGradePromotionMeta(s)));
}

export function useStudents(academyId, { persistGradePromotion = false } = {}) {
  return useQuery({
    queryKey: [...queryKeys.students(academyId), persistGradePromotion ? "persist" : "read"],
    queryFn: () => fetchStudentsWithGradePromotion(academyId, { persistGradePromotion }),
    enabled: !!academyId,
  });
}

export function useStudentMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.students(academyId) });

  const addStudent = useMutation({
    mutationFn: async (student) => {
      if (!academyId) {
        throw new Error("학원 정보가 없습니다. 로그아웃 후 원장 앱에서 다시 로그인해 주세요.");
      }
      const sb = requireSupabase();
      const row = {
        ...mapStudentToDb(student, academyId),
        name: student.name,
        art_emoji: student.art ?? "🎨",
        art_count: 0,
        fee_status: student.fee ?? "미납",
        grade_as_of_year: student.gradeAsOfYear ?? getSchoolYear(),
        use_emoji_avatar: !!student.useEmojiAvatar,
      };
      const { data, error } = await sb.from("students").insert(row).select().single();
      if (error) throw error;
      const photoUri = await resolveStudentPhotoForSave(student);
      const withPhoto = await applyStudentPhoto(sb, academyId, data.id, photoUri);
      return stripGradePromotionMeta(applyGradePromotion(mapStudent(withPhoto ?? data), withPhoto ?? data));
    },
    onSuccess: invalidate,
  });

  const updateStudent = useMutation({
    mutationFn: async ({ id, patch }) => {
      const sb = requireSupabase();
      const { photoUri: patchPhotoUri, ...rest } = patch;
      const { data, error } = await sb
        .from("students")
        .update(mapStudentToDb(rest))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      const avatarTouched = patchPhotoUri !== undefined || patch.useEmojiAvatar !== undefined;
      if (!avatarTouched) {
        const mapped = applyFeeMonthReset(mapStudent(data), data);
        return stripFeeResetMeta(stripGradePromotionMeta(mapped));
      }

      const merged = {
        ...mapStudent(data),
        ...patch,
        useEmojiAvatar: patch.useEmojiAvatar ?? mapStudent(data).useEmojiAvatar,
        photoUri: patchPhotoUri !== undefined ? patchPhotoUri : mapStudent(data).photoUri,
      };
      const photoUri = await resolveStudentPhotoForSave(merged);
      const finalRow = await applyStudentPhoto(sb, academyId, id, photoUri);
      const mapped = applyFeeMonthReset(mapStudent(finalRow ?? data), finalRow ?? data);
      return stripFeeResetMeta(stripGradePromotionMeta(mapped));
    },
    onSuccess: invalidate,
  });

  const deleteStudent = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.artworks(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.feedbacks(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.invites(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.attendance(academyId) });
      qc.invalidateQueries({ queryKey: queryKeys.linkedParents(academyId) });
    },
  });

  return { addStudent, updateStudent, deleteStudent };
}
