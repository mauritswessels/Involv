import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-sm">
        <p className="text-6xl font-bold text-slate-200 mb-2">404</p>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/" className="btn-primary justify-center">
            Back to home
          </Link>
          <Link to="/browse" className="btn-secondary justify-center">
            Browse opportunities
          </Link>
        </div>
      </div>
    </div>
  );
}
