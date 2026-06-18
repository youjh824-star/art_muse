import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapArtwork } from "../lib/mappers.js";
import { uploadArtworkPhoto } from "../lib/storage.js";
import { queryKeys } from "./queryKeys.js";

export function useArtworks(academyId) {
  return useQuery({
    queryKey: queryKeys.artworks(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("artworks")
        .select("*, students(name)")
        .eq("academy_id", academyId)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapArtwork);
    },
    enabled: !!academyId,
  });
}

export function useArtworkMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.artworks(academyId) });
    qc.invalidateQueries({ queryKey: queryKeys.students(academyId) });
  };

  const createArtwork = useMutation({
    mutationFn: async ({ student, emoji, photoUri, title, parentMode }) => {
      const sb = requireSupabase();
      const isParent = !!parentMode;
      const today = new Date().toISOString().slice(0, 10);
      let photoUrl = null;
      let photoPath = null;
      if (photoUri) {
        const uploaded = await uploadArtworkPhoto({
          academyId,
          studentId: student.id,
          dataUri: photoUri,
        });
        photoUrl = uploaded.photoUrl;
        photoPath = uploaded.photoPath;
      }
      const { data, error } = await sb
        .from("artworks")
        .insert({
          academy_id: academyId,
          student_id: student.id,
          title: title || (photoUri ? `${student.name} 작품` : `${emoji} 작품`),
          medium: isParent ? "집에서 완성" : photoUri ? "사진" : "스케치",
          work_date: today,
          emoji: emoji || "🎨",
          progress: 100,
          description: isParent
            ? "학부모가 집에서 완성한 작품입니다."
            : photoUri
              ? "업로드된 작품 사진입니다."
              : "업로드된 작품입니다.",
          photo_url: photoUrl,
          photo_path: photoPath,
          uploaded_by: isParent ? "parent" : "teacher",
        })
        .select("*, students(name)")
        .single();
      if (error) throw error;
      return mapArtwork(data);
    },
    onSuccess: invalidate,
  });

  const updateArtwork = useMutation({
    mutationFn: async ({ id, studentId, patch }) => {
      const sb = requireSupabase();
      const row = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.emoji !== undefined) row.emoji = patch.emoji;
      if (patch.photoUri !== undefined) {
        if (patch.photoUri) {
          const uploaded = await uploadArtworkPhoto({
            academyId,
            studentId,
            dataUri: patch.photoUri,
          });
          row.photo_url = uploaded.photoUrl;
          row.photo_path = uploaded.photoPath;
        } else {
          row.photo_url = null;
          row.photo_path = null;
        }
      }
      const { data, error } = await sb
        .from("artworks")
        .update(row)
        .eq("id", id)
        .select("*, students(name)")
        .single();
      if (error) throw error;
      return mapArtwork(data);
    },
    onSuccess: invalidate,
  });

  return { createArtwork, updateArtwork };
}
