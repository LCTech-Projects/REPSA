import { useEffect, useState } from "react";

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: "error" | "warning" | "info" | "success";
    title: string;
    message: string;
    details?: string;
}

export const FeedbackModal = ({
    isOpen,
    onClose,
    type,
    title,
    message,
    details
}: FeedbackModalProps) => {
    const [shouldAnimate, setShouldAnimate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Trigger animation after a brief delay
            setTimeout(() => setShouldAnimate(true), 100);
        } else {
            setShouldAnimate(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getIconColor = () => {
        switch (type) {
            case "error":
                return "text-red-500";
            case "warning":
                return "text-yellow-500";
            case "success":
                return "text-green-500";
            default:
                return "text-blue-1";
        }
    };

    const getIconBg = () => {
        switch (type) {
            case "error":
                return "bg-red-50";
            case "warning":
                return "bg-yellow-50";
            case "success":
                return "bg-green-50";
            default:
                return "bg-blue-50";
        }
    };

    const getIcon = () => {
        switch (type) {
            case "error":
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case "warning":
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case "success":
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            default:
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 pointer-events-auto transition-opacity duration-300"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className={`relative bg-white-1 rounded-[12px] shadow-xl p-6 max-w-[500px] w-full mx-4 pointer-events-auto ${shouldAnimate ? 'reveal-up' : 'opacity-0'}`}>
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                    <div className={`${getIconBg()} ${getIconColor()} p-3 rounded-full flex-shrink-0`}>
                        {getIcon()}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-[1.25rem] font-inter font-semibold text-black-1 mb-2">
                            {title}
                        </h3>
                        <p className="text-[0.875rem] font-inter text-grey-2">
                            {message}
                        </p>
                        {details && (
                            <div className="mt-3 p-3 bg-grey-1 rounded-[8px]">
                                <p className="text-[0.75rem] font-inter text-grey-2 font-mono whitespace-pre-wrap break-words">
                                    {details}
                                </p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-grey-2 hover:text-black-1 transition-colors flex-shrink-0"
                        aria-label="Close modal"
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

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-1 text-white-1 rounded-[8px] text-[0.875rem] font-inter font-medium hover:bg-blue-600 transition-colors"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

