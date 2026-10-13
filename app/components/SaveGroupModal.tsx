'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { X } from 'lucide-react';

interface SaveGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
  participantCount: number;
}

export default function SaveGroupModal({ 
  isOpen, 
  onClose, 
  onSave,
  participantCount
}: SaveGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('กรุณาระบุชื่อกลุ่ม');
      return;
    }
    
    onSave(name.trim(), description.trim() || undefined);
    onClose();
    setName('');
    setDescription('');
    setNameError('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
          
          {/* Header */}
          <div className="bg-primary p-5 text-white">
            <h2 className="text-xl font-bold">บันทึกกลุ่ม</h2>
            <p className="mt-1 text-sm opacity-90">
              บันทึกกลุ่มผู้เข้าร่วมเพื่อใช้ในครั้งต่อไป
            </p>
          </div>
          
          {/* Content */}
          <div className="p-5">
            <div className="text-blue-600 bg-blue-50 p-3 rounded-md mb-4">
              <p className="text-sm">บันทึกกลุ่มที่มี {participantCount} คน เพื่อใช้งานในครั้งต่อไป</p>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="ชื่อกลุ่ม"
                placeholder="เช่น เพื่อนสนิท, ครอบครัว"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) {
                    setNameError('');
                  }
                }}
                error={nameError}
                required
              />
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย (ไม่บังคับ)
                </label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  rows={3}
                  placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับกลุ่มนี้"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              
              <div className="flex space-x-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={!name.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  บันทึกกลุ่ม
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  ยกเลิก
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 