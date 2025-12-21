import { Link } from 'react-router-dom';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PC</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">
              Project Creator
            </span>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link
              to="/settings"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="w-6 h-6" />
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
