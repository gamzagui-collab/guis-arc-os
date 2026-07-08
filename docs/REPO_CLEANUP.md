# 저장소 정리 안내

표준 루트 구조:

```text
backend/
database/
docs/
frontend/
scripts/
.github/
README.md
package.json
wrangler.toml
```

`guis-arc-enterprise/` 같은 예전 폴더가 남아 있으면 사용하지 않는 폴더일 가능성이 큽니다.

삭제 전 확인:

```powershell
dir guis-arc-enterprise
```

삭제:

```powershell
Remove-Item guis-arc-enterprise -Recurse -Force
git add .
git commit -m "Remove legacy enterprise folder"
git push
```
