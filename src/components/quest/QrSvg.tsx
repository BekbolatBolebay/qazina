"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrSvgProps {
  path: string;
  size?: number;
  label?: string;
}

export function QrSvg({ path, size = 128, label }: QrSvgProps) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fullUrl = path.startsWith("http") ? path : `${origin}${path}`;

    QRCode.toString(fullUrl, {
      type: "svg",
      margin: 1,
      width: size,
      color: {
        dark: "#173F35",
        light: "#FFFFFF",
      },
    })
      .then((res) => setSvg(res))
      .catch(() => setSvg(""));
  }, [path, size]);

  return (
    <div className="inline-flex flex-col items-center gap-1.5 rounded-xl border border-[#EFE8DD] bg-white p-2.5 shadow-sm">
      {svg ? (
        <div
          style={{ width: size, height: size }}
          className="[&>svg]:h-full [&>svg]:w-full"
          aria-label={label || `QR код: ${path}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center rounded bg-[#F8F5EF] text-[10px] text-neutral-400"
        >
          QR...
        </div>
      )}
      {label && (
        <span className="max-w-[140px] truncate text-[10px] font-semibold text-[#173F35]">
          {label}
        </span>
      )}
    </div>
  );
}
