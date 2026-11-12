# WebJaws PHASE 1.3B-07B — Menu Feature Status Indicators

## Summary
Added a compact feature-readiness icon to every configured application menu entry in the desktop sidebar and mobile menu drawer. The three fixed mobile bottom-navigation entries also show a status icon.

## Files changed
- `src/components/layout/FeatureMenuStatus.tsx` — new shared status resolver and icon component.
- `src/components/layout/Sidebar.tsx` — status icon on standalone and category menu entries; collapsed sidebar tooltips include status.
- `src/components/layout/MobileMenuDrawer.tsx` — status icon on standalone and category entries.
- `src/components/layout/BottomNav.tsx` — status icon beside fixed bottom-navigation labels.

## Current conservative status mapping
- Work Orders (`/management-wo/*`) and Installer (`/installer/*`): LOCKED, reflecting the previously audited in-memory persistence / incomplete production verification.
- Database Application (`/setup/database-application`): LOCKED, pending RLS and trusted database context integration.
- Dashboard, Contact Center, Report WO, User Management, other Setup routes, and unknown routes: PENDING, because complete end-to-end verification is not established.
- No menu is marked VERIFIED without measured end-to-end evidence.

## Important behavior
- Icons are informational only and do not disable navigation or grant/revoke permissions.
- Existing backend authorization and login/session flows are unchanged.
- Status mapping is centralized in `FeatureMenuStatus.tsx` for easy updates after tests pass.

## Validation
Source changes were reviewed for JSX structure. A full TypeScript/Vite production build was not run because dependencies are not installed in this workspace. Run `npm ci` followed by `npm run build` in the project environment before deployment.
