import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient, ApiError, type ContactDetail, type ContactSummary } from "@rapport/core";

export const api = new ApiClient("");

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The service worker answers from cache when offline, so always try.
      networkMode: "offlineFirst",
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

export const keys = {
  me: ["me"] as const,
  contacts: ["contacts"] as const,
  contact: (id: string) => ["contact", id] as const,
  groups: ["groups"] as const,
  tags: ["tags"] as const,
  aiUsage: ["ai-usage"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.me, retry: false, staleTime: 5 * 60_000 });
export const useContacts = () => useQuery({ queryKey: keys.contacts, queryFn: api.listContacts });
export const useContact = (id: string | undefined) =>
  useQuery({ queryKey: keys.contact(id ?? ""), queryFn: () => api.getContact(id!), enabled: Boolean(id) });
export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: api.listGroups, staleTime: 5 * 60_000 });
export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: api.listTags });
export const useAiUsage = () => useQuery({ queryKey: keys.aiUsage, queryFn: api.aiUsage });

/** After any write to a contact: refresh the list, its detail, and tags (which may have been created or pruned). */
export function useInvalidateContact() {
  const qc = useQueryClient();
  return (id?: string, detail?: ContactDetail) => {
    if (id && detail) qc.setQueryData(keys.contact(id), detail);
    else if (id) void qc.invalidateQueries({ queryKey: keys.contact(id) });
    void qc.invalidateQueries({ queryKey: keys.contacts });
    void qc.invalidateQueries({ queryKey: keys.tags });
  };
}

/** Generic mutation that refreshes a contact afterwards. */
export function useContactMutation<TVars, TResult>(contactId: string | undefined, fn: (vars: TVars) => Promise<TResult>) {
  const invalidate = useInvalidateContact();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const detail = result && typeof result === "object" && "interactions" in result ? (result as unknown as ContactDetail) : undefined;
      invalidate(contactId, detail);
    },
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.message === "Failed to fetch") return "You're offline. Try again when you're connected.";
    return err.message;
  }
  if (err instanceof TypeError) return "You're offline. Try again when you're connected.";
  return err instanceof Error ? err.message : "Something went wrong";
}

export function contactLabel(c: Pick<ContactSummary, "name" | "nickname">) {
  return c.nickname ? `${c.name} (${c.nickname})` : c.name;
}
