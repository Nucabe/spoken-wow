"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { GALLERY } from "./shots";
import { useArrowFocus } from "./useArrowFocus";

/**
 * One large frame and a single row of buttons under it that scrolls sideways. The frame shows the
 * shot at its own size, never enlarged, over a blurred, enlarged copy of the same picture. The
 * caption is a polite live region, so a screen reader hears which shot is showing.
 */
export default function Gallery() {
  const [index, setIndex] = useState(0);
  const [edges, setEdges] = useState({ start: false, end: true });
  const row = useRef<HTMLUListElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const item = GALLERY[index];

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

  useArrowFocus(edges, row, prev, next);

  const go = (step: 1 | -1) => {
    const next = (index + step + GALLERY.length) % GALLERY.length;
    setIndex(next);
    const thumb = row.current?.children[next] as HTMLElement | undefined;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    thumb?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "center" });
  };

  const scroll = (direction: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="bn-gallery">
      <figure className="bn-shot">
        <div className="bn-shot-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} alt={item.alt} className="bn-shot-img" />
          <button type="button" className="bn-shot-arrow bn-shot-prev" aria-label="Previous picture" onClick={() => go(-1)}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4l-6 6 6 6" />
            </svg>
          </button>
          <button type="button" className="bn-shot-arrow bn-shot-next" aria-label="Next picture" onClick={() => go(1)}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 4l6 6-6 6" />
            </svg>
          </button>
        </div>
        <figcaption aria-live="polite">
          <b>{item.title}</b>
          <span>{item.text}</span>
        </figcaption>
      </figure>
      <div className="bn-thumbs-wrap" data-start={edges.start} data-end={edges.end}>
        <ul className="bn-thumbs" aria-label="Gallery pictures" ref={row} onScroll={measure}>
          {GALLERY.map((entry, i) => (
            <li key={entry.title}>
              <button type="button" aria-pressed={i === index} className="bn-thumb" onClick={() => setIndex(i)}>
                <span className="bn-thumb-art" aria-hidden="true">
                  <Image src={entry.thumb} alt="" width={320} height={180} unoptimized />
                </span>
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" ref={prev} className="bn-thumbs-arrow bn-thumbs-prev" aria-label="Earlier pictures" aria-hidden={!edges.start} tabIndex={edges.start ? 0 : -1} onClick={() => scroll(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <button type="button" ref={next} className="bn-thumbs-arrow bn-thumbs-next" aria-label="More pictures" aria-hidden={!edges.end} tabIndex={edges.end ? 0 : -1} onClick={() => scroll(1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
