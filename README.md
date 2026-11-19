# Turkey Day Planner

Plan Thanksgiving cooking backward from serve time: dinners, dishes, recipes, shopping list, and a day-by-day order of operations. Replaces the yearly Google Sheet.

**Version:** 0.1.0
**Live:** https://birria-corp.github.io/turkey-day-planner/ (after first deploy)

---

## Features (planned)

- Event by year, with real calendar days (Thanksgiving = 4th Thursday of November)
- Meals with serve times, dishes with assigned cooks
- Recipes with ingredients and steps, JSON import
- Shopping list built from the chosen dishes
- Week grid and day-of order of operations, planned backward from serve time
- Google sign-in, family sharing, live sync

Built so far: scaffold and calendar helpers.

---

## File Structure

```
turkey-day-planner/
├── index.html            Vite entry
├── vite.config.js        base path for GitHub Pages
├── package.json
├── version.json          { "version": "0.1.0" }
├── src/
│   ├── main.jsx
│   ├── App.jsx
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
| v0.1.0 | Scaffold: React + Vite, GitHub Pages deploy workflow, calendar helpers with tests |
