# korean-elementary-learning-map-mcp

한국 초등 2022 개정 교육과정 학습 그래프를 조회하는 MCP(Model Context Protocol) 서버입니다.
성취기준 620개(**공식 원문 수록**) · 세부 학습 주제 1,956개 · 선수관계 1,894개 · 클러스터 153개를
패키지에 내장하며, 네트워크 없이 완전 로컬(stdio)로 동작합니다.

## 설치

### Claude Code

```bash
claude mcp add curriculum-kr -- npx -y korean-elementary-learning-map-mcp
```

### Claude Desktop

`claude_desktop_config.json`의 `mcpServers`에 추가:

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

## 도구 (9종)

| 도구 | 설명 |
| --- | --- |
| `list_curricula` | 11개 교과 목록과 성취기준 수 |
| `search_standards` | 성취기준 검색 (코드·키워드·교과·학년군·영역) |
| `search_standard_text` | **성취기준 공식 원문 전문 검색** (스니펫 반환) |
| `get_standard` | 성취기준 상세 + **공식 원문** + 연결 주제 |
| `search_topics` | 학습 주제 검색 |
| `get_topic` | 주제 상세 (관찰 증거·평가 문항 포함) |
| `get_prerequisites` | 선수/후속 관계, `depth=all`이면 전이적 학습 경로 |
| `get_learning_roadmap` | **교과·학년군 학습 로드맵** (영역→모듈 계층 집계) |
| `list_clusters` | 학습 클러스터 목록·상세 |

리소스 `about://korean-elementary-learning-map`에 출처·라이선스 고지가 있습니다.

## 원문 파이프라인 재현

원문 데이터(`data/kr/standard-texts.json`)는 NCIC 공개 PDF에서 추출합니다. 재현하려면
`brew install poppler` 후:

```bash
npm run pipeline:fetch     # PDF 12종 다운로드 (.cache/, git 미추적)
npm run pipeline:extract   # 원문 추출 (실패분은 pipeline/exceptions.json으로 보정)
npm run pipeline:verify    # 620건 전수 검증 + manifest 해시 기록
```

## 배포 (메인테이너용)

```bash
npm test && npm run pipeline:verify
npm publish --browser=false   # 이 머신은 브라우저 자동 열기가 실패(-1712)하므로 URL 수동 복사
```

## 고지

- MIT 라이선스. 기반 데이터셋 원저작자 DECK(github.com/DECK6) 고지 유지 — NOTICE.md 참조
- 성취기준 원문은 교육부 공표 공공저작물로 출처를 표기해 수록 (NOTICE.md)
- 교육부·NCIC 공식 산출물이 아니며, 개별 학습자를 진단하지 않습니다
