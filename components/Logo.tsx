import React from 'react';

interface LogoProps {
  /** Size variant: sm (compact), md (board header), lg (setup hero) */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the text wordmark alongside the emblem */
  showWordmark?: boolean;
  /** Optional subtitle or badge */
  subtitle?: string;
  /** Optional custom class name for the wrapper */
  className?: string;
}

export default function Logo({
  size = 'md',
  showWordmark = true,
  subtitle,
  className = '',
}: LogoProps) {
  // Dimensions based on variant
  const emblemSizes = {
    sm: { w: 34, h: 34, viewBox: '0 0 48 48', textClass: 'text-xl' },
    md: {
      w: 46,
      h: 46,
      viewBox: '0 0 48 48',
      textClass: 'text-2xl sm:text-3xl',
    },
    lg: {
      w: 72,
      h: 72,
      viewBox: '0 0 48 48',
      textClass: 'text-4xl sm:text-5xl',
    },
  };

  const current = emblemSizes[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* ── Triptych 3-Panel Architectural Crest ───────────────────── */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={current.w}
          height={current.h}
          viewBox={current.viewBox}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm transition-transform hover:scale-105"
          aria-label="Triptych Logo"
          role="img"
        >
          {/* Subtle outer soft glow container */}
          <rect
            x="2"
            y="2"
            width="44"
            height="44"
            rx="12"
            fill="#FDFBF7"
            stroke="#C5A059"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Left Arch Panel */}
          <path
            d="M9 19C9 15.5 11 14 14 14C17 14 19 15.5 19 19V36H9V19Z"
            fill="#0D5C58"
            fillOpacity="0.85"
          />
          <path
            d="M11 20C11 17 12 16 14 16C16 16 17 17 17 20V34H11V20Z"
            fill="#C5A059"
            fillOpacity="0.4"
          />

          {/* Right Arch Panel */}
          <path
            d="M29 19C29 15.5 31 14 34 14C37 14 39 15.5 39 19V36H29V19Z"
            fill="#0D5C58"
            fillOpacity="0.85"
          />
          <path
            d="M31 20C31 17 32 16 34 16C36 16 37 17 37 20V34H31V20Z"
            fill="#C5A059"
            fillOpacity="0.4"
          />

          {/* Center Arch Panel (Taller, grander focal point) */}
          <path
            d="M18 13C18 9 20.5 7 24 7C27.5 7 30 9 30 13V37H18V13Z"
            fill="#0D5C58"
          />
          <path
            d="M20 14.5C20 11 21.5 9 24 9C26.5 9 28 11 28 14.5V35H20V14.5Z"
            fill="#C5A059"
            fillOpacity="0.9"
          />

          {/* Center Gold Keystone / Diamond Accent */}
          <path
            d="M24 13L26 16L24 19L22 16L24 13Z"
            fill="#FFFFFF"
            fillOpacity="0.95"
          />

          {/* Golden base foundation plinth */}
          <rect x="7" y="37" width="34" height="3" rx="1.5" fill="#C5A059" />
        </svg>
      </div>

      {/* ── Brand Wordmark Typography ──────────────────────────────── */}
      {showWordmark && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-tight text-[#0D5C58] leading-none ${current.textClass}`}
          >
            Triptych
          </span>
          {subtitle && (
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#8A6B29] mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
