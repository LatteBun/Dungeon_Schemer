import type { MetadataRoute } from "next";

/**
 * 홈 화면에 얹었을 때의 앱 정보.
 *
 * 휴대폰 브라우저는 주소창을 스스로 감추게 해 주지 않는다. 유일하게 확실한
 * 길이 홈 화면에 추가해 앱처럼 여는 것이고, 그때 이 파일이 쓰인다.
 *
 * `fullscreen` 은 안드로이드에서 주소창과 상태 표시줄까지 감춘다. iOS 는 이 값을
 * 모르고 `standalone` 처럼 다루는데, 그것만으로도 주소창은 사라진다.
 *
 * `orientation` 은 안드로이드에서 가로로 잠근다. iOS 는 이 값을 무시하므로 세로로
 * 들면 세로로 보인다 — 그 경우는 화면이 직접 「가로로 돌려 주세요」 라고 말한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "용사님, 이쪽입니다",
    short_name: "용사님, 이쪽입니다",
    description: "그들은 당신의 말을 믿는다",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#000000",
    theme_color: "#120e0a",
    icons: [
      {
        src: "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_guild.png",
        sizes: "144x165",
        type: "image/png",
      },
    ],
  };
}
