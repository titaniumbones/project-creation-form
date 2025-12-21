import { useLocation, Link, Navigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import {
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

export default function Success() {
  const location = useLocation();
  const { projectName, airtableUrl, asanaUrl, driveUrl, deckUrl } = location.state || {};

  // Redirect if no project data
  if (!projectName) {
    return <Navigate to="/" replace />;
  }

  const links = [
    { label: 'Airtable Project', url: airtableUrl, icon: '📊' },
    { label: 'Asana Workspace', url: asanaUrl, icon: '✅' },
    { label: 'Google Drive Folder', url: driveUrl, icon: '📁' },
    { label: 'Kick-off Deck', url: deckUrl, icon: '📽️' },
  ].filter(link => link.url);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <CheckCircleIcon className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Project Created Successfully!
          </h1>

          <p className="text-lg text-gray-600 mb-4">
            <strong>{projectName}</strong> has been set up across all connected platforms.
          </p>
        </div>

        {/* Resource links */}
        {links.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Links</h2>
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center space-x-3">
                    <span className="text-xl">{link.icon}</span>
                    <span className="font-medium text-gray-900">{link.label}</span>
                  </span>
                  <ArrowTopRightOnSquareIcon className="w-5 h-5 text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* What was created */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h2 className="font-semibold text-blue-900 mb-3">What was created</h2>
          <ul className="text-blue-800 space-y-2 text-sm">
            <li>✓ Airtable project record with team assignments</li>
            <li>✓ Milestone records linked to the project</li>
            {asanaUrl && <li>✓ Asana project with tasks from outcomes</li>}
            {driveUrl && <li>✓ Google Drive folder structure</li>}
            {deckUrl && <li>✓ Kick-off presentation deck</li>}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="btn-primary inline-flex items-center justify-center space-x-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create Another Project</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
