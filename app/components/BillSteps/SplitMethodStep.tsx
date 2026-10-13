import { formatTHB } from '@/app/lib/format';
import { allocateSatang, fromSatang, toSatang } from '@/app/lib/money';
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { BillState } from '../../lib/billTypes';
import { Badge } from '../ui/Badge';
import { Users, Calculator, FileText, Info } from 'lucide-react';

interface SplitMethodStepProps {
  state: BillState;
  dispatch: React.Dispatch<any>;
}

export default function SplitMethodStep({
  state,
  dispatch
}: SplitMethodStepProps) {
  
  // คำนวณสถิติเบื้องต้น
  const totalAmount = state.foodItems.reduce((sum, item) => sum + item.price, 0);
  const participantCount = state.participants.length;
  const foodItemCount = state.foodItems.length;
  
  // คำนวณค่าเฉลี่ยต่อคน (สำหรับ equal split)
  // ใช้การแบ่งแบบสตางค์เดียวกับหน้าผลลัพธ์ ถ้าหารไม่ลงตัวแสดงเป็นช่วง เช่น 33.33–33.34
  const shares = allocateSatang(toSatang(totalAmount), new Array(participantCount).fill(1)).map(fromSatang);
  const minShare = shares.length ? Math.min(...shares) : 0;
  const maxShare = shares.length ? Math.max(...shares) : 0;
  const perPersonLabel = minShare === maxShare ? formatTHB(maxShare) : `${formatTHB(minShare)}–${formatTHB(maxShare)}`;

  return (
    <>
      <CardHeader className="bg-card border-b px-6 py-4">
        <CardTitle className="text-xl font-semibold flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary text-white inline-flex items-center justify-center mr-2.5 text-sm shadow-sm">3</div>
          <span className="text-primary">วิธีการหารบิล</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 p-6">
        {/* ข้อมูลสรุป */}
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-gray-600">ผู้เข้าร่วม:</span>
            <Badge variant="secondary">{participantCount} คน</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-gray-600">รายการอาหาร:</span>
            <Badge variant="secondary">{foodItemCount} รายการ</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="text-gray-600">ยอดรวม:</span>
            <Badge variant="default">{formatTHB(totalAmount)} บาท</Badge>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-700 flex items-start">
          <Info size={18} className="mr-2 text-blue-500 flex-shrink-0 mt-0.5" />
          <p>เลือกวิธีการหารบิลที่ต้องการ แต่ละวิธีจะมีขั้นตอนการจัดการที่แตกต่างกัน</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-4 text-gray-700">
            วิธีการหารบิล
          </label>
          <div className="grid grid-cols-1 gap-4">
            
            {/* หารเท่ากันทุกคน */}
            <label className={`relative flex items-start p-4 bg-white border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
              state.splitMethod === 'equal' ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}>
              <input
                type="radio"
                checked={state.splitMethod === 'equal'}
                onChange={() => {
                  dispatch({ type: 'SET_SPLIT_METHOD', payload: 'equal' });
                  // Auto-assign ทุกคนให้ทุกรายการเมื่อเลือก equal
                  if (state.participants.length > 0) {
                    const participantIds = state.participants.map(p => p.id);
                    const updatedFoodItems = state.foodItems.map(item => ({
                      ...item,
                      participants: participantIds
                    }));
                    dispatch({ type: 'SET_FOOD_ITEMS', payload: updatedFoodItems });
                  }
                }}
                className="h-5 w-5 text-primary border-gray-300 focus:ring-primary cursor-pointer mt-0.5"
              />
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="block text-base font-medium text-gray-900">หารเท่ากันทุกคน</span>
                  {state.splitMethod === 'equal' && (
                    <Badge variant="default" className="ml-2">เลือกแล้ว</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 mb-3">
                  แบ่งค่าอาหารเป็นจำนวนเท่าๆ กันตามจำนวนคน ทุกคนจ่ายเท่ากันหมด
                </p>
                
                {/* Preview สำหรับ Equal Split */}
                {participantCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700 font-medium">แต่ละคนจ่าย:</span>
                      <span className="text-green-800 font-bold">
                        {perPersonLabel} บาท
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </label>
            
            {/* หารตามรายการที่สั่ง */}
            <label className={`relative flex items-start p-4 bg-white border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
              state.splitMethod === 'itemized' ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}>
              <input
                type="radio"
                checked={state.splitMethod === 'itemized'}
                onChange={() => {
                  dispatch({ type: 'SET_SPLIT_METHOD', payload: 'itemized' });
                  // ล้าง participants assignment เมื่อเลือก itemized
                  const clearedFoodItems = state.foodItems.map(item => ({
                    ...item,
                    participants: []
                  }));
                  dispatch({ type: 'SET_FOOD_ITEMS', payload: clearedFoodItems });
                }}
                className="h-5 w-5 text-primary border-gray-300 focus:ring-primary cursor-pointer mt-0.5"
              />
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="block text-base font-medium text-gray-900">หารตามรายการที่สั่ง</span>
                  {state.splitMethod === 'itemized' && (
                    <Badge variant="default" className="ml-2">เลือกแล้ว</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 mb-3">
                  แบ่งค่าอาหารตามรายการที่แต่ละคนสั่ง จะมีขั้นตอนให้เลือกว่าใครกินอะไรบ้าง
                </p>
                
                {/* Preview สำหรับ Itemized Split */}
                {state.splitMethod === 'itemized' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
                    <div className="text-sm text-amber-700">
                      <div className="flex items-center space-x-1 mb-1">
                        <Info className="w-4 h-4" />
                        <span className="font-medium">ขั้นตอนถัดไป:</span>
                      </div>
                      <p>จะได้เลือกว่าใครกินรายการอาหารไหนบ้าง เพื่อคำนวณจำนวนที่ต้องจ่ายของแต่ละคน</p>
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
        
        {/* คำแนะนำเพิ่มเติม */}
        {state.splitMethod && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">คำแนะนำ:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {state.splitMethod === 'equal' ? (
                <>
                  <li>• เหมาะสำหรับการไปกินข้าวที่ทุกคนทานร่วมกัน</li>
                  <li>• ง่าย รวดเร็ว ไม่ต้องคำนวณซับซ้อน</li>
                  <li>• ไม่ต้องจำใครกินอะไรบ้าง</li>
                </>
              ) : (
                <>
                  <li>• เหมาะสำหรับการไปกินข้าวที่แต่ละคนสั่งของคนละอย่าง</li>
                  <li>• ยุติธรรม แต่ละคนจ่ายเฉพาะที่ตัวเองกิน</li>
                  <li>• ต้องจำว่าใครกินอะไรบ้าง</li>
                </>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </>
  );
} 