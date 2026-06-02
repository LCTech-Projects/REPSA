import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import { getEmailInitial } from "./utils/userInitial";
import { ConfirmLogoutModal } from "./modals/ConfirmLogoutModal";
import { ProfileMenuModal } from "./modals/ProfileMenuModal";

type SidebarProfileProps = {
  expand: boolean;
};

export const SidebarProfile = ({ expand }: SidebarProfileProps) => {
  const { userEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const email = userEmail ?? "";
  const initial = getEmailInitial(email);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const handleConfirmLogout = () => {
    signOut();
    setConfirmOpen(false);
    setMenuOpen(false);
    navigate("/in");
  };

  if (!email) return null;

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Account menu"
          className="h-10 w-10 rounded-full bg-grey-2 flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="font-inter text-sm font-semibold text-white-1">
            {initial}
          </span>
        </button>

        {menuOpen && (
          <ProfileMenuModal
            email={email}
            expand={expand}
            onLogoutClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          />
        )}
      </div>

      {confirmOpen &&
        createPortal(
          <ConfirmLogoutModal
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={handleConfirmLogout}
          />,
          document.body,
        )}
    </>
  );
};
