import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { authApi } from "../../lib/auth";

// Compact markdown styling for chat bubbles (no typography plugin)
const markdownComponents = {
  h1: (props) => <h1 className="text-sm font-bold mt-2 mb-1 first:mt-0" {...props} />,
  h2: (props) => <h2 className="text-sm font-bold mt-2 mb-1 first:mt-0" {...props} />,
  h3: (props) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0" {...props} />,
  p: (props) => <p className="mb-1.5 last:mb-0" {...props} />,
  ul: (props) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
  ol: (props) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
  li: (props) => <li className="leading-snug" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => (
    <a
      className="text-blue-600 dark:text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: (props) => (
    <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[0.85em]" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-2 italic mb-1.5" {...props} />
  ),
  hr: (props) => <hr className="my-2 border-gray-300 dark:border-gray-600" {...props} />,
};

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SUGGEST_TRIP_PROMPT = "Suggest my next trip ✈️";

export default function AiChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Pintrip assistant ✈️ Ask me anything about your trips!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  const suggestTrip = async () => {
    if (loading) return;
    setMessages((prev) => [...prev, { role: "user", content: SUGGEST_TRIP_PROMPT }]);
    setLoading(true);

    try {
      const session = authApi.getSession();
      const token = session?.access_token || "";

      const res = await fetch(`${BACKEND_URL}/ai/suggest-trip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("suggest-trip failed");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.intro || "Here are some ideas for your next trip:",
          suggestions: data.suggestions || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't come up with suggestions right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const goToTrip = (s) => {
    const params = new URLSearchParams({
      dest: `${s.lat},${s.lng}`,
      name: s.country ? `${s.name}, ${s.country}` : s.name,
      reason: s.reason || "",
    });
    setIsOpen(false);
    navigate(`/arc?${params.toString()}`);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const session = authApi.getSession();
      const token = session?.access_token || "";

      const res = await fetch(`${BACKEND_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Sorry, I couldn't get a response." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
        <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-10 right-12 z-50 w-14 h-14 rounded-full bg-white text-black shadow-lg flex items-center justify-center hover:bg-white-700 transition-all overflow-hidden"
        aria-label="Toggle AI Chat"
        >
        {isOpen ? (
            <span className="text-2xl">✕</span>
        ) : (
            <img
            src="/icons8-chat.gif"
            alt="Chat"
            width={36}
            height={36}
            style={{ mixBlendMode: "multiply" }}
            className="object-contain"
            />
        )}
        </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-11 z-50 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary/10 text-primary px-4 py-3 font-semibold text-sm flex items-center gap-2">
            Pintrip AI Assistant
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                  {msg.suggestions?.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => goToTrip(s)}
                          className="w-full text-left border border-gray-300 dark:border-gray-600
                                     rounded-lg px-3 py-2 bg-white dark:bg-gray-900
                                     hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800
                                     transition-colors"
                        >
                          <span className="block font-semibold text-blue-600 dark:text-blue-400">
                            📍 {s.name}{s.country ? `, ${s.country}` : ""}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {s.reason}
                          </span>
                          <span className="block text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                            Show route on map →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-3 py-2 rounded-xl rounded-bl-sm text-sm animate-pulse">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompt */}
          {!loading && (
            <div className="px-3 pb-1 flex flex-wrap gap-2">
              <button
                onClick={suggestTrip}
                className="text-xs border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400
                           rounded-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
              >
                {SUGGEST_TRIP_PROMPT}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your trip..."
              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}