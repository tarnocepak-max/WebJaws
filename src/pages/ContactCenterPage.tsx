import React, { useState, useEffect, useCallback } from 'react';
import {
  Headphones,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Search,
  MessageSquare,
  Clock,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { TicketMessage } from '../types';
import { Badge } from '../components/common/Badge';

export const ContactCenterPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedWoNumber, setSelectedWoNumber] = useState<string>('WO-202611-0081');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.getContactMessages();
      setMessages(res.messages);
      setThreads(res.threads || []);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 8000); // Poll for live chat updates
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setSending(true);
    try {
      await api.sendContactMessage({
        wo_number: selectedWoNumber,
        message: inputText.trim(),
      });
      setInputText('');
      await fetchMessages();
    } catch (err: any) {
      alert(`Gagal mengirim pesan: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const activeMessages = messages.filter(
    (m) => m.wo_number && m.wo_number.toLowerCase() === selectedWoNumber.toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Headphones className="w-6 h-6 text-sky-400" />
            Contact Center &amp; LiveChat Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Komunikasi Operasional Real-time Antara Agent Dispatch &bull; Leader &bull; Installer
          </p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Segarkan Chat</span>
        </button>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Left: Ticket Threads List */}
        <div className="border-r border-slate-800 flex flex-col bg-slate-950/60">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/80">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Thread Tiket WO
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {threads.length > 0 ? (
              threads.map((thread) => {
                const isSelected = thread.wo_number === selectedWoNumber;
                return (
                  <button
                    key={thread.wo_number}
                    onClick={() => setSelectedWoNumber(thread.wo_number)}
                    className={`w-full p-3.5 text-left transition flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-950/70 border-l-4 border-sky-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {thread.wo_number}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(thread.latestMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium truncate">
                      {thread.latestMessage.sender_name}: {thread.latestMessage.message}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Belum ada percakapan tiket
              </div>
            )}
          </div>
        </div>

        {/* Right: Active LiveChat Window */}
        <div className="md:col-span-2 flex flex-col bg-slate-900">
          {/* Chat Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-extrabold text-white flex items-center gap-2">
                <span>Thread: {selectedWoNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Live Dispatch
                </span>
              </p>
              <p className="text-[10px] text-slate-400">
                Pesan terenkripsi &amp; tercatat dalam audit log
              </p>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeMessages.length > 0 ? (
              activeMessages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                      <span className="font-bold text-slate-200">{msg.sender_name}</span>
                      <span>({msg.sender_role})</span>
                    </div>

                    <div
                      className={`max-w-md p-3 rounded-2xl text-xs ${
                        isMe
                          ? 'bg-sky-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.message}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-sky-400" />}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30 text-sky-400" />
                <p>Belum ada pesan untuk tiket {selectedWoNumber}.</p>
                <p className="text-[11px] text-slate-400">Mulai diskusi operasional di bawah.</p>
              </div>
            )}
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Tulis pesan untuk ${selectedWoNumber}...`}
              className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
