"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  U5BattleReplay,
  U5BattleReplayFrame,
  U5BattleReplayParticipant,
  U5BattleReplayPhase,
} from "./u5-battle-replay";

export interface U5BattleSceneProps {
  readonly replay: U5BattleReplay;
}

const FRAME_DURATION_MS: Readonly<Record<U5BattleReplayPhase, number>> = {
  idle: 500,
  attack: 360,
  impact: 420,
  settle: 520,
  complete: 0,
};

function participantById(replay: U5BattleReplay, id: string | null) {
  return id === null ? undefined : replay.participants.find((participant) => participant.id === id);
}

function frameDescription(replay: U5BattleReplay, frame: U5BattleReplayFrame): string {
  const actor = participantById(replay, frame.actorId);
  const target = participantById(replay, frame.targetId);

  switch (frame.phase) {
    case "idle":
      return "전투가 시작됩니다.";
    case "attack":
      return `${actor?.name}이(가) ${target?.name}을(를) 공격합니다.`;
    case "impact":
      return `${target?.name}이(가) ${frame.damage} 피해를 받습니다.`;
    case "settle":
      return frame.targetId !== null && frame.defeatedParticipantIds.includes(frame.targetId)
        ? `${target?.name}이(가) 쓰러졌습니다.`
        : `${target?.name} HP가 ${frame.targetId === null ? undefined : frame.hpByParticipantId[frame.targetId]}로 감소했습니다.`;
    case "complete":
      return replay.outcome === "victory"
        ? "파티가 전투에서 승리했습니다."
        : "파티가 전투에서 패배했습니다.";
  }
}

function motionForParticipant(
  participant: U5BattleReplayParticipant,
  frame: U5BattleReplayFrame,
  reducedMotion: boolean,
) {
  const defeated = frame.defeatedParticipantIds.includes(participant.id);
  if (defeated) return { animate: { x: 0, y: 0, opacity: 0.38 }, transition: { duration: 0.24 } };
  if (frame.phase === "attack" && frame.actorId === participant.id) {
    return {
      animate: { x: reducedMotion ? 0 : participant.side === "party" ? "16%" : "-16%", y: 0, opacity: 1 },
      transition: { duration: 0.18, repeat: 1, repeatType: "reverse" as const },
    };
  }
  if (frame.phase === "impact" && frame.targetId === participant.id) {
    return {
      animate: { x: reducedMotion ? 0 : [0, "-3%", "3%", 0], y: 0, opacity: 1 },
      transition: { duration: 0.24 },
    };
  }
  return {
    animate: { x: 0, y: reducedMotion ? 0 : [0, "-2%", 0], opacity: 1 },
    transition: reducedMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const },
  };
}

function Participant({ participant, frame, reducedMotion }: {
  readonly participant: U5BattleReplayParticipant;
  readonly frame: U5BattleReplayFrame;
  readonly reducedMotion: boolean;
}) {
  const hp = frame.hpByParticipantId[participant.id] ?? participant.finalHp;
  const hpPercent = Math.max(0, Math.min(100, hp / participant.maxHp * 100));
  const defeated = frame.defeatedParticipantIds.includes(participant.id);
  const showDamage = frame.phase === "impact" && frame.targetId === participant.id;
  const motionState = motionForParticipant(participant, frame, reducedMotion);

  return (
    <article className="u5-battle-participant" data-participant-id={participant.id}>
      <div className={`u5-battle-orientation is-${participant.side}`}>
        <motion.div
          className="u5-battle-motion"
          animate={motionState.animate}
          transition={motionState.transition}
        >
          <Image
            className="u5-battle-sprite"
            src={participant.imageSrc}
            alt={participant.name}
            width={participant.side === "party" ? 1024 : 1254}
            height={participant.side === "party" ? 1536 : 1254}
            priority
          />
        </motion.div>
      </div>
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
          <motion.span
            className="u5-battle-damage"
            initial={{ opacity: 0, y: reducedMotion ? 0 : "12%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : "-18%" }}
          >
            -{frame.damage}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {defeated ? <span className="u5-battle-defeated">쓰러짐</span> : null}
    </article>
  );
}

export function U5BattleScene({ replay }: U5BattleSceneProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const reducedMotion = useReducedMotion() ?? false;
  const frame = replay.frames[Math.min(frameIndex, replay.frames.length - 1)];

  useEffect(() => {
    // 새 replay 객체는 같은 scene 인스턴스에서 항상 첫 frame부터 다시 재생한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 승인된 replay 교체 계약이다.
    setFrameIndex(0);
  }, [replay]);

  useEffect(() => {
    if (frame === undefined || frame.phase === "complete") return;
    const timeout = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, replay.frames.length - 1));
    }, FRAME_DURATION_MS[frame.phase]);
    return () => window.clearTimeout(timeout);
  }, [frame, replay.frames.length]);

  if (frame === undefined) return null;

  const party = replay.participants.filter((participant) => participant.side === "party");
  const enemies = replay.participants.filter((participant) => participant.side === "enemy");
  const complete = frame.phase === "complete";

  return (
    <section className="u5-battle-scene" data-testid="u5-battle-scene" aria-label="자동 전투 재생">
      <div className="u5-battle-overlay">
        <div className="u5-battle-group" data-side="party" role="group" aria-label="파티">
          {party.map((participant) => (
            <Participant key={participant.id} participant={participant} frame={frame} reducedMotion={reducedMotion} />
          ))}
        </div>
        <div className="u5-battle-group" data-side="enemy" role="group" aria-label="적">
          {enemies.map((participant) => (
            <Participant key={participant.id} participant={participant} frame={frame} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
      <p className="u5-battle-live" aria-live="polite">{frameDescription(replay, frame)}</p>
      <div className="u5-battle-controls">
        {complete ? (
          <button type="button" onClick={() => setFrameIndex(0)}>다시 보기</button>
        ) : (
          <button type="button" onClick={() => setFrameIndex(replay.frames.length - 1)}>전투 건너뛰기</button>
        )}
      </div>
    </section>
  );
}
