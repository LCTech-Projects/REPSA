import { Link } from "react-router-dom";

export const MenuIcon = ({
  link,
  img,
  label,
  active,
  expand,
}: {
  link: string;
  img: string;
  label: string;
  active: boolean;
  expand: boolean;
}) => (
  <Link
    to={link}
    className={`flex items-center gap-[10px] cursor-pointer relative group`}
  >
    <div
      className={`h-[40px] w-[40px] flex items-center justify-center rounded-[5px] ${active ? "bg-grey-1" : "bg-white-1"}`}
    >
      <img src={`/images/${img}.png`} alt="" />
    </div>
    {expand && (
      <span className="font-inter font-medium text-[1rem]">{label}</span>
    )}
    {!expand && (
      <div className="absolute left-full ml-2 px-3 py-2 bg-black-1 text-white-1 text-[0.875rem] font-inter rounded-[8px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-[100] pointer-events-none">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black-1"></div>
      </div>
    )}
  </Link>
);

export const SwitchIcon = ({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLImageElement> | undefined;
}) => {
  return (
    <img
      src="/images/switch.png"
      alt=""
      onClick={onClick}
      className="cursor-pointer"
    />
  );
};

export const ProfileIcon = ({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLImageElement> | undefined;
}) => {
  return (
    <img
      src="/images/profile.png"
      alt=""
      onClick={onClick}
      className="cursor-pointer"
    />
  );
};

export const WorldIcon = () => {
  return <img src="/images/world.png" alt="" className="cursor-pointer" />;
};

export const ArrowBlueIcon = ({ extraClass }: { extraClass?: string }) => {
  return (
    <img
      src="/images/arrowBlue.png"
      alt=""
      className={`cursor-pointer ${extraClass}`}
    />
  );
};

export const ArrowBlackIcon = ({ extraClass }: { extraClass?: string }) => {
  return (
    <img
      src="/images/arrowBlack.png"
      alt=""
      className={`cursor-pointer ${extraClass}`}
    />
  );
};

export const SearchIcon = () => {
  return <img src="/images/search.png" alt="" className={`cursor-pointer `} />;
};

export const ExternalLinkIcon = () => {
  return (
    <img
      src="/images/externalLink.png"
      alt=""
      className="cursor-pointer w-[18px] h-[18px]"
    />
  );
};

export const SelectIcon = () => {
  return (
    <img
      src="/images/select.png"
      alt=""
      className="cursor-pointer w-[18px] h-[18px]"
    />
  );
};

export const LightIcon = () => {
  return (
    <img
      src="/images/light.png"
      alt=""
      className="cursor-pointer w-[35px] h-[35px]"
    />
  );
};
