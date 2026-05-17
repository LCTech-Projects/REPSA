import { Link, Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-white-1 flex flex-col items-center px-4 py-10 md:justify-center md:py-12">
      <div className="w-full max-w-[373px] flex flex-col items-center">
        <Link
          to="/in"
          aria-label="REPSA"
          className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity"
        >
          <img
            src="/images/logo.png"
            alt=""
            className="h-12 w-12 object-contain object-top shrink-0"
          />
          <span className="font-libre font-bold tracking-[2%] text-blue-1 text-[3rem] leading-none">
            REPSA
          </span>
        </Link>

        <div className="w-full flex flex-col items-center">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
