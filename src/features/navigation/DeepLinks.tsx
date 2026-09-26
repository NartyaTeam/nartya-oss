import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPlatform } from "../../lib/platform.ts";

export function DeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    const bridge = getPlatform()?.navigation;
    if (!bridge) return;
    const follow = (): void => {
      void bridge.take().then((route) => {
        if (route) navigate(route);
      });
    };
    follow();
    return bridge.onPending(follow);
  }, [navigate]);

  return null;
}
