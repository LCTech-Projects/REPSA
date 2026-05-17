import { getEmailInitial } from "../Utils/userInitial";

type ProfileMenuModalProps = {
  email: string;
  onLogoutClick: () => void;
  expand: boolean;
};

export const ProfileMenuModal = ({
  email,
  onLogoutClick,
  expand,
}: ProfileMenuModalProps) => (
  <div
    role="menu"
    className={`absolute z-[60] w-[260px] rounded-xl border border-black-4 bg-white-1 shadow-lg overflow-hidden ${
      expand ? "bottom-full left-0 mb-2" : "bottom-0 left-full ml-2"
    }`}
  >
    <div className="flex items-center gap-3 px-4 py-3 border-b border-grey-1">
      <div className="h-9 w-9 shrink-0 rounded-full bg-grey-2 flex items-center justify-center">
        <span className="font-inter text-sm font-semibold text-white-1">
          {getEmailInitial(email)}
        </span>
      </div>
      <p className="font-inter text-sm font-medium text-black-1 break-all leading-snug">
        {email}
      </p>
    </div>

    <div className="p-2">
      <button
        type="button"
        role="menuitem"
        onClick={onLogoutClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-inter text-sm font-medium text-black-1 hover:bg-grey-1 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 text-black-3"
          aria-hidden
        >
          <path
            d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 17L21 12L16 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Log out
      </button>
    </div>
  </div>
);

