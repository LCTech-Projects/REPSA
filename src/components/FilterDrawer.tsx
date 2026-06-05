import { FilterField } from "./inputs/FilterField";

interface FilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    availableYears: number[];
    selectedYear: number | null;
    onYearChange: (year: number | null) => void;
}

export const FilterDrawer = ({ isOpen, onClose, availableYears, selectedYear, onYearChange }: FilterDrawerProps) => {
    const yearOptions = availableYears.map(year => year.toString()).reverse(); // Latest first

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`fixed top-0 left-0 h-full w-[320px] bg-white-1 shadow-xl z-[60] transform transition-transform duration-300 ease-in-out overflow-y-auto ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[1.125rem] font-inter font-semibold text-black-1">
                            Filter and Control
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-grey-2 hover:text-black-1 transition-colors"
                            aria-label="Close filter"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path
                                    d="M15 5L5 15M5 5L15 15"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Filter Fields */}
                    <div className="flex flex-col gap-6">
                        <FilterField
                            label="Year"
                            placeholder={selectedYear ? selectedYear.toString() : "Select Year"}
                            options={yearOptions}
                            selectedValue={selectedYear ? selectedYear.toString() : null}
                            onValueChange={(value) => {
                                const year = value ? parseInt(value, 10) : null;
                                onYearChange(year);
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

