import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { MessageSquare, X, Send, Paperclip, Loader2, Bot, User } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: { name: string; type: string }[];
}

interface AIAssistantProps {
  posts: any[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ posts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; base64: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const allowedTypes = [
        'text/plain',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg',
      ];
      const validFiles = filesArray.filter((file) => allowedTypes.includes(file.type));

      const newAttachments = await Promise.all(
        validFiles.map(async (file) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
          });
          return { file, base64 };
        })
      );

      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: input,
      attachments: attachments.map((a) => ({ name: a.file.name, type: a.file.type })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const formattedAttachments = attachments.map((a) => {
      const base64Data = a.base64.split(',')[1];
      return { mimeType: a.file.type, data: base64Data };
    });

    setAttachments([]);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages,
          prompt: userMessage.text,
          attachments: formattedAttachments,
          systemContext: posts
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      setMessages((prev) => [...prev, { role: 'model', text: data.text }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `**Erro:** ${error.message}` },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            drag
            dragMomentum={false}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center cursor-pointer"
            style={{ touchAction: 'none' }}
          >
            <MessageSquare size={28} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragHandle=".chat-header"
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, x: 0, y: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
            style={{ top: '10%', left: 'calc(100vw - 420px)', width: '400px', height: '600px', resize: 'both', minWidth: '300px', minHeight: '400px', maxWidth: '100vw', maxHeight: '100vh', touchAction: 'none' }}
          >
            <div className="chat-header bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center cursor-move select-none">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Bot size={20} /> Assistente IA
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 text-sm mt-10">
                  <Bot size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Olá! Sou seu assistente de gestão.</p>
                  <p>Como posso ajudar com os indicadores hoje?</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-emerald-600/20 border border-emerald-500/30 text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="bg-slate-900/50 px-2 py-1 rounded text-[10px] text-slate-400 flex items-center gap-1 border border-slate-700">
                            <Paperclip size={10} /> {att.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-start">
                  <div className="bg-slate-800 border border-slate-700 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span className="text-xs text-slate-400">Digitando...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="bg-slate-800 px-2 py-1 rounded-lg text-xs text-slate-300 flex items-center gap-2 border border-slate-700">
                      <span className="truncate max-w-[100px]">{att.file.name}</span>
                      <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-300"><X size={12}/></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".txt,.csv,.xlsx,image/png,image/jpeg"
                />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-emerald-400 bg-slate-900 rounded-xl border border-slate-800 transition-colors">
                  <Paperclip size={18} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white resize-none outline-none focus:border-emerald-500 min-h-[44px] max-h-[120px] custom-scrollbar"
                  rows={1}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
