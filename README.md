# Turkey Day Planner

Plan Thanksgiving cooking backward from serve time: dinners, dishes, recipes, shopping list, and a day-by-day order of operations. Replaces the yearly Google Sheet.

**Version:** see `version.json` (also shown under the title in the app)
**Live:** https://birria-corp.github.io/turkey-day-planner/ (after first deploy)

---

## Features (planned)

- Event by year, with real calendar days (Thanksgiving = 4th Thursday of November)
- Meals with serve times, dishes with assigned cooks
- Recipes with ingredients and steps, JSON import
- Shopping list built from the chosen dishes
- Week grid and day-of order of operations, planned backward from serve time
- Google sign-in, family sharing, live sync

Built so far: sign-in, access control, menu and recipes (imported from a private file, not stored in this repo), week/day/timeline grid with drag and drop, shopping list, printing, backups, live updates and an installable app. This file's feature list and file structure below are out of date; see the code for the current layout.

## Credits

- App icon: the roast-turkey silhouette is "Thanksgiving Turkey" by liftarn, from [Openclipart](https://openclipart.org/detail/319574/thanksgiving-turkey), released under the [CC0 1.0 public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/). Recolored for this app. No credit is required; it is given as a courtesy.

---

## File Structure

```
turkey-day-planner/
├── index.html            Vite entry
├── vite.config.js        base path for GitHub Pages
├── package.json
├── version.json          { "version": "0.2.0" }
├── firestore.rules       Source of truth for rules (owner uid to pin)
├── src/
│   ├── main.jsx
│   ├── App.jsx           Sign-in screen, access request
│   ├── firebase.js       Config, Google auth, Firestore + offline cache
│   └── scheduler/
│       ├── dates.js      Thanksgiving date, event range, weekday labels
│       └── dates.test.js
├── .github/workflows/deploy.yml
├── README.md
├── CONTEXT.md            (to add)
└── LOG.md                (to add)
```

---

## Firebase

- **Project:** turkey-day-planner
- **Auth:** Google sign-in
- **Database:** Firestore (default), production mode, nam5
- **Hosting:** GitHub Pages (birria-corp.github.io/turkey-day-planner)
- Authorized domains include birria-corp.github.io

---

## Develop

```
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build into dist/
```

---

## Update Workflow

1. GitHub Desktop: **Pull origin** first
2. Make changes, bump `version.json` and `package.json`, add a Version History row
3. Commit, then Push origin (GitHub Actions builds and deploys in a few minutes)
4. Rules changes: `firestore.rules` in this repo is the source. This project is not shared, so it can be deployed with the Firebase CLI or pasted in the console.

---

## Version History

| Version | Changes |
|---------|---------|
| v0.2.0 | Google sign-in (popup on desktop, redirect on mobile), Firestore connection with offline cache, access-request flow, `firestore.rules` draft (owner uid still to pin) |
| v0.1.0 | Scaffold: React + Vite, GitHub Pages deploy workflow, calendar helpers with tests |
