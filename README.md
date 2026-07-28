# korean-elementary-learning-map-mcp

[![npm](https://img.shields.io/npm/v/korean-elementary-learning-map-mcp)](https://www.npmjs.com/package/korean-elementary-learning-map-mcp)
[![CI](https://github.com/taehyeonglim/korean-elementary-learning-map-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/taehyeonglim/korean-elementary-learning-map-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**한국 초등 2022 개정 교육과정 학습 그래프를 AI가 조회하게 해주는 MCP(Model Context Protocol) 서버**입니다.
Claude Desktop, Claude Code 등 MCP를 지원하는 AI 클라이언트에 설정 한 줄로 연결하면, AI가
성취기준·학습 주제·선수관계를 직접 검색해서 답합니다.

| 데이터 | 수량 |
| --- | ---: |
| 교육과정(교과) | 11 |
| 성취기준 — **공식 원문 수록** | 620 |
| 세부 학습 주제 (관찰 증거·평가 문항 포함) | 1,956 |
| 선수관계 (교과 내 DAG) | 1,894 |
| 학습 클러스터 (학부모용 요약 포함) | 153 |

## 특징

- **성취기준 공식 원문 수록** — 620개 전부 NCIC 공개 PDF에서 추출·전수 검증. 원문 전문 검색 도구 제공
- **완전 로컬 동작** — 데이터가 패키지에 내장(약 8.6MB)되어 설치 후 네트워크 불필요, stdio 방식
- **무결성 보장** — 데이터 파일별 SHA-256을 서버 기동 시 재검증. 손상된 설치본은 기동 거부
- **LLM 친화 설계** — 검색은 요약만, 상세는 조회로 나눈 2단계 패턴(토큰 절약). 오타 입력엔 유사 후보 제안

## 빠른 시작

```bash
claude mcp add curriculum-kr -- npx -y korean-elementary-learning-map-mcp
```

설치 후 AI에게 바로 물어보세요:

> "3-4학년 수학에서 분수 관련 성취기준 찾아줘"
> "[2수01-01] 원문 보여줘"
> "초등 1-2학년 수학 한 학기 로드맵 정리해줘"

## 설치

### Claude Code

```bash
claude mcp add curriculum-kr -- npx -y korean-elementary-learning-map-mcp
```

모든 프로젝트에서 쓰려면 사용자 범위로:

```bash
claude mcp add -s user curriculum-kr -- npx -y korean-elementary-learning-map-mcp
```

### Claude Desktop

설정 파일에 추가합니다.
macOS: `~/Library/Application Support/Claude/claude_desktop_config.json` · Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "curriculum-kr": {
      "command": "npx",
      "args": ["-y", "korean-elementary-learning-map-mcp"]
    }
  }
}
```

저장 후 Claude Desktop을 재시작하면 도구 9종이 로드됩니다.

### Codex CLI

```bash
codex mcp add curriculum-kr -- npx -y korean-elementary-learning-map-mcp
```

또는 `~/.codex/config.toml`에 직접 추가:

```toml
[mcp_servers.curriculum-kr]
command = "npx"
args = ["-y", "korean-elementary-learning-map-mcp"]
```

### 기타 MCP 클라이언트 (Cursor 등)

stdio 방식 MCP 서버를 지원하는 모든 클라이언트에서 동일한 형태로 등록됩니다:
실행 명령 `npx`, 인자 `["-y", "korean-elementary-learning-map-mcp"]`.

### 요구 사항

- Node.js ≥ 20.11 (`npx` 포함)
- 첫 실행 시 npm에서 패키지를 내려받으며(약 320KB 압축), 이후에는 캐시로 즉시 실행됩니다

### 동작 확인

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' | npx -y korean-elementary-learning-map-mcp | head -1
```

`"serverInfo":{"name":"korean-elementary-learning-map","version":"0.5.0"}`이 포함된 응답이 나오면 정상입니다.

## 사용법

AI에게 자연어로 물어보면 알아서 적절한 도구를 호출합니다. 대표 시나리오:

| 이렇게 물어보면 | 호출되는 도구 |
| --- | --- |
| "초등 교과 뭐뭐 있어?" | `list_curricula` |
| "3-4학년 수학 분수 성취기준 찾아줘" | `search_standards` |
| "원문에 '문제 해결'이 들어간 성취기준은?" | `search_standard_text` |
| "[2수01-01] 자세히, 원문도" | `get_standard` |
| "이 성취기준으로 뭘 가르치고 평가하지?" | `search_topics` → `get_topic` |
| "이 주제 배우기 전에 뭘 알아야 해?" | `get_prerequisites` (depth=all이면 전체 경로) |
| "1-2학년 수학 로드맵 만들어줘" | `get_learning_roadmap` |
| "학부모한테 설명할 단원 묶음 보여줘" | `list_clusters` |

### 도구 레퍼런스 (9종)

#### `list_curricula`
11개 교과의 ID·이름·성취기준 수·학년군·영역 목록. 파라미터 없음.

#### `search_standards`
성취기준 검색 — 코드 정확 일치 우선, 이후 키워드 부분 일치 랭킹.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `query` | string? | 키워드 또는 코드 (예: `분수`, `2수01-01`) |
| `subject` | string? | 교과명 (`수학` 또는 `Mathematics`) |
| `gradeBand` | string? | 학년군: `1-2`, `3-4`, `5-6` |
| `domain` | string? | 영역명 (예: `수와 연산`) |
| `limit` | number? | 기본 20, 최대 50 |

#### `search_standard_text`
**성취기준 공식 원문 전문 검색.** 매칭 지점 주변 스니펫을 반환합니다.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `query` | string | 원문에서 찾을 키워드 (필수) |
| `subject`, `gradeBand`, `limit` | | `search_standards`와 동일 |

```jsonc
// search_standard_text { "query": "수의 필요성" } 응답 예
{ "total": 3, "results": [
  { "code": "[2수01-01]", "subjectKorean": "수학", "gradeBand": "1-2",
    "snippet": "수의 필요성을 인식하면서 0과 100까지의 수 개념을 이해하고, 수를 세고 읽고 쓸…" } ] }
```

#### `get_standard`
성취기준 전체 레코드 + **공식 원문(`officialText`)** + 연결된 학습 주제 목록.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 성취기준 코드 — `[2수01-01]`, `2수01-01` 모두 허용 |

```jsonc
// get_standard { "code": "2수01-01" } 응답 발췌
{ "code": "[2수01-01]", "gradeBand": "1-2", "domainKorean": "수와 연산",
  "officialText": "수의 필요성을 인식하면서 0과 100까지의 수 개념을 이해하고, 수를 세고 읽고 쓸 수 있다.",
  "linkedTopics": [ { "id": "kr.mt.math.number-operations.g1-2.s2-01-01.application", "...": "..." } ] }
```

#### `search_topics`
세부 학습 주제 검색.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `query` | string? | 키워드 |
| `subject`, `gradeBand`, `limit` | | 위와 동일 |
| `type` | string? | 주제 유형 (예: `CONCEPTUAL`, `PROCEDURAL`) |
| `standardCode` | string? | 이 성취기준에 연결된 주제만 |

#### `get_topic`
주제 전체 레코드 — 관찰 가능한 증거, 평가 발문(`assessmentPrompt`), 출처 증거 포함.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `topicId` | string | 주제 ID (예: `kr.mt.math.…`) |

#### `get_prerequisites`
선수/후속 관계 조회. `depth: "all"`이면 위상 정렬된 전이적 학습 경로를 반환합니다.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `topicId` | string | 주제 ID |
| `direction` | string? | `prerequisites`(기본) 또는 `unlocks`(후속) |
| `depth` | 1 \| "all" | 1 = 직접 관계만(기본), `all` = 전체 경로 |
| `strength` | string? | `hard` 또는 `soft` 관계만 필터 |

#### `get_learning_roadmap`
교과·학년군의 성취기준을 **영역 → 모듈 계층**으로 집계한 로드맵. 기존 데이터의 집계이며 순서를 새로 생성하지 않습니다.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `subject` | string | 교과명 (필수) |
| `gradeBand` | string | 학년군 (필수) |
| `domain` | string? | 특정 영역만 |

```jsonc
// get_learning_roadmap { "subject": "수학", "gradeBand": "1-2" } 응답 발췌
{ "subjectKorean": "수학", "gradeBand": "1-2", "standardCount": 29,
  "domains": [ { "domainKorean": "수와 연산", "domainOrder": 1,
    "clusters": [ { "id": "kr.cluster….", "titleKorean": "…" } ],
    "modules": [ { "module": "네 자리 이하의 수",
      "standards": [ { "code": "[2수01-01]", "topicCount": 3 } ] } ] } ] }
```

#### `list_clusters`
학습 클러스터(학부모용 요약이 있는 단원 묶음) 목록·상세.

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `clusterId` | string? | 지정 시 단건 전체 레코드 |
| `subject`, `gradeBand` | string? | 목록 필터 |

### 리소스

`about://korean-elementary-learning-map` — 데이터 릴리스·수량·라이선스·원문 수록 정책·비보증 고지.
AI가 데이터의 출처와 법적 성격을 확인할 때 읽습니다.

### 에러 응답

존재하지 않는 코드·ID를 주면 한국어 메시지와 함께 **유사 후보 최대 3개**를 제안합니다
(예: `2수01-1` → `[2수01-01]`). AI가 오타를 스스로 교정해 재시도할 수 있습니다.
검색 결과가 0건이면 사용 가능한 교과명·학년군 형식을 힌트로 돌려줍니다.

## 데이터

### 출처와 구축 방식

- 성취기준 코드·구조·원문: 국가교육과정정보센터(NCIC)가 공개한 2022 개정 교육과정 고시 PDF 12종에서 추출.
  각 PDF의 URL·SHA-256은 [`pipeline/sources.json`](pipeline/sources.json)에 기록
- 학습 주제·선수관계·클러스터: [DECK](https://github.com/DECK6)이 독립 구축한
  [korean-elementary-learning-map](https://github.com/taehyeonglim/korean-elementary-learning-map) 데이터셋(MIT) 기반
- 원문 620건은 자동 추출 후 **전수 검증 게이트**(수량·코드 유효성·빈 원문·절취 오류)를 통과한 것만 수록

### 파일 구성

```
data/kr/
├── curriculum-standards.json  # 교과 11 + 성취기준 620 (코드·위치·출처 증거)
├── standard-texts.json        # 성취기준 공식 원문 620 (v0.5 신규)
├── topics.json                # 세부 학습 주제 1,956
├── dependencies.json          # 선수관계 1,894 (교과 내 DAG, 교과 간 간선 없음)
├── clusters.json              # 학습 클러스터 153
└── manifest.json              # 파일별 바이트 수·SHA-256 (서버 기동 시 재검증)
```

### 알아둘 데이터 특성

- 선수관계는 이 데이터셋 모델의 **추천 구조**이며 보편적 학습 순서 주장이 아닙니다
- 성취기준 620개 중 373개는 `sequence` 필드가 없습니다 — 로드맵은 공식 문서 수록 순서를 보존합니다
- 검색은 NFC 정규화 + 부분 문자열 일치입니다 (형태소 분석 없음 — 짧은 핵심어가 잘 맞습니다)

## 원문 파이프라인 재현 (개발자용)

`data/kr/standard-texts.json`은 커밋되어 있으므로 일반 사용에는 재현이 필요 없습니다.
직접 재현·검증하려면 `brew install poppler`(pdftotext) 후:

```bash
npm run pipeline:fetch     # NCIC PDF 12종 다운로드 → .cache/ (git 미추적, 해시 대조)
npm run pipeline:extract   # 코드 패턴 매칭으로 원문 절취 (실패분은 pipeline/exceptions.json으로 보정)
npm run pipeline:verify    # 620건 전수 검증 + manifest 해시 기록
```

## 개발

```bash
git clone https://github.com/taehyeonglim/korean-elementary-learning-map-mcp.git
cd korean-elementary-learning-map-mcp
npm install
npm test          # 49개 테스트 (node --test)
node src/cli.mjs  # stdio 서버 직접 실행
```

- 순수 ESM(.mjs), 런타임 의존성은 `@modelcontextprotocol/sdk` + `zod` 2종뿐
- `src/`: data-store(로드·인덱스) → search/graph/roadmap(순수 함수) → server(도구 정의) → cli(stdio 진입점)
- CI: push마다 테스트 → 원문 전수 게이트 → 패키지 내용물 검사

## 버전

| 버전 | 내용 |
| --- | --- |
| **0.5.0** | 독립 레포 이전 · 성취기준 원문 620건 수록 · `search_standard_text`/`get_learning_roadmap` 추가 (도구 9종) |
| 0.4.0 | 최초 npm 공개 (도구 7종, [원 데이터셋 레포](https://github.com/taehyeonglim/korean-elementary-learning-map)의 서브패키지) |

상세 이력은 [CHANGELOG.md](CHANGELOG.md) 참조.

## 라이선스·고지

- **MIT** — 기반 데이터셋 원저작자 DECK(github.com/DECK6)의 저작권 고지를 유지합니다
- 성취기준 원문은 교육부가 공표한 **공공저작물**(저작권법 제24조의2)로서 출처를 표기해 수록합니다 — 상세는 [NOTICE.md](NOTICE.md)
- 이 프로젝트는 교육부·국가교육위원회·NCIC의 공식 산출물이 아니며, 개별 학습자를 진단하지 않습니다
