"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  message: string;
  created_at: string;
};

export default function ConversationPage() {
  const supabase = createClient();
  const params = useParams();

  const conversationId =
    typeof params.conversationId === "string"
      ? params.conversationId
      : "";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    loadPage();
  }, [conversationId]);

  async function loadPage() {
    setLoading(true);
    setError("");
    setHasAccess(null);

    if (!conversationId) {
      setError("Sohbet bulunamadı.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Mesajları görmek için giriş yapmalısın.");
      setCurrentUserId(null);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: accessData, error: accessError } =
      await supabase.rpc("can_access_conversation", {
        p_conversation_id: Number(conversationId),
      });

    if (accessError) {
      setError("Sohbete erişim kontrolü yapılamadı.");
      setHasAccess(false);
      setLoading(false);
      return;
    }

    if (!accessData) {
      setError("Bu sohbete erişim yetkin yok.");
      setHasAccess(false);
      setLoading(false);
      return;
    }

    setHasAccess(true);

    await loadMessages();

    setLoading(false);
  }

  async function loadMessages() {
    const { data, error: messagesError } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, message, created_at",
      )
      .eq("conversation_id", Number(conversationId))
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(
        messagesError.message ||
          "Mesajlar yüklenirken bir hata oluştu.",
      );
      return false;
    }

    setMessages((data ?? []) as ChatMessage[]);
    return true;
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  async function sendMessage() {
    const text = draft.trim();

    if (!text) {
      setError("Boş mesaj gönderilemez.");
      return;
    }

    if (!currentUserId) {
      setError("Mesaj göndermek için giriş yapmalısın.");
      return;
    }

    if (!conversationId) {
      setError("Sohbet bulunamadı.");
      return;
    }

    if (!hasAccess) {
      setError("Bu sohbete mesaj gönderme yetkin yok.");
      return;
    }

    setSending(true);
    setError("");

    const { error: insertError } = await supabase.rpc(
      "send_message",
      {
        p_conversation_id: Number(conversationId),
        p_message: text,
      },
    );

    if (insertError) {
      setError(
        insertError.message ||
          "Mesaj gönderilirken bir hata oluştu.",
      );
      setSending(false);
      return;
    }

    setDraft("");

    await loadMessages();

    setSending(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-zinc-500">
          Mesajlar yükleniyor...
        </p>
      </main>
    );
  }

  if (hasAccess === false) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-medium text-red-800">
            Bu sohbete erişim yetkin yok.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-zinc-500">
          Project Match
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Mesajlaşma
        </h1>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Henüz mesaj yok.
            </p>
          ) : (
            messages.map((item) => {
              const isOwn =
                item.sender_id === currentUserId;

              return (
                <div
                  key={item.id}
                  className={`flex ${
                    isOwn
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isOwn
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {item.message}
                    </p>

                    <p
                      className={`mt-2 text-xs ${
                        isOwn
                          ? "text-zinc-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-zinc-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
              rows={3}
              placeholder="Mesajını yaz..."
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={sending}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? "Gönderiliyor..."
                : "Gönder"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}