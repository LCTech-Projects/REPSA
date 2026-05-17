import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { DownloadFormat } from "../../app/authNavigation";

type SignInRequiredModalProps = {
  isOpen: boolean;
  onClose: () => void;
  returnPath?: string;
  pendingDownloadFormat?: DownloadFormat | null;
};

export const SignInRequiredModal = ({
  isOpen,
  onClose,
  returnPath,
  pendingDownloadFormat = null,
}: SignInRequiredModalProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  const handleSignIn = () => {
    const from = returnPath ?? `${location.pathname}${location.search}`;
    onClose();
    navigate("/sign-in", {
      state: { from, pendingDownloadFormat: pendingDownloadFormat ?? undefined },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-required-title"
        className="relative w-full max-w-[400px] rounded-xl bg-white-1 border border-black-4 shadow-xl p-6"
      >
        <h2
          id="sign-in-required-title"
          className="font-inter text-xl font-semibold text-auth-heading mb-2"
        >
          Sign in required
        </h2>
        <p className="font-inter text-sm text-black-3 mb-6">
          Please sign in to access data.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-grey-2 font-inter text-sm font-medium text-black-1 hover:bg-grey-1 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            className="px-4 py-2 rounded-lg bg-blue-1 font-inter text-sm font-medium text-white-1 hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
