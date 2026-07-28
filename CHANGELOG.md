# 변경 기록

## [0.5.1] — 2026-07-28

- MCP 공식 레지스트리(registry.modelcontextprotocol.io) 등록을 위한 `mcpName` 필드 추가.
- npm 패키지 페이지에 상세 README 반영 (설치·사용법·도구 9종 레퍼런스).

## [0.5.0] — 2026-07-28

### 독립 프로젝트화

- taehyeonglim/korean-elementary-learning-map의 mcp/ 서브패키지에서 독립 레포로 이전.

### 원문 수록

- NCIC 공개 PDF 12종에서 성취기준 본문 620건을 추출·검증해 수록 (`data/kr/standard-texts.json`).
- 파이프라인(fetch/extract/verify)과 620건 전수 검증 게이트, 수동 보정 기록(exceptions.json) 추가.

### 도구 (7종 → 9종)

- `search_standard_text`: 원문 전문 검색 (스니펫 반환).
- `get_learning_roadmap`: 교과·학년군 영역→모듈 계층 로드맵.
- `get_standard` 응답에 `officialText` 추가 (기존 필드 하위 호환).
