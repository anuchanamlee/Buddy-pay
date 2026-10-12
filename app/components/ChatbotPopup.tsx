'use client';

import { useState, useEffect, useRef } from 'react';
import { Transition } from '@headlessui/react';
import { XCircleIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';

// ประเภทข้อมูลของข้อความในแชท (system prompt อยู่ฝั่ง server เท่านั้น)
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// คุณสมบัติของ ChatbotPopup
type ChatbotPopupProps = {
  position?: 'bottom-right' | 'bottom-left'; // ตำแหน่งของ popup
  botName?: string; // ชื่อของแชทบอท
  primaryColor?: string; // สีหลักของ UI
};

// ขีดจำกัดให้ตรงกับ CHAT_LIMITS ใน app/lib/chat/validation.ts ฝั่ง server
const MAX_HISTORY_MESSAGES = 20;
const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_ASSISTANT_MESSAGE_CHARS = 4000;

// ตัดประวัติแชทให้อยู่ในขีดจำกัดของ server ก่อนส่ง
function toRequestHistory(messages: Message[]): Message[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((msg) => ({
    role: msg.role,
    content: msg.content.slice(0, msg.role === 'user' ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS),
  }));
}

// ข้อความ error ตาม HTTP status ที่ /api/chat ส่งกลับมา
function getErrorMessage(status: number, fallback?: string): string {
  switch (status) {
    case 401: return 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
    case 429: return 'ส่งข้อความถี่เกินไป กรุณารอสักครู่';
    case 503: return 'แชทบอทยังไม่เปิดใช้งาน';
    default: return fallback || 'เกิดข้อผิดพลาดในการส่งข้อความ';
  }
}

export default function ChatbotPopup({
  position = 'bottom-right',
  botName = 'ChatBot GPT',
  primaryColor = 'bg-blue-600',
}: ChatbotPopupProps) {
  const { user, isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();

  // สถานะ
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ref สำหรับ auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // auto-scroll ไปที่ข้อความล่าสุด
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ส่งข้อความไปยัง /api/chat (server เป็นผู้เรียก OpenAI ด้วย key ของ server)
  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return;
    if (!isAuthenticated || !user) {
      setError('กรุณาเข้าสู่ระบบก่อนใช้งานแชทบอท');
      return;
    }

    const newUserMessage: Message = { role: 'user', content: message.trim() };
    const updatedMessages = [...messages, newUserMessage];

    try {
      setLoading(true);
      setError(null);
      setMessages(updatedMessages);
      setInput('');

      const idToken = await user.getIdToken();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ messages: toRequestHistory(updatedMessages) }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.reply !== 'string') {
        setError(getErrorMessage(response.status, data?.message));
        return;
      }

      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('เกิดข้อผิดพลาดในการส่งข้อความ');
    } finally {
      setLoading(false);
    }
  };

  // สี UI
  const buttonClass = primaryColor;
  const positionClass = position === 'bottom-right' 
    ? 'bottom-6 right-6' 
    : 'bottom-6 left-6';

  return (
    <>
      {/* ปุ่มเปิด/ปิด Chatbot */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${buttonClass} fixed ${positionClass} rounded-full p-3 text-white shadow-lg hover:opacity-90 transition-all z-50`}
        aria-label={isOpen ? 'ปิดแชทบอท' : 'เปิดแชทบอท'}
      >
        <ChatBubbleLeftRightIcon className="h-6 w-6" />
      </button>

      {/* Popup แชทบอท */}
      <Transition
        show={isOpen}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div 
          className={`fixed ${positionClass} -translate-y-16 w-80 sm:w-96 h-[32rem] bg-white rounded-xl shadow-2xl overflow-hidden z-40 flex flex-col border border-gray-200`}
        >
          {/* ส่วนหัว */}
          <div className={`${buttonClass} p-4 text-white flex justify-between items-center`}>
            <h3 className="font-semibold text-black">{botName}</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200"
                aria-label="ปิดแชทบอท"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ส่วนแสดงข้อความ */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* แชทบอทใช้งานได้เฉพาะผู้ใช้ที่ล็อกอิน เพราะ server ต้องตรวจ ID token */}
            {!isAuthenticated && (
              <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border text-sm text-black">
                <p className="mb-2">กรุณาเข้าสู่ระบบเพื่อใช้งานแชทบอท</p>
                <button
                  onClick={openLoginModal}
                  className={`${buttonClass} text-white px-3 py-1.5 rounded text-sm`}
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            )}

            {/* แสดงข้อความแชท */}
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-blue-100 ml-6 text-black' 
                      : 'bg-white mr-6 shadow-sm border border-gray-100 text-black'
                  }`}
                >
                  <div className="font-medium text-sm mb-1 text-black">
                    {msg.role === 'user' ? 'คุณ' : botName}
                  </div>
                  <div className="text-sm whitespace-pre-wrap text-black">
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="bg-white p-3 rounded-lg mr-6 shadow-sm border border-gray-100">
                  <div className="font-medium text-sm mb-1">{botName}</div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              )}
              
              {/* ref สำหรับ auto-scroll */}
              <div ref={messagesEndRef} />
            </div>
            
            {/* แสดงข้อความข้อผิดพลาด */}
            {error && (
              <div className="mt-4 p-2 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="p-4 bg-gray-100 rounded-lg shadow-md">
              <h4 className="font-semibold text-lg mb-2">คำถามที่แนะนำ</h4>
              <ul className="space-y-2">
                {[
                  { text: "วิธีการใช้งานแอพพลิเคชัน BuddyPay", icon: "📘" },
                  { text: "การแบ่งบิลด้วยวิธีต่างๆ", icon: "💰" },
                  { text: "การใช้งานระบบชำระเงินผ่าน QR Code", icon: "📲" },
                  { text: "การบันทึกประวัติการแชร์บิล", icon: "📝" }
                ].map((item, index) => (
                  <li key={index} className="flex items-center">
                    <span className="mr-2">{item.icon}</span>
                    <button 
                      onClick={() => sendMessage(item.text)} 
                      disabled={loading || !isAuthenticated}
                      className="text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {item.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* ส่วนกรอกข้อความ */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์ข้อความของคุณที่นี่..."
                maxLength={MAX_USER_MESSAGE_CHARS}
                className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || !isAuthenticated}
              />
              <button
                type="submit"
                disabled={loading || !isAuthenticated || !input.trim()}
                className={`${buttonClass} text-white p-2 rounded-lg disabled:opacity-50`}
                aria-label="ส่งข้อความ"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </>
  );
} 