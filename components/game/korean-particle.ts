/*
 * 받침에 따라 조사를 고른다.
 *
 * "새끼거미이(가) 쓰러졌습니다" 처럼 두 형태를 나란히 적는 방식은 읽는 사람이
 * 매번 고르게 만든다. 한글 음절은 (코드 - 0xAC00) % 28 이 0 이면 받침이 없다.
 * 한글이 아닌 글자로 끝나면 판별할 수 없으므로 받침 없는 쪽을 쓴다. 숫자는
 * 읽는 방식에 따라 갈리므로(3 삼, 12 십이) 조사를 붙이지 않는 문장을 쓴다.
 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;

export function hasFinalConsonant(word: string): boolean {
  const last = word.at(-1);
  if (last === undefined) return false;

  const code = last.codePointAt(0);
  if (code === undefined || code < HANGUL_FIRST || code > HANGUL_LAST) return false;

  return (code - HANGUL_FIRST) % JONGSEONG_COUNT !== 0;
}

/** 이 / 가 */
export function withSubjectParticle(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "이" : "가"}`;
}

/** 을 / 를 */
export function withObjectParticle(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "을" : "를"}`;
}
