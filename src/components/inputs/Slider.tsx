import { useState, useEffect } from "react";

interface SliderProps {
    label: string;
    icon?: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step?: number;
    formatValue?: (value: number) => string;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export const Slider = ({
    label,
    icon,
    value,
    min,
    max,
    step = 1,
    formatValue,
    onChange,
    disabled = false,
}: SliderProps) => {
    const [localValue, setLocalValue] = useState(value);
    const percentage = ((localValue - min) / (max - min)) * 100;

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        setLocalValue(newValue);
        onChange(newValue);
    };

    const displayValue = formatValue ? formatValue(localValue) : localValue.toString();

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {icon && <div className="w-5 h-5">{icon}</div>}
                    <span className="text-[0.875rem] font-inter text-black-1">{label}</span>
                </div>
                <div className="bg-grey-1 rounded-[8px] px-3 py-1">
                    <span className="text-[0.875rem] font-inter text-black-1 font-medium">
                        {displayValue}
                    </span>
                </div>
            </div>
            <div className="relative">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={handleChange}
                    disabled={disabled}
                    className="w-full h-2 bg-grey-1 rounded-lg appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #1E3A8A 0%, #1E3A8A ${percentage}%, #E5E7EB ${percentage}%, #E5E7EB 100%)`,
                    }}
                />
            </div>
        </div>
    );
};

