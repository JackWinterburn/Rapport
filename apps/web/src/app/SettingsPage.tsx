import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Download, FileJson, FileSpreadsheet, Hash, LogOut, Palette, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { COLORS, type Color, type Group, type Tag as TagModel } from "@rapport/core";
import {
  Avatar,
  Button,
  Callout,
  ColorDot,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  List,
  ListRow,
  PageHeader,
  Section,
  Segmented,
  Switch,
  TextInput,
  useToast,
} from "../ui";
import { api, errorMessage, keys, queryClient, useAiUsage, useGroups, useMe, useTags } from "../lib/api";
import { applyTheme, clearOfflineData, currentPushSubscription, disablePush, enablePush, getTheme, isIos, isStandalone, pushSupported, type ThemePref } from "../lib/device";
import "./pages.css";

export function SettingsPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemePref>(getTheme());

  return (
    <>
      <PageHeader title="Settings" />
      <div className="settings">
        <Section title="Account">
          <div className="account-row">
            <Avatar name={me?.name ?? me?.email ?? "You"} photo={me?.picture} color="red" size="md" />
            <div className="stack" style={{ minWidth: 0, flex: 1 }}>
              <strong>{me?.name}</strong>
              <span className="text-secondary text-sm">{me?.email}</span>
            </div>
            <Button
              variant="secondary"
              icon={<LogOut />}
              onClick={async () => {
                await api.logout().catch(() => undefined);
                await clearOfflineData();
                queryClient.clear();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </Section>

        <Section title="Appearance">
          <Segmented
            label="Theme"
            value={theme}
            onChange={(v) => {
              setTheme(v);
              applyTheme(v);
            }}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <Button variant="link" icon={<Palette />} onClick={() => navigate("/design-system")} style={{ marginTop: 12 }}>
            View the design system
          </Button>
        </Section>

        <NotificationsSettings />
        <GroupsSettings />
        <TagsSettings />
        <AiSettings />
        <DataSettings />
      </div>
    </>
  );
}

function NotificationsSettings() {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void currentPushSubscription().then((s) => setOn(Boolean(s)));
  }, []);
  const supported = pushSupported();

  return (
    <Section title="Notifications">
      {!supported ? (
        <Callout icon={<Bell />}>This browser doesn't support push notifications. Upcoming dates still show in the app.</Callout>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {isIos() && !isStandalone() && (
            <Callout tone="info" icon={<Bell />} title="iPhone needs the app installed">
              Tap Share → Add to Home Screen, open Rapport from there, then turn notifications on.
            </Callout>
          )}
          <Switch
            checked={on}
            disabled={busy}
            label="Reminder notifications"
            description="A push at the lead time you set on each birthday or key date, sent in the morning."
            onChange={async (v) => {
              setBusy(true);
              try {
                if (v) await enablePush();
                else await disablePush();
                setOn(v);
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          {on && (
            <div>
              <Button
                size="sm"
                onClick={() =>
                  api
                    .pushTest()
                    .then((r) => (r.sent ? toast.success("Test notification sent") : toast.error("No devices are subscribed")))
                    .catch((e) => toast.error(errorMessage(e)))
                }
              >
                Send a test notification
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function GroupsSettings() {
  const { data: groups = [] } = useGroups();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.groups });
    void qc.invalidateQueries({ queryKey: keys.contacts });
  };

  return (
    <Section
      title="Groups"
      count={groups.length}
      action={
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setEditing("new")}>
          New group
        </Button>
      }
    >
      <List label="Groups">
        {groups.map((g) => (
          <ListRow
            key={g.id}
            onClick={() => setEditing(g)}
            leading={<ColorDot color={g.color} size={12} />}
            title={g.name}
            actions={
              <IconButton label={`Delete ${g.name}`} size="sm" onClick={() => setDeleting(g)}>
                <Trash2 />
              </IconButton>
            }
          />
        ))}
      </List>
      <GroupDialog
        group={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete the ${deleting?.name} group?`}
        confirmLabel="Delete group"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          api
            .deleteGroup(deleting!.id)
            .then(() => {
              setDeleting(null);
              refresh();
            })
            .catch((e) => toast.error(errorMessage(e)))
        }
      >
        Contacts in it are kept; they just leave the group.
      </ConfirmDialog>
    </Section>
  );
}

function GroupDialog({ group, onClose, onSaved }: { group: Group | "new" | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<Color>("gray");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (group && group !== "new") {
      setName(group.name);
      setColor(group.color);
    } else if (group === "new") {
      setName("");
      setColor("blue");
    }
  }, [group]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (group === "new") await api.createGroup({ name, color });
      else if (group) await api.updateGroup(group.id, { name, color });
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={group !== null}
      onClose={onClose}
      title={group === "new" ? "New group" : "Edit group"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">{(id) => <TextInput id={id} autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="stack" style={{ gap: 6 }}>
          <span className="ui-field__label">Colour</span>
          <div className="color-grid" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className="color-swatch" onClick={() => setColor(c)}>
                <ColorDot color={c} size={16} />
              </button>
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function TagsSettings() {
  const { data: tags = [] } = useTags();
  const qc = useQueryClient();
  const toast = useToast();
  const [renaming, setRenaming] = useState<TagModel | null>(null);
  const [name, setName] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.tags });
    void qc.invalidateQueries({ queryKey: keys.contacts });
  };
  if (tags.length === 0) return null;
  return (
    <Section title="Tags" count={tags.length} collapsible defaultOpen={false}>
      <p className="text-secondary text-sm" style={{ margin: "8px 0" }}>
        Tags are created as you add them to contacts and disappear when no one uses them.
      </p>
      <List label="Tags">
        {tags.map((t) => (
          <ListRow
            key={t.id}
            leading={<Hash className="inline-icon" />}
            title={t.name}
            onClick={() => {
              setRenaming(t);
              setName(t.name);
            }}
            actions={
              <IconButton
                label={`Delete tag ${t.name}`}
                size="sm"
                onClick={() =>
                  api
                    .deleteTag(t.id)
                    .then(refresh)
                    .catch((e) => toast.error(errorMessage(e)))
                }
              >
                <Trash2 />
              </IconButton>
            }
          />
        ))}
      </List>
      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename tag"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() =>
                api
                  .renameTag(renaming!.id, name)
                  .then(() => {
                    setRenaming(null);
                    refresh();
                  })
                  .catch((e) => toast.error(errorMessage(e)))
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Name" hint="Renaming to an existing tag merges them.">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />}
        </Field>
      </Dialog>
    </Section>
  );
}

function AiSettings() {
  const { data: usage } = useAiUsage();
  if (!usage) return null;
  const used = usage.inputTokens + usage.outputTokens;
  const pct = Math.min(100, Math.round((used / Math.max(1, usage.tokenLimit)) * 100));
  return (
    <Section title="AI conversation capture">
      <div className="stack" style={{ gap: 12 }}>
        {!usage.configured && (
          <Callout tone="warning" icon={<Sparkles />} title="Not configured">
            Set GEMINI_API_KEY on the server to turn on suggestions. You can still log conversations without AI.
          </Callout>
        )}
        <div className="usage">
          <div className="usage__row">
            <span>
              {usage.requests} {usage.requests === 1 ? "capture" : "captures"} this month
            </span>
            <span className="text-secondary text-sm">
              {used.toLocaleString()} / {usage.tokenLimit.toLocaleString()} tokens
            </span>
          </div>
          <div className="usage__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly AI usage">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-tertiary">Model: {usage.model}. The limit resets on the 1st of each month.</p>
        </div>
        <p className="text-sm text-secondary">
          Only the text you write, the contact's name and their non-private details are sent to Google. Contact details, photos and anything marked private
          are never sent. Suggestions on sensitive topics (health, religion, relationships, politics, finances) are filtered out.
        </p>
      </div>
    </Section>
  );
}

function DataSettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Your data">
      <div className="stack" style={{ gap: 12 }}>
        <p className="text-sm text-secondary">Download everything you've stored, at any time. JSON includes photos and the full timeline; CSV is one row per contact.</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <a className="ui-btn ui-btn--secondary ui-btn--md" href={api.exportJsonUrl()} download>
            <FileJson /> <span className="ui-btn__label">Export JSON</span>
          </a>
          <a className="ui-btn ui-btn--secondary ui-btn--md" href={api.exportCsvUrl()} download>
            <FileSpreadsheet /> <span className="ui-btn__label">Export CSV</span>
          </a>
        </div>
        <div className="danger-zone">
          <div className="stack" style={{ gap: 2 }}>
            <strong>Delete everything</strong>
            <span className="text-sm text-secondary">Permanently removes all contacts, groups, tags, notes and reminders.</span>
          </div>
          <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirm(true)}>
            Delete all data
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete all your data?"
        confirmLabel="Delete everything"
        danger
        loading={busy}
        onClose={() => {
          setConfirm(false);
          setTyped("");
        }}
        onConfirm={async () => {
          if (typed !== "DELETE") return toast.error("Type DELETE to confirm");
          setBusy(true);
          try {
            await api.deleteEverything();
            await disablePush().catch(() => undefined);
            await clearOfflineData();
            queryClient.clear();
            toast.show("All data deleted");
            navigate("/", { replace: true });
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
            setConfirm(false);
            setTyped("");
          }
        }}
      >
        <div className="stack" style={{ gap: 12 }}>
          <p>This can't be undone. Consider exporting first.</p>
          <Field label={<>Type <strong>DELETE</strong> to confirm</>}>
            {(id) => <TextInput id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
          </Field>
          <span className="row text-xs text-tertiary" style={{ gap: 6 }}>
            <Download className="inline-icon" /> <Users className="inline-icon" /> Your account stays so you can start again.
          </span>
        </div>
      </ConfirmDialog>
    </Section>
  );
}
