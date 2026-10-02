import { useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { CalendarDays, ChevronRight, CloudOff, Hash, MessageSquarePlus, Palette, Settings, Users, LogOut } from "lucide-react";
import { todayLocal, upcomingDates } from "@rapport/core";
import { Avatar, Badge, ColorDot, Menu } from "../ui";
import { api, queryClient, useContacts, useGroups, useMe, useTags } from "../lib/api";
import { clearOfflineData, useOnline } from "../lib/device";
import { UpdateBanner } from "./UpdateBanner";
import "./shell.css";

export function AppShell() {
  const { data: me } = useMe();
  const { data: contacts = [] } = useContacts();
  const { data: groups = [] } = useGroups();
  const { data: tags = [] } = useTags();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const [tagsOpen, setTagsOpen] = useState(true);

  const dueCount = useMemo(() => upcomingDates(contacts, todayLocal()).filter((u) => u.reminderDue).length, [contacts]);
  const onList = location.pathname === "/";
  const activeGroup = onList ? params.get("group") : null;
  const activeTag = onList ? params.get("tag") : null;

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    await clearOfflineData();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <a href="#main" className="shell__skip">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar__top">
          <Menu
            align="start"
            trigger={(p) => (
              <button type="button" className="sidebar__user" {...p}>
                <Avatar name={me?.name ?? me?.email ?? "You"} photo={me?.picture} color="red" size="xs" />
                <span className="sidebar__user-name">{me?.name ?? me?.email}</span>
              </button>
            )}
            items={[
              { label: "Settings", icon: <Settings />, onSelect: () => navigate("/settings") },
              { label: "Design system", icon: <Palette />, onSelect: () => navigate("/design-system") },
              "separator",
              { label: "Sign out", icon: <LogOut />, onSelect: signOut },
            ]}
          />
        </div>

        <button type="button" className="sidebar__quick" onClick={() => navigate("/capture")}>
          <span className="sidebar__quick-icon">
            <MessageSquarePlus />
          </span>
          Log conversation
        </button>

        <nav className="sidebar__nav">
          <SideLink to="/" icon={<Users />} label="Contacts" end count={contacts.length} active={onList && !activeGroup && !activeTag} />
          <SideLink to="/upcoming" icon={<CalendarDays />} label="Upcoming" badge={dueCount || undefined} />
        </nav>

        <div className="sidebar__group">
          <p className="sidebar__heading">Groups</p>
          {groups.map((g) => (
            <SideLink
              key={g.id}
              to={`/?group=${g.id}`}
              icon={<ColorDot color={g.color} size={10} />}
              label={g.name}
              count={contacts.filter((c) => c.groupIds.includes(g.id)).length}
              active={activeGroup === g.id}
            />
          ))}
        </div>

        {tags.length > 0 && (
          <div className="sidebar__group">
            <button type="button" className="sidebar__heading sidebar__heading--toggle" aria-expanded={tagsOpen} onClick={() => setTagsOpen((o) => !o)}>
              Tags <ChevronRight aria-hidden />
            </button>
            {tagsOpen &&
              tags.map((t) => (
                <SideLink
                  key={t.id}
                  to={`/?tag=${t.id}`}
                  icon={<Hash />}
                  label={t.name}
                  count={contacts.filter((c) => c.tagIds.includes(t.id)).length}
                  active={activeTag === t.id}
                />
              ))}
          </div>
        )}

        <div className="sidebar__bottom">
          <SideLink to="/settings" icon={<Settings />} label="Settings" />
        </div>
      </aside>

      <div className="shell__main">
        {!online && (
          <div className="offline-bar" role="status">
            <CloudOff aria-hidden /> You're offline. Profiles you've opened are still readable; changes need a connection.
          </div>
        )}
        <UpdateBanner />
        <main id="main" className="shell__content">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="Main navigation">
        <TabLink to="/" icon={<Users />} label="Contacts" end />
        <TabLink to="/upcoming" icon={<CalendarDays />} label="Upcoming" badge={dueCount || undefined} />
        <TabLink to="/capture" icon={<MessageSquarePlus />} label="Log" />
        <TabLink to="/settings" icon={<Settings />} label="Settings" />
      </nav>
    </div>
  );
}

function SideLink({
  to,
  icon,
  label,
  count,
  badge,
  end,
  active,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  count?: number;
  badge?: number;
  end?: boolean;
  active?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => ["sidebar__link", (active ?? isActive) && "sidebar__link--active"].filter(Boolean).join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <span className="sidebar__link-icon">{icon}</span>
      <span className="sidebar__link-label">{label}</span>
      {badge ? <Badge tone="accent">{badge}</Badge> : count !== undefined && count > 0 && <span className="sidebar__count">{count}</span>}
    </NavLink>
  );
}

function TabLink({ to, icon, label, badge, end }: { to: string; icon: ReactNode; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => ["tabbar__link", isActive && "tabbar__link--active"].filter(Boolean).join(" ")}>
      <span className="tabbar__icon">
        {icon}
        {badge && <span className="tabbar__badge">{badge}</span>}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
