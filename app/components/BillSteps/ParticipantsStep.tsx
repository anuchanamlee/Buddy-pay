import { useState, useEffect } from 'react';
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BillState } from '../../lib/billTypes';
import ParticipantForm from '../../components/ParticipantForm';

import QuickAddParticipantsModal from '../../components/QuickAddParticipantsModal';
import SaveGroupModal from '../../components/SaveGroupModal';
import SelectGroupModal from '../../components/SelectGroupModal';
import { ParticipantGroup } from '../../lib/types/participantGroup';
import { useAuth } from '../../context/AuthContext';
import { Users, Save, List, Plus, Info } from 'lucide-react';

interface ParticipantsStepProps {
  state: BillState;
  handleRemoveParticipant: (id: string) => void;
  onUpdateParticipant: (updated: any) => void;
  savedGroups: ParticipantGroup[];
  onSaveGroup: (name: string, description?: string) => void;
  onSelectGroup: (groupId: string) => void;
}

export default function ParticipantsStep({
  state,
  handleRemoveParticipant,
  onUpdateParticipant,
  savedGroups,
  onSaveGroup,
  onSelectGroup
}: ParticipantsStepProps) {
  const { isAuthenticated } = useAuth();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSaveGroupOpen, setIsSaveGroupOpen] = useState(false);
  const [isSelectGroupOpen, setIsSelectGroupOpen] = useState(false);
  const [error, setError] = useState('');

  // เช็คความถูกต้องของข้อมูล
  useEffect(() => {
    const invalidParticipants = state.participants.filter(p => !p.name || p.name.trim() === '');
    
    if (invalidParticipants.length > 0) {
      setError('กรุณาระบุชื่อผู้เข้าร่วมให้ครบถ้วน');
    } else {
      setError('');
    }
  }, [state.participants]);

  // ฟังก์ชันสำหรับเพิ่มผู้เข้าร่วมอย่างรวดเร็ว
  const handleQuickAdd = (name: string) => {
    onUpdateParticipant({
      id: Date.now().toString(),
      name,
      status: 'pending',
      isNew: true,
    });
  };

  return (
    <>
      <CardHeader className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary text-white inline-flex items-center justify-center mr-2.5 text-sm shadow-sm">1</div>
            <span className="text-primary">รายชื่อผู้เข้าร่วม</span>
            {state.participants.length > 0 && (
              <div className="ml-3 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                {state.participants.length} คน
              </div>
            )}
          </CardTitle>
          
          {/* ปุ่มเพิ่มกลุ่มและเลือกกลุ่ม */}
          {isAuthenticated && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsSaveGroupOpen(true)}
                disabled={state.participants.length === 0}
                title="บันทึกรายชื่อเป็นกลุ่ม"
              >
                <Save size={16} className="mr-1" />
                <span className="hidden sm:inline">บันทึกกลุ่ม</span>
              </Button>
              
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsSelectGroupOpen(true)}
                title="เลือกกลุ่มที่บันทึกไว้"
              >
                <List size={16} className="mr-1" />
                <span className="hidden sm:inline">เลือกกลุ่ม</span>
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 text-sm text-blue-700 flex items-start">
          <Info size={18} className="mr-2 text-blue-500 flex-shrink-0 mt-0.5" />
          <p>เพิ่มรายชื่อผู้เข้าร่วมทั้งหมดที่จะแชร์บิลนี้ ต้องมีอย่างน้อย 2 คน</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {state.participants.length === 0 ? (
          <div className="text-center py-16 px-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Users className="h-16 w-16 mx-auto text-primary/20 mb-4" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">ยังไม่มีผู้เข้าร่วม</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                เพิ่มรายชื่อผู้เข้าร่วมหรือเลือกจากกลุ่มที่บันทึกไว้
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => setIsQuickAddOpen(true)} 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 duration-200"
                >
                  <Plus size={18} className="mr-1.5" />
                  เพิ่มผู้เข้าร่วม
                </Button>
                
                {isAuthenticated && savedGroups?.length > 0 && (
                  <Button 
                    onClick={() => setIsSelectGroupOpen(true)} 
                    variant="outline" 
                    className="border-dashed border-gray-300 hover:border-primary/70 hover:bg-primary/5"
                  >
                    <List size={16} className="mr-1.5" />
                    เลือกจากกลุ่ม
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {state.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <ParticipantForm
                    participant={participant}
                    onUpdate={onUpdateParticipant}
                    onRemove={handleRemoveParticipant}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={() => setIsQuickAddOpen(true)}
                variant="outline"
                className="border-dashed border-gray-300 hover:border-primary/70 hover:bg-primary/5 transition-all duration-200"
              >
                <Plus size={18} className="mr-1.5 text-primary" />
                เพิ่มผู้เข้าร่วม
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Modal เพิ่มผู้เข้าร่วมแบบรวดเร็ว */}
      <QuickAddParticipantsModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={handleQuickAdd}
        currentCount={state.participants.length}
      />
      
      {/* Modal บันทึกกลุ่ม */}
      <SaveGroupModal
        isOpen={isSaveGroupOpen}
        onClose={() => setIsSaveGroupOpen(false)}
        onSave={onSaveGroup}
        participantCount={state.participants.length}
      />
      
      {/* Modal เลือกกลุ่ม */}
      <SelectGroupModal
        isOpen={isSelectGroupOpen}
        onClose={() => setIsSelectGroupOpen(false)}
        groups={savedGroups || []}
        onSelect={onSelectGroup}
      />
    </>
  );
} 