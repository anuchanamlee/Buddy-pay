import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-blue-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="mt-2 text-gray-600">ลิงก์อาจผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/share-bill" className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700">
          สร้างบิลใหม่
        </Link>
        <Link href="/" className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-50">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
