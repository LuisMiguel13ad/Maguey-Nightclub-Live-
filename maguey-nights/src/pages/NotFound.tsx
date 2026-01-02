import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center px-4">
        <h1 className="mb-4 text-8xl font-bold text-amber-500">404</h1>
        <p className="mb-6 text-2xl text-white">Page not found</p>
        <p className="mb-8 text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block px-8 py-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
