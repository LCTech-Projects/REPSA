import { Link, Outlet, useLocation } from "react-router-dom";
import { HiArrowDownTray } from "react-icons/hi2";
import { MenuIcon, SwitchIcon } from "../../components/Icons";
import { SidebarProfile } from "../../components/SidebarProfile";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  SidebarContext,
} from "../../app/SidebarContext";

const InLayout = () => {
  const [expand, setExpand] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const sidebarWidth = expand ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  useEffect(() => {
    if (!expand) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sidebarRef.current?.contains(target)) return;
      if ((target as Element).closest?.('[role="dialog"]')) return;
      setExpand(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expand]);

  return (
    <SidebarContext.Provider value={{ expanded: expand, width: sidebarWidth }}>
      <div className="flex relative min-h-screen">
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={handleMobileToggle}
          />
        )}

        <div
          ref={sidebarRef}
          className={`fixed top-0 left-0 bottom-0 bg-white-1 py-[20px] px-[14px] flex flex-col shadow-[4px_0_12px_0_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out z-[100] overflow-visible ${expand ? "w-[257px] items-flex-start" : "w-[85px] items-center"
            } ${isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
            }`}
        >
          <Link
            to="/in/map"
            aria-label="REPSA"
            className={`flex shrink-0 items-center transition-all duration-300 ${expand ? "gap-2 justify-start" : "justify-center w-full"}`}
          >
            <img
              src="/images/logo.png"
              alt=""
              className="h-10 w-10 object-contain object-top shrink-0"
            />
            {expand && (
              <span className="font-libre font-bold tracking-[2%] text-blue-1 text-[1.5rem] leading-none whitespace-nowrap">
                REPSA
              </span>
            )}
          </Link>

          <div
            className="mt-[55.5px] flex flex-col gap-y-[20px] overflow-visible"
            onClick={() => setIsMobileOpen(false)}
          >
            <MenuIcon
              link="/in/home"
              img="homeMenu"
              label="Home"
              active={location.pathname === "/in/home"}
              expand={expand}
            />
            <MenuIcon
              link="/in/map"
              img="mapMenu"
              label="Map"
              active={location.pathname === "/in/map"}
              expand={expand}
            />
            <MenuIcon
              link="/in/simulation"
              img="simulationMenu"
              label="Simulation"
              active={location.pathname === "/in/simulation"}
              expand={expand}
            />
            <MenuIcon
              link="/in/visualization"
              img="visualizationMenu"
              label="Visualization"
              active={location.pathname === "/in/visualization"}
              expand={expand}
            />
            <MenuIcon
              link="/in/compare"
              img="compareMenu"
              label="Comparison"
              active={location.pathname === "/in/compare"}
              expand={expand}
            />
            <MenuIcon
              link="/in/download-data"
              label="Download Data"
              active={location.pathname === "/in/download-data"}
              expand={expand}
              icon={
                <HiArrowDownTray
                  className="size-5 text-grey-2"
                  strokeWidth={1}
                  aria-hidden
                />
              }
            />
          </div>

          <div
            className={`mt-auto flex overflow-visible ${expand ? "flex-row items-center justify-between" : "gap-y-[37px] flex-col items-center"}`}
          >
            {isAuthenticated ? (
              <SidebarProfile expand={expand} />
            ) : expand ? (
              <Link
                to="/sign-in"
                className="bg-yellow-1 text-blue-2 text-[0.875rem] font-medium font-inter p-[8px] rounded-[8px] h-[36px] w-[88px] cursor-pointer flex items-center justify-center"
              >
                Sign in
              </Link>
            ) : null}
            <SwitchIcon onClick={() => setExpand(!expand)} />
          </div>
        </div>

        <button
          onClick={handleMobileToggle}
          className="fixed bottom-6 right-6 z-[90] md:hidden bg-white-1 shadow-lg rounded-full p-3 hover:bg-grey-1 transition-colors"
          aria-label="Toggle menu"
        >
          <SwitchIcon onClick={undefined} />
        </button>

        <div
          className={`flex-1 min-w-0 pb-20 md:pb-0 md:ml-[85px] transition-all duration-300 ease-in-out`}
        >
          <Outlet />
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default InLayout;
