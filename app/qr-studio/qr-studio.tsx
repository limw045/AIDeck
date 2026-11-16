"use client";

import { useEffect, useRef } from "react";

export function QRStudio({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = frameRef.current!;
    let resize: ResizeObserver | undefined;
    let resizeFrame = 0;
    function syncTheme() {
      const editor = frame.contentDocument;
      if (!editor?.body) return;
      const styles = getComputedStyle(document.documentElement);
      for (const property of styles) {
        if (property.startsWith("--")) editor.documentElement.style.setProperty(property, styles.getPropertyValue(property));
      }
      editor.documentElement.dataset.theme = document.documentElement.dataset.theme;
      editor.body.style.fontFamily = getComputedStyle(document.body).fontFamily;
      for (const font of document.fonts) editor.fonts.add(font);
    }
    function ready() {
      resize?.disconnect();
      syncTheme();
      const body = frame.contentDocument?.body;
      if (!body) return;
      resize = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          const height = `${Math.ceil(body.getBoundingClientRect().height)}px`;
          if (frame.style.height !== height) frame.style.height = height;
        });
      });
      resize.observe(body);
    }
    frame.addEventListener("load", ready);
    const theme = new MutationObserver(syncTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (frame.contentDocument?.readyState === "complete") ready();
    return () => { frame.removeEventListener("load", ready); resize?.disconnect(); cancelAnimationFrame(resizeFrame); theme.disconnect(); };
  }, []);
  return <iframe ref={frameRef} title="QR Studio editor and preview" className="qr-studio-frame" srcDoc={html} />;
}
