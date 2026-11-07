import { useEffect, useState } from "react";
import { platform } from "../platform";
import { tNow } from "../store";
import { showToast } from "../toast";
import { useReport } from "./report/store";

export function useIntake(): { dragging: boolean } {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void platform
      .onFileDrop({
        hover: setDragging,
        deck: (deck) => void useReport.getState().load(deck),
        failed: () => showToast(tNow("drop.error"), "error"),
        largeMessage: (size) => tNow("drop.large", { size }),
      })
      .then((fn) => (cancelled ? fn() : (unlisten = fn)));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return { dragging };
}
