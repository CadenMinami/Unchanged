"use client";

import type { ReactNode } from "react";

import { WorldErrorBoundary } from "../world-error-boundary";

export function OptionalAssetBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return (
    <WorldErrorBoundary renderFallback={() => fallback} resetKey={0}>
      {children}
    </WorldErrorBoundary>
  );
}
