import { redirect } from "next/navigation";

/** 시작 화면은 온보딩 작업이 정하므로 지금은 곧바로 플레이 화면으로 보낸다. */
export default function Home() {
  redirect("/play");
}
