import { useEffect, useRef } from "react";
import { GridRenderer } from "../pixi/GridRenderer.js";
import { useRunStore } from "../state/store.js";
import { subscribeLocaleChange } from "../i18n.js";

/**
 * Mounts the Pixi grid renderer inside a host div, observes the host
 * for size changes (so flex-layout shifts resize the canvas), and
 * dispatches moves via the store when the renderer reports a tap.
 */
export function GridView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GridRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let renderer: GridRenderer | null = null;
    let observer: ResizeObserver | null = null;

    GridRenderer.create(host).then((r) => {
      if (cancelled) {
        r.destroy();
        return;
      }
      renderer = r;
      rendererRef.current = r;
      r.setMoveHandler((cell) => {
        useRunStore.getState().move(cell);
      });
      const snap = useRunStore.getState();
      r.render(snap.state, snap.lastEvents);
      r.resize();

      observer = new ResizeObserver(() => {
        rendererRef.current?.resize();
      });
      observer.observe(host);
    });

    const unsub = useRunStore.subscribe((s) => {
      rendererRef.current?.render(s.state, s.lastEvents);
    });
    const unsubLocale = subscribeLocaleChange(() => {
      const snap = useRunStore.getState();
      rendererRef.current?.render(snap.state, snap.lastEvents);
    });

    return () => {
      cancelled = true;
      unsub();
      unsubLocale();
      observer?.disconnect();
      renderer?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        position: "relative",
        touchAction: "none",
        overflow: "hidden",
      }}
    />
  );
}
