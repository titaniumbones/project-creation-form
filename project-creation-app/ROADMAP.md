# Roadmap 

This roadmap is incomplete and provisional. Some features may be out of scope for the current project, and future development decisions should be based on user experience & Product team's assessment of the utility of the MVP.  


## Styling: Apply gt-styles

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

Other products in our portfolio all use Typescript. this project should also be ocnverted to Typescript.  

## Use different asana templates for distinct project types

Several project types have well-developed Asana templates with additional project roles. We should:

1. ensure that there is some minimal consistency across these distinct templates
2. establish logic within the app that assigns the appropriate template
3. ensure that the template choices are part of config.toml, so that semi-technical staff can update them during development

## Add Auth0 Authentication

The app should use proper authendication based on the GTDVC authentication manager (Auth0) and the self-signup capacity we've recently released.

## Evaluate whether this can be combined with our project-tracker-app

The [Project Tracker App](https://github.com/Giving-Tuesday/project-tracker-app) uses the same Airtable data to produce a set of visualizations. It is itself under active development, but when it stabilizes as an MVP we should explore whether it can be published in a single interface with the creation helper. This could be part of a broader expansion of this app into a work tracker that ads analytics to Asana.

## Use GivingTuesday component libraries

GivingTuesday is in the process of creating a set of standard React components for use across products. As that develops, we should integrate those components as much as possible.
