'use client';

import { useAuthModal } from '../context/AuthModalContext';

interface LoginPromptProps {
  message?: string;
}

export default function LoginPrompt({ message = 'คุณยังไม่ได้เข้าสู่ระบบ' }: LoginPromptProps) {
  const { openLoginModal } = useAuthModal();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-blue-700">
            {message} ข้อมูลที่คุณเห็นเป็นเพียงตัวอย่าง หากต้องการใช้งานเต็มรูปแบบ กรุณาเข้าสู่ระบบ
          </p>
          <div className="mt-3 text-sm md:mt-0 md:ml-6">
            <button
              onClick={openLoginModal}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-jade-700"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 