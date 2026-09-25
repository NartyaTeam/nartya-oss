import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNetwork } from "./store.ts";

const OFFLINE_PAGES = ["/telechargements", "/watch/"];

export function OfflineRedirect() {
  const offline = useNetwork((state) => state.checked && !state.online);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!offline || OFFLINE_PAGES.some((page) => pathname.startsWith(page))) return;
    navigate("/telechargements", { replace: true });
  }, [offline, pathname, navigate]);

  return null;
}
