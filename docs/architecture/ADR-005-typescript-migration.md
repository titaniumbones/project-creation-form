# ADR-005: TypeScript Migration

**Status:** Accepted
**Date:** 2025-12-21
**Deciders:** Matt Price
**Technical Story:** Migrate project-creation-app from JavaScript/JSX to TypeScript/TSX for improved type safety and developer experience.

---

## Context and Problem Statement

The project-creation-app was originally implemented in JavaScript/JSX. As the codebase has grown to include multiple services (Airtable, Asana, Google), complex form handling, and a draft approval workflow, several challenges have emerged:

1. **Type ambiguity**: Function parameters and return types are not explicitly documented
2. **Runtime errors**: Type mismatches are only caught at runtime, not during development
3. **IDE support**: Limited autocomplete and refactoring capabilities
4. **API contracts**: Service layer interfaces are implicit, making changes risky
5. **Onboarding friction**: New developers must read implementation to understand types

---

## Decision Drivers

- **Consistency**: Other GivingTuesday products use TypeScript
- **Safety**: Prevent type-related bugs before they reach production
- **Maintainability**: Make refactoring safer and faster
- **Developer experience**: Better IDE support (autocomplete, go-to-definition)
- **Documentation**: Types serve as inline documentation
- **Incremental adoption**: Ability to migrate file-by-file without breaking the build

---

## Considered Options

### Option 1: Full TypeScript Migration with Strict Mode

Convert all files to TypeScript with `strict: true` in tsconfig.json.

**Pros:**
- Maximum type safety
- Catches more bugs at compile time
- Consistent experience across all files
- Better IDE support everywhere

**Cons:**
- Larger initial investment
- May require some type assertions for complex cases
- External libraries without types need declarations

### Option 2: Gradual Migration with Loose Mode

Use TypeScript but with relaxed settings (`strict: false`, `noImplicitAny: false`).

**Pros:**
- Faster initial migration
- Fewer required type annotations
- Can be stricter over time

**Cons:**
- Misses many type errors
- Creates false sense of security
- Technical debt accumulates

### Option 3: JSDoc Type Annotations

Keep JavaScript but add JSDoc comments for type hints.

**Pros:**
- No build step changes
- IDE support for documented functions
- Zero migration risk

**Cons:**
- Comments can drift from implementation
- Less rigorous than TypeScript
- No compile-time enforcement
- Verbose syntax

---

## Decision Outcome

**Chosen option: Option 1 - Full TypeScript Migration with Strict Mode**

TypeScript with strict mode provides the best long-term value. The codebase is small enough (21 files) to migrate in a single effort, and the team is already familiar with TypeScript from other projects.

---

## Implementation

### Configuration

Created `tsconfig.json` with strict settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Type Definitions

Created `src/types/index.ts` with shared interfaces:

| Category | Types |
|----------|-------|
| Form Data | `FormData`, `RoleAssignment`, `Outcome` |
| Team & User | `TeamMember`, `UserInfo` |
| OAuth | `TokenData`, `ConnectionStatus` |
| Drafts | `Draft`, `DraftStatus` |
| Resources | `CreatedResources` |
| API Types | `AirtableRecord`, `AsanaUser`, `GoogleFile` |
| Config | `FieldConfig`, `AirtableConfig`, `Config` |
| Debug | `DebugLog`, `DebugCategory` |

### Migration Order

Files were migrated bottom-up to avoid import errors:

1. **Services** (6 files): `debugLogger.ts`, `oauth.ts`, `airtable.ts`, `asana.ts`, `google.ts`, `drafts.ts`
2. **Config** (1 file): `config/index.ts`
3. **Hooks** (3 files): `useTeamMembers.ts`, `useConfig.ts`, `useHelpText.ts`
4. **Components** (4 files): `Header.tsx`, `HelpTooltip.tsx`, `ShareDraftModal.tsx`, `FormComponents.tsx`
5. **Pages** (5 files): `Success.tsx`, `Settings.tsx`, `MyDrafts.tsx`, `ReviewDraft.tsx`, `ProjectForm.tsx`
6. **Entry Points** (2 files): `App.tsx`, `main.tsx`

### Files Created

| File | Purpose |
|------|---------|
| `tsconfig.json` | Main TypeScript configuration |
| `tsconfig.node.json` | Node-specific config for Vite |
| `src/vite-env.d.ts` | Vite client type references |
| `src/types/index.ts` | Shared type definitions |
| `src/types/toml.d.ts` | Type declarations for TOML imports |

---

## Key Type Patterns

### React Components

```typescript
// Inferred return types (preferred)
function Header() {
  return <header>...</header>;
}

// Props interfaces
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: { message?: string };
  children: ReactNode;
}
```

### React Hook Form Integration

```typescript
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { FormData } from '../types';

interface RoleAssignmentSectionProps {
  register: UseFormRegister<FormData>;
  errors?: FieldErrors<FormData>;
  teamMembers: TeamMember[];
  disabled?: boolean;
}
```

### Service Functions

```typescript
export async function createProject(data: ProjectData): Promise<AirtableRecord> {
  // ...
}

export async function getWorkspaceUsers(workspaceGid: string): Promise<AsanaUser[]> {
  // ...
}
```

### Configuration Loading

```typescript
// TOML module declaration
declare module 'toml' {
  export function parse(input: string): unknown;
}

// Raw TOML import
declare module '*.toml?raw' {
  const content: string;
  export default content;
}
```

---

## Trade-offs and Risks

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| Build time | Slightly longer due to type checking |
| Learning curve | Team must understand TypeScript idioms |
| Flexibility | Some JavaScript patterns require explicit typing |
| Bundle size | No change (TypeScript compiles to JavaScript) |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Type assertion overuse | Code review to ensure proper typing |
| Third-party library types | Use `@types/*` packages or create declarations |
| Migration regressions | Full test pass after migration |
| Type definition maintenance | Keep types close to implementation |

---

## Verification

After migration:

1. **Type check**: `npx tsc --noEmit` passes with no errors
2. **Build**: `npm run build` succeeds
3. **Development**: `npm run dev` works correctly
4. **All functionality**: Manual testing of form, drafts, approvals

---

## Future Considerations

- **Stricter checks**: Enable additional strict options as codebase matures
- **API type generation**: Generate types from Airtable schema
- **Runtime validation**: Add Zod for runtime type validation at boundaries
- **Type coverage**: Add type coverage reporting to CI

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Vite TypeScript Support](https://vitejs.dev/guide/features.html#typescript)
