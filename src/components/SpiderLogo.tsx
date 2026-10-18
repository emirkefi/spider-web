import React from 'react';

interface SpiderLogoProps {
  size?: number;
  className?: string;
}

export const SpiderLogo: React.FC<SpiderLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <linearGradient id="spiderBadgeBg" x1="64" y1="32" x2="448" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FAFAFA" />
          <stop offset="55%" stopColor="#E4E4E7" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
      </defs>

      {/* Apple Squircle Badge */}
      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx="115"
        fill="url(#spiderBadgeBg)"
        stroke="#09090B"
        strokeWidth="16"
      />

      {/* Razor-Sharp Black Spider Silhouette */}
      <g fill="#09090B">
        {/* Left Articulated Blade Legs */}
        <path d="M232 198 L172 122 L118 64 L148 138 L218 214 Z" />
        <path d="M222 222 L130 162 L54 142 L120 190 L216 238 Z" />
        <path d="M222 248 L120 244 L48 294 L132 270 L224 264 Z" />
        <path d="M230 272 L148 338 L104 444 L174 350 L240 284 Z" />

        {/* Right Articulated Blade Legs */}
        <path d="M280 198 L340 122 L394 64 L364 138 L294 214 Z" />
        <path d="M290 222 L382 162 L458 142 L392 190 L296 238 Z" />
        <path d="M290 248 L392 244 L464 294 L380 270 L288 264 Z" />
        <path d="M282 272 L364 338 L408 444 L338 350 L272 284 Z" />

        {/* Fangs */}
        <polygon points="244,174 230,134 250,156" />
        <polygon points="268,174 282,134 262,156" />

        {/* Cephalothorax */}
        <polygon points="256,158 290,190 278,248 234,248 222,190" />

        {/* Sharp Faceted Abdomen */}
        <polygon points="256,236 312,288 288,386 256,442 224,386 200,288" />
      </g>

      {/* Crisp White Specular Eyes & Dorsal Crest */}
      <polygon points="256,262 270,298 256,388 242,298" fill="#52525B" opacity="0.65" />
      <polygon points="242,186 252,194 240,200" fill="#FFFFFF" />
      <polygon points="270,186 260,194 272,200" fill="#FFFFFF" />
    </svg>
  );
};
