import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonSpinner } from "../utils/ButtonSpinner";

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  spinnerColor?: string;
  children: ReactNode;
};

export const AuthButton = ({
  children,
  className = "",
  type = "button",
  loading = false,
  spinnerColor = "#122354",
  disabled,
  ...props
}: AuthButtonProps) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`w-full h-[52px] rounded-xl bg-yellow-1 font-inter text-base font-semibold text-blue-2 hover:brightness-95 active:brightness-90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${className}`}
    {...props}
  >
    {loading ? <ButtonSpinner color={spinnerColor} /> : children}
  </button>
);
