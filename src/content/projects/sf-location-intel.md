---
title: SF Location Intel
summary: "Permits, incidents and new businesses for one street. Hackathon build for a newsroom."
metaDescription: "A hackathon prototype for a nonprofit newsroom: San Francisco open data about a street in one view, plus a daily email digest of newly registered businesses."
context: Hack for Social Impact 2025
period: November 2025
stack: [Cloudflare Workers, FastAPI, Python, React, Mapbox, Supabase, SendGrid]
repo: https://github.com/amirassyl/sf-location-intel
order: 2
featured: true
---

## The problem

A local reporter covering a block has to query several city datasets separately to see what is happening there. [Mission Local](https://missionlocal.org/), a nonprofit newsroom, set the challenge at Hack for Social Impact 2025: put building permits, police incident reports, and registered businesses for a street in one place.

## What we built

| Piece | What it does | Stack |
| :--- | :--- | :--- |
| Email worker | Runs on a daily schedule, fetches businesses newly registered in San Francisco, and emails a digest with map links | Cloudflare Workers (cron trigger), SendGrid |
| Backend | Takes an address and returns permits, incidents, and businesses for that street, with simple volume alerts | Python, FastAPI, httpx |
| Front end | Single-page search UI for the backend | React, Tailwind |
| Map app | Map-based version of the search with cached lookups | TypeScript, React, Mapbox, Supabase |

Data comes from the city's open data portal, [data.sf.gov](https://data.sf.gov), through its Socrata API.

## My part

This was a team project. My main part was the scheduled email worker; the other pieces were team efforts. We worked with AI-assisted tooling throughout, which is how a small team shipped four working pieces during one event.

## Cleaning it up afterwards

Before publishing the code I went back through it:

- Removed API keys and personal email addresses and replaced them with environment variables.
- Updated URLs after the city moved its portal from `data.sfgov.org` to `data.sf.gov`.
- Fixed the backend search so street names match the way the datasets store them, and updated the business query to the dataset's current column names.
- Changed the worker schedule from every minute, which we used for the demo, to once a day.
