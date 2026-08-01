const request = process.argv.slice(2).join(" ").trim();
if (!request) {
  console.error('사용법: npm run task:scope -- "수정 요청"');
  process.exit(1);
}
console.log(`사용자 요청: ${request}`);
console.log("작업 방식: 최소 범위 수정");
console.log("필수 확인: VERSION.md, DEVELOPMENT_RULES.md");
console.log("원칙: 관련 파일만 탐색하고 요청하지 않은 구조 변경은 하지 않는다.");
console.log("범위가 크게 확대될 때만 사용자에게 설명하고 중단한다.");
