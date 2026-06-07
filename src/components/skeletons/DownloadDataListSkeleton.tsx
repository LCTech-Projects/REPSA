type DownloadDataListSkeletonProps = {
  rows?: number;
};

const pulse = "animate-pulse rounded-md bg-grey-1";

export const DownloadDataListSkeleton = ({
  rows = 8,
}: DownloadDataListSkeletonProps) => (
  <ul
    aria-busy="true"
    aria-label="Loading available downloads"
    className="mt-6 divide-y divide-grey-1 border border-grey-1 rounded-xl overflow-hidden bg-white-1"
  >
    {Array.from({ length: rows }, (_, index) => (
      <li key={index} className="flex items-center gap-3 px-4 py-3">
        <div aria-hidden className={`size-8 shrink-0 rounded ${pulse}`} />
        <span className="flex-1 min-w-0 space-y-2">
          <div aria-hidden className={`h-4 w-[45%] max-w-[180px] ${pulse}`} />
          <div aria-hidden className={`h-3.5 w-[30%] max-w-[120px] ${pulse}`} />
        </span>
        <div aria-hidden className={`h-4 w-24 shrink-0 ${pulse}`} />
      </li>
    ))}
  </ul>
);
