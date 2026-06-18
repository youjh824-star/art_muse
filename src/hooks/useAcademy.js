import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapAcademy, mapAcademyOptions } from "../lib/mappers.js";
import { uploadAcademyLogo } from "../lib/storage.js";
import { queryKeys } from "./queryKeys.js";

export function useAcademy(academyId) {
  return useQuery({
    queryKey: queryKeys.academy(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb.from("academies").select("*").eq("id", academyId).single();
      if (error) throw error;
      return mapAcademy(data);
    },
    enabled: !!academyId,
  });
}

export function useAcademyOptions(academyId) {
  return useQuery({
    queryKey: queryKeys.academyOptions(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("academy_options")
        .select("*")
        .eq("academy_id", academyId)
        .maybeSingle();
      if (error) throw error;
      return mapAcademyOptions(data);
    },
    enabled: !!academyId,
  });
}

export function useAcademyMutations(academyId) {
  const qc = useQueryClient();

  const updateAcademy = useMutation({
    mutationFn: async (patch) => {
      const sb = requireSupabase();
      let logoUrl = patch.logoUrl;
      if (patch.logoUrl?.startsWith("data:")) {
        logoUrl = await uploadAcademyLogo({ academyId, dataUri: patch.logoUrl });
      }
      const row = {
        name: patch.name,
        tagline: patch.tagline,
        phone: patch.phone,
        addr: patch.addr,
        email: patch.email,
        logo_url: logoUrl,
        notifs: patch.notifs,
      };
      if (patch.bankName !== undefined) row.bank_name = patch.bankName;
      if (patch.bankAccount !== undefined) row.bank_account = patch.bankAccount;
      const { data, error } = await sb
        .from("academies")
        .update(row)
        .eq("id", academyId)
        .select()
        .single();
      if (error) throw error;
      return mapAcademy(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.academy(academyId) }),
  });

  const updateOptions = useMutation({
    mutationFn: async (patch) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("academy_options")
        .upsert({
          academy_id: academyId,
          class_times: patch.classTimes,
          monthly_fees: patch.monthlyFees,
          fee_due_days: patch.feeDueDays,
        })
        .select()
        .single();
      if (error) throw error;
      return mapAcademyOptions(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.academyOptions(academyId) }),
  });

  return { updateAcademy, updateOptions };
}
