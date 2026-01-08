import { Link, Outlet, useLocation } from "react-router-dom";
import { MenuIcon, ProfileIcon, SwitchIcon } from "../../components/Icons";
import { useState } from "react";


const InLayout = () => {
    const [expand, setExpand] = useState<boolean>(false);
    const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
    const [isAuthenticated, _] = useState<boolean>(false);
    const location = useLocation();

    const handleMobileToggle = () => {
        setIsMobileOpen(!isMobileOpen);
    };

    return (
        <div className="flex relative">
            {/* Backdrop overlay for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={handleMobileToggle}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed top-0 left-0 bottom-0 bg-white-1 py-[20px] px-[14px] flex flex-col shadow-[4px_0_0_0_#0000000D] transition-all duration-300 ease-in-out z-50 
                ${expand ? "w-[257px] items-flex-start" : "w-[85px] items-center"}
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                <Link to="/in" className={`font-libre font-bold tracking-[2%] text-blue-1 transition-all duration-300 ${expand ? "text-[1.5rem]" : "text-[1rem]"}`}>REPSA</Link>
                <div className="mt-[55.5px] flex flex-col gap-y-[20px]" onClick={() => setIsMobileOpen(false)}>
                    <MenuIcon link="/in" img="homeMenu" label="Home" active={location.pathname === "/in"} expand={expand} />
                    <MenuIcon link="/in/simulation" img="simulationMenu" label="Simulation" active={location.pathname === "/in/simulation"} expand={expand} />
                    <MenuIcon link="/in/map" img="mapMenu" label="Map" active={location.pathname === "/in/map"} expand={expand} />
                    <MenuIcon link="/in/visualization" img="visualizationMenu" label="Visualization" active={location.pathname === "/in/visualization"} expand={expand} />
                    <MenuIcon link="/in/compare" img="compareMenu" label="Comparison" active={location.pathname === "/in/compare"} expand={expand} />
                </div>
                <div className={`mt-auto flex ${expand ? "flex-row items-center justify-between" : "gap-y-[37px] flex-col items-center"}`}>
                    {isAuthenticated ? <div>J</div> : expand ? <button className="bg-yellow-1 text-blue-2 text-[0.875rem] font-medium font-inter p-[8px] rounded-[8px] h-[36px] w-[88px] cursor-pointer">Sign in</button> : <ProfileIcon onClick={() => { }} />}
                    <SwitchIcon onClick={() => setExpand(!expand)} />
                </div>
            </div>

            {/* Floating switch button for mobile */}
            <button
                onClick={handleMobileToggle}
                className="fixed bottom-6 right-6 z-50 md:hidden bg-white-1 shadow-lg rounded-full p-3 hover:bg-grey-1 transition-colors"
                aria-label="Toggle menu"
            >
                <SwitchIcon onClick={undefined} />
            </button>

            {/* Main content */}
            <div className={`transition-all duration-300 ease-in-out w-full ${expand ? "md:w-full" : "md:w-[calc(100%-85px)] md:ml-[85px]"}`}>
                <Outlet />
            </div>
        </div>
    );
};

export default InLayout;
