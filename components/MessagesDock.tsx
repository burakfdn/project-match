"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ConversationProjectContext,
  ConversationStartNotice,
  getConversationJobStartIndex,
  loadConversationProjectJobs,
  conversationJobHref,
  type ConversationJob,
} from "@/components/ConversationProjectContext";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_PATHS = ["/login", "/signup", "/onboarding"];

type DockConversation = {
  conversation_id: number;
  job_id: number | null;
  job_title: string | null;
  other_user_id: string | null;
  other_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  conversationJobs: ConversationJob[];
};

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  message: string;
  created_at: string;
};

type IncomingPreview = {
  conversation_id: number;
  sender_name: string;
  message: string;
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function excerptText(value: string, maxLength = 72) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function parseIncomingMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = Number(row.id);
  const conversationId = Number(row.conversation_id);
  const createdAt =
    row.created_at == null ? "" : String(row.created_at);
  const message = row.message == null ? "" : String(row.message);
  const senderId =
    row.sender_id == null ? "" : String(row.sender_id);

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(conversationId) ||
    !senderId ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    message,
    created_at: createdAt,
  };
}

function findConversation(
  conversations: DockConversation[],
  conversationId: number,
) {
  return (
    conversations.find(
      (conversation) =>
        Number(conversation.conversation_id) === conversationId,
    ) ?? null
  );
}

function normalizeConversations(data: unknown): DockConversation[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const conversation = row as DockConversation;

    return {
      ...conversation,
      unread_count: Math.max(
        0,
        Number(conversation.unread_count) || 0,
      ),
      conversationJobs: Array.isArray(conversation.conversationJobs)
        ? conversation.conversationJobs
        : [],
    };
  });
}

function formatUnreadCount(count: number) {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) {
    return "K";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonAvatar({
  name,
  size = "sm",
}: {
  name: string | null | undefined;
  size?: "sm" | "md";
}) {
  const sizeClass =
    size === "md"
      ? "h-9 w-9 text-xs"
      : "h-8 w-8 text-[11px]";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white ${sizeClass}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

export const OPEN_MESSAGES_DOCK_EVENT =
  "project-match-open-conversation";
export const OPEN_MESSAGES_LIST_EVENT =
  "project-match-open-messages";
export const MESSAGES_UNREAD_CHANGE_EVENT =
  "project-match-messages-unread";

export function openMessagesDockConversation(
  conversationId: number,
  jobId?: number,
) {
  window.dispatchEvent(
    new CustomEvent(OPEN_MESSAGES_DOCK_EVENT, {
      detail: { conversationId, jobId },
    }),
  );
}

export function openMessagesDock() {
  window.dispatchEvent(new Event(OPEN_MESSAGES_LIST_EVENT));
}

export function notifyMessagesUnreadChange() {
  window.dispatchEvent(new Event(MESSAGES_UNREAD_CHANGE_EVENT));
}

export default function MessagesDock() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<
    DockConversation[]
  >([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<DockConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<IncomingPreview | null>(null);
  const [attentionConversationId, setAttentionConversationId] =
    useState<number | null>(null);
  const [buttonPulse, setButtonPulse] = useState(false);
  const [startedFromJobId, setStartedFromJobId] = useState<
    number | null
  >(null);

  const currentUserIdRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const selectedRef = useRef<DockConversation | null>(null);
  const conversationsRef = useRef<DockConversation[]>([]);
  const handleIncomingRef = useRef<(row: ChatMessage) => void>(
    () => {},
  );
  const openConversationByIdRef = useRef<
    (conversationId: number, startedFromJobId?: number | null) => Promise<void>
  >(async () => {});
  const previousUnreadTotalRef = useRef<number | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingThreadScrollRef = useRef<"none" | "instant" | "smooth">(
    "none",
  );
  const [hasUnseenIncoming, setHasUnseenIncoming] = useState(false);
  const [menuConversationId, setMenuConversationId] = useState<
    number | null
  >(null);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    setOpen(false);
    setSelected(null);
    loadAuth();
  }, [pathname]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    void fetchConversations();
  }, [currentUserId]);

  useEffect(() => {
    if (!open || selected) {
      return;
    }

    loadConversations();
  }, [open, selected]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel("messages-dock")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const incoming = parseIncomingMessage(
            payload.new ??
              (payload as { record?: unknown }).record,
          );

          if (!incoming) {
            return;
          }

          handleIncomingRef.current(incoming);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleOpenConversationEvent(event: Event) {
      const customEvent = event as CustomEvent<{
        conversationId?: number;
        jobId?: number;
      }>;
      const conversationId = Number(customEvent.detail?.conversationId);
      const jobId = Number(customEvent.detail?.jobId);

      if (!Number.isFinite(conversationId) || conversationId <= 0) {
        return;
      }

      void openConversationByIdRef.current(
        conversationId,
        Number.isFinite(jobId) && jobId > 0 ? jobId : null,
      );
    }

    window.addEventListener(
      OPEN_MESSAGES_DOCK_EVENT,
      handleOpenConversationEvent,
    );

    function handleOpenListEvent() {
      setOpen(true);
      setSelected(null);
      setMenuConversationId(null);
    }

    window.addEventListener(OPEN_MESSAGES_LIST_EVENT, handleOpenListEvent);

    return () => {
      window.removeEventListener(
        OPEN_MESSAGES_DOCK_EVENT,
        handleOpenConversationEvent,
      );
      window.removeEventListener(
        OPEN_MESSAGES_LIST_EVENT,
        handleOpenListEvent,
      );
    };
  }, []);

  async function loadAuth() {
    if (PUBLIC_PATHS.includes(pathname)) {
      setCurrentUserId(null);
      setReady(true);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? null);
    setReady(true);
  }

  async function fetchConversations() {
    const { data, error } = await supabase.rpc("get_my_conversations");

    if (error) {
      return null;
    }

    const next = normalizeConversations(data);
    setConversations(next);
    notifyMessagesUnreadChange();
    return next;
  }

  async function loadConversations() {
    setListLoading(true);
    setListError("");

    const { data, error } = await supabase.rpc("get_my_conversations");

    if (error) {
      console.error(error);
      setListError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setConversations([]);
      setListLoading(false);
      return;
    }

    setConversations(normalizeConversations(data));
    setListLoading(false);
    notifyMessagesUnreadChange();
  }

  async function loadMessages(conversationId: number) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, message, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setThreadError("Bir hata oluştu. Lütfen tekrar deneyin.");
      return false;
    }

    setMessages((data ?? []) as ChatMessage[]);
    return true;
  }

  async function loadConversationJobs(
    conversationId: number,
    otherUserId: string | null,
  ) {
    return loadConversationProjectJobs(
      supabase,
      conversationId,
      currentUserIdRef.current,
      otherUserId,
    );
  }

  async function markConversationRead(conversationId: number) {
    const { error } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
    });

    if (error) {
      return false;
    }

    setConversations((current) =>
      current.map((conversation) =>
        Number(conversation.conversation_id) === conversationId
          ? {
              ...conversation,
              unread_count: 0,
            }
          : conversation,
      ),
    );
    notifyMessagesUnreadChange();

    return true;
  }

  async function markConversationUnread(conversationId: number) {
    const { error } = await supabase.rpc("mark_conversation_unread", {
      p_conversation_id: conversationId,
    });

    if (error) {
      return false;
    }

    await fetchConversations();
    setMenuConversationId(null);
    return true;
  }

  handleIncomingRef.current = (incoming: ChatMessage) => {
    const userId = currentUserIdRef.current;

    if (!userId) {
      return;
    }

    if (incoming.sender_id === userId) {
      if (
        openRef.current &&
        selectedRef.current &&
        Number(selectedRef.current.conversation_id) ===
          incoming.conversation_id
      ) {
        pendingThreadScrollRef.current = "smooth";
        setMessages((current) => {
          if (current.some((item) => item.id === incoming.id)) {
            return current;
          }

          return [...current, incoming];
        });
      }

      setConversations((current) =>
        current.map((conversation) =>
          Number(conversation.conversation_id) === incoming.conversation_id
            ? {
                ...conversation,
                last_message: incoming.message,
                last_message_at: incoming.created_at,
              }
            : conversation,
        ),
      );
      return;
    }

    const selectedId = selectedRef.current
      ? Number(selectedRef.current.conversation_id)
      : null;
    const isOpenThread =
      openRef.current &&
      selectedId !== null &&
      selectedId === incoming.conversation_id;

    if (isOpenThread) {
      if (stickToBottomRef.current) {
        pendingThreadScrollRef.current = "smooth";
      } else {
        setHasUnseenIncoming(true);
      }

      setMessages((current) => {
        if (current.some((item) => item.id === incoming.id)) {
          return current;
        }

        return [...current, incoming];
      });
      setConversations((current) =>
        current.map((conversation) =>
          Number(conversation.conversation_id) === incoming.conversation_id
            ? {
                ...conversation,
                last_message: incoming.message,
                last_message_at: incoming.created_at,
                unread_count: 0,
              }
            : conversation,
        ),
      );
      setPreview((current) =>
        current?.conversation_id === incoming.conversation_id
          ? null
          : current,
      );
      setAttentionConversationId((current) =>
        current === incoming.conversation_id ? null : current,
      );
      void markConversationRead(incoming.conversation_id);
      return;
    }

    setConversations((current) => {
      const exists = current.some(
        (conversation) =>
          Number(conversation.conversation_id) === incoming.conversation_id,
      );

      if (!exists) {
        return current;
      }

      return current.map((conversation) =>
        Number(conversation.conversation_id) === incoming.conversation_id
          ? {
              ...conversation,
              last_message: incoming.message,
              last_message_at: incoming.created_at,
              unread_count: (conversation.unread_count ?? 0) + 1,
            }
            : conversation,
      );
    });

    notifyMessagesUnreadChange();
    void showIncomingPreview(incoming);
  };

  async function showIncomingPreview(incoming: ChatMessage) {
    setAttentionConversationId(incoming.conversation_id);

    let conversation = findConversation(
      conversationsRef.current,
      incoming.conversation_id,
    );

    if (!conversation) {
      const next = await fetchConversations();
      conversation = findConversation(
        next ?? [],
        incoming.conversation_id,
      );
    }

    setPreview({
      conversation_id: incoming.conversation_id,
      sender_name: conversation?.other_user_name?.trim() || "Yeni mesaj",
      message: incoming.message,
    });
  }

  async function openConversation(
    conversation: DockConversation,
    startedFromJobIdValue: number | null = null,
  ) {
    const conversationId = Number(conversation.conversation_id);

    setHasUnseenIncoming(false);
    stickToBottomRef.current = true;
    pendingThreadScrollRef.current = "instant";
    setStartedFromJobId(startedFromJobIdValue);
    setSelected({
      ...conversation,
      conversationJobs: conversation.conversationJobs ?? [],
    });
    setDraft("");
    setMessages([]);
    setThreadError("");
    setHasAccess(null);
    setThreadLoading(true);
    setPreview((current) =>
      current?.conversation_id === conversationId ? null : current,
    );
    setAttentionConversationId((current) =>
      current === conversationId ? null : current,
    );

    const { data: accessData, error: accessError } = await supabase.rpc(
      "can_access_conversation",
      {
        p_conversation_id: conversationId,
      },
    );

    if (accessError) {
      setThreadError("Sohbete erişim kontrolü yapılamadı.");
      setHasAccess(false);
      setThreadLoading(false);
      return;
    }

    if (!accessData) {
      setThreadError("Bu sohbete erişim yetkin yok.");
      setHasAccess(false);
      setThreadLoading(false);
      return;
    }

    setHasAccess(true);
    const [loaded, conversationJobs] = await Promise.all([
      loadMessages(conversationId),
      loadConversationJobs(conversationId, conversation.other_user_id),
    ]);
    setSelected((current) =>
      current && Number(current.conversation_id) === conversationId
        ? {
            ...current,
            conversationJobs,
          }
        : current,
    );
    setThreadLoading(false);

    if (loaded) {
      void markConversationRead(conversationId);
    }
  }

  openConversationByIdRef.current = async (
    conversationId: number,
    startedFromJobIdValue: number | null = null,
  ) => {
    setOpen(true);

    let existing = findConversation(
      conversationsRef.current,
      conversationId,
    );

    if (!existing) {
      const next = await fetchConversations();
      existing = findConversation(next ?? [], conversationId);
    }

    await openConversation(
      existing ?? {
        conversation_id: conversationId,
        job_id: null,
        job_title: null,
        other_user_id: null,
        other_user_name: null,
        last_message: null,
        last_message_at: null,
        unread_count: 0,
        conversationJobs: [],
      },
      startedFromJobIdValue,
    );
  };

  async function openPreviewConversation() {
    if (!preview) {
      return;
    }

    const conversationId = preview.conversation_id;
    const existing = findConversation(
      conversationsRef.current,
      conversationId,
    );

    setOpen(true);
    await openConversation(
      existing ?? {
        conversation_id: conversationId,
        job_id: null,
        job_title: null,
        other_user_id: null,
        other_user_name:
          preview.sender_name === "Yeni mesaj"
            ? null
            : preview.sender_name,
        last_message: preview.message,
        last_message_at: null,
        unread_count: 0,
        conversationJobs: [],
      },
      null,
    );
  }

  async function sendMessage() {
    const text = draft.trim();
    const conversationId = selected
      ? Number(selected.conversation_id)
      : NaN;

    if (!text) {
      setThreadError("Boş mesaj gönderilemez.");
      return;
    }

    if (!currentUserId) {
      setThreadError("Mesaj göndermek için giriş yapmalısın.");
      return;
    }

    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setThreadError("Sohbet bulunamadı.");
      return;
    }

    if (!hasAccess) {
      setThreadError("Bu sohbete mesaj gönderme yetkin yok.");
      return;
    }

    setSending(true);
    setThreadError("");

    const { error: insertError } = await supabase.rpc("send_message", {
      p_conversation_id: conversationId,
      p_message: text,
    });

    if (insertError) {
      console.error(insertError);
      setThreadError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSending(false);
      return;
    }

    setDraft("");
    pendingThreadScrollRef.current = "smooth";
    const loaded = await loadMessages(conversationId);
    if (!loaded) {
      pendingThreadScrollRef.current = "none";
    }
    void markConversationRead(conversationId);
    setSending(false);
  }

  function closePanel() {
    setOpen(false);
    setSelected(null);
    setDraft("");
    setThreadError("");
    setHasAccess(null);
    setStartedFromJobId(null);
    setHasUnseenIncoming(false);
    setMenuConversationId(null);
    pendingThreadScrollRef.current = "none";
  }

  function backToList() {
    setSelected(null);
    setMessages([]);
    setDraft("");
    setThreadError("");
    setHasAccess(null);
    setStartedFromJobId(null);
    setHasUnseenIncoming(false);
    setMenuConversationId(null);
    pendingThreadScrollRef.current = "none";
  }

  function handleThreadScroll() {
    const el = threadScrollRef.current;

    if (!el) {
      return;
    }

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= 96;
    stickToBottomRef.current = nearBottom;

    if (nearBottom) {
      setHasUnseenIncoming(false);
    }
  }

  function scrollThreadToBottom(behavior: ScrollBehavior) {
    threadEndRef.current?.scrollIntoView({
      block: "end",
      behavior,
    });
    stickToBottomRef.current = true;
    setHasUnseenIncoming(false);
  }

  function dismissPreview() {
    setPreview(null);
  }

  const totalUnreadCount = conversations.reduce(
    (sum, conversation) => sum + (conversation.unread_count ?? 0),
    0,
  );
  const hasUnread = totalUnreadCount > 0;
  const hasIncomingAttention =
    attentionConversationId !== null || hasUnread;
  const startedJob =
    selected && startedFromJobId != null
      ? (selected.conversationJobs.find(
          (job) => job.job_id === startedFromJobId,
        ) ?? null)
      : null;
  const projectStartIndex = startedJob
    ? getConversationJobStartIndex(messages, startedJob.linked_at)
    : -1;

  useEffect(() => {
    const previousCount = previousUnreadTotalRef.current;
    previousUnreadTotalRef.current = totalUnreadCount;

    if (
      previousCount === null ||
      totalUnreadCount <= previousCount ||
      totalUnreadCount === 0
    ) {
      return;
    }

    setButtonPulse(true);

    const timeout = window.setTimeout(() => {
      setButtonPulse(false);
    }, 280);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [totalUnreadCount]);

  useEffect(() => {
    if (!selected || threadLoading) {
      return;
    }

    const mode = pendingThreadScrollRef.current;

    if (mode === "none") {
      return;
    }

    pendingThreadScrollRef.current = "none";
    const behavior: ScrollBehavior = mode === "instant" ? "auto" : "smooth";
    const frame = window.requestAnimationFrame(() => {
      scrollThreadToBottom(behavior);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [messages, threadLoading, selected?.conversation_id]);

  if (!ready || PUBLIC_PATHS.includes(pathname) || !currentUserId) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 max-w-full">
      {open ? (
        <div className="pointer-events-auto absolute inset-x-3 bottom-[4.75rem] top-auto flex h-[min(62vh,36rem)] max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:inset-auto sm:right-6 sm:bottom-20 sm:top-auto sm:h-[600px] sm:max-h-none sm:w-[400px]">
          {selected ? (
            <>
              <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3">
                <button
                  type="button"
                  onClick={backToList}
                  className="mt-1 shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900"
                >
                  ←
                </button>

                <PersonAvatar
                  name={selected.other_user_name}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {selected.other_user_name?.trim() || "Kullanıcı"}
                  </p>
                </div>
              </div>

              <ConversationProjectContext
                key={selected.conversation_id}
                jobs={selected.conversationJobs}
                currentUserId={currentUserId}
                onViewJob={(jobId) => {
                  closePanel();
                  router.push(conversationJobHref(selected.conversationJobs, jobId));
                }}
              />

              <div className="relative min-h-0 flex-1">
                <div
                  ref={threadScrollRef}
                  onScroll={handleThreadScroll}
                  className="h-full space-y-3 overflow-y-auto px-4 py-3"
                >
                {threadLoading ? (
                  <p className="text-sm text-zinc-500">
                    Mesajlar yükleniyor...
                  </p>
                ) : hasAccess === false ? (
                  <p className="text-sm text-red-700">
                    {threadError || "Bu sohbete erişim yetkin yok."}
                  </p>
                ) : (
                  <>
                    {threadError ? (
                      <p className="text-sm text-red-700">{threadError}</p>
                    ) : null}

                    {messages.length === 0 && !startedJob ? (
                      <p className="text-sm text-zinc-500">
                        Henüz mesaj yok.
                      </p>
                    ) : (
                      <>
                        {messages.map((item, index) => {
                          const isOwn = item.sender_id === currentUserId;

                          return (
                            <Fragment key={item.id}>
                              {startedJob &&
                              index === projectStartIndex ? (
                                <ConversationStartNotice
                                  job={startedJob}
                                  onViewJob={(jobId) => {
                                    closePanel();
                                    router.push(conversationJobHref(selected.conversationJobs, jobId));
                                  }}
                                />
                              ) : null}
                              <div
                                className={`flex ${
                                  isOwn
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[min(80%,18rem)] rounded-2xl px-3 py-2 sm:max-w-[80%] ${
                                    isOwn
                                      ? "bg-zinc-900 text-white"
                                      : "bg-zinc-100 text-zinc-900"
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap break-words text-sm leading-5">
                                    {item.message}
                                  </p>
                                  <p
                                    className={`mt-1 text-[11px] ${
                                      isOwn
                                        ? "text-zinc-300"
                                        : "text-zinc-500"
                                    }`}
                                  >
                                    {formatMessageTime(item.created_at)}
                                  </p>
                                </div>
                              </div>
                            </Fragment>
                          );
                        })}
                        {startedJob &&
                        projectStartIndex >= messages.length ? (
                          <ConversationStartNotice
                            job={startedJob}
                            onViewJob={(jobId) => {
                              closePanel();
                              router.push(conversationJobHref(selected.conversationJobs, jobId));
                            }}
                          />
                        ) : null}
                        <div ref={threadEndRef} />
                      </>
                    )}
                  </>
                )}
                </div>
                {hasUnseenIncoming ? (
                  <button
                    type="button"
                    onClick={() => scrollThreadToBottom("smooth")}
                    className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                  >
                    ↓ Yeni mesaj
                  </button>
                ) : null}
              </div>

              <div className="border-t border-zinc-100 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={2}
                    placeholder="Mesajını yaz..."
                    disabled={
                      sending || threadLoading || hasAccess !== true
                    }
                    className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 sm:min-h-0 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={
                      sending || threadLoading || hasAccess !== true
                    }
                    className="min-h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2"
                  >
                    {sending ? "..." : "Gönder"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">
                  Mesajlar
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {listLoading ? (
                  <p className="px-4 py-6 text-sm text-zinc-500">
                    Konuşmalar yükleniyor...
                  </p>
                ) : listError ? (
                  <p className="px-4 py-6 text-sm text-red-700">
                    {listError}
                  </p>
                ) : conversations.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-zinc-500">
                    Henüz mesajlaşman yok.
                  </p>
                ) : (
                  conversations.map((conversation) => {
                    const unreadCount = conversation.unread_count ?? 0;
                    const isUnread = unreadCount > 0;
                    const conversationId = Number(
                      conversation.conversation_id,
                    );
                    const menuOpen = menuConversationId === conversationId;

                    return (
                      <div
                        key={conversation.conversation_id}
                        className={`relative flex items-stretch border-t border-zinc-100 first:border-t-0 ${
                          isUnread ? "bg-zinc-50" : "bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuConversationId(null);
                            void openConversation(conversation);
                          }}
                          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                        >
                          <PersonAvatar
                            name={conversation.other_user_name}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`truncate text-sm ${
                                  isUnread
                                    ? "font-semibold text-zinc-950"
                                    : "font-medium text-zinc-900"
                                }`}
                              >
                                {conversation.other_user_name?.trim() ||
                                  "Kullanıcı"}
                              </p>
                              {conversation.last_message_at ? (
                                <p className="shrink-0 text-[11px] text-zinc-400">
                                  {formatMessageTime(
                                    conversation.last_message_at,
                                  )}
                                </p>
                              ) : null}
                            </div>
                            {conversation.job_title?.trim() ? (
                              <p className="mt-0.5 truncate text-[11px] leading-4 text-zinc-400">
                                {conversation.job_title.trim()}
                              </p>
                            ) : null}
                            <p
                              className={`mt-1 truncate text-xs ${
                                isUnread
                                  ? "font-medium text-zinc-700"
                                  : "text-zinc-500"
                              }`}
                            >
                              {excerptText(
                                conversation.last_message?.trim() ||
                                  "Henüz mesaj yok.",
                              )}
                            </p>
                          </div>
                          {isUnread ? (
                            <span className="mt-0.5 inline-flex h-[21px] min-w-[21px] shrink-0 items-center justify-center rounded-full bg-zinc-900 px-2 text-[11px] font-medium leading-none text-white">
                              {formatUnreadCount(unreadCount)}
                            </span>
                          ) : null}
                        </button>

                        <div className="relative shrink-0 pr-2 pt-2">
                          <button
                            type="button"
                            aria-label="Konuşma seçenekleri"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMenuConversationId(
                                menuOpen ? null : conversationId,
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                          >
                            ⋯
                          </button>
                          {menuOpen ? (
                            <div
                              role="menu"
                              className="absolute right-2 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isUnread) {
                                    void markConversationRead(conversationId);
                                    setMenuConversationId(null);
                                  } else {
                                    void markConversationUnread(
                                      conversationId,
                                    );
                                  }
                                }}
                                className="w-full px-3 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                              >
                                {isUnread
                                  ? "Okundu olarak işaretle"
                                  : "Okunmadı olarak işaretle"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {preview ? (
        <div className="pointer-events-auto absolute bottom-3 left-3 right-[5.75rem] sm:left-auto sm:right-40 sm:bottom-5 sm:w-[320px] sm:max-w-[340px]">
          <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => openPreviewConversation()}
              className="flex w-full items-start gap-3 px-4 py-3 pr-10 text-left"
            >
              <PersonAvatar name={preview.sender_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {preview.sender_name}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-400">
                  {excerptText(preview.message || "", 64) ||
                    "Yeni mesaj"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={dismissPreview}
              aria-label="Önizlemeyi kapat"
              className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (open) {
            closePanel();
          } else {
            setOpen(true);
          }
        }}
        className={`pointer-events-auto absolute right-3 bottom-3 inline-flex h-11 max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium shadow-sm transition-transform duration-200 sm:right-6 sm:bottom-5 sm:h-auto sm:gap-2 sm:px-4 sm:py-2.5 ${
          hasUnread
            ? "border-rose-300 bg-rose-50 text-rose-800 shadow-md"
            : open
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
        } ${buttonPulse ? "scale-105" : "scale-100"}`}
      >
        {hasIncomingAttention ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
        ) : null}
        <span className="truncate">
          Mesajlar
          {hasUnread ? (
            <>
              {" · "}
              {formatUnreadCount(totalUnreadCount)}
              <span className="hidden sm:inline"> yeni</span>
            </>
          ) : null}
        </span>
      </button>
    </div>
  );
}
