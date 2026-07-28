# CLAUDE.md

한국 초등 2022 개정 교육과정 학습 그래프 MCP 서버 (npm: `korean-elementary-learning-map-mcp`, 레지스트리: `io.github.taehyeonglim/korean-elementary-learning-map-mcp`). 성취기준 620(공식 원문 수록) · 주제 1,956 · 선수관계 1,894 · 클러스터 153을 패키지에 내장, stdio 완전 로컬 동작. 도구 9종.

## 명령

- `npm test` — 테스트 49개 (`node --test tests/*.test.mjs`)
- `npm run pipeline:verify` — 원문 620건 전수 게이트 + manifest 해시 기록 (**데이터 변경 후 필수**)
- `npm run pipeline:fetch` / `pipeline:extract` — NCIC PDF 12종 다운로드(.cache/, git 미추적) / 원문 추출 (재현용 — 산출물은 커밋되어 있음, `brew install poppler` 필요)
- `node src/cli.mjs` — 서버 직접 실행 (initialize JSON-RPC 파이프로 스모크 가능)
- `node pipeline/fetch-ncic.mjs --check` — 원본 개정 무기록 점검 (개정 의심/다운로드 실패 구분, 매월 1일 revision-check 워크플로가 자동 실행·이슈 생성)

## 규칙

- 순수 ESM `.mjs`만, TypeScript·빌드 금지. 런타임 의존성은 `@modelcontextprotocol/sdk` + `zod` **2종만**.
- stdout은 MCP 프로토콜 전용 — 사람용 로그는 반드시 `console.error`.
- 도구 이름 영어 snake_case, 설명·에러 메시지 한국어. 검색 limit 기본 20 최대 50. NFC 정규화 + 부분 문자열 일치만 (형태소 분석기 금지).
- `bin` 경로에 `./` 접두사 금지 (npm publish 오해성 경고).
- **원문 수록 범위는 성취기준 본문 문장만** — 해설·적용 시 고려사항 추가 금지. 법적 근거·출처 표기는 NOTICE.md.
- 아키텍처: data-store(로드·인덱스) → search/graph/roadmap(순수 함수) → server(도구 정의) → cli. 역방향 의존 금지.

## 데이터 특성 (가정 금지)

- 성취기준 620개 중 373개는 `sequence` 없음 — 정렬 시 `?? 0` + 코드순 폴백 또는 데이터 등장 순서 보존.
- 원문 출처는 PDF 12종 (`pipeline/sources.json`에 URL·SHA-256). `curriculum-standards.json`의 sourceIds/sourceUrls 배열은 통합교과에서 길이 불일치 — 인덱스 정렬 신뢰 금지.
- 모든 데이터 파일은 `data/kr/manifest.json`의 SHA-256으로 서버 기동 시 재검증됨 — 데이터 수정 후 `pipeline:verify` 없이는 서버가 기동 거부.

## 배포 절차 (버전 릴리스)

1. `package.json` version + `server.json` version **2곳**(서버·packages) 동시 bump
2. `npm test && npm run pipeline:verify`
3. `npm whoami`로 토큰 확인 (웹 로그인 토큰은 수일 내 만료 — 만료 시 publish가 **PUT 404로 위장 실패**)
4. `npm publish --browser=false` (이 머신은 브라우저 자동 열기 -1712 실패 → 출력된 URL 수동 복사)
5. `mcp-publisher publish` — MCP 공식 레지스트리 반영 (인증 만료 시 `mcp-publisher login github`)

## 관련 저장소

- 원 데이터셋(v0.4까지의 모노레포, 온톨로지 포함): https://github.com/taehyeonglim/korean-elementary-learning-map — v0.5 설계 스펙·구현 계획 문서는 그쪽 `docs/superpowers/`에 있음.
