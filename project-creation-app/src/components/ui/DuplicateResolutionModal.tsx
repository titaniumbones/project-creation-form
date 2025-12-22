import { useState, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  LinkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type {
  DuplicateCheckResult,
  DuplicateResolution,
  DuplicateDefaults,
  AirtableResolution,
  AsanaResolution,
  GoogleResolution,
} from '../../types';

interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolution: DuplicateResolution) => void;
  checkResult: DuplicateCheckResult;
  defaults: DuplicateDefaults;
  isLoading?: boolean;
  /** Whether to show the Google "recreate" option (dangerous, hidden by default) */
  allowGoogleRecreate?: boolean;
}

// Platform status types
type PlatformStatus = 'will_create' | 'duplicate_found' | 'user_provided' | 'not_connected';

interface PlatformConfig {
  status: PlatformStatus;
  url?: string;
  details?: string;
  userProvided?: boolean;
}

// Platform-specific icons
function AirtableIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function AsanaIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="6" r="4" />
      <circle cx="6" cy="18" r="4" />
      <circle cx="18" cy="18" r="4" />
    </svg>
  );
}

function GoogleDriveIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 2l8 14H0L8 2zm8 0l8 14h-8L8 2z" />
      <path d="M0 16h16l-4 6H4l-4-6z" />
    </svg>
  );
}

interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
  recommended?: boolean;
}

function RadioOption({ name, value, checked, onChange, label, description, recommended }: RadioOptionProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
      />
      <div>
        <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
          {label}
          {recommended && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
              Recommended
            </span>
          )}
        </span>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </label>
  );
}

// Simplified platform section that shows status and options
interface PlatformSectionProps {
  title: string;
  icon: React.ReactNode;
  config: PlatformConfig;
  children?: React.ReactNode;
}

function PlatformSection({ title, icon, config, children }: PlatformSectionProps) {
  const { status, url, details, userProvided } = config;

  // User provided URL - show link status
  if (status === 'user_provided') {
    return (
      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
        <div className="flex items-center gap-3">
          <div className="text-blue-600">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-blue-900">{title}</h4>
              <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full flex items-center gap-1">
                <LinkIcon className="w-3 h-3" />
                Linked
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-0.5">Using existing URL you provided</p>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Will create new (no duplicate found) - but still show skip option
  if (status === 'will_create') {
    return (
      <div className="border border-green-200 rounded-lg p-4 bg-green-50">
        <div className="flex items-start gap-3">
          <div className="text-green-600 mt-0.5">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-green-900">{title}</h4>
              <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full flex items-center gap-1">
                <PlusCircleIcon className="w-3 h-3" />
                Ready
              </span>
            </div>
            <p className="text-sm text-green-700 mt-0.5">No existing project found</p>
            {children && <div className="mt-3 space-y-2">{children}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Duplicate found - show options
  if (status === 'duplicate_found') {
    return (
      <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
        <div className="flex items-start gap-3">
          <div className="text-amber-600 mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-amber-800">{title}</h4>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">
                Match found
              </span>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  View <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              )}
            </div>
            {details && <p className="mt-1 text-sm text-amber-700">{details}</p>}
            {children && <div className="mt-3 space-y-2">{children}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Not connected
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="text-gray-400">{icon}</div>
        <div>
          <h4 className="font-medium text-gray-500">{title}</h4>
          <p className="text-sm text-gray-400">Not connected</p>
        </div>
      </div>
    </div>
  );
}

export default function DuplicateResolutionModal({
  isOpen,
  onClose,
  onConfirm,
  checkResult,
  defaults,
  isLoading = false,
  allowGoogleRecreate = false,
}: DuplicateResolutionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Resolution state
  const [airtableChoice, setAirtableChoice] = useState<AirtableResolution>(defaults.airtable);
  const [asanaChoice, setAsanaChoice] = useState<AsanaResolution>(defaults.asana);
  const [googleChoice, setGoogleChoice] = useState<GoogleResolution>(defaults.google);

  // Reset choices when modal opens or defaults change
  useEffect(() => {
    if (isOpen) {
      setAirtableChoice(defaults.airtable);
      setAsanaChoice(defaults.asana);
      setGoogleChoice(defaults.google);
    }
  }, [isOpen, defaults]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (!isLoading) onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, isLoading]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, isLoading]);

  const handleConfirm = () => {
    onConfirm({
      airtable: airtableChoice,
      asana: asanaChoice,
      google: googleChoice,
    });
  };

  if (!isOpen) return null;

  const { airtable, asana, google } = checkResult;

  // Determine platform configurations
  const airtableConfig: PlatformConfig = {
    status: airtable.found ? 'duplicate_found' : 'will_create',
    url: airtable.url,
    details: airtable.createdTime ? `Created: ${new Date(airtable.createdTime).toLocaleDateString()}` : undefined,
  };

  const asanaConfig: PlatformConfig = {
    status: (asana as { userProvided?: boolean }).userProvided
      ? 'user_provided'
      : asana.found
        ? 'duplicate_found'
        : 'will_create',
    url: asana.url,
    details: asana.project?.name ? `Project: ${asana.project.name}` : undefined,
    userProvided: (asana as { userProvided?: boolean }).userProvided,
  };

  const googleConfig: PlatformConfig = {
    status: (google as { userProvided?: boolean }).userProvided
      ? 'user_provided'
      : google.found
        ? 'duplicate_found'
        : 'will_create',
    url: google.url,
    details: google.folderName ? `Folder: ${google.folderName}` : undefined,
    userProvided: (google as { userProvided?: boolean }).userProvided,
  };

  // Count what will happen
  const willCreate = [airtableConfig, asanaConfig, googleConfig].filter(c => c.status === 'will_create').length;
  const hasMatches = [airtableConfig, asanaConfig, googleConfig].filter(c => c.status === 'duplicate_found').length;
  const hasLinked = [airtableConfig, asanaConfig, googleConfig].filter(c => c.status === 'user_provided').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${hasMatches > 0 ? 'bg-amber-500' : 'bg-blue-600'}`}>
          {hasMatches > 0 ? (
            <CheckCircleIcon className="w-6 h-6 text-white" />
          ) : (
            <PlusCircleIcon className="w-6 h-6 text-white" />
          )}
          <h2 className="text-lg font-semibold text-white flex-1">
            {hasMatches > 0 ? 'Review and Create Resources' : 'Create Resources'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-sm">
          {willCreate > 0 && (
            <span className="flex items-center gap-1.5 text-green-700">
              <PlusCircleIcon className="w-4 h-4" />
              {willCreate} to create
            </span>
          )}
          {hasMatches > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <CheckCircleIcon className="w-4 h-4" />
              {hasMatches} existing found
            </span>
          )}
          {hasLinked > 0 && (
            <span className="flex items-center gap-1.5 text-blue-700">
              <LinkIcon className="w-4 h-4" />
              {hasLinked} linked
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-gray-600 mb-6">
            {hasMatches > 0
              ? 'Existing resources were found. Choose how to handle each platform:'
              : 'Ready to create resources across all platforms:'}
          </p>

          <div className="space-y-4">
            {/* Airtable Section */}
            <PlatformSection
              title="Airtable"
              icon={<AirtableIcon />}
              config={airtableConfig}
            >
              {airtableConfig.status === 'duplicate_found' ? (
                <>
                  <RadioOption
                    name="airtable"
                    value="update"
                    checked={airtableChoice === 'update'}
                    onChange={() => setAirtableChoice('update')}
                    label="Update existing record"
                    description="Update the existing project record with new data"
                    recommended
                  />
                  <RadioOption
                    name="airtable"
                    value="create_new"
                    checked={airtableChoice === 'create_new'}
                    onChange={() => setAirtableChoice('create_new')}
                    label="Create new record"
                    description="Create a new project record alongside the existing one"
                  />
                  <RadioOption
                    name="airtable"
                    value="skip"
                    checked={airtableChoice === 'skip'}
                    onChange={() => setAirtableChoice('skip')}
                    label="Skip Airtable"
                    description="Don't create or update any Airtable records"
                  />
                </>
              ) : airtableConfig.status === 'will_create' ? (
                <>
                  <RadioOption
                    name="airtable"
                    value="create_new"
                    checked={airtableChoice === 'create_new'}
                    onChange={() => setAirtableChoice('create_new')}
                    label="Create new record"
                    description="Create project, milestones, and assignments in Airtable"
                    recommended
                  />
                  <RadioOption
                    name="airtable"
                    value="skip"
                    checked={airtableChoice === 'skip'}
                    onChange={() => setAirtableChoice('skip')}
                    label="Skip Airtable"
                    description="Don't create any Airtable records"
                  />
                </>
              ) : null}
            </PlatformSection>

            {/* Asana Section */}
            <PlatformSection
              title="Asana"
              icon={<AsanaIcon />}
              config={asanaConfig}
            >
              {asanaConfig.status === 'duplicate_found' ? (
                <>
                  <RadioOption
                    name="asana"
                    value="use_existing"
                    checked={asanaChoice === 'use_existing'}
                    onChange={() => setAsanaChoice('use_existing')}
                    label="Use existing project"
                    description="Add milestones to the existing Asana project"
                    recommended
                  />
                  <RadioOption
                    name="asana"
                    value="create_new"
                    checked={asanaChoice === 'create_new'}
                    onChange={() => setAsanaChoice('create_new')}
                    label="Create new project"
                    description="Create a new Asana project from template"
                  />
                  <RadioOption
                    name="asana"
                    value="skip"
                    checked={asanaChoice === 'skip'}
                    onChange={() => setAsanaChoice('skip')}
                    label="Skip Asana"
                    description="Don't create or update any Asana project"
                  />
                </>
              ) : asanaConfig.status === 'will_create' ? (
                <>
                  <RadioOption
                    name="asana"
                    value="create_new"
                    checked={asanaChoice === 'create_new'}
                    onChange={() => setAsanaChoice('create_new')}
                    label="Create new project"
                    description="Create Asana project from template with milestones"
                    recommended
                  />
                  <RadioOption
                    name="asana"
                    value="skip"
                    checked={asanaChoice === 'skip'}
                    onChange={() => setAsanaChoice('skip')}
                    label="Skip Asana"
                    description="Don't create any Asana project"
                  />
                </>
              ) : null}
            </PlatformSection>

            {/* Google Drive Section */}
            <PlatformSection
              title="Google Drive"
              icon={<GoogleDriveIcon />}
              config={googleConfig}
            >
              {googleConfig.status === 'duplicate_found' ? (
                <>
                  <RadioOption
                    name="google"
                    value="keep"
                    checked={googleChoice === 'keep'}
                    onChange={() => setGoogleChoice('keep')}
                    label="Keep existing documents"
                    description="Skip Google Drive creation, use existing folder"
                    recommended
                  />
                  <RadioOption
                    name="google"
                    value="skip"
                    checked={googleChoice === 'skip'}
                    onChange={() => setGoogleChoice('skip')}
                    label="Skip Google Drive"
                    description="Don't create any Google Drive resources"
                  />
                  {allowGoogleRecreate && (
                    <RadioOption
                      name="google"
                      value="recreate"
                      checked={googleChoice === 'recreate'}
                      onChange={() => setGoogleChoice('recreate')}
                      label="Delete and recreate"
                      description="Warning: Deletes existing documents"
                    />
                  )}
                </>
              ) : googleConfig.status === 'will_create' ? (
                <>
                  <RadioOption
                    name="google"
                    value="keep"
                    checked={googleChoice === 'keep'}
                    onChange={() => setGoogleChoice('keep')}
                    label="Create folder and documents"
                    description="Create project folder, scoping doc, and kickoff deck"
                    recommended
                  />
                  <RadioOption
                    name="google"
                    value="skip"
                    checked={googleChoice === 'skip'}
                    onChange={() => setGoogleChoice('skip')}
                    label="Skip Google Drive"
                    description="Don't create any Google Drive resources"
                  />
                </>
              ) : null}
            </PlatformSection>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Creating Resources...
              </>
            ) : (
              <>
                <PlusCircleIcon className="w-4 h-4" />
                Create Resources
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
