import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type AuthLinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
};

export const AuthLink = ({ to, children, className = "" }: AuthLinkProps) => (
  <Link
    to={to}
    className={`font-inter text-sm font-medium leading-5 tracking-[0.001em] text-blue-2 hover:underline ${className}`}
  >
    {children}
  </Link>
);
