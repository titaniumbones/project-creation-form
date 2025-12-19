import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  startOAuthFlow,
  disconnectService,
  getConnectionStatus,
} from '../services/oauth';

// Service configuration
const services = [
  {
    key: 'airtable',
    name: 'Airtable',
    description: 'Required for team member data and project records',
    icon: '📊',
    required: true,
  },
  {
    key: 'asana',
    name: 'Asana',
    description: 'Creates project workspace with tasks and milestones',
    icon: '✅',
    required: false,
  },
  {
    key: 'google',
    name: 'Google Workspace',
    description: 'Generates scoping documents and presentation decks',
    icon: '📁',
    required: false,
  },
];

function ServiceCard({ service, isConnected, onConnect, onDisconnect, isLoading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="text-3xl">{service.icon}</div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {service.name}
              {service.required && (
                <span className="ml-2 text-xs font-medium text-red-500">Required</span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{service.description}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <span className="flex items-center text-sm text-green-600">
                <CheckCircleIcon className="w-5 h-5 mr-1" />
                Connected
              </span>
              <button
                onClick={onDisconnect}
                className="btn-secondary text-sm px-3 py-1"
                disabled={isLoading}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center text-sm text-gray-500">
                <XCircleIcon className="w-5 h-5 mr-1" />
                Not connected
              </span>
              <button
                onClick={onConnect}
                className="btn-primary text-sm px-3 py-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  'Connect'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus);
  const [loadingService, setLoadingService] = useState(null);
  const [error, setError] = useState(null);

  const handleConnect = async (serviceKey) => {
    setLoadingService(serviceKey);
    setError(null);

    try {
      await startOAuthFlow(serviceKey);
      setConnectionStatus(getConnectionStatus());
    } catch (err) {
      setError(`Failed to connect to ${serviceKey}: ${err.message}`);
    } finally {
      setLoadingService(null);
    }
  };

  const handleDisconnect = (serviceKey) => {
    disconnectService(serviceKey);
    setConnectionStatus(getConnectionStatus());
  };

  const connectedCount = Object.values(connectionStatus).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back to form
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">
            Connect your accounts to enable project creation across all platforms.
          </p>
        </div>

        {/* Connection summary */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800">
            <strong>{connectedCount}</strong> of {services.length} services connected
            {connectedCount === services.length && (
              <span className="ml-2 text-green-600">✓ All set!</span>
            )}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Service cards */}
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceCard
              key={service.key}
              service={service}
              isConnected={connectionStatus[service.key]}
              onConnect={() => handleConnect(service.key)}
              onDisconnect={() => handleDisconnect(service.key)}
              isLoading={loadingService === service.key}
            />
          ))}
        </div>

        {/* Help text */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">About Connections</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              • <strong>Airtable</strong> is required to load team members and create project records
            </li>
            <li>
              • <strong>Asana</strong> creates a project workspace with tasks mapped from outcomes
            </li>
            <li>
              • <strong>Google Workspace</strong> generates scoping documents and kick-off decks from templates
            </li>
            <li>
              • Your credentials are stored locally in your browser and never sent to our servers
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
