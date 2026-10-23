"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Voice } from "./voices";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * One recording from the voice packs: the speaker, a waveform that doubles as the seek bar, and
 * the words below it, lit as they are spoken by the start times measured against this audio. The
 * file downloads when it is played.
 */
function Clip({ voice, label }: { voice: Voice; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    // A play that the player's removal interrupts rejects; there is nothing to do about it.
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const seek = (to: number) => {
    if (audio.current) audio.current.currentTime = to;
    setTime(to);
  };

  let current = -1;
  if (playing || time > 0) {
    voice.times.forEach((start, i) => {
      if (time >= start) current = i;
    });
  }
  const progress = time / voice.duration;

  // The text shows two lines; keep the word being spoken inside them.
  useEffect(() => {
    const box = text.current;
    const word = box?.querySelector<HTMLElement>(".now");
    // Move only when the word falls outside the two lines showing, and then to the top line.
    if (box && word && (word.offsetTop + word.offsetHeight > box.scrollTop + box.clientHeight || word.offsetTop < box.scrollTop)) {
      box.scrollTo({ top: word.offsetTop, behavior: "smooth" });
    }
  }, [current]);

  return (
    <div className="bn-voice-card">
      <audio
        ref={audio}
        src={voice.audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          if (audio.current) setTime(audio.current.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          seek(0);
        }}
      />
      <div className="bn-voice-head">
        <Image src={voice.icon} alt="" width={64} height={64} unoptimized />
        <p>
          <b>{voice.name}</b>
          <span>{voice.sub}</span>
        </p>
      </div>
      <div className="bn-voice-bar">
        <button type="button" className="bn-voice-play" aria-label={`${playing ? "Pause" : "Play"}: ${voice.name}`} onClick={toggle}>
          {playing ? (
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 4l12 8-12 8z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="bn-voice-wave">
          <input
            type="range"
            className="bn-voice-seek"
            min={0}
            max={voice.duration}
            step={0.05}
            value={time}
            aria-label={`Position in the ${label} example`}
            aria-valuetext={`${clock(time)} of ${clock(voice.duration)}`}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="bn-wave" aria-hidden="true">
            {voice.peaks.map((peak, i) => (
              <i key={i} className={i / voice.peaks.length < progress ? "on" : undefined} style={{ height: `${peak * 100}%` }} />
            ))}
          </div>
        </div>
        <span className="bn-voice-time">
          {clock(time)} / {clock(voice.duration)}
        </span>
      </div>
      <p className="bn-voice-text" lang="en" ref={text}>
        {voice.words.map((word, i) => (
          <span key={i} className={i === current ? "now" : i < current ? "said" : undefined}>
            {word}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

const CHEVRON = (path: string) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

/**
 * The part's recordings: one row of buttons that scrolls sideways, fading out at an edge that has
 * more, above the recording that is showing.
 */
export default function VoicePlayer({ voices, label }: { voices: Voice[]; label: string }) {
  const [pick, setPick] = useState(0);
  const [edges, setEdges] = useState({ start: false, end: false });
  const row = useRef<HTMLUListElement>(null);

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const behavior = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

  const scroll = (direction: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: behavior() });
  };

  const choose = (i: number) => {
    setPick(i);
    const el = row.current;
    const button = el?.children[i] as HTMLElement | undefined;
    if (el && button) el.scrollTo({ left: button.offsetLeft - (el.clientWidth - button.offsetWidth) / 2, behavior: behavior() });
  };

  return (
    <div className="bn-voice">
      <div className="bn-voice-picks-wrap" data-start={edges.start} data-end={edges.end}>
        <ul className="bn-voice-picks" aria-label={`${label} examples`} ref={row} onScroll={measure}>
          {voices.map((voice, i) => (
            <li key={voice.audio}>
              <button type="button" aria-pressed={i === pick} onClick={() => choose(i)}>
                <Image src={voice.icon} alt="" width={64} height={64} unoptimized />
                {voice.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="bn-voice-arrow bn-voice-prev" aria-label="Earlier examples" aria-hidden={!edges.start} tabIndex={edges.start ? 0 : -1} onClick={() => scroll(-1)}>
          {CHEVRON("M12 4l-6 6 6 6")}
        </button>
        <button type="button" className="bn-voice-arrow bn-voice-next" aria-label="More examples" aria-hidden={!edges.end} tabIndex={edges.end ? 0 : -1} onClick={() => scroll(1)}>
          {CHEVRON("M8 4l6 6-6 6")}
        </button>
      </div>
      <Clip key={pick} voice={voices[pick]} label={label} />
    </div>
  );
}
