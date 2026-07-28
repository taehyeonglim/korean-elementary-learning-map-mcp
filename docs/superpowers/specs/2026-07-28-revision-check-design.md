# 설계: 교육과정 원본 개정 감지 자동화

- 날짜: 2026-07-28 · 상태: 승인됨
- 배경: 프로젝트 가치 축은 정보의 정확성·신뢰성. 원본(NCIC PDF 12종) 개정 시 데이터가 조용히 낡는 것이 최대 리스크. 현재 `pipeline:fetch`는 해시 불일치를 경고만 하고 기록을 덮어쓰며 exit 0 — 감지 전용 장치가 없음.

## 결정 사항

| 항목 | 결정 |
| --- | --- |
| 실행 장치 | GitHub Actions cron (매월 1일) + workflow_dispatch |
| 알림 | 실패 시 GitHub 이슈 자동 생성 (`revision-alert` 라벨, 중복 방지) |
| 감지 방식 | `--check` 모드: 임시 디렉터리에 신규 다운로드 → 해시를 sources.json과 대조, 무기록 |

## 구성 요소

### 1. `pipeline/fetch-ncic.mjs` — `--check` 모드 (수정)

- 12종 전부 **임시 디렉터리에 새로 다운로드** (캐시 재사용 금지 — 옛 파일끼리 비교하면 무의미).
- **파일 쓰기 전무**: sources.json 갱신 없음, `.cache/` 미접촉.
- 순수 함수 `diffSources(entries, computedHashes) → { changed: [{id, recorded, actual}], unreachable: [{id, reason}] }` 분리 (entries = sources.json의 entries, computedHashes = `Map<id, sha256|null>`; null = 다운로드 실패).
- 출력: 변경(개정 의심)과 다운로드 실패(URL·일시 장애)를 **구분해** 보고 — 네트워크 장애를 개정으로 오보하지 않음. 전부 일치 시 `✓ 원본 12종 변경 없음` 출력.
- exit: 전부 일치 0 / 변경 또는 실패 존재 1.

### 2. `.github/workflows/revision-check.yml` (신규)

- `schedule: cron '0 0 1 * *'` + `workflow_dispatch`. permissions: `contents: read`, `issues: write`.
- 단계: checkout → setup-node(20.11.1) → `node pipeline/fetch-ncic.mjs --check`.
- 실패 시: `revision-alert` 라벨의 **열린 이슈가 없을 때만** 이슈 생성 (제목 "교육과정 원본 점검 실패", 본문에 점검 출력과 실행 링크). 워크플로 실패 메일은 GitHub 기본 동작.

### 3. 테스트·문서

- `tests/fetch-ncic.test.mjs`에 `diffSources` 테스트 2개 추가(변경 감지, 전부 일치) → 총 51개.
- README "원본 개정 감지" 절: 월 1회 자동 점검 + 수동 실행법(`node pipeline/fetch-ncic.mjs --check`).

## 비범위

- 개정 감지 후 자동 데이터 갱신·PR 생성 (사람 검토가 맞음 — 개정은 추출 규칙 재검증 필요)
- Claude 루틴·외부 모니터링 서비스

## 성공 기준

- `--check`가 파일을 일절 쓰지 않고 정확한 exit code를 반환 (수동 실행으로 확인)
- 테스트 51개 통과, 워크플로가 수동 트리거(workflow_dispatch)로 정상 실행
