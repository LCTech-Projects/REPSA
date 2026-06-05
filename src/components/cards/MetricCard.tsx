interface MetricCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon?: React.ReactNode;
    change?: {
        value: number;
        isPositive: boolean;
    };
    backgroundColor?: string;
    textColor?: string;
}

export const MetricCard = ({ 
    title, 
    value, 
    unit = "", 
    icon, 
    change,
    backgroundColor,
    textColor = "text-black-1"
}: MetricCardProps) => {
    const formatValue = (val: string | number): string => {
        if (typeof val === 'number') {
            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
            return val.toFixed(1);
        }
        return val;
    };

    const formatChange = (changeValue: number): string => {
        const sign = changeValue >= 0 ? '+' : '';
        return `${sign}${changeValue.toFixed(2)}%`;
    };

    return (
        <div 
            className={`rounded-[8px] p-4 flex-1 min-w-0 basis-[140px] ${backgroundColor || 'bg-grey-1'}`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className={`text-[0.875rem] font-inter ${backgroundColor ? 'text-white-1' : 'text-grey-2'}`}>
                    {title}
                </div>
                {icon && (
                    <div className={`${backgroundColor ? 'text-white-1' : 'text-grey-2'}`}>
                        {icon}
                    </div>
                )}
            </div>
            <div className={`text-[2rem] font-inter font-bold ${backgroundColor ? 'text-white-1' : textColor}`}>
                {formatValue(value)}{unit}
            </div>
            {change && (
                <div className={`text-[0.75rem] font-inter mt-1 ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {formatChange(change.value)}
                </div>
            )}
        </div>
    );
};

