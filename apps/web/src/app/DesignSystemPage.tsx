import { useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Gift,
  Handshake,
  Hash,
  Info,
  Layers,
  LayoutList,
  Lightbulb,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { COLORS } from "@rapport/core";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  ColorDot,
  ConfirmDialog,
  DateBadge,
  Dialog,
  Divider,
  EmptyState,
  Field,
  FilterChip,
  IconButton,
  Kbd,
  List,
  ListRow,
  Menu,
  PageHeader,
  Property,
  PropertyList,
  SearchInput,
  Section,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tag,
  TextArea,
  TextInput,
  useToast,
} from "../ui";
import "./design-system.css";

const NAV = [
  ["principles", "Principles"],
  ["color", "Colour"],
  ["type", "Typography"],
  ["space", "Spacing & radius"],
  ["elevation", "Elevation"],
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["selection", "Selection"],
  ["tags", "Tags & badges"],
  ["avatars", "Avatars"],
  ["lists", "Lists & sections"],
  ["properties", "Properties"],
  ["feedback", "Feedback"],
  ["overlays", "Overlays"],
  ["patterns", "Patterns"],
] as const;

/** Living style guide: every swatch and example below renders from the real tokens and components. */
export default function DesignSystemPage() {
  return (
    <div className="ds">
      <PageHeader
        size="page"
        title="Design system"
        subtitle="Rapport's UI kit: Notion's calm document surfaces with Todoist's crisp lists, red accent and coloured dates."
      />
      <nav className="ds__toc" aria-label="On this page">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <Block id="principles" title="Principles">
        <div className="ds-grid ds-grid--3">
          <Principle icon={<LayoutList />} title="Quiet by default">
            Warm neutrals, hairline dividers and hover-revealed controls (Notion). Colour is reserved for meaning.
          </Principle>
          <Principle icon={<Check />} title="One red action">
            Each view has at most one primary (red) action, like Todoist's “Add task”. Everything else is neutral or ghost.
          </Principle>
          <Principle icon={<CalendarDays />} title="Dates carry colour">
            Green today, orange tomorrow, purple this week, grey later, red overdue, so time reads at a glance.
          </Principle>
          <Principle icon={<Hash />} title="Soft tags">
            Groups and tags use Notion's nine soft pastel pairs; avatars and dots use the solid tone of the same hue.
          </Principle>
          <Principle icon={<Sparkles />} title="AI is labelled">
            Anything the AI proposed carries a sparkle and needs an explicit accept. Nothing writes silently.
          </Principle>
          <Principle icon={<Users />} title="Thumb first">
            16px inputs, 40px+ touch targets, a bottom tab bar and FAB on phones; sidebar on desktop.
          </Principle>
        </div>
      </Block>

      <Block id="color" title="Colour" intro="All colours are CSS custom properties in styles/tokens.css, with light and dark values. Components never use raw hex.">
        <h3 className="ds-h3">Neutrals</h3>
        <div className="ds-swatches">
          {["bg", "bg-subtle", "bg-sidebar", "bg-inset", "bg-hover", "bg-active", "text", "text-secondary", "text-tertiary", "border", "border-strong"].map((t) => (
            <Swatch key={t} token={`--color-${t}`} />
          ))}
        </div>
        <h3 className="ds-h3">Accent & interaction</h3>
        <div className="ds-swatches">
          {["accent", "accent-hover", "accent-text", "accent-soft", "link", "focus-ring"].map((t) => (
            <Swatch key={t} token={`--color-${t}`} />
          ))}
        </div>
        <h3 className="ds-h3">Status</h3>
        <div className="ds-swatches">
          {["success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft"].map((t) => (
            <Swatch key={t} token={`--color-${t}`} />
          ))}
        </div>
        <h3 className="ds-h3">Relative dates</h3>
        <div className="ds-swatches">
          {["today", "tomorrow", "week", "later", "overdue"].map((t) => (
            <Swatch key={t} token={`--color-date-${t}`} />
          ))}
        </div>
        <h3 className="ds-h3">Tag palette</h3>
        <div className="ds-palette">
          {COLORS.map((c) => (
            <div key={c} className="ds-palette__col">
              <span className="ds-palette__solid" style={{ background: `var(--tag-${c}-solid)` }} />
              <Tag color={c}>{c}</Tag>
            </div>
          ))}
        </div>
      </Block>

      <Block id="type" title="Typography" intro="Inter Variable, self-hosted for offline use. Body is 14px on desktop; inputs are 16px on phones so iOS doesn't zoom.">
        <div className="ds-type">
          {[
            ["--text-3xl", "40 / Bold", "Page title", 700],
            ["--text-2xl", "32 / Bold", "Page title (mobile)", 700],
            ["--text-xl", "24 / Bold", "View title", 700],
            ["--text-lg", "18 / Semibold", "Dialog title", 600],
            ["--text-base", "16 / Regular", "Reading text and inputs", 400],
            ["--text-md", "14 / Regular", "Body and UI default", 400],
            ["--text-sm", "13 / Regular", "Secondary and metadata", 400],
            ["--text-xs", "12 / Medium", "Captions, badges, dates", 500],
          ].map(([token, spec, sample, weight]) => (
            <div key={token as string} className="ds-type__row">
              <code>{token}</code>
              <span className="text-tertiary text-xs">{spec}</span>
              <span style={{ fontSize: `var(${token})`, fontWeight: weight as number, lineHeight: 1.25 }}>{sample}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block id="space" title="Spacing & radius" intro="A 4px grid. Radii stay small: 3px for Notion blocks and tags, 10px for Todoist dialogs.">
        <div className="ds-space">
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
            <div key={n} className="ds-space__row">
              <code>--space-{n}</code>
              <span className="ds-space__bar" style={{ width: `var(--space-${n})` }} />
            </div>
          ))}
        </div>
        <div className="ds-grid ds-grid--6" style={{ marginTop: 24 }}>
          {["xs", "sm", "md", "lg", "xl", "full"].map((r) => (
            <div key={r} className="ds-radius" style={{ borderRadius: `var(--radius-${r})` }}>
              <code>--radius-{r}</code>
            </div>
          ))}
        </div>
      </Block>

      <Block id="elevation" title="Elevation" intro="Notion-style layered shadows: a 1px ring plus soft drop. Used sparingly; most surfaces are flat.">
        <div className="ds-grid ds-grid--4">
          {["sm", "card", "popover", "modal"].map((s) => (
            <div key={s} className="ds-elev" style={{ boxShadow: `var(--shadow-${s})` }}>
              <code>--shadow-{s}</code>
            </div>
          ))}
        </div>
      </Block>

      <Block id="buttons" title="Buttons">
        <Example title="Variants">
          <Button variant="primary" icon={<Plus />}>
            Add contact
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost" icon={<Pencil />}>
            Ghost
          </Button>
          <Button variant="danger" icon={<Trash2 />}>
            Danger
          </Button>
          <Button variant="link">Link button</Button>
        </Example>
        <Example title="Sizes and states">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
        </Example>
        <Example title="Icon buttons">
          <IconButton label="More">
            <MoreHorizontal />
          </IconButton>
          <IconButton label="Edit" variant="secondary">
            <Pencil />
          </IconButton>
          <IconButton label="Add" variant="primary">
            <Plus />
          </IconButton>
          <IconButton label="Close" size="sm">
            <X />
          </IconButton>
        </Example>
      </Block>

      <Block id="inputs" title="Inputs">
        <div className="ds-grid ds-grid--2">
          <Field label="Name" required hint="The only required field">
            {(id) => <TextInput id={id} placeholder="Full name" />}
          </Field>
          <Field label="Email" error="That doesn't look like an email">
            {(id) => <TextInput id={id} defaultValue="priya@" invalid />}
          </Field>
          <Field label="Reminder">
            {(id) => (
              <Select id={id} defaultValue="7">
                <option value="">No reminder</option>
                <option value="7">1 week before</option>
              </Select>
            )}
          </Field>
          <Field label="With icon">{(id) => <TextInput id={id} leading={<Gift />} placeholder="Gift idea" />}</Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Notes">{(id) => <TextArea id={id} autoGrow placeholder="Grows as you type…" />}</Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <SearchDemo />
        </div>
      </Block>

      <Block id="selection" title="Selection">
        <SelectionDemo />
      </Block>

      <Block id="tags" title="Tags & badges">
        <Example title="Tags (Notion)">
          <Tag color="orange">Family</Tag>
          <Tag color="green">Friends</Tag>
          <Tag color="blue">Work</Tag>
          <Tag onRemove={() => {}}>climbing</Tag>
          <Tag color="purple" size="sm" icon={<Sparkles />}>
            From AI
          </Tag>
        </Example>
        <ChipDemo />
        <Example title="Badges, dots and keys">
          <Badge>12</Badge>
          <Badge tone="accent">3</Badge>
          <Badge tone="success">New</Badge>
          <Badge tone="warning">Due</Badge>
          <Badge tone="info">Beta</Badge>
          <ColorDot color="red" size={10} />
          <ColorDot color="blue" size={10} />
          <span className="row" style={{ gap: 4 }}>
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </span>
        </Example>
        <Example title="Relative dates (Todoist)">
          <DateBadge daysUntil={0} date={{ year: 2026, month: 10, day: 2 }} />
          <DateBadge daysUntil={1} date={{ year: 2026, month: 10, day: 3 }} />
          <DateBadge daysUntil={4} date={{ year: 2026, month: 10, day: 6 }} suffix="Turns 30" />
          <DateBadge daysUntil={40} date={{ year: 2026, month: 11, day: 11 }} />
          <DateBadge daysUntil={-2} date={{ year: 2026, month: 9, day: 30 }} />
        </Example>
      </Block>

      <Block id="avatars" title="Avatars">
        <Example title="Sizes, initials on the person's colour">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((s, i) => (
            <Avatar key={s} name={["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Priya Shah"][i]!} color={COLORS[i + 2]} size={s} />
          ))}
        </Example>
        <Example title="Stack">
          <AvatarStack
            people={[
              { name: "Ada Lovelace", color: "blue" },
              { name: "Grace Hopper", color: "green" },
              { name: "Alan Turing", color: "orange" },
              { name: "Mary Somerville", color: "pink" },
              { name: "Hedy Lamarr", color: "purple" },
            ]}
          />
        </Example>
      </Block>

      <Block id="lists" title="Lists & sections" intro="Todoist row anatomy: leading control, title, a small meta line, actions revealed on hover, hairline dividers.">
        <Section title="This week" count={2} collapsible>
          <List>
            <ListRow
              leading={<Avatar name="Priya Shah" color="pink" size="sm" />}
              title="Priya's birthday"
              meta={
                <>
                  <DateBadge daysUntil={3} date={{ year: 2026, month: 10, day: 5 }} suffix="Turns 34" />
                  <Bell className="inline-icon" aria-label="Reminder set" />
                </>
              }
              trailing={
                <span className="row" style={{ gap: 4 }}>
                  <Gift className="inline-icon" /> 2
                </span>
              }
              actions={
                <IconButton label="More" size="sm">
                  <MoreHorizontal />
                </IconButton>
              }
              onClick={() => {}}
            />
            <ListRow
              leading={<Checkbox shape="round" checked={false} onChange={() => {}} aria-label="Done" />}
              title="Send Sam the climbing gym link"
              description="Follow-up from Tuesday"
              meta={<DateBadge daysUntil={0} date={{ year: 2026, month: 10, day: 2 }} />}
              onClick={() => {}}
            />
          </List>
        </Section>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="add-row">
            <span className="add-row__plus">
              <Plus />
            </span>
            Add interest
          </button>
        </div>
      </Block>

      <Block id="properties" title="Properties" intro="Notion page properties: muted icon + label column, value column, placeholder when empty.">
        <PropertyList>
          <Property icon={<Handshake />} label="How we know">
            Climbing gym
          </Property>
          <Property icon={<Layers />} label="Groups">
            <Tag color="green">Friends</Tag>
          </Property>
          <Property icon={<Clock />} label="Last spoke">
            3 days ago
          </Property>
          <Property icon={<Hash />} label="Tags" />
        </PropertyList>
      </Block>

      <Block id="feedback" title="Feedback">
        <div className="stack" style={{ gap: 12 }}>
          <Callout icon={<Lightbulb />} title="Callout (neutral)">
            Notion-style block with an icon. Use for tips and inline context.
          </Callout>
          <Callout tone="info" icon={<Info />} title="Info">
            On iPhone, add Rapport to your Home Screen to get notifications.
          </Callout>
          <Callout tone="success" icon={<Check />} title="Success">
            3 details saved to Priya's profile.
          </Callout>
          <Callout tone="warning" icon={<TriangleAlert />} title="Warning">
            You're offline. Changes need a connection.
          </Callout>
          <Callout tone="accent" icon={<Bell />} title="Accent" action={<Button size="sm" variant="primary">Turn on</Button>}>
            Get reminded a week before birthdays.
          </Callout>
          <ToastDemo />
          <Example title="Loading">
            <Spinner />
            <Skeleton width={160} />
            <Skeleton width={36} height={36} radius={18} />
          </Example>
          <Card>
            <EmptyState icon={<Users />} title="Add your first contact" action={<Button variant="primary" icon={<Plus />}>Add contact</Button>}>
              Empty states explain what goes here and offer the next step.
            </EmptyState>
          </Card>
        </div>
      </Block>

      <Block id="overlays" title="Overlays" intro="Dialogs use the native <dialog> element: a centred card on desktop, a bottom sheet on phones.">
        <OverlayDemo />
      </Block>

      <Block id="patterns" title="Patterns">
        <h3 className="ds-h3">AI suggestion card</h3>
        <ul className="suggestions">
          <li className="suggestion">
            <div className="suggestion__head">
              <Tag color="pink" size="sm">
                Gift idea
              </Tag>
            </div>
            <p className="suggestion__text">Garmin running watch</p>
            <p className="suggestion__evidence">You wrote: “wants a new Garmin watch”</p>
            <div className="suggestion__actions">
              <Button size="sm" variant="ghost" icon={<X />}>
                Reject
              </Button>
              <Button size="sm" variant="ghost" icon={<Pencil />}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" icon={<Check />}>
                Accept
              </Button>
            </div>
          </li>
          <li className="suggestion suggestion--accepted">
            <div className="suggestion__head">
              <Tag color="blue" size="sm">
                Interest
              </Tag>
              <span className="suggestion__state suggestion__state--ok">Accepted</span>
            </div>
            <p className="suggestion__text">Marathon running</p>
            <p className="suggestion__evidence">You wrote: “training for the Berlin marathon”</p>
          </li>
        </ul>
        <h3 className="ds-h3">Primary action placement</h3>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Button variant="primary" icon={<MessageSquarePlus />}>
            Log conversation
          </Button>
          <span className="text-secondary text-sm">Desktop: top-right of the view. Phone: full-width under the title, or the red FAB.</span>
        </div>
      </Block>
    </div>
  );
}

function Block({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="ds-block">
      <h2 className="ds-h2">{title}</h2>
      {intro && <p className="ds-intro">{intro}</p>}
      {children}
    </section>
  );
}

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ds-example">
      <p className="ds-example__title">{title}</p>
      <div className="ds-example__body">{children}</div>
    </div>
  );
}

function Principle({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="ds-principle__icon">{icon}</div>
      <h3 className="ds-principle__title">{title}</h3>
      <p className="text-secondary text-sm">{children}</p>
    </Card>
  );
}

function Swatch({ token }: { token: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="ds-swatch"
      onClick={() => navigator.clipboard?.writeText(`var(${token})`).then(() => toast.show(`Copied var(${token})`))}
      title="Copy CSS variable"
    >
      <span className="ds-swatch__chip" style={{ background: `var(${token})` }} />
      <code>{token.replace("--color-", "")}</code>
      <Copy className="ds-swatch__copy" aria-hidden />
    </button>
  );
}

function SearchDemo() {
  const [q, setQ] = useState("");
  return <SearchInput value={q} onChange={setQ} placeholder="Search names, interests, tags…" aria-label="Search demo" />;
}

function SelectionDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [sw, setSw] = useState(true);
  const [seg, setSeg] = useState<"list" | "board">("list");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Example title="Checkboxes">
        <Checkbox checked={a} onChange={setA} label="Square" />
        <Checkbox checked={b} onChange={setB} shape="round" label="Round (Todoist task)" />
        <Checkbox checked onChange={() => {}} shape="round" label="Checked" />
        <Checkbox checked onChange={() => {}} tone="neutral" label="Neutral" />
      </Example>
      <div style={{ maxWidth: 420 }}>
        <Switch checked={sw} onChange={setSw} label="Reminder notifications" description="A push before each birthday." />
      </div>
      <Example title="Segmented control">
        <Segmented
          label="View"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ]}
        />
      </Example>
    </div>
  );
}

function ChipDemo() {
  const [sel, setSel] = useState<string | null>("Friends");
  return (
    <Example title="Filter chips">
      {(["Family", "Friends", "Work"] as const).map((g, i) => (
        <FilterChip key={g} color={(["orange", "green", "blue"] as const)[i]} selected={sel === g} onClick={() => setSel(sel === g ? null : g)} count={[4, 12, 7][i]}>
          {g}
        </FilterChip>
      ))}
      <FilterChip>#climbing</FilterChip>
    </Example>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <Example title="Toasts">
      <Button size="sm" onClick={() => toast.show("Detail deleted", { action: { label: "Undo", onClick: () => toast.show("Restored") } })}>
        Neutral with undo
      </Button>
      <Button size="sm" onClick={() => toast.success("Saved 3 details")}>
        Success
      </Button>
      <Button size="sm" onClick={() => toast.error("Couldn't reach the server")}>
        Error
      </Button>
    </Example>
  );
}

function OverlayDemo() {
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <Example title="Dialog, confirm and menu">
      <Button onClick={() => setDialog(true)}>Open dialog</Button>
      <Button variant="danger" onClick={() => setConfirm(true)}>
        Confirm delete
      </Button>
      <Menu
        align="start"
        trigger={(p) => (
          <Button icon={<MoreHorizontal />} {...p}>
            Menu
          </Button>
        )}
        items={[
          { label: "Edit", icon: <Pencil />, onSelect: () => {} },
          { label: "Duplicate", icon: <Copy />, onSelect: () => {} },
          "separator",
          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => {} },
        ]}
      />
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Add a key date"
        description="Birthdays repeat every year."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialog(false)}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Name">{(id) => <TextInput id={id} defaultValue="Birthday" />}</Field>
        <Divider />
        <p className="text-secondary text-sm">Dialog body content scrolls when it is long.</p>
      </Dialog>
      <ConfirmDialog open={confirm} title="Delete Priya?" confirmLabel="Delete contact" danger onClose={() => setConfirm(false)} onConfirm={() => setConfirm(false)}>
        This can't be undone.
      </ConfirmDialog>
    </Example>
  );
}
