# 원본 개정 감지 자동화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NCIC 원본 PDF 12종의 개정을 매월 자동 감지해 GitHub 이슈로 알리는 `--check` 모드와 스케줄 워크플로를 추가한다.

**Architecture:** `fetch-ncic.mjs`에 무기록(no-write) 점검 모드를 추가 — 12종을 메모리로 새로 내려받아 해시를 `sources.json` 기록과 대조하고, 변경(개정 의심)과 다운로드 실패(네트워크·URL)를 구분해 보고. GitHub Actions cron이 매월 실행하고 실패 시 중복 방지된 이슈를 생성한다.

**Tech Stack:** Node.js ≥20.11 내장 fetch/crypto, GitHub Actions, gh CLI(워크플로 내).

## Global Constraints

- 순수 ESM `.mjs`, 신규 의존성 금지. 사람용 로그는 `console.error`.
- `--check`는 **어떤 파일도 쓰지 않는다** (sources.json·.cache 미접촉 — 스펙의 "임시 디렉터리" 대신 메모리 버퍼로 처리, 디스크 기록 전무라는 목적에 더 충실).
- exit code: 전부 일치 0, 변경 또는 실패 존재 1. 개정과 네트워크 장애를 출력에서 구분.
- 커밋: conventional prefix + 한국어 본문.

---

### Task 1: `--check` 모드 + 워크플로 + 문서

**Files:**
- Modify: `pipeline/fetch-ncic.mjs` (diffSources export + runCheck + main 분기)
- Modify: `tests/fetch-ncic.test.mjs` (테스트 2개 추가 → 총 51)
- Create: `.github/workflows/revision-check.yml`
- Modify: `README.md` ("원본 개정 감지" 절)

**Interfaces:**
- Produces: `diffSources(entries, computedHashes: Map<id, sha256|null>) → { changed: [{id, recorded, actual}], unreachable: [{id}] }`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/fetch-ncic.test.mjs`의 import 줄을 `import { isPdf, neededSourceIds, seedSourceMap, diffSources } from '../pipeline/fetch-ncic.mjs';`로 바꾸고 파일 끝에 추가:

```js
test('diffSources는 해시 변경과 다운로드 실패를 구분한다', () => {
  const entries = { a: { sha256: 'x1' }, b: { sha256: 'x2' }, c: { sha256: 'x3' } };
  const computed = new Map([['a', 'x1'], ['b', 'CHANGED'], ['c', null]]);
  const { changed, unreachable } = diffSources(entries, computed);
  assert.deepEqual(changed, [{ id: 'b', recorded: 'x2', actual: 'CHANGED' }]);
  assert.deepEqual(unreachable.map((u) => u.id), ['c']);
});

test('diffSources는 전부 일치하면 빈 결과를 반환한다', () => {
  const entries = { a: { sha256: 'x1' } };
  const { changed, unreachable } = diffSources(entries, new Map([['a', 'x1']]));
  assert.deepEqual(changed, []);
  assert.deepEqual(unreachable, []);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/fetch-ncic.test.mjs` · Expected: FAIL (`diffSources` export 없음)

- [ ] **Step 3: 구현** — `pipeline/fetch-ncic.mjs`의 `seedSourceMap` 함수 뒤에 추가:

```js
export function diffSources(entries, computedHashes) {
  const changed = [];
  const unreachable = [];
  for (const [id, entry] of Object.entries(entries)) {
    const actual = computedHashes.get(id);
    if (!actual) { unreachable.push({ id }); continue; }
    if (entry.sha256 && entry.sha256 !== actual) {
      changed.push({ id, recorded: entry.sha256, actual });
    }
  }
  return { changed, unreachable };
}

async function runCheck() {
  const curriculaDoc = JSON.parse(readFileSync(curriculaPath, 'utf8'));
  const needed = neededSourceIds(curriculaDoc);
  const sources = loadSources();
  const computed = new Map();
  for (const id of needed) {
    const url = sources.entries[id]?.url;
    if (!url) { computed.set(id, null); continue; }
    console.error(`점검: ${id}`);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!isPdf(buffer)) throw new Error('PDF 아님');
      computed.set(id, createHash('sha256').update(buffer).digest('hex'));
    } catch {
      computed.set(id, null);
    }
  }
  const { changed, unreachable } = diffSources(sources.entries, computed);
  if (!changed.length && !unreachable.length) {
    console.error(`✓ 원본 ${needed.length}종 변경 없음`);
    return;
  }
  if (changed.length) {
    console.error(`⚠ 개정 의심 — 해시 변경 ${changed.length}종:`);
    for (const c of changed) console.error(`  - ${c.id}: 기록 ${c.recorded.slice(0, 12)}… → 현재 ${c.actual.slice(0, 12)}…`);
  }
  if (unreachable.length) {
    console.error(`✗ 다운로드 실패(개정 아님 — URL·네트워크 확인) ${unreachable.length}종:`);
    for (const u of unreachable) console.error(`  - ${u.id}`);
  }
  process.exit(1);
}
```

`main()` 첫 줄(즉 `const curriculaDoc = …` 앞)에 분기 추가:

```js
  if (process.argv.includes('--check')) {
    await runCheck();
    return;
  }
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test` · Expected: `tests 51, pass 51`

- [ ] **Step 5: 무기록·실동작 수동 검증** — Run: `git status --porcelain pipeline .cache 2>/dev/null | wc -l` 기록 후 `node pipeline/fetch-ncic.mjs --check; echo "exit=$?"` 실행 → Expected: `✓ 원본 12종 변경 없음`, `exit=0`, git status 변화 없음

- [ ] **Step 6: 워크플로 작성** — `.github/workflows/revision-check.yml`:

```yaml
name: Revision check

on:
  schedule:
    - cron: '0 0 1 * *'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.11.1
      - name: Check source revisions
        run: |
          set -o pipefail
          node pipeline/fetch-ncic.mjs --check 2>&1 | tee check-output.txt
      - name: Create alert issue
        if: failure()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh label create revision-alert --color D93F0B --description "원본 개정/점검 경고" --force
          if [ -z "$(gh issue list --label revision-alert --state open --json number --jq '.[0].number')" ]; then
            gh issue create --title "교육과정 원본 점검 실패 ($(date -u +%Y-%m-%d))" \
              --label revision-alert \
              --body "$(printf '월간 원본 점검이 실패했습니다. 출력의 [개정 의심/다운로드 실패] 구분을 확인하세요.\n\n~~~\n%s\n~~~\n\n실행 로그: %s/%s/actions/runs/%s' "$(cat check-output.txt)" "${{ github.server_url }}" "${{ github.repository }}" "${{ github.run_id }}")"
          fi
```

- [ ] **Step 7: README 갱신** — "## 원문 파이프라인 재현 (개발자용)" 절 뒤에 추가:

```markdown
## 원본 개정 감지

매월 1일 GitHub Actions([revision-check](.github/workflows/revision-check.yml))가 NCIC 원본
PDF 12종을 새로 내려받아 기록된 SHA-256과 대조하고, 변경이 감지되면 `revision-alert` 라벨의
이슈를 자동 생성합니다. 수동 점검: `node pipeline/fetch-ncic.mjs --check` — 어떤 파일도 쓰지 않습니다.
```

- [ ] **Step 8: 워크플로 수동 트리거 검증** — 커밋·푸시 후 `gh workflow run revision-check.yml && sleep 60 && gh run list --workflow revision-check.yml --limit 1` → Expected: success

- [ ] **Step 9: 커밋** —

```bash
git add pipeline/fetch-ncic.mjs tests/fetch-ncic.test.mjs .github/workflows/revision-check.yml README.md
git commit -m "feat: add monthly source-revision detection with --check mode

--check는 무기록으로 12종을 새로 받아 해시 대조, 개정 의심과 다운로드
실패를 구분 보고. 매월 1일 워크플로가 실패 시 revision-alert 이슈 생성.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```
