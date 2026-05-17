type ConfirmLogoutModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const ConfirmLogoutModal = ({
  isOpen,
  onClose,
  onConfirm,
}: ConfirmLogoutModalProps) => {
  if (!isOpen) return null;

  return (
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
        aria-labelledby="logout-dialog-title"
        className="relative w-full max-w-[400px] rounded-xl bg-white-1 border border-black-4 shadow-xl p-6"
      >
        <h2
          id="logout-dialog-title"
          className="font-inter text-xl font-semibold text-auth-heading mb-2"
        >
          Log out?
        </h2>
        <p className="font-inter text-sm text-black-3 mb-6">
          You will need to sign in again to access your account.
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
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-[#DC2626] font-inter text-sm font-medium text-white-1 hover:bg-[#B91C1C] transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};
