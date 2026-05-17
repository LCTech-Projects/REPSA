const NotFound = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black-1 mb-4">404</h1>
        <p className="text-lg text-grey-2 mb-8">Page not found</p>
        <a href="/sign-in" className="text-blue-2 hover:underline">Return to Sign in</a>
      </div>
    </div>
  );
};

export default NotFound;

