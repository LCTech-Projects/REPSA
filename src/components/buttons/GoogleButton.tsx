type GoogleButtonProps = {
  onClick?: () => void;
};

export const GoogleButton = ({ onClick }: GoogleButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-[52px] rounded-xl border border-black-4 bg-white-1 font-inter text-base font-medium text-auth-heading flex items-center justify-center gap-3 hover:bg-grey-3 transition-colors"
  >
    <img src="/images/google.png" alt="" className="w-5 h-5" />
    Continue with Google
  </button>
);
