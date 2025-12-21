import { useState, useEffect, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { getCurrentUserEmail, getConnectionStatus } from '../services/oauth';
import * as drafts from '../services/drafts';
import type { DraftStatus, ConnectionStatus } from '../types';
import {
  ArrowPathIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

interface DraftItem {
  id: string;
  projectName: string;
  status: DraftStatus;
  createdAt?: string;
  approverNotes?: string;
  shareToken: string;
}

interface PendingDraftItem {
  id: string;
  projectName: string;
  status: DraftStatus;
  createdBy?: string;
  shareToken: string;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

// Status badge component
interface StatusBadgeProps {
  status: DraftStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    Draft: 'bg-gray-200 text-gray-700',
    'Pending Approval': 'bg-yellow-200 text-yellow-800',
    Approved: 'bg-green-200 text-green-800',
    'Changes Requested': 'bg-orange-200 text-orange-800',
  };

  const icons: Record<string, typeof DocumentDuplicateIcon> = {
    Draft: DocumentDuplicateIcon,
    'Pending Approval': ClockIcon,
    Approved: CheckCircleIcon,
    'Changes Requested': ChatBubbleLeftIcon,
  };

  const Icon = icons[status] || DocumentDuplicateIcon;

  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.Draft}`}>
      <Icon className="w-3 h-3" />
      <span>{status || 'Draft'}</span>
    </span>
  );
}

// Draft card component
interface DraftCardProps {
  draft: DraftItem;
  onDelete: (id: string) => Promise<void>;
  onCopyLink: (shareToken: string) => void;
}

function DraftCard({ draft, onDelete, onCopyLink }: DraftCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    setIsDeleting(true);
    try {
      await onDelete(draft.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {draft.projectName || 'Untitled Draft'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Created: {draft.createdAt ? new Date(draft.createdAt).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
        <StatusBadge status={draft.status} />
      </div>

      {/* Approver Notes */}
      {draft.approverNotes && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showNotes ? 'Hide Notes' : 'View Approver Notes'}
          </button>
          {showNotes && (
            <div className="mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{draft.approverNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/?draft=${draft.id}`}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PencilIcon className="w-4 h-4" />
          <span>Edit</span>
        </Link>

        {draft.shareToken && (
          <>
            <Link
              to={`/review/${draft.shareToken}`}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              <span>View</span>
            </Link>
            <button
              type="button"
              onClick={() => onCopyLink(draft.shareToken)}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ClipboardDocumentListIcon className="w-4 h-4" />
              <span>Copy Link</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {isDeleting ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <TrashIcon className="w-4 h-4" />
          )}
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

export default function MyDrafts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDrafts, setMyDrafts] = useState<DraftItem[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingDraftItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [message, setMessage] = useState<Message | null>(null);

  const connectionStatus: ConnectionStatus = getConnectionStatus();

  // Load drafts on mount
  useEffect(() => {
    async function loadDrafts() {
      try {
        setLoading(true);
        setError(null);

        const userEmail = await getCurrentUserEmail();
        if (!userEmail) {
          setError('Please connect to Airtable to view your drafts');
          return;
        }

        const [userDrafts, approvalDrafts] = await Promise.all([
          drafts.getUserDrafts(userEmail),
          drafts.getDraftsPendingApproval(userEmail),
        ]);

        setMyDrafts(userDrafts);
        setPendingApproval(approvalDrafts);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (connectionStatus.airtable) {
      loadDrafts();
    } else {
      setLoading(false);
      setError('Please connect to Airtable to view your drafts');
    }
  }, [connectionStatus.airtable]);

  // Handle draft deletion
  const handleDelete = async (draftId: string) => {
    try {
      await drafts.deleteDraft(draftId);
      setMyDrafts(prev => prev.filter(d => d.id !== draftId));
      setMessage({ type: 'success', text: 'Draft deleted' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  // Copy share link
  const handleCopyLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/review/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setMessage({ type: 'success', text: 'Link copied to clipboard' });
      setTimeout(() => setMessage(null), 3000);
    });
  };

  // Filter drafts
  const filteredDrafts = myDrafts.filter((draft) => {
    if (filter === 'all') return true;
    return draft.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link to="/" className="hover:text-blue-600">Home</Link>
            <span>/</span>
            <span>My Drafts</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">My Drafts</h1>
            <Link
              to="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create New Project
            </Link>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Not Connected Warning */}
        {!connectionStatus.airtable && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-medium">Not connected to Airtable</p>
              <p className="text-yellow-700 text-sm mt-1">
                <Link to="/settings" className="underline">Connect your account</Link> to view and manage your drafts.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading drafts...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Pending Approval Section */}
            {pendingApproval.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <ClockIcon className="w-5 h-5 text-yellow-600" />
                  <span>Awaiting Your Approval ({pendingApproval.length})</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingApproval.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {draft.projectName || 'Untitled Draft'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            From: {draft.createdBy}
                          </p>
                        </div>
                        <StatusBadge status={draft.status} />
                      </div>
                      <Link
                        to={`/review/${draft.shareToken}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <span>Review Draft</span>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Drafts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  My Drafts ({filteredDrafts.length})
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Filter:</span>
                  <select
                    value={filter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    <option value="all">All</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Changes Requested">Changes Requested</option>
                  </select>
                </div>
              </div>

              {filteredDrafts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <DocumentDuplicateIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {filter === 'all'
                      ? "You don't have any drafts yet."
                      : `No drafts with status "${filter}".`}
                  </p>
                  <Link
                    to="/"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Draft
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onDelete={handleDelete}
                      onCopyLink={handleCopyLink}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
