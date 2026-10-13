import { formatTHB } from '@/app/lib/format';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

import { BillState } from '../../lib/billTypes';
import FoodItemForm from '../../components/FoodItemForm';
import QuickAddFoodItemsModal from '../../components/QuickAddFoodItemsModal';
import { Plus, Info, Coffee, ShoppingBag, Calculator } from 'lucide-react';

interface FoodItemsStepProps {
  state: BillState;
  handleRemoveFoodItem: (id: string) => void;
  onUpdateFoodItem: (updated: any) => void;
}

export default function FoodItemsStep({
  state,
  handleRemoveFoodItem,
  onUpdateFoodItem
}: FoodItemsStepProps) {

  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);

  // ฟังก์ชันเพิ่มรายการอาหารผ่าน modal
  const handleQuickAddFromModal = (name: string, price: number) => {
    // สร้างรายการอาหารใหม่ด้วยชื่อและราคาที่กำหนด
    const itemId = crypto.randomUUID();
    const newFoodItem = {
      id: itemId,
      name: name.trim(),
      price: price,
      participants: state.splitMethod === 'equal' 
        ? state.participants.map(p => p.id) 
        : []
    };
    
    // เรียกใช้ dispatch เพื่อเพิ่มรายการอาหารใหม่พร้อมข้อมูลเลย
    onUpdateFoodItem({
      ...newFoodItem,
      isNew: true
    });
  };

  // คำนวณยอดรวม
  const calculateSummary = () => {
    const subtotal = state.foodItems.reduce((sum, item) => sum + item.price, 0);
    
    return {
      subtotal,
      itemCount: state.foodItems.length,
    };
  };

  const summary = calculateSummary();

  // แบ่งเป็นสีส้มเมื่อจำนวนรายการมากกว่า 5
  const getCountClassNames = () => {
    if (state.foodItems.length > 5) {
      return "bg-orange-500 text-white";
    }
    return "bg-primary text-white";
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary/20 to-primary/5 border-b px-6 py-4 sticky top-0 z-10">
        <CardTitle className="text-xl font-semibold flex items-center">
          <div className={`w-8 h-8 rounded-full ${getCountClassNames()} inline-flex items-center justify-center mr-2.5 text-sm shadow-sm`}>2</div>
          <span className="text-primary">รายการอาหาร</span>
          {state.foodItems.length > 0 && (
            <div className="ml-3 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
              {state.foodItems.length} รายการ
            </div>
          )}
        </CardTitle>
        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button 
            onClick={() => setIsQuickAddModalOpen(true)} 
            size="sm" 
            className="bg-primary hover:bg-primary/90 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transform duration-200"
          >
            <ShoppingBag size={16} className="mr-1.5" />
            เพิ่มหลายรายการ
          </Button>
        </motion.div>
      </CardHeader>
      <CardContent className="p-6 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 text-sm text-blue-700 flex items-start"
        >
          <Info size={18} className="mr-2 text-blue-500 flex-shrink-0 mt-0.5" />
          <p>เพิ่มรายการอาหารทั้งหมดที่คุณและเพื่อนสั่ง พร้อมระบุราคาให้ครบถ้วน</p>
        </motion.div>

        {state.foodItems.length > 0 ? (
          <div className="space-y-6">
            {/* ตารางรายการอาหาร */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-gray-50 border-b text-sm font-medium text-gray-700">
                <div className="col-span-1">#</div>
                <div className="col-span-7">ชื่ออาหาร</div>
                <div className="col-span-3 text-right">ราคา (บาท)</div>
                <div className="col-span-1"></div>
              </div>
              
              {/* รายการอาหาร */}
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                <AnimatePresence>
                  {state.foodItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: "hidden", y: -20 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: index * 0.02,
                        layout: { duration: 0.2 } 
                      }}
                      layout
                    >
                      <FoodItemForm
                        item={item}
                        onUpdate={onUpdateFoodItem}
                        onRemove={handleRemoveFoodItem}
                        index={index}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            
            {/* สรุปยอดรวม */}
            <motion.div 
              className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20 p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">ยอดรวมค่าอาหาร</h3>
                    <p className="text-sm text-gray-600">{summary.itemCount} รายการ</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {formatTHB(summary.subtotal)} บาท
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* ปุ่มเพิ่มรายการ */}
            <motion.div 
              className="flex justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Button 
                variant="outline" 
                onClick={() => setIsQuickAddModalOpen(true)} 
                className="border-dashed border-gray-300 hover:border-primary/70 hover:bg-primary/5 transition-all duration-200"
              >
                <Plus size={18} className="mr-1.5 text-primary" />
                เพิ่มรายการอาหาร
              </Button>
            </motion.div>
          </div>
        ) : (
          <motion.div 
            className="text-center py-16 px-6 bg-gray-50 rounded-xl border border-dashed border-gray-200"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Coffee className="h-16 w-16 mx-auto text-primary/20 mb-4" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">ยังไม่มีรายการอาหาร</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                กดปุ่ม 'เพิ่มรายการแรก' เพื่อเริ่มต้นเพิ่มรายการอาหารที่สั่ง
              </p>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={() => setIsQuickAddModalOpen(true)} 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 duration-200"
                >
                  <Plus size={18} className="mr-1.5" />
                  เพิ่มรายการแรก
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </CardContent>

      {/* Modal เพิ่มรายการอาหารแบบต่อเนื่อง */}
      <QuickAddFoodItemsModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onAdd={handleQuickAddFromModal}
        currentCount={state.foodItems.length}
      />
    </>
  );
} 