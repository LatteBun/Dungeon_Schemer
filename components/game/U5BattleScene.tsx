"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type CSSProperties } from "react";
import { withObjectParticle, withSubjectParticle } from "./korean-particle";
import type {
  U5BattleCueView,
  U5BattleReplay,
  U5BattleReplayFrame,
  U5BattleReplayParticipant,
} from "./u5-battle-replay";
import type { U5BattlePlaybackRate } from "./use-u5-battle-playback";

export interface U5BattleSceneProps {
  readonly replay: U5BattleReplay;
  readonly frame: U5BattleReplayFrame;
  readonly playbackRate: U5BattlePlaybackRate;
  readonly onReplayFromStart: () => void;
  readonly onTogglePlaybackRate: () => void;
  readonly showReplayControl?: boolean;
}

export function u5BattleMotionDuration(seconds: number, playbackRate: U5BattlePlaybackRate): number {
  return seconds / playbackRate;
}

function participantById(replay: U5BattleReplay, id: string | null) {
  return id === null ? undefined : replay.participants.find((participant) => participant.id === id);
}

/*
 * 한 프레임을 한 문장으로 옮긴다.
 *
 * 참가자는 replay 를 만들 때 이미 검증했지만, 빠졌을 때 문장에 undefined 를
 * 흘려보내느니 아무 말도 하지 않는다. 숫자 뒤에는 조사를 붙이지 않는다.
 * 3 은 "삼", 12 는 "십이" 라 읽는 방식에 따라 조사가 갈리기 때문이다.
 */
/*
 * 보스 정보가 전투에서 어떻게 드러나는지 옮긴다.
 *
 * `E4` 가 `boss-info.{축}.{방향}` 키를 준다. 축은 셋뿐이고 방향은 둘뿐이라
 * 표로 적을 수 있다. 화면이 문구를 지어내지 않고 이 표만 본다.
 */
const CUE_AXIS_WORD: Readonly<Record<U5BattleCueView["axis"], string>> = {
  targetWeight: "노려지는 자리",
  incomingDamage: "받는 피해",
  outgoingDamage: "주는 피해",
};

/** 전투 뒤 신뢰 검증. 인과 사슬의 마지막 칸이다. */
const VERIFICATION_WORD: Readonly<Record<U5BattleReplay["verifications"][number]["action"], string>> = {
  adviceHelped: "믿은 정보가 옳았습니다",
  adviceHarmed: "믿은 정보가 해로웠습니다",
  suspicionWasCostly: "의심한 정보가 실은 도움이었습니다",
  suspicionWasCorrect: "의심이 옳았습니다",
};

function frameDescription(replay: U5BattleReplay, frame: U5BattleReplayFrame): string {
  const actor = participantById(replay, frame.actorId);
  const target = participantById(replay, frame.targetId);

  switch (frame.phase) {
    case "idle":
      return "전투가 시작됩니다.";
    case "attack":
      if (actor === undefined || target === undefined) return "";
      if (frame.actionKind === "heal") {
        return `${withSubjectParticle(actor.name)} ${withObjectParticle(target.name)} 위한 치유 기도를 올립니다.`;
      }
      return `${withSubjectParticle(actor.name)} ${withObjectParticle(target.name)} 공격합니다.`;
    case "impact":
      if (actor === undefined || target === undefined) return "";
      if (frame.actionKind === "heal") {
        return frame.healing === null
          ? ""
          : `${withSubjectParticle(actor.name)} ${withObjectParticle(target.name)} ${frame.healing} 회복했습니다.`;
      }
      if (frame.damage === null) return "";
      return `${withSubjectParticle(target.name)} ${frame.damage} 피해를 받습니다.`;
    case "settle": {
      if (actor === undefined || target === undefined) return "";
      if (frame.actionKind === "heal") {
        const hp = frame.hpByParticipantId[target.id];
        return hp === undefined ? "" : `${target.name}의 HP가 ${hp}까지 회복되었습니다.`;
      }
      if (frame.defeatedParticipantIds.includes(target.id)) {
        return `${withSubjectParticle(actor.name)} ${withObjectParticle(target.name)} 쓰러뜨렸습니다.`;
      }
      const hp = frame.hpByParticipantId[target.id];
      if (hp === undefined) return "";
      return `${withSubjectParticle(actor.name)} ${withObjectParticle(target.name)} 공격해 HP가 ${hp}까지 떨어졌습니다.`;
    }
    case "complete":
      return replay.outcome === "victory"
        ? "파티가 전투에서 승리했습니다."
        : "파티가 전투에서 패배했습니다.";
  }
}

/*
 * 화면에는 프레임마다 문장을 갈아 끼우지만, 읽어 주는 것은 행동이 끝난
 * settle 과 complete 뿐이다.
 *
 * 네 프레임을 모두 알리면 행동 하나에 네 번, 20 행동 전투면 80 번을 읽는다.
 * 프레임 간격이 0.36~0.52초라 합성음이 따라오지 못하고, 화면은 여덟 번째
 * 행동을 그리는데 귀로는 첫 행동을 듣게 된다. settle 문장은 누가 누구를
 * 어떻게 했는지를 그 안에 다 담고 있으므로 그것만으로 따라갈 수 있다.
 */
function announcement(replay: U5BattleReplay, frame: U5BattleReplayFrame): string {
  if (frame.actionKind === "heal") {
    return frame.phase === "impact" ? frameDescription(replay, frame) : "";
  }
  return frame.phase === "settle" || frame.phase === "complete" ? frameDescription(replay, frame) : "";
}

/*
 * 화면에 남기는 문장은 사건뿐이다.
 *
 * 프레임마다 "누가 누구를 공격합니다 / N 피해를 받습니다 / HP가 N까지
 * 떨어졌습니다" 를 갈아 끼우면, 스무 행동 전투에서 예순 줄이 지나간다. 그런데
 * 그 셋은 화면이 이미 보여 주는 것을 글로 옮긴 것이다 — 달려드는 몸짓이 공격
 * 이고, 머리 위 숫자가 피해이고, 줄어드는 막대가 HP다. 글이 그림과 경쟁하면
 * 눈이 글로 가고, 정작 봐야 할 피해 숫자를 놓친다.
 *
 * 그림이 말하지 못하는 것만 남긴다 — 시작, 누군가 쓰러진 순간, 승패.
 * 읽어 주는 자리(.u5-battle-announcement)는 그대로 다 말하므로 눈으로 못 보는
 * 사람이 잃는 것은 없다.
 */
function caption(replay: U5BattleReplay, frame: U5BattleReplayFrame): string {
  if (frame.phase === "idle" || frame.phase === "complete") return frameDescription(replay, frame);
  if (frame.actionKind === "heal" && frame.phase === "impact") return frameDescription(replay, frame);
  if (frame.phase === "settle" && frame.defeatedParticipantIds.includes(String(frame.targetId))) {
    return frameDescription(replay, frame);
  }
  return "";
}

function motionForParticipant(
  participant: U5BattleReplayParticipant,
  frame: U5BattleReplayFrame,
  reducedMotion: boolean,
  playbackRate: U5BattlePlaybackRate,
) {
  const defeated = frame.defeatedParticipantIds.includes(participant.id);
  if (defeated) {
    return {
      animate: { x: 0, y: 0, opacity: 0.38 },
      transition: { duration: u5BattleMotionDuration(0.24, playbackRate) },
    };
  }
  if (frame.phase === "attack" && frame.actorId === participant.id) {
    if (frame.actionKind === "heal") {
      return {
        animate: {
          x: 0,
          y: 0,
          scale: reducedMotion ? 1 : [1, 1.05, 1],
          opacity: 1,
        },
        transition: { duration: reducedMotion ? 0 : u5BattleMotionDuration(0.32, playbackRate) },
      };
    }
    return {
      animate: { x: reducedMotion ? 0 : "var(--u5-battle-lunge-x)", y: 0, opacity: 1 },
      transition: {
        duration: u5BattleMotionDuration(0.18, playbackRate),
        repeat: 1,
        repeatType: "reverse" as const,
      },
    };
  }
  if (frame.phase === "impact" && frame.targetId === participant.id) {
    if (frame.actionKind === "heal") {
      return {
        animate: {
          x: 0,
          y: 0,
          scale: reducedMotion ? 1 : [1, 1.08, 1],
          opacity: 1,
        },
        transition: { duration: reducedMotion ? 0 : u5BattleMotionDuration(0.3, playbackRate) },
      };
    }
    return {
      animate: { x: reducedMotion ? 0 : [0, "-3%", "3%", 0], y: 0, opacity: 1 },
      transition: { duration: u5BattleMotionDuration(0.24, playbackRate) },
    };
  }
  /*
   * 숨 쉬는 것은 y 뿐이다. 되풀이를 그 하나에만 건다.
   *
   * 예전에는 transition 을 통째로 줘서 `repeat: Infinity` 가 opacity 에도
   * 걸렸다. 쓰러져 0.38 이 된 사람을 두고 다시 보기를 누르면, 0.38 에서 1 로
   * 가던 애니메이션이 끝나기 전에 처음으로 되돌아가기를 무한히 반복한다.
   * 게다가 프레임이 넘어갈 때마다 다시 시작하므로 영영 1 에 닿지 못한다.
   * 죽을 사람이 첫 프레임부터 흐린 채로 서 있던 까닭이다.
   */
  return {
    animate: { x: 0, y: reducedMotion ? 0 : [0, "-2%", 0], opacity: 1 },
    transition: reducedMotion ? { duration: 0 } : {
      y: { duration: u5BattleMotionDuration(1.8, playbackRate), repeat: Infinity, ease: "easeInOut" as const },
      x: { duration: u5BattleMotionDuration(0.24, playbackRate) },
      /*
       * 살아 있는 사람의 투명도는 애니메이션 대상이 아니다.
       *
       * 다시 보기는 쓰러졌던 사람을 되살려 놓고 시작한다. 그때 0.38 에서 1 로
       * 스며들면 첫 0.24 초 동안 멀쩡한 사람이 흐리게 보인다. 곧바로 1 이 된다.
       */
      opacity: { duration: 0 },
    },
  };
}

function participantMotionClass(
  participant: U5BattleReplayParticipant,
  frame: U5BattleReplayFrame,
): string {
  if (frame.phase === "attack" && frame.actorId === participant.id) {
    return frame.actionKind === "heal"
      ? "u5-battle-motion is-praying"
      : "u5-battle-motion is-lunging";
  }
  if (frame.phase === "impact" && frame.targetId === participant.id) {
    return frame.actionKind === "heal"
      ? "u5-battle-motion is-recovering"
      : "u5-battle-motion is-hit";
  }
  return "u5-battle-motion";
}

function Participant({ participant, frame, reducedMotion, playbackRate }: {
  readonly participant: U5BattleReplayParticipant;
  readonly frame: U5BattleReplayFrame;
  readonly reducedMotion: boolean;
  readonly playbackRate: U5BattlePlaybackRate;
}) {
  /* 믿음은 그것을 들고 간 사람의 것이다. 피해 숫자가 대상 위에 뜨듯 여기 붙인다. */
  const cue = frame.cues.find((one) => one.characterId === participant.id);
  const hp = frame.hpByParticipantId[participant.id] ?? participant.finalHp;
  const hpPercent = Math.max(0, Math.min(100, hp / participant.maxHp * 100));
  const defeated = frame.defeatedParticipantIds.includes(participant.id);
  const showDamage = frame.phase === "impact"
    && frame.actionKind === "attack"
    && frame.targetId === participant.id
    && frame.damage !== null;
  const showHealing = frame.phase === "impact"
    && frame.actionKind === "heal"
    && frame.targetId === participant.id
    && frame.healing !== null;
  const motionState = motionForParticipant(participant, frame, reducedMotion, playbackRate);
  const participantStyle = {
    "--u5-battle-lunge-x": participant.side === "party" ? "16%" : "-16%",
  } as CSSProperties;

  /*
   * 쓰러진 사람은 흐려진다. 그런데 흐려지기만 하면 무슨 일이 난 건지 알기
   * 어렵다 — 화면이 잠깐 반투명해진 것처럼 보인다. 상태를 표식으로 내놓아
   * 색을 빼고 배지를 키운다.
   */
  return (
    <article
      className="u5-battle-participant"
      data-participant-id={participant.id}
      data-defeated={defeated ? "true" : "false"}
      style={participantStyle}
    >
      <motion.div
        className={participantMotionClass(participant, frame)}
        animate={motionState.animate}
        transition={motionState.transition}
      >
        <div className={`u5-battle-orientation is-${participant.side}`}>
          <div className="u5-battle-sprite-frame">
            <Image
              className="u5-battle-sprite"
              src={participant.imageSrc}
              alt={participant.name}
              fill
              sizes="10rem"
              priority
            />
          </div>
        </div>
      </motion.div>
      <strong className="u5-battle-name">{participant.name}</strong>
      <div
        className="u5-battle-hp"
        role="progressbar"
        aria-label={`${participant.name} HP ${hp} / ${participant.maxHp}`}
        aria-valuemin={0}
        aria-valuemax={participant.maxHp}
        aria-valuenow={hp}
        style={{ "--u5-battle-hp-percent": `${hpPercent}%` } as CSSProperties}
      >
        <span className="u5-battle-hp__fill" aria-hidden="true" />
      </div>
      <span className="u5-battle-hp__numbers">{hp} / {participant.maxHp}</span>
      <AnimatePresence>
        {showDamage ? (
          <span className="u5-battle-damage-anchor">
            <motion.span
              className="u5-battle-damage"
              initial={{ opacity: 0, y: reducedMotion ? 0 : "12%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : "-18%" }}
              transition={{ duration: reducedMotion ? 0 : u5BattleMotionDuration(0.24, playbackRate) }}
            >
              -{frame.damage}
            </motion.span>
          </span>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showHealing ? (
          <span className="u5-battle-healing-anchor">
            <motion.output
              className="u5-battle-healing"
              aria-label={`${frame.healing} 회복`}
              initial={{ opacity: 0, y: reducedMotion ? 0 : "12%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : "-18%" }}
              transition={{ duration: reducedMotion ? 0 : u5BattleMotionDuration(0.24, playbackRate) }}
            >
              <span aria-hidden="true">+{frame.healing}</span>
            </motion.output>
          </span>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {cue === undefined ? null : (
          <motion.span
            className={`u5-battle-cue is-${cue.direction}`}
            initial={{ opacity: 0, y: reducedMotion ? 0 : "24%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : u5BattleMotionDuration(0.24, playbackRate) }}
          >
            <b>{CUE_AXIS_WORD[cue.axis]}</b>
            {cue.direction === "beneficial" ? "믿음이 통했다" : "믿음이 어긋났다"}
          </motion.span>
        )}
      </AnimatePresence>
      {defeated ? <span className="u5-battle-defeated">쓰러짐</span> : null}
    </article>
  );
}

export function U5BattleScene({
  replay,
  frame,
  playbackRate,
  onReplayFromStart,
  onTogglePlaybackRate,
  showReplayControl = true,
}: U5BattleSceneProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const party = replay.participants.filter((participant) => participant.side === "party");
  const enemies = replay.participants.filter((participant) => participant.side === "enemy");
  const complete = frame.phase === "complete";
  const healActor = frame.actionKind === "heal" ? participantById(replay, frame.actorId) : undefined;
  const healTarget = frame.actionKind === "heal" ? participantById(replay, frame.targetId) : undefined;
  const healUsesRemaining = frame.actorId === null
    ? undefined
    : frame.battleAbilityUsesRemainingByParticipantId[frame.actorId];

  return (
    <section
      className="u5-battle-scene"
      data-testid="u5-battle-scene"
      data-playback-rate={playbackRate}
      aria-label="자동 전투 재생"
      style={{
        "--u5-battle-hp-transition-duration": `${u5BattleMotionDuration(0.28, playbackRate)}s`,
      } as CSSProperties}
    >
      <div className="u5-battle-overlay">
        <div className="u5-battle-group" data-side="party" role="group" aria-label="파티">
          {party.map((participant) => (
            <Participant
              key={participant.id}
              participant={participant}
              frame={frame}
              reducedMotion={reducedMotion}
              playbackRate={playbackRate}
            />
          ))}
        </div>
        <div className="u5-battle-group" data-side="enemy" role="group" aria-label="적">
          {enemies.map((participant) => (
            <Participant
              key={participant.id}
              participant={participant}
              frame={frame}
              reducedMotion={reducedMotion}
              playbackRate={playbackRate}
            />
          ))}
        </div>
      </div>
      {healActor === undefined || healTarget === undefined || healUsesRemaining === undefined ? null : (
        <div className="u5-battle-heal-action" aria-label="치유 행동">
          <strong>치유 기도</strong>
          <span>{healActor.name} → {healTarget.name}</span>
          <span>남은 횟수 {healUsesRemaining}</span>
        </div>
      )}
      {/* 빈 문장에도 자리는 지킨다. 줄이 나타났다 사라지면 화면이 덜컹거린다. */}
      <p className="u5-battle-live" data-empty={caption(replay, frame) === "" ? "true" : "false"}>
        {caption(replay, frame)}
      </p>
      {!complete || !showReplayControl || replay.verifications.length === 0 ? null : (
        <ul className="u5-battle-verifications" data-testid="u5-battle-verifications">
          {replay.verifications.map((one) => (
            <li key={`${one.characterId}-${one.action}`}>
              {participantById(replay, one.characterId)?.name ?? one.characterId} · {VERIFICATION_WORD[one.action]}
            </li>
          ))}
        </ul>
      )}
      <p className="u5-battle-announcement" aria-live="polite" aria-atomic="true">{announcement(replay, frame)}</p>
      <div className="u5-battle-controls">
        <button
          type="button"
          aria-label="전투 재생 속도"
          aria-pressed={playbackRate === 2}
          onClick={onTogglePlaybackRate}
        >
          ×{playbackRate}
        </button>
        {complete && showReplayControl
          ? <button type="button" onClick={onReplayFromStart}>다시 보기</button>
          : null}
      </div>
    </section>
  );
}
