import { AuthLink } from "../AuthLink";

type AuthFooterProps = {
  backTo?: string;
  backLabel?: string;
  prompt?: string;
  actionLabel?: string;
  actionTo?: string;
  showTerms?: boolean;
};

export const AuthFooter = ({
  backTo,
  backLabel = "Back to Sign in",
  prompt,
  actionLabel,
  actionTo,
  showTerms = false,
}: AuthFooterProps) => (
  <div className="mt-6 w-full flex flex-col items-center gap-4 text-center">
    {backTo && <AuthLink to={backTo}>{backLabel}</AuthLink>}
    {showTerms && (
      <p className="font-inter text-xs leading-5 text-black-3">
        By continuing, you agree to our{" "}
        <a href="#" className="text-blue-2 hover:underline">
          Terms and Conditions
        </a>{" "}
        and{" "}
        <a href="#" className="text-blue-2 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    )}
    {prompt && actionTo && actionLabel && (
      <p className="font-inter text-sm font-medium text-auth-heading">
        {prompt}{" "}
        <AuthLink to={actionTo} className="inline">
          {actionLabel}
        </AuthLink>
      </p>
    )}
  </div>
);
