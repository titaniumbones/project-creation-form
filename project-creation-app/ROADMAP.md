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

**STATUS: Complete**

Several project types have well-developed Asana templates with additional project roles. Implementation:

1. Template mappings are configured in `src/config/integrations.toml` under `[asana.templates]`
2. Logic in `src/utils/asanaTemplates.ts` selects the appropriate template based on Project Type
3. Any project type without a specific template mapping falls back to `default_template_gid`
4. Template GIDs are configurable in the TOML config file for semi-technical staff to update

## Autodeploy this app with github actions
- deploy to prod on merge to main [do not implement yet]
- ~~deploy preview links on PR creation, and push notification of deploy link as comment to the PR~~ DONE

Deploy *only* the project creation helper app, *not* the oauth relay, as the platform oauth endpoints need a stable redirect url.

**Setup required for preview deploys:**
Add these secrets in GitHub repo Settings > Secrets and variables > Actions:
- `NETLIFY_AUTH_TOKEN` - Create at Netlify User Settings > Applications > Personal access tokens
- `NETLIFY_SITE_ID` - `4bc49778-3108-4574-9923-1712db813c89`
- `VITE_AIRTABLE_BASE_ID`, `VITE_ASANA_TEMPLATE_GID`, `VITE_ASANA_TEAM_GID`
- `VITE_GOOGLE_SHARED_DRIVE_ID`, `VITE_GOOGLE_PROJECTS_FOLDER_ID`
- `VITE_GOOGLE_SCOPING_DOC_TEMPLATE_ID`, `VITE_GOOGLE_KICKOFF_DECK_TEMPLATE_ID`  

## Add Auth0 Authentication

The app should use proper authendication based on the GTDVC authentication manager (Auth0) and the self-signup capacity we've recently released.

This gives room for additional features:

- My Projects: Page showing current user's projects
- My Milestones: Page showing current user's milestones with their status (complete, on time, delayed) 

Such features will require more careful reworkign of some existing features. 


## Evaluate whether this can be combined with our project-tracker-app

The [Project Tracker App](https://github.com/Giving-Tuesday/project-tracker-app) uses the same Airtable data to produce a set of visualizations. It is itself under active development, but when it stabilizes as an MVP we should explore whether it can be published in a single interface with the creation helper. This could be part of a broader expansion of this app into a work tracker that ads analytics to Asana.

## Use GivingTuesday component libraries

GivingTuesday is in the process of creating a set of standard React components for use across products. As that develops, we should integrate those components as much as possible.
