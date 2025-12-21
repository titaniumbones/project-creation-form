import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function ShareDraftModal({ isOpen, onClose, onSubmit, teamMembers, isLoading }) {
  const [selectedMember, setSelectedMember] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const modalRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMember('');
      setCustomEmail('');
      setUseCustomEmail(false);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (useCustomEmail) {
      if (!customEmail || !customEmail.includes('@')) {
        return;
      }
      onSubmit({ email: customEmail, memberId: null });
    } else {
      if (!selectedMember) {
        return;
      }
      const member = teamMembers.find((m) => m.id === selectedMember);
      // Note: We don't have email in team members, so we'll need to ask for it
      // or look it up. For now, prompt for email if not available.
      onSubmit({ memberId: selectedMember, memberName: member?.name });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Share for Approval</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-gray-600 text-sm">
            Select a team member to send this draft for approval. They will receive an email
            with a link to review and approve the project scope.
          </p>

          {/* Team Member Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Approver
            </label>
            <select
              value={selectedMember}
              onChange={(e) => {
                setSelectedMember(e.target.value);
                setUseCustomEmail(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={useCustomEmail}
            >
              <option value="">Choose a team member...</option>
              {(teamMembers || []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Custom Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={useCustomEmail}
                onChange={(e) => {
                  setUseCustomEmail(e.target.checked);
                  if (e.target.checked) {
                    setSelectedMember('');
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Enter email manually
            </label>
            {useCustomEmail && (
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="approver@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required={useCustomEmail}
              />
            )}
          </div>

          {/* Approver email input when team member selected */}
          {selectedMember && !useCustomEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approver's Email Address
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="Enter their email address"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                The approval link will be sent to this email address.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (!selectedMember && !useCustomEmail) || (selectedMember && !customEmail) || (useCustomEmail && !customEmail)}
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Send for Approval
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
