"use client";

import Script from "next/script";
import { useCallback, useId, useRef } from "react";
import type { ShowpassWidgetConfig } from "@/lib/showpass";

declare global {
  interface Window {
    showpass?: {
      tickets?: {
        eventPurchaseWidget: (slug: string, params: Record<string, string | boolean>, containerId: string) => void;
      };
    };
  }
}

export function ShowpassWidget({ config, title }: { config: ShowpassWidgetConfig; title: string }) {
  const generatedId = useId();
  const containerId = `showpass-widget-${generatedId.replace(/[^a-z0-9_-]/gi, "")}`;
  const mounted = useRef(false);
  const mountWidget = useCallback(() => {
    if (config.kind !== "sdk" || mounted.current || !window.showpass?.tickets) return;
    mounted.current = true;
    window.showpass.tickets.eventPurchaseWidget(config.slug, config.params, containerId);
  }, [config, containerId]);

  if (config.kind === "iframe") {
    return <iframe className="showpass-frame" src={config.src} title={`${title} ticket checkout`} loading="lazy" allow="payment" referrerPolicy="strict-origin-when-cross-origin" />;
  }

  return <>
    <div id={containerId} className="showpass-mount" />
    <Script id="showpass-sdk" src="https://www.showpass.com/static/dist/sdk.js" strategy="lazyOnload" onReady={mountWidget} />
  </>;
}
