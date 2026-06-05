import { Outlet } from "react-router-dom";
import { useScrollToTop } from "./utils/useScrollToTop";

export function ScrollToTopLayout() {
  useScrollToTop();
  return <Outlet />;
}
