import { Link } from "react-router-dom";

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-black-1 py-[60px] px-[22px]">
            <div className="max-w-[1200px] mx-auto">
                {/* Top Section */}
                <div className="flex flex-col gap-[40px] md:gap-[60px] mb-[40px]">
                    {/* Branding Section */}
                    <div className="w-full">
                        <h2 className="text-white-1 text-[2rem] font-libre font-bold mb-[12px]">REPSA</h2>
                        <p className="text-black-4 text-[0.875rem] font-inter leading-[1.25rem]">
                            A data and simulation platform helping Africa close its energy access gap
                        </p>
                    </div>

                    {/* Navigation Columns */}
                    <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-[40px] md:gap-[60px]">
                        {/* PLATFORM */}
                        <div className="flex flex-col gap-y-[16px]">
                            <h3 className="text-white-1 text-[0.875rem] font-inter font-semibold uppercase tracking-wide">PLATFORM</h3>
                            <div className="flex flex-col gap-y-[12px]">
                                <Link to="/in/home" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Home</Link>
                                <Link to="/in/map" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Explore Map</Link>
                                <Link to="/in/simulation" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Run Simulation</Link>
                                <Link to="/in/visualization" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Visualization</Link>
                                <Link to="/in/compare" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Compare Region</Link>
                            </div>
                        </div>

                        {/* RESOURCES */}
                        <div className="flex flex-col gap-y-[16px]">
                            <h3 className="text-white-1 text-[0.875rem] font-inter font-semibold uppercase tracking-wide">RESOURCES</h3>
                            <div className="flex flex-col gap-y-[12px]">
                                <Link to="/in/about" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">About REPSA</Link>
                                <Link to="/in/methodology" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Methodology</Link>
                                <Link to="/in/data-sources" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Data Sources</Link>
                                <Link to="/in/documentation" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Documentation</Link>
                                <Link to="/in/api-access" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">API Access</Link>
                                <Link to="/in/research" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Research Papers</Link>
                            </div>
                        </div>

                        {/* SUPPORT */}
                        <div className="flex flex-col gap-y-[16px]">
                            <h3 className="text-white-1 text-[0.875rem] font-inter font-semibold uppercase tracking-wide">SUPPORT</h3>
                            <div className="flex flex-col gap-y-[12px]">
                                <Link to="/in/contact" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Contact Us</Link>
                                <Link to="/in/faq" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">FAQ</Link>
                                <Link to="/in/help" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Help Center</Link>
                            </div>
                        </div>

                        {/* PARTNERS */}
                        <div className="flex flex-col gap-y-[16px]">
                            <h3 className="text-white-1 text-[0.875rem] font-inter font-semibold uppercase tracking-wide">PARTNERS</h3>
                            <div className="flex flex-col gap-y-[12px]">
                                <Link to="/in/partners" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Our Partners</Link>
                                <Link to="/in/collaborate" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Collaborate</Link>
                                <Link to="/in/sponsors" className="text-black-4 text-[0.875rem] font-inter hover:text-white-1 transition-colors">Sponsors</Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-grey-2 mb-[24px]"></div>

                {/* Bottom Section - Copyright */}
                <div>
                    <p className="text-black-4 text-[0.875rem] font-inter">© {currentYear} REPSA. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};
