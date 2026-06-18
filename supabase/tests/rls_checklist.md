# RLS 수동 테스트 체크리스트

앱에서 각 시나리오를 실행하며 확인하세요.

## 원장 (admin)

- [ ] 회원가입 후 profiles.role = admin, academies 1건 생성
- [ ] 학생 CRUD
- [ ] 작품 업로드 → Storage + artworks 행
- [ ] 피드백·공지·일정 CRUD
- [ ] 초대 코드 생성
- [ ] 출결 저장
- [ ] 다른 academy 데이터 조회 불가

## 학부모 (parent)

- [ ] 초대 코드 + 가입 → parent_student_links 생성
- [ ] 연결된 학생 데이터만 조회
- [ ] 집에서 완성 작품 업로드
- [ ] 다른 학생·원장 기능 불가

## Realtime

- [ ] 원장 피드백 작성 → 학부모 앱 자동 갱신
