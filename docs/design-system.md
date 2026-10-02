# Rapport design system

Rapport's UI combines **Notion's** calm document surfaces with **Todoist's** crisp list mechanics. The living version, rendered from the real tokens and components, is at **`/design-system`** in the app (Settings → View the design system).

- Tokens: [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css)
- Components: [`apps/web/src/ui/`](../apps/web/src/ui) (import from `../ui`)
- Showcase: [`apps/web/src/app/DesignSystemPage.tsx`](../apps/web/src/app/DesignSystemPage.tsx)

## What we take from each

| From Notion | From Todoist |
| --- | --- |
| Warm neutral greys (`#37352f` text, `#f7f7f5` sidebar) | Red accent `#dc4c3e` for the single primary action |
| Big bold page titles (40px) and property rows | Bold view titles (24px) and section headers with counts and a collapse chevron |
| Soft pastel tag pairs in nine hues | Coloured relative dates: green today, orange tomorrow, purple this week, red overdue |
| Hover-revealed controls, 3px radii, hairline dividers | Task-row anatomy: leading control, title, small meta line, hover actions |
| Callout blocks with an icon | Round checkboxes, red “+ Add …” rows, the red mobile FAB, dark snackbar toasts with Undo |
| Layered popover shadows | 10px-radius dialogs |

## Principles

1. **Quiet by default.** Colour carries meaning (dates, groups, status), never decoration.
2. **One red action per view.** Everything else is secondary (bordered) or ghost.
3. **AI is labelled.** Anything proposed by the AI shows a sparkle and needs an explicit accept.
4. **Thumb first.** 16px inputs on phones (no iOS zoom), 40px+ targets, bottom tab bar and FAB; a sidebar from 900px.
5. **Tokens only.** Components use CSS custom properties, never raw hex, so dark mode is a token swap.

## Tokens

| Group | Tokens | Notes |
| --- | --- | --- |
| Neutrals | `--color-bg`, `-bg-subtle`, `-bg-sidebar`, `-bg-inset`, `-bg-hover`, `-bg-active`, `-text`, `-text-secondary`, `-text-tertiary`, `-border`, `-border-strong` | Hover/active are translucent so they work on any surface |
| Accent | `--color-accent`, `-accent-hover`, `-accent-text`, `-accent-soft`, `-on-accent` | Use `-accent-text` for red text (passes contrast on white) |
| Status | `--color-success`, `-warning`, `-danger`, `-info` (+ `-soft`) | |
| Dates | `--color-date-today`, `-tomorrow`, `-week`, `-later`, `-overdue` | Used only by `DateBadge` |
| Tag palette | `--tag-{gray,brown,orange,yellow,green,blue,purple,pink,red}-{bg,fg,solid}` | `bg`/`fg` for pills, `solid` for dots and avatars |
| Type | `--text-xs` 12 → `--text-3xl` 40; weights 400/500/600/700 | Inter Variable, self-hosted |
| Space | `--space-1` 4px … `--space-16` 64px | 4px grid |
| Radius | `--radius-xs` 3 · `sm` 4 · `md` 6 · `lg` 10 · `xl` 14 · `full` | |
| Elevation | `--shadow-sm`, `-card`, `-popover`, `-modal`, `-fab` | 1px ring + soft drop |
| Motion | `--duration-fast` 100ms, `--duration` 160ms, `--duration-slow` 260ms, `--ease-out` | Respects `prefers-reduced-motion` |

Dark mode follows the OS, or is forced with `data-theme="dark" | "light"` on `<html>` (Settings → Appearance).

## Components

| Component | Use |
| --- | --- |
| `Button` (`primary`, `secondary`, `ghost`, `danger`, `link`; `sm`/`md`/`lg`; `loading`) / `IconButton` | Actions. `IconButton` requires a `label`. |
| `Field` + `TextInput` / `TextArea` (`autoGrow`) / `Select` / `SearchInput` | Forms. `Field` wires label, hint and error ids. |
| `Checkbox` (`square` / `round`), `Switch`, `Segmented` | Selection |
| `Tag`, `FilterChip`, `ColorDot`, `Badge`, `Kbd` | Labels and counts |
| `Avatar`, `AvatarStack` | Photo or initials on the person's colour |
| `Card`, `Callout`, `Divider`, `EmptyState` | Surfaces |
| `List`, `ListRow`, `Section` | Todoist-style lists with hover actions and collapsible sections |
| `PropertyList`, `Property` | Notion page properties |
| `PageHeader` (`page` / `view`) | Titles |
| `DateBadge` | Relative, colour-coded dates |
| `Dialog`, `ConfirmDialog` | Native `<dialog>`: centred on desktop, bottom sheet on phones |
| `Menu` | Popover menu with arrow-key navigation |
| `Fab` | Mobile quick action |
| `ToastProvider` / `useToast` | Snackbars, optional Undo action |
| `Spinner`, `Skeleton` | Loading |

## Accessibility

- Every control is keyboard reachable; focus shows a 2px blue ring (`--color-focus-ring`).
- Icon-only buttons need a `label`; dialogs are labelled by their title; toasts use `aria-live`.
- Filter chips and segmented controls expose `aria-pressed` / `aria-checked`.
- Body and secondary text (`--color-text`, `--color-text-secondary`) meet WCAG AA on the page background. `--color-text-tertiary` does not (about 2.8:1 on white), so keep it to placeholders, counts and decorative metadata, never information that is only available there.
