const NotFound = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black-1 mb-4">404</h1>
        <p className="text-lg text-grey-2 mb-8">Page not found</p>
        <a href="/" className="text-blue-1 hover:underline">Return to Home</a>
      </div>
    </div>
  );
};

export default NotFound;

