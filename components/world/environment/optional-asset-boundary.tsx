"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { WorldErrorBoundary } from "../world-error-boundary";

export function OptionalAssetBoundary({
  assetId = "optional-asset",
  children,
  fallback,
  onResolved,
  onWarning,
}: {
  assetId?: string;
  children: ReactNode;
  fallback: ReactNode;
  onResolved?: (status: "loaded" | "fallback") => void;
  onWarning?: (warning: {
    assetId: string;
    status: "fallback";
  }) => void;
}) {
  const warnedRef = useRef(false);

  const reportFallback = () => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    const warning = { assetId, status: "fallback" } as const;
    console.warn(`[world-asset:${assetId}] Using deterministic fallback.`);
    onWarning?.(warning);
  };

  return (
    <WorldErrorBoundary
      onError={reportFallback}
      renderFallback={() => (
        <>
          {fallback}
          <ResolutionSignal onResolved={onResolved} status="fallback" />
        </>
      )}
      resetKey={0}
    >
      <>
        {children}
        <ResolutionSignal onResolved={onResolved} status="loaded" />
      </>
    </WorldErrorBoundary>
  );
}

function ResolutionSignal({
  onResolved,
  status,
}: Readonly<{
  onResolved?: (status: "loaded" | "fallback") => void;
  status: "loaded" | "fallback";
}>) {
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onResolved?.(status);
  }, [onResolved, status]);

  return null;
}
