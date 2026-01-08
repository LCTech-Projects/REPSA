import { ReactNode } from "react";

interface ChartCardProps {
    title: string;
    children: ReactNode;
    className?: string;
    fullWidth?: boolean;
}

export const ChartCard = ({ 
    title, 
    children, 
    className = "",
    fullWidth = false
}: ChartCardProps) => {
    return (
        <div 
            className={`bg-white-1 border border-grey-1 rounded-[8px] p-4 ${fullWidth ? 'w-full' : 'flex-1 min-w-[500px]'} ${className}`}
        >
            <h3 className="text-[0.875rem] font-inter font-semibold text-black-1 mb-4">
                {title}
            </h3>
            <div className="w-full">
                {children}
            </div>
        </div>
    );
};

