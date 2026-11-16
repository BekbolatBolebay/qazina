"use client";

import React, { useState } from "react";

interface Book3DCoverProps {
  title: string;
  author: string;
  language: string;
  ageMin?: number;
  color: string;
  size?: "sm" | "md" | "lg";
}

export function Book3DCover({
  title,
  author,
  language,
  ageMin,
  color,
  size = "md",
}: Book3DCoverProps) {
  const [tilt, setTilt] = useState({ rx: 4, ry: -14 });

  const dims =
    size === "sm"
      ? "h-24 w-16 p-2 text-[9px]"
      : size === "lg"
        ? "h-56 w-40 p-4 text-sm"
        : "h-36 w-24 p-2.5 text-[11px]";

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-y * 18).toFixed(1)),
      ry: Number((x * 26 - 8).toFixed(1)),
    });
  }

  function resetTilt() {
    setTilt({ rx: 4, ry: -14 });
  }

  return (
    <div
      className="inline-block select-none"
      style={{ perspective: "900px" }}
      onMouseMove={handleMove}
      onMouseLeave={resetTilt}
    >
      <div
        className={`relative flex flex-col justify-between rounded-r-xl rounded-l-sm text-white transition-transform duration-200 ease-out ${dims}`}
        style={{
          backgroundColor: color || "#173F35",
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          boxShadow:
            "inset 6px 0 12px rgba(0,0,0,0.28), 8px 12px 22px rgba(23,63,53,0.24)",
        }}
      >
        {/* 3D Book Spine */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 top-0 w-2.5 rounded-l-sm bg-black/25"
          style={{
            transform: "translateZ(2px)",
          }}
        />
        {/* 3D Paper Pages Edge on Right */}
        <div
          className="pointer-events-none absolute bottom-1 right-0 top-1 w-1.5 rounded-r bg-[#F8F5EF]/85"
          style={{
            transform: "translateX(3px) translateZ(-4px)",
          }}
        />

        <div className="relative z-10 flex items-center justify-between gap-1 pl-1">
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
            {language}
          </span>
          {ageMin && (
            <span className="text-[9px] font-bold text-white/80">
              {ageMin}+
            </span>
          )}
        </div>

        <div className="relative z-10 pl-1">
          <div className="literary-text line-clamp-3 font-bold leading-tight">
            {title}
          </div>
          <div className="mt-1 truncate text-[0.78em] text-white/80">
            {author}
          </div>
        </div>
      </div>
    </div>
  );
}
