import type {
  ContactDetail,
  ContactInput,
  ContactPatch,
  ContactSummary,
  Fact,
  FactInput,
  FactPatch,
  Group,
  GroupInput,
  Interaction,
  KeyDate,
  KeyDateInput,
  NoteInput,
  Tag,
  User,
} from "./models";
import type { CaptureCommit, CaptureProposal } from "./suggestions";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface AiUsage {
  month: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  tokenLimit: number;
  model: string;
  configured: boolean;
}

/** Minimal fetch signature so core needs neither DOM nor Node typings. */
export type FetchLike = (
  url: string,
  init: { method: string; credentials?: "include"; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; statusText: string; text(): Promise<string> }>;

const globalFetch: FetchLike = (url, init) => (globalThis as unknown as { fetch: FetchLike }).fetch(url, init);

export interface AuthConfig {
  google: boolean;
  devLogin: boolean;
}

/**
 * Platform-agnostic API client. Uses only `fetch`, so it runs in the browser,
 * React Native and Node. Every mutating request sends a custom header the server
 * requires, which blocks cross-site form posts (CSRF).
 */
export class ApiClient {
  constructor(
    private baseUrl = "",
    private fetchImpl: FetchLike = globalFetch,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(this.baseUrl + path, {
      method,
      credentials: "include",
      headers: {
        "X-Requested-With": "rapport",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText, data?.details);
    return data as T;
  }

  // Auth
  me = () => this.request<User>("GET", "/api/me");
  authConfig = () => this.request<AuthConfig>("GET", "/auth/config");
  logout = () => this.request<void>("POST", "/auth/logout");
  devLogin = () => this.request<User>("POST", "/auth/dev-login");

  // Contacts
  listContacts = () => this.request<ContactSummary[]>("GET", "/api/contacts");
  getContact = (id: string) => this.request<ContactDetail>("GET", `/api/contacts/${id}`);
  createContact = (input: ContactInput) => this.request<ContactDetail>("POST", "/api/contacts", input);
  updateContact = (id: string, patch: ContactPatch) => this.request<ContactDetail>("PATCH", `/api/contacts/${id}`, patch);
  deleteContact = (id: string) => this.request<void>("DELETE", `/api/contacts/${id}`);

  // Facts
  addFact = (contactId: string, input: FactInput) => this.request<Fact>("POST", `/api/contacts/${contactId}/facts`, input);
  updateFact = (id: string, patch: FactPatch) => this.request<Fact>("PATCH", `/api/facts/${id}`, patch);
  deleteFact = (id: string) => this.request<void>("DELETE", `/api/facts/${id}`);

  // Key dates
  addKeyDate = (contactId: string, input: KeyDateInput) => this.request<KeyDate>("POST", `/api/contacts/${contactId}/dates`, input);
  updateKeyDate = (id: string, input: KeyDateInput) => this.request<KeyDate>("PUT", `/api/dates/${id}`, input);
  deleteKeyDate = (id: string) => this.request<void>("DELETE", `/api/dates/${id}`);

  // Notes and history
  addNote = (contactId: string, input: NoteInput) => this.request<Interaction>("POST", `/api/contacts/${contactId}/interactions`, input);
  updateInteraction = (id: string, patch: Partial<NoteInput>) => this.request<Interaction>("PATCH", `/api/interactions/${id}`, patch);
  deleteInteraction = (id: string) => this.request<void>("DELETE", `/api/interactions/${id}`);

  // Groups and tags
  listGroups = () => this.request<Group[]>("GET", "/api/groups");
  createGroup = (input: GroupInput) => this.request<Group>("POST", "/api/groups", input);
  updateGroup = (id: string, input: Partial<GroupInput>) => this.request<Group>("PATCH", `/api/groups/${id}`, input);
  deleteGroup = (id: string) => this.request<void>("DELETE", `/api/groups/${id}`);
  listTags = () => this.request<Tag[]>("GET", "/api/tags");
  renameTag = (id: string, name: string) => this.request<Tag>("PATCH", `/api/tags/${id}`, { name });
  deleteTag = (id: string) => this.request<void>("DELETE", `/api/tags/${id}`);

  // AI capture
  proposeCapture = (contactId: string, text: string) =>
    this.request<CaptureProposal>("POST", `/api/contacts/${contactId}/capture`, { text });
  commitCapture = (contactId: string, commit: CaptureCommit) =>
    this.request<ContactDetail>("POST", `/api/contacts/${contactId}/capture/commit`, commit);
  aiUsage = () => this.request<AiUsage>("GET", "/api/ai/usage");

  // Push
  pushPublicKey = () => this.request<{ publicKey: string }>("GET", "/api/push/public-key");
  pushSubscribe = (subscription: unknown) => this.request<void>("POST", "/api/push/subscribe", subscription);
  pushUnsubscribe = (endpoint: string) => this.request<void>("DELETE", "/api/push/subscribe", { endpoint });
  pushTest = () => this.request<{ sent: number }>("POST", "/api/push/test");

  // Data control
  exportJsonUrl = () => `${this.baseUrl}/api/export.json`;
  exportCsvUrl = () => `${this.baseUrl}/api/export.csv`;
  deleteEverything = () => this.request<void>("DELETE", "/api/data", { confirm: "DELETE" });
}
