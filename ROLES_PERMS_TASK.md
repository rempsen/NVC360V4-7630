# Roles & Permissions Buildout

## Goal
Rename "Technicians" nav button -> "Technicians & Managers". From it, create ANY internal
employee: admin, manager, dispatcher, project_manager, field-staff (technician/driver).
Each role has industry-default permissions; admin can override per-role AND per-person.
Manager: sees ALL techs/jobs, but a more limited create/delete set than admin.

## Role model (better-auth user.role string)
- admin            full control
- manager          broad view, limited destructive ops
- dispatcher       work orders, forms, catalogs, parts
- project_manager  projects + scheduling oversight
- rider            field staff (technician OR driver via riders.staffType)
- customer         client (unchanged)

## Permission catalog (feature -> actions)
Each permission key = `<module>:<action>`. Actions: view, create, edit, delete (+special).
Modules: dashboard, work_orders, scheduler, fleet_map, catalog, parts, forms(builder),
clients, techs(team), reviews, zones, payouts, notifications, automation, integrations,
api_access, reports, tags, audit, settings, permissions(manage roles).

## Data
- New table `role_permissions(role TEXT pk, perms TEXT json array, updatedAt)`.
- New col `user.permissions` TEXT (json array | null) = per-person override (full replace when set).
- New col `user.staffType` TEXT ('technician'|'driver') for riders (optional).
- New col `user.managerId` TEXT (optional, who they report to) - nice-to-have.

## Backend
- lib/permissions.ts: PERMISSION_CATALOG, DEFAULT_ROLE_PERMS (industry defaults), resolvePerms(user).
- middleware requirePermission(key) + helper hasPermission.
- routes/team.ts mounted /api/team: GET list (internal roles), POST create (any internal role),
  PATCH :id, DELETE :id, GET/PUT permissions (role defaults), PUT :id/permissions (person override).
- seed role_permissions on boot if empty.

## Frontend
- shell.tsx: rename label -> "Technicians & Managers".
- techs page -> tabs: "Field Staff" (existing) | "Internal Team" (managers/dispatch/admin/pm) |
  "Roles & Permissions" (matrix editor).
- Create-employee modal with role selector; if field staff -> technician/driver type + existing fields.
- Permission matrix: role columns x module rows, checkboxes per action. Per-person override editor.

## Steps
1. [ ] schema: role_permissions table + user.permissions/staffType cols (raw SQL, no db:push)
2. [ ] lib/permissions.ts catalog + defaults + resolver
3. [ ] middleware requirePermission
4. [ ] routes/team.ts + mount + seed
5. [ ] frontend: rename nav, team tabs, create modal, perms matrix
6. [ ] build + verify + deliver

## STATUS: COMPLETE
- DB: role_permissions table + user.permissions/staffType/managerId cols applied (raw SQL).
- Backend: lib/permissions.ts (catalog+defaults+resolver), middleware requirePermission, routes/team.ts mounted /api/team, seeded on boot.
- Frontend: nav renamed "Technicians & Managers"; 3 tabs (Field Staff / Internal Team / Roles & Permissions) in riders.tsx; create-any-role modal; per-person override modal; role-default matrix editor in team-tabs.tsx.
- Verified: tsc clean, build clean, all endpoints smoke-tested, save round-trips, create+delete employee works, UI screenshots good.
- Defaults seeded: manager 35, dispatcher 39, project_manager 28, rider 0, admin=* .
