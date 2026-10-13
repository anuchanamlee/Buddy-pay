'use client';

import { useReducer, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { Card, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Stepper } from '@/app/components/ui/Stepper';
import generatePayload from 'promptpay-qr';
import { billReducer } from '../reducers/billReducer';
import { initialState } from '../lib/billTypes';
import { useBillManagement } from '../hooks/useBillManagement';

// แยก components ตาม step
import ParticipantsStep from '../components/BillSteps/ParticipantsStep';
import FoodItemsStep from '../components/BillSteps/FoodItemsStep';
import SplitMethodStep from '../components/BillSteps/SplitMethodStep';
import FoodParticipantsStep from '../components/BillSteps/FoodParticipantsStep';
import BillDetailsStep from '../components/BillSteps/BillDetailsStep';
import ResultStep from '../components/BillSteps/ResultStep';

// Lazy loading ของคอมโพเนนต์ที่มีขนาดใหญ่


export default function ShareBillPage() {
  const { user, isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(billReducer, initialState);

  // ใช้ custom hook เพื่อจัดการ logic ส่วนใหญ่
  const {
    promptPayId,
    setPromptPayId,
    qrPayload,
    setQrPayload,
    currentStep,
    isLoading,
    error,
    notes,
    setNotes,
    calculatedResults,
    handleRemoveParticipant,
    handleRemoveFoodItem,
    handleSaveBill,
    loadInitialData,
    setupRealtimeListener,
    canProceedToNextStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    // กลุ่มผู้เข้าร่วม
    savedGroups,
    saveParticipantGroup,
    loadParticipantGroup
  } = useBillManagement(state, dispatch);

  // สร้าง dynamic steps ตาม splitMethod
  const getStepsForDisplay = () => {
    const baseSteps = [
      { title: 'ผู้ร่วมบิล', description: 'ใส่ชื่อผู้ร่วมบิล' },
      { title: 'รายการอาหาร', description: 'ใส่รายการอาหาร' },
      { title: 'วิธีหาร', description: 'เลือกวิธีหารบิล' }
    ];

    if (state.splitMethod === 'itemized') {
      return [
        ...baseSteps,
        { title: 'จัดสรรรายการ', description: 'เลือกผู้กินแต่ละรายการ' },
        { title: 'ข้อมูลบิล', description: 'ตั้งชื่อและรายละเอียด' },
        { title: 'ผลลัพธ์', description: 'สรุปการหารบิล' }
      ];
    } else {
      return [
        ...baseSteps,
        { title: 'ข้อมูลบิล', description: 'ตั้งชื่อและรายละเอียด' },
        { title: 'ผลลัพธ์', description: 'สรุปการหารบิล' }
      ];
    }
  };

  // แปลง currentStep สำหรับการแสดงผล
  const getDisplayStep = () => {
    if (state.splitMethod === 'equal') {
      // สำหรับ equal split: 0,1,2,4,5 -> 0,1,2,3,4
      if (currentStep <= 2) return currentStep;
      if (currentStep === 4) return 3;
      if (currentStep === 5) return 4;
    }
    return currentStep;
  };

  // แปลง display step กลับเป็น actual step
  const getActualStep = (displayStep: number) => {
    if (state.splitMethod === 'equal') {
      // สำหรับ equal split: 0,1,2,3,4 -> 0,1,2,4,5
      if (displayStep <= 2) return displayStep;
      if (displayStep === 3) return 4;
      if (displayStep === 4) return 5;
    }
    return displayStep;
  };

  // useEffect สำหรับการโหลดข้อมูลเริ่มต้น
  useEffect(() => {
    if (user && isAuthenticated) {
      loadInitialData();
    }
  }, [user, isAuthenticated, loadInitialData]);

  // useEffect สำหรับ real-time updates
  useEffect(() => {
    const unsubscribe = setupRealtimeListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setupRealtimeListener]);

  // useEffect สำหรับอัพเดตผลลัพธ์
  useEffect(() => {
    if (((currentStep === 4 && state.splitMethod === 'equal') || (currentStep === 5 && state.splitMethod === 'itemized')) && calculatedResults.length > 0) {
      dispatch({ type: 'SET_SPLIT_RESULTS', payload: calculatedResults });
    }
  }, [currentStep, calculatedResults, dispatch, state.splitMethod]);

  // useEffect เพื่อสร้าง QR code อัตโนมัติเมื่อผู้ใช้กรอกข้อมูลครบ
  useEffect(() => {
    if (!promptPayId) return;
    
    // เลือกเฉพาะตัวเลขจากเบอร์ PromptPay
    const sanitizedId = promptPayId.replace(/[^0-9]/g, '');
    
    // ตรวจสอบว่าเป็นเบอร์มือถือ (10 หลัก) หรือเลขประจำตัวประชาชน (13 หลัก)
    if (sanitizedId.length === 10 || sanitizedId.length === 13) {
      try {
        // สร้าง QR Code สำหรับ PromptPay
        const amount = 0; // ใส่จำนวนเงินเป็น 0 เสมอ
        const payload = generatePayload(sanitizedId, { amount });
        setQrPayload(payload);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    } else {
      // ล้าง QR code ถ้าข้อมูลไม่ถูกต้อง
      setQrPayload('');
    }
  }, [promptPayId, setQrPayload]);

  // แสดงข้อความโหลดข้อมูล
  if (isLoading && state.bills.length === 0) {
    return <div className="loading">กำลังโหลดข้อมูล...</div>;
  }
  
  // แสดงข้อความเมื่อเกิดข้อผิดพลาด
  if (error && state.bills.length === 0) {
    return (
      <div className="error bg-red-50 p-4 rounded-md border border-red-200 text-red-700">
        <h3 className="font-semibold mb-2 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          เกิดข้อผิดพลาดในการโหลดข้อมูล
        </h3>
        <p>{error.message}</p>
        <button 
          onClick={() => loadInitialData()} 
          className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <header className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-foreground">
              แชร์ค่าอาหาร
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-4 sm:mb-6">
              แชร์ค่าอาหารกับเพื่อนๆ ได้อย่างง่ายดาย รวดเร็ว และยุติธรรม
            </p>
          </header>

          {/* เพิ่ม Stepper */}
          <div className="mb-6 sm:mb-8">
            <Stepper 
              steps={getStepsForDisplay()} 
              activeStep={getDisplayStep()} 
              onStepClick={(displayStep) => {
                // อนุญาตให้ย้อนกลับไป step ก่อนหน้าได้ แต่ไม่อนุญาตให้ข้าม step ไปข้างหน้า
                if (displayStep < getDisplayStep()) {
                  const actualStep = getActualStep(displayStep);
                  goToStep(actualStep);
                }
              }}
              className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200"
            />
          </div>

          {/* Toast notification */}
          {state.toast.show && (
            <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
              state.toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
              state.toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
              'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
              <div className="flex items-center gap-2">
                {state.toast.type === 'success' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {state.toast.type === 'error' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {state.toast.type === 'warning' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span>{state.toast.message}</span>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden rounded-lg border border-gray-200">
              {/* แสดงเนื้อหาตาม step ปัจจุบัน */}
              {getDisplayStep() === 0 && (
                <ParticipantsStep 
                  state={state}
                  handleRemoveParticipant={handleRemoveParticipant}
                  onUpdateParticipant={(updated) => dispatch({ type: 'UPDATE_PARTICIPANT', payload: updated })}
                  savedGroups={savedGroups}
                  onSaveGroup={saveParticipantGroup}
                  onSelectGroup={loadParticipantGroup}
                />
              )}

              {getDisplayStep() === 1 && (
                <FoodItemsStep
                  state={state}
                  handleRemoveFoodItem={handleRemoveFoodItem}
                  onUpdateFoodItem={(updated) => dispatch({ type: 'UPDATE_FOOD_ITEM', payload: updated })}
                />
              )}

              {getDisplayStep() === 2 && (
                <SplitMethodStep
                  state={state}
                  dispatch={dispatch}
                />
              )}

              {getDisplayStep() === 3 && state.splitMethod === 'itemized' && (
                <FoodParticipantsStep
                  state={state}
                  dispatch={dispatch}
                />
              )}

              {(getDisplayStep() === 3 && state.splitMethod === 'equal') && (
                <BillDetailsStep
                  state={state}
                  dispatch={dispatch}
                  promptPayId={promptPayId}
                  setPromptPayId={setPromptPayId}
                  notes={notes}
                  setNotes={setNotes}
                />
              )}

              {getDisplayStep() === 4 && state.splitMethod === 'itemized' && (
                <BillDetailsStep
                  state={state}
                  dispatch={dispatch}
                  promptPayId={promptPayId}
                  setPromptPayId={setPromptPayId}
                  notes={notes}
                  setNotes={setNotes}
                />
              )}

              {((getDisplayStep() === 4 && state.splitMethod === 'equal') || (getDisplayStep() === 5 && state.splitMethod === 'itemized')) && (
                <ResultStep
                  state={{...state, splitResults: calculatedResults}}
                  promptPayId={promptPayId}
                  qrPayload={qrPayload}
                  notes={notes}
                />
              )}

              {/* Step navigation buttons */}
              <CardFooter className="bg-gray-50 border-t px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
                {getDisplayStep() > 0 ? (
                  <Button 
                    onClick={goToPreviousStep} 
                    variant="outline"
                    className="flex items-center justify-center gap-2 w-full sm:w-auto order-2 sm:order-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    ย้อนกลับ
                  </Button>
                ) : (
                  <div className="hidden sm:block"></div> // ให้ปุ่ม "ถัดไป" อยู่ด้านขวาเสมอ
                )}
                
                {getDisplayStep() < getStepsForDisplay().length - 1 ? (
                  <Button 
                    onClick={goToNextStep} 
                    className="bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 w-full sm:w-auto order-1 sm:order-2"
                    disabled={!canProceedToNextStep()}
                  >
                    ถัดไป
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSaveBill} 
                    className="bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 w-full sm:w-auto order-1 sm:order-2"
                    disabled={!canProceedToNextStep()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    บันทึกบิล
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 