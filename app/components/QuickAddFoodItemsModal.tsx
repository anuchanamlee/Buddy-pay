'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { X, Plus, Check, AlertCircle, DollarSign, Utensils, ChevronDown, Search, Tag, PlusCircle, ShoppingBag, Clock } from 'lucide-react';
import { FoodSuggestion, foodSuggestions, getUniqueCategories, findFoodSuggestions, groupFoodSuggestionsByCategory } from '../data/foodSuggestions';

interface QuickAddFoodItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, price: number) => void;
  currentCount: number;
}

export default function QuickAddFoodItemsModal({
  isOpen,
  onClose,
  onAdd,
  currentCount,
}: QuickAddFoodItemsModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [count, setCount] = useState(currentCount + 1);
  const [nameError, setNameError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);

  // รายการหมวดหมู่ที่ไม่ซ้ำกัน - ใช้ useMemo
  const categories = useMemo(() => getUniqueCategories(), []);

  // กรองรายการอาหารตามคำค้นหาและหมวดหมู่ - ใช้ useMemo
  const filteredSuggestions = useMemo(() => 
    findFoodSuggestions(searchTerm, selectedCategory), 
    [searchTerm, selectedCategory]
  );

  // จัดกลุ่มรายการอาหารตามหมวดหมู่ - ใช้ useMemo
  const groupedSuggestions = useMemo(() => 
    groupFoodSuggestionsByCategory(filteredSuggestions),
    [filteredSuggestions]
  );

  // เลือกรายการอาหาร
  const handleSelectFood = (food: FoodSuggestion) => {
    setName(food.name);
    setPrice(food.price.toString());
    setIsSuggestionOpen(false);
    setNameError('');
    setPriceError('');
    setSearchTerm('');
  };

  // ปิด dropdown เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setIsSuggestionOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // เมื่อ modal เปิด ให้ focus ที่ช่องกรอกข้อมูล
    if (isOpen && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
    setCount(currentCount + 1);
  }, [isOpen, currentCount]);

  const validateInput = (): boolean => {
    let isValid = true;
    
    // ตรวจสอบชื่ออาหาร
    if (!name.trim()) {
      setNameError('กรุณาระบุชื่ออาหาร');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // ตรวจสอบราคา
    if (!price.trim()) {
      setPriceError('กรุณาระบุราคา');
      isValid = false;
    } else {
      const priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue <= 0) {
        setPriceError('ราคาต้องเป็นตัวเลขที่มากกว่า 0');
        isValid = false;
      } else {
        setPriceError('');
      }
    }
    
    return isValid;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateInput()) {
      onAdd(name.trim(), parseFloat(price));
      
      // เก็บรายการที่เพิ่งเพิ่มไป
      setRecentlyAdded(prev => [name.trim(), ...prev.slice(0, 4)]);
      
      setName('');
      setPrice('');
      setCount(prev => prev + 1);
      
      // Focus กลับไปที่ช่องกรอกชื่ออาหารเพื่อให้เพิ่มรายการต่อไปได้เลย
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  };

  // ระบบแนะนำอัตโนมัติ - เลือกรายการที่เพิ่งเพิ่ม
  const selectRecentItem = (itemName: string) => {
    const food = foodSuggestions.find(item => item.name === itemName);
    if (food) {
      handleSelectFood(food);
    } else {
      setName(itemName);
      setPrice('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/90 hover:bg-white/20 hover:text-white transition-all duration-200 z-20"
          >
            <X size={20} />
          </button>
          
          {/* Header */}
          <div className="bg-primary p-6 text-white relative overflow-hidden">
            <motion.div 
              className="absolute inset-0 opacity-20" 
              initial={{ backgroundPosition: '0% 0%' }}
              animate={{ backgroundPosition: '100% 100%' }}
              transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}
            />
            <motion.div 
              className="flex items-center"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="mr-3 bg-white/20 p-2.5 rounded-lg shadow-inner">
                <ShoppingBag size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">เพิ่มรายการอาหาร</h2>
                <p className="mt-1 text-sm opacity-90">
                  เพิ่มรายการอาหารทีละรายการ กดปุ่ม "เพิ่ม" เพื่อเพิ่มรายการถัดไป
                </p>
              </div>
            </motion.div>
            
            {/* Counter */}
            <div className="absolute top-5 right-12 bg-white/20 rounded-full h-7 min-w-7 px-2 flex items-center justify-center text-sm font-medium">
              {currentCount} รายการ
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {/* เพิ่งเพิ่มล่าสุด */}
            {recentlyAdded.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <div className="text-xs text-gray-500 flex items-center mb-2">
                  <Clock size={12} className="mr-1" />
                  เพิ่งเพิ่มล่าสุด
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentlyAdded.map((item, index) => (
                    <motion.button
                      key={index}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => selectRecentItem(item)}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-800 transition-colors flex items-center"
                    >
                      <PlusCircle size={12} className="mr-1.5 text-primary" />
                      {item}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* Dropdown รายการอาหารแนะนำ */}
            <div className="mb-5 relative" ref={suggestionRef}>
              <button
                type="button"
                onClick={() => setIsSuggestionOpen(!isSuggestionOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-gray-300 bg-white hover:bg-primary/5 text-gray-700 text-sm transition-all duration-300 hover:shadow-sm hover:border-primary/30"
              >
                <div className="flex items-center">
                  <Utensils size={16} className="mr-2 text-primary" />
                  <span>เลือกจากรายการอาหารแนะนำ</span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-300 ${isSuggestionOpen ? 'transform rotate-180 text-primary' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isSuggestionOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg"
                  >
                    {/* ช่องค้นหา */}
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="ค้นหาอาหาร..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full p-2 pl-9 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
                        />
                      </div>
                    </div>
                    
                    {/* ตัวเลือกหมวดหมู่ */}
                    <div className="p-2 border-b border-gray-100 flex items-center overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex items-center px-3 py-1.5 mr-1.5 rounded-full text-xs whitespace-nowrap ${!selectedCategory ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      >
                        ทั้งหมด
                      </button>
                      {categories.map((category, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                          className={`flex items-center px-3 py-1.5 mr-1.5 rounded-full text-xs whitespace-nowrap ${selectedCategory === category ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                        >
                          <Tag size={10} className="mr-1" />
                          {category}
                        </button>
                      ))}
                    </div>
                    
                    {/* รายการอาหาร */}
                    <div className="max-h-60 overflow-y-auto p-1">
                      {Object.entries(groupedSuggestions).length > 0 ? (
                        Object.entries(groupedSuggestions).map(([category, items]) => (
                          <div key={category} className="mb-2">
                            <div className="text-xs font-medium text-gray-500 px-3 py-1.5 bg-gray-50">{category}</div>
                            <div className="space-y-0.5">
                              {items.map((food, index) => (
                                <motion.button
                                  key={index}
                                  whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                                  onClick={() => handleSelectFood(food)}
                                  className="flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors"
                                >
                                  <span className="font-medium text-gray-800">{food.name}</span>
                                  <span className="text-primary font-medium">{food.price} บาท</span>
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-sm text-gray-500">
                          <Search size={28} className="mx-auto mb-2 text-gray-300" />
                          ไม่พบรายการอาหารที่ค้นหา
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center relative">
                  <div className="absolute left-3 text-gray-500">
                    <Utensils size={18} />
                  </div>
                  <Input
                    ref={nameInputRef}
                    label={`รายการอาหารที่ ${count}`}
                    placeholder="ชื่ออาหาร เช่น ข้าวผัดหมู"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={nameError}
                    required
                    className="pl-10 border-gray-300 focus:border-primary focus:ring-primary transition-all"
                  />
                </div>
                {nameError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={12} className="mr-1 flex-shrink-0" />
                    <span>{nameError}</span>
                  </motion.div>
                )}
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center relative">
                  <div className="absolute left-3 text-gray-500">
                    <DollarSign size={18} />
                  </div>
                  <Input
                    label="ราคา (บาท)"
                    placeholder="ราคา เช่น 80"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    error={priceError}
                    required
                    className="pl-10 border-gray-300 focus:border-primary focus:ring-primary transition-all"
                  />
                </div>
                {priceError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={12} className="mr-1 flex-shrink-0" />
                    <span>{priceError}</span>
                  </motion.div>
                )}
              </div>
              
              <div className="flex space-x-3 pt-3">
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                  disabled={!name.trim() || !price.trim()}
                >
                  <Plus size={18} className="mr-1.5" />
                  เพิ่ม
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-gray-300 hover:bg-gray-50 transition-all duration-200"
                >
                  <Check size={18} className="mr-1.5" />
                  เสร็จสิ้น
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 