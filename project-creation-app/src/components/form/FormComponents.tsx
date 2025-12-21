// Shared form components used by ProjectForm and ReviewDraft
import { ReactNode } from 'react';
import { UseFormRegister, FieldErrors, FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';
import HelpTooltip from '../ui/HelpTooltip';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { TeamMember, FormData } from '../../types';

// Form section wrapper
interface FormSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  helpFile?: string;
}

export function FormSection({ id, title, children, helpFile }: FormSectionProps) {
  return (
    <section id={id} className="form-section scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="form-section-title">{title}</h2>
        {helpFile && <HelpTooltip helpFile={helpFile} />}
      </div>
      {children}
    </section>
  );
}

// Form field wrapper
interface FormFieldProps {
  label: string;
  required?: boolean;
  helpFile?: string;
  error?: { message?: string };
  children: ReactNode;
}

export function FormField({ label, required, helpFile, error, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="form-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {helpFile && <HelpTooltip helpFile={helpFile} />}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}

// Action button component for individual steps
interface ActionButtonProps {
  label: string;
  onClick: () => void | Promise<void>;
  isLoading: boolean;
  isComplete: boolean;
  url?: string;
  disabled?: boolean;
  error?: string;
}

export function ActionButton({ label, onClick, isLoading, isComplete, url, disabled, error }: ActionButtonProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center space-x-3">
        {isComplete ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
        )}
        <span className={`font-medium ${isComplete ? 'text-green-700' : 'text-gray-700'}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center space-x-2">
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
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || isLoading}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            isComplete
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : isComplete ? (
            'Recreate'
          ) : (
            'Create'
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Role assignment list configuration
interface RoleType {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

export const ROLE_TYPES: RoleType[] = [
  { key: 'project_owner', label: 'Project Owner', required: true, description: 'Primary decision maker and accountable party' },
  { key: 'project_coordinator', label: 'Project Coordinator', required: true, description: 'Day-to-day management and coordination' },
  { key: 'technical_support', label: 'Technical Support', required: false, description: 'Technical implementation and data work' },
  { key: 'comms_support', label: 'Communications Support', required: false, description: 'External communications and stakeholder engagement' },
  { key: 'oversight', label: 'Oversight', required: false, description: 'Strategic oversight and guidance' },
  { key: 'other', label: 'Other', required: false, description: 'Additional team members' },
];

// Role assignment section component
interface RoleAssignmentSectionProps {
  register: UseFormRegister<FormData>;
  errors?: FieldErrors<FormData>;
  teamMembers: TeamMember[];
  disabled?: boolean;
}

export function RoleAssignmentSection({ register, errors, teamMembers, disabled = false }: RoleAssignmentSectionProps) {
  return (
    <div className="space-y-4">
      {ROLE_TYPES.map((role) => (
        <FormField
          key={role.key}
          label={role.label}
          required={role.required}
          error={errors?.roles?.[role.key as keyof FormData['roles']]?.memberId}
        >
          <div className="flex gap-3">
            <select
              className="form-input flex-1"
              disabled={disabled}
              {...register(`roles.${role.key as keyof FormData['roles']}.memberId`)}
            >
              <option value="">Select team member...</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="form-input w-24"
              placeholder="% FTE"
              disabled={disabled}
              {...register(`roles.${role.key as keyof FormData['roles']}.fte`)}
            />
          </div>
        </FormField>
      ))}
    </div>
  );
}

// Outcome item component
interface OutcomeItemProps {
  index: number;
  register: UseFormRegister<FormData>;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
}

export function OutcomeItem({ index, register, onRemove, canRemove, disabled = false }: OutcomeItemProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm font-medium text-gray-500">
          Outcome {index + 1}
        </span>
        {!disabled && canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <input
          type="text"
          className="form-input"
          placeholder="Outcome name"
          disabled={disabled}
          {...register(`outcomes.${index}.name`)}
        />

        <textarea
          className="form-input"
          placeholder="Brief description (optional)"
          rows={2}
          disabled={disabled}
          {...register(`outcomes.${index}.description`)}
        />

        <input
          type="date"
          className="form-input"
          disabled={disabled}
          {...register(`outcomes.${index}.dueDate`)}
        />
      </div>
    </div>
  );
}

// Outcomes section component
interface OutcomesSectionProps {
  fields: FieldArrayWithId<FormData, 'outcomes', 'id'>[];
  register: UseFormRegister<FormData>;
  append: UseFieldArrayAppend<FormData, 'outcomes'>;
  remove: UseFieldArrayRemove;
  disabled?: boolean;
}

export function OutcomesSection({ fields, register, append, remove, disabled = false }: OutcomesSectionProps) {
  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <OutcomeItem
          key={field.id}
          index={index}
          register={register}
          onRemove={() => remove(index)}
          canRemove={fields.length > 1}
          disabled={disabled}
        />
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={() => append({ name: '', description: '', dueDate: '' })}
          className="btn-secondary w-full flex items-center justify-center space-x-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Outcome</span>
        </button>
      )}
    </div>
  );
}

// Default form values
export const DEFAULT_FORM_VALUES: FormData = {
  projectName: '',
  projectAcronym: '',
  startDate: '',
  endDate: '',
  description: '',
  objectives: '',
  roles: {
    project_owner: { memberId: '', fte: '' },
    project_coordinator: { memberId: '', fte: '' },
    technical_support: { memberId: '', fte: '' },
    comms_support: { memberId: '', fte: '' },
    oversight: { memberId: '', fte: '' },
    other: { memberId: '', fte: '' },
  },
  outcomes: [{ name: '', description: '', dueDate: '' }],
  funder: '',
  parentInitiative: '',
  projectType: '',
};
