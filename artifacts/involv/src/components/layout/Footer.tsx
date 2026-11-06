import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-blue-900 font-bold text-base">Involv</span>
              <span className="text-xs text-slate-400">involv.me</span>
            </div>
            <p className="text-xs text-slate-500 max-w-xs">
              A better way to organise service learning. Connecting students with meaningful opportunities.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Platform</p>
              <div className="flex flex-col gap-1.5">
                <Link to="/browse" className="text-xs text-slate-500 hover:text-slate-900">Browse opportunities</Link>
                <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900">Sign in</Link>
                <Link to="/create" className="text-xs text-slate-500 hover:text-slate-900">Post an opportunity</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Categories</p>
              <div className="flex flex-col gap-1.5">
                <Link to="/browse?category=Sustainability%20%26%20Environment" className="text-xs text-slate-500 hover:text-slate-900">Environment</Link>
                <Link to="/browse?category=Education%20%26%20Mentorship" className="text-xs text-slate-500 hover:text-slate-900">Education</Link>
                <Link to="/browse?category=Community%20%26%20Social%20Impact" className="text-xs text-slate-500 hover:text-slate-900">Community</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-400">
            © 2026 Involv. For school use only.
          </p>
          <p className="text-xs text-slate-400">
            A student-built platform for service learning.
          </p>
        </div>
      </div>
    </footer>
  );
}
