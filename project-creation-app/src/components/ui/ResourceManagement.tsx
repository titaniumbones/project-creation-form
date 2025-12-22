// Post-submission resource management component
// Allows users to link existing resources or create missing ones after initial submission

import { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import type { CreatedResources, ConnectionStatus } from '../../types';

interface ResourceConfig {
  key: keyof CreatedResources;
  urlKey: keyof CreatedResources;
  label: string;
  placeholder: string;
  urlPattern: RegExp;
  service: keyof ConnectionStatus;
  canCreate: boolean;
}

const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    key: 'airtableProjectId',
    urlKey: 'airtableUrl',
    label: 'Airtable Record',
    placeholder: 'https://airtable.com/...',
    urlPattern: /airtable\.com/,
    service: 'airtable',
    canCreate: false, // Airtable is always created first
  },
  {
    key: 'asanaProjectGid',
    urlKey: 'asanaUrl',
    label: 'Asana Project',
    placeholder: 'https://app.asana.com/...',
    urlPattern: /app\.asana\.com/,
    service: 'asana',
    canCreate: true,
  },
  {
    key: 'scopingDocId',
    urlKey: 'scopingDocUrl',
    label: 'Scoping Document',
    placeholder: 'https://docs.google.com/document/d/...',
    urlPattern: /docs\.google\.com\/document/,
    service: 'google',
    canCreate: true,
  },
  {
    key: 'kickoffDeckId',
    urlKey: 'kickoffDeckUrl',
    label: 'Kickoff Deck',
    placeholder: 'https://docs.google.com/presentation/d/...',
    urlPattern: /docs\.google\.com\/presentation/,
    service: 'google',
    canCreate: true,
  },
  {
    key: 'googleFolderId',
    urlKey: 'folderUrl',
    label: 'Google Drive Folder',
    placeholder: 'https://drive.google.com/drive/folders/...',
    urlPattern: /drive\.google\.com/,
    service: 'google',
    canCreate: true,
  },
];

interface ResourceManagementProps {
  createdResources: CreatedResources;
  connectionStatus: ConnectionStatus;
  airtableProjectId: string | undefined;
  onLinkResource: (resourceKey: keyof CreatedResources, url: string) => Promise<void>;
  onCreateResource: (resourceType: 'asana' | 'scopingDoc' | 'kickoffDeck' | 'folder') => Promise<void>;
  isLoading: boolean;
}

interface ResourceRowProps {
  config: ResourceConfig;
  url: string | undefined;
  isConnected: boolean;
  hasAirtableRecord: boolean;
  onLink: (url: string) => Promise<void>;
  onCreate: () => Promise<void>;
  isLoading: boolean;
  loadingType: string | null;
}

function ResourceRow({
  config,
  url,
  isConnected,
  hasAirtableRecord,
  onLink,
  onCreate,
  isLoading,
  loadingType,
}: ResourceRowProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasResource = !!url;
  const isThisLoading = loadingType === config.key;

  const handleSubmitLink = async () => {
    if (!linkUrl.trim()) {
      setError('Please enter a URL');
      return;
    }
    if (!config.urlPattern.test(linkUrl)) {
      setError(`Please enter a valid ${config.label} URL`);
      return;
    }

    setError(null);
    try {
      await onLink(linkUrl);
      setIsLinking(false);
      setLinkUrl('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Resource already exists
  if (hasResource) {
    return (
      <div className="flex items-center gap-3 py-2">
        <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
        <span className="text-gray-900 flex-1">{config.label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          View <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </a>
      </div>
    );
  }

  // Service not connected
  if (!isConnected) {
    return (
      <div className="flex items-center gap-3 py-2 opacity-50">
        <XCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-500 flex-1">{config.label}</span>
        <span className="text-xs text-gray-400">Not connected</span>
      </div>
    );
  }

  // Linking mode
  if (isLinking) {
    return (
      <div className="py-2 space-y-2">
        <div className="flex items-center gap-3">
          <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span className="text-gray-900">{config.label}</span>
        </div>
        <div className="ml-8 flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={config.placeholder}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handleSubmitLink}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {isLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLinking(false);
              setLinkUrl('');
              setError(null);
            }}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
        {error && <p className="ml-8 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Resource missing - show action buttons
  return (
    <div className="flex items-center gap-3 py-2">
      <XCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 flex-1">{config.label}</span>
      <div className="flex gap-2">
        {hasAirtableRecord && (
          <button
            type="button"
            onClick={() => setIsLinking(true)}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Link URL
          </button>
        )}
        {config.canCreate && hasAirtableRecord && (
          <button
            type="button"
            onClick={onCreate}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          >
            {isThisLoading ? (
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlusCircleIcon className="w-3.5 h-3.5" />
            )}
            Create Now
          </button>
        )}
      </div>
    </div>
  );
}

export default function ResourceManagement({
  createdResources,
  connectionStatus,
  airtableProjectId,
  onLinkResource,
  onCreateResource,
  isLoading,
}: ResourceManagementProps) {
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const hasAirtableRecord = !!airtableProjectId;

  // Don't show if no Airtable record exists
  if (!hasAirtableRecord) {
    return null;
  }

  // Check if all resources are created
  const allResourcesCreated = RESOURCE_CONFIGS.every(
    (config) => !!createdResources[config.urlKey] || !connectionStatus[config.service]
  );

  // Don't show if everything is complete
  if (allResourcesCreated) {
    return null;
  }

  const handleLink = async (config: ResourceConfig, url: string) => {
    setLoadingType(config.key);
    try {
      await onLinkResource(config.urlKey, url);
    } finally {
      setLoadingType(null);
    }
  };

  const handleCreate = async (config: ResourceConfig) => {
    setLoadingType(config.key);
    try {
      const typeMap: Record<string, 'asana' | 'scopingDoc' | 'kickoffDeck' | 'folder'> = {
        asanaProjectGid: 'asana',
        scopingDocId: 'scopingDoc',
        kickoffDeckId: 'kickoffDeck',
        googleFolderId: 'folder',
      };
      const resourceType = typeMap[config.key];
      if (resourceType) {
        await onCreateResource(resourceType);
      }
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h4 className="font-medium text-gray-900 mb-3">Manage Resources</h4>
      <p className="text-sm text-gray-500 mb-4">
        Link existing resources or create missing ones for this project.
      </p>
      <div className="divide-y divide-gray-200">
        {RESOURCE_CONFIGS.map((config) => (
          <ResourceRow
            key={config.key}
            config={config}
            url={createdResources[config.urlKey] as string | undefined}
            isConnected={connectionStatus[config.service]}
            hasAirtableRecord={hasAirtableRecord}
            onLink={(url) => handleLink(config, url)}
            onCreate={() => handleCreate(config)}
            isLoading={isLoading || loadingType !== null}
            loadingType={loadingType}
          />
        ))}
      </div>
    </div>
  );
}
