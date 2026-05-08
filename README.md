# TaskFlow Hub

TaskFlow Hub is a lightweight browser app for managing team users and task assignments without a backend. It stores data in `localStorage`, so the demo remains fast and self-contained.

## Features

- Users Master for creating, editing, activating/deactivating, and deleting users.
- Tasks Hub for recording upcoming tasks, priorities, due dates, and assignments.
- My Tasks view filtered by the currently selected user.
- Task lifecycle actions to start work, move tasks to in-progress, and close tasks.
- Synchronized task statuses across Tasks Hub and My Tasks because all views read from the same task state.
- Confirmation popups for create, update, delete, start, and close actions.
- Responsive, interactive UI with dashboard summary cards and polished task/user cards.

## Run locally

```bash
npm run dev
```

Then open <http://localhost:5173>.

## Validate

```bash
npm run build
```

The validation script checks JavaScript syntax and verifies that core app sections and confirmation modal styles are present.
