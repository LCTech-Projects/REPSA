import { SelectIcon } from "../Icons";
import { useState, useEffect, useRef } from "react";

interface FilterFieldProps {
    label: string;
    placeholder: string;
    options?: string[];
    selectedValue?: string | null;
    onValueChange?: (value: string | null) => void;
}

export const FilterField = ({ label, placeholder, options = [], selectedValue: controlledValue, onValueChange }: FilterFieldProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Use controlled value if provided, otherwise use internal state
    const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;
    const setSelectedValue = (value: string | null) => {
        if (onValueChange) {
            onValueChange(value);
        } else {
            setInternalValue(value);
        }
    };

    // Sync internal state when controlled value changes
    useEffect(() => {
        if (controlledValue !== undefined) {
            // Controlled mode - don't update internal state
        } else {
            // Uncontrolled mode - internal state is already managed
        }
    }, [controlledValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="w-full">
            <label className="text-[0.875rem] font-inter text-grey-2 mb-[8px] block">{label}</label>
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-white-1 border border-grey-1 rounded-[8px] px-4 py-3 flex items-center justify-between text-[0.875rem] font-inter text-black-1 hover:border-grey-2 transition-colors"
                >
                    <span className={selectedValue ? "text-black-1" : "text-grey-2"}>
                        {selectedValue || placeholder}
                    </span>
                    <SelectIcon />
                </button>
                {isOpen && options.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white-1 border border-grey-1 rounded-[8px] shadow-lg z-50 max-h-[200px] overflow-y-auto">
                        {options.map((option, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedValue(option);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2 text-left text-[0.875rem] font-inter hover:bg-grey-1 transition-colors ${
                                    selectedValue === option ? 'bg-grey-1 text-black-1 font-semibold' : 'text-black-1'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

