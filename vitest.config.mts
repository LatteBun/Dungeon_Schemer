import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 4의 기본값이지만, 화면 트랙이 jsdom을 도입할 때
    // 무엇을 바꿔야 하는지 드러나도록 명시한다.
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: [".worktrees/**", "node_modules/**", ".next/**"],
  },
  resolve: {
    // Vitest는 tsconfig.json의 paths를 읽지 않으므로 직접 맞춘다.
    // 이 별칭이 없으면 @/lib/domain 을 가져오는 모든 테스트가 깨진다.
    alias: { "@": import.meta.dirname },
  },
});
