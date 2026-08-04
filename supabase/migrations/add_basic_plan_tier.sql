-- 요금제에 Basic 등급 추가 (free < basic < standard < premium)
ALTER TABLE academies DROP CONSTRAINT IF EXISTS academies_plan_check;
ALTER TABLE academies ADD CONSTRAINT academies_plan_check
  CHECK (plan IN ('free','basic','standard','premium'));
