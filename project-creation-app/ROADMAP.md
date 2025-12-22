# Roadmap 

This roadmap is incomplete and provisional. Some features may be out of scope for the current project, and future development decisions should be based on user experience & Product team's assessment of the utility of the MVP.  


## Styling: Apply gt-styles

**On hold pending resolution of [gt-styles #1](https://github.com/Giving-Tuesday/gt-styles/issues/1)**

GivingTuesday maintains a stylesheet for both SASS and tailwind projects at https://github.com/Giving-Tuesday/gt-styles. it can be installed with 

``` shell
:npm install github:givingtuesday/gt-styles
```

and added to tailwind projects with 

``` css
@import "gt-styles/tailwind/theme";
@import "gt-styles/tailwind/utilities";
```

It should be relatively easy to add this to our project.


## Convert to Typescript

**STATUS: Complete in PR** 

Other products in our portfolio all use Typescript. this project should also be ocnverted to Typescript.  

## Add New fields

**STATUS: Complete**

Airtable contains the following fields that we do not yet use:

- Funder: choose from a list of possible funders
- Parent Initiative: If this project is part of a larger initiative, indicate so here.  This helps us to bundle projects & is a prerequisite for identifying asana templates
- Project Type: Also useful for choosing asana templates, and may eventually require slight differneces i nthe form (not yet though)

We need those fields in order to implement the next step, below. 


## Use different asana templates for distinct project types

**STATUS: Implemented in Code in PR #6, but project-specific templates have not been specified in `config.toml`**

Several project types have well-developed Asana templates with additional project roles. Implementation:

1. Template mappings are configured in `src/config/integrations.toml` under `[asana.templates]`
2. Logic in `src/utils/asanaTemplates.ts` selects the appropriate template based on Project Type
3. Any project type without a specific template mapping falls back to `default_template_gid`
4. Template GIDs are configurable in the TOML config file for semi-technical staff to update

## Autodeploy this app
- deploy to prod on merge to main [do not implement yet]
- ~~deploy preview links on PR creation~~ DONE (via Netlify native GitHub integration)

Deploy *only* the project creation helper app, *not* the oauth relay, as the platform oauth endpoints need a stable redirect url.

**How it works:** Netlify's native GitHub integration automatically creates deploy previews for PRs. The root `netlify.toml` configures `base = "project-creation-app"` for monorepo support. Environment variables are configured in Netlify site settings (sync with `npm run env:sync:execute`).  

## Manage Duplicates

This project needs an explicit strategy for managing duplicates.  It is always possible, when interacting  with any of the three services, that some version of the project already exists in that form:
- in Airtable, if a a Project with the same `Name` exists, it may be a duplicate or the name may already be "taken".
- in Asana, the same is true: if an Asana Project with the same name exists, it may be an existing board for this project
- in Google docs, if the Project Folder exists and there is a document or slide deck with the expected name, that document is likely to be a duplicate of this one.  

What's required here is:

1. a way to check for existing duplicate projects in the three platforms before pushing
2. a UI for presenting possible duplicates
3. default and non-default choices for each platform, eg:
   a. Airtable:  Default behaviour may be updating the existing record & reusing the existing staff Assignments and Milestones, with an option to create new records for all of the above
   b. Asana: Default behaviour is probably using the existing Asana Project and updating existing milestones that match certain criteria, or creating new ones if they don't; creating a new project should be the non-default option  
   c. Google Docs: Default behaviour is likely leaving the docs as is; a non-default option is to delete the existing docs and create new ones, but this should not be exposed to users until we are sure it works.  
   
In all the above cases, there are difficult UI questions and likely tradeoffs. 

If this is implemented, it will definitely require an ADR, and before  beginning work, a draft ADR should be checked in as a vehicle for discussion.  

## Move all resource creation behind the modal, and add Scoping Doc and Asana Board fields to form

It is still too easy to create duplicates with this form. Proposal:
- near the top of the form, offer to populate from an existing Airtable record. User can enter a URL or search for a partial match. If a match is found, user is offered the chance to populate from that match. Show a preview in a new modal.

If populating from an existing record, remember that fact & during submission, default to updating that record. But also: Move the resource creation buttons into the modal. That is:

- Rename "Check For Duplicates" to "Submit and Check".
- Within the modal, perform checks as before. If links to Scoping Doc or Asana Board have already been provided, check to see that they refer to real docs/boards.
- For each resource, offer a set of radio button options as before. Ensure each of them includes a "do nothing" (or similar) option.
- This UI should replace the existing resource creation buttons, which should no longer be accessible directly from the form until after submission. At that point, they should appear at the bottom of the page, and should include the "link" and "recreate" buttons as they do right now.

Deploy *only* the project creation helper app, *not* the oauth relay, as the platform oauth endpoints need a stable redirect url.

**How it works:** Netlify's native GitHub integration automatically creates deploy previews for PRs. The root `netlify.toml` configures `base = "project-creation-app"` for monorepo support. Environment variables are configured in Netlify site settings (sync with `npm run env:sync:execute`).  

## Add Auth0 Authentication

**Status: TODO**

The app should use proper authentication based on the GTDVC authentication manager (Auth0) and the self-signup capacity we've recently released.

This gives room for additional features:

- My Projects: Page showing current user's projects
- My Milestones: Page showing current user's milestones with their status (complete, on time, delayed) 

Such features will require more careful reworkign of some existing features. 


## Evaluate whether this can be combined with our project-tracker-app

**Status: Blocked**

The [Project Tracker App](https://github.com/Giving-Tuesday/project-tracker-app) uses the same Airtable data to produce a set of visualizations. It is itself under active development, but when it stabilizes as an MVP we should explore whether it can be published in a single interface with the creation helper. This could be part of a broader expansion of this app into a work tracker that ads analytics to Asana.

## Use GivingTuesday component libraries

**Status: Blocked**

GivingTuesday is in the process of creating a set of standard React components for use across products. As that develops, we should integrate those components as much as possible.
