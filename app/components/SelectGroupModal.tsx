'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/app/components/ui/Button';
import { X } from 'lucide-react';
import { ParticipantGroup } from '../lib/types/participantGroup';

interface SelectGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ParticipantGroup[];
  onSelect: (groupId: string) => void;
}

export default function SelectGroupModal({ 
  isOpen, 
  onClose, 
  groups,
  onSelect
}: SelectGroupModalProps) {
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
            <h2 className="text-xl font-bold">เลือกกลุ่มผู้เข้าร่วม</h2>
            <p className="mt-1 text-sm opacity-90">
              เลือกกลุ่มที่บันทึกไว้เพื่อเพิ่มรายชื่อทั้งหมด
            </p>
          </div>
          
          {/* Content */}
          <div className="p-5">
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500">ยังไม่มีกลุ่มที่บันทึกไว้</p>
                <p className="text-sm text-gray-400 mt-2">เพิ่มรายชื่อผู้เข้าร่วมและบันทึกเป็นกลุ่มเพื่อใช้ในครั้งต่อไป</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {groups.map(group => (
                  <div 
                    key={group.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      onSelect(group.id);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{group.name}</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {group.participants.length} คน
                      </span>
                    </div>
                    
                    {group.description && (
                      <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                    )}
                    
                    <div className="mt-3 flex flex-wrap gap-1">
                      {group.participants.slice(0, 3).map(p => (
                        <span key={p.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {p.name}
                        </span>
                      ))}
                      {group.participants.length > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          +{group.participants.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="w-full mt-4"
            >
              ปิด
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 