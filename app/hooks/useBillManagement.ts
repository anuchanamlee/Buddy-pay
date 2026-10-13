import { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { collection, addDoc, query, orderBy, limit, startAfter, onSnapshot, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { useRouter } from 'next/navigation';
import localforage from 'localforage';
import { useQueryClient } from '@tanstack/react-query';
import { FirestoreBill, BillState } from '../lib/billTypes';
import { calculateSplitMemoized as calculateSplit } from '../lib/billCalculator';
import { fromSatang, toSatang } from '../lib/money';
import { FoodItem, Participant, Bill } from '../lib/schema';
import { ParticipantGroup } from '../lib/types/participantGroup';
import { getParticipantGroups, saveParticipantGroup as saveGroup } from '../lib/services/participantGroupService';

export function useBillManagement(state: BillState, dispatch: React.Dispatch<any>) {
  const { user, isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // สถานะที่ไม่เกี่ยวข้องกับการคำนวณหลัก
  const [promptPayId, setPromptPayId] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isRealTimeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notes, setNotes] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  
  // สำหรับกลุ่มผู้เข้าร่วม
  const [savedGroups, setSavedGroups] = useState<ParticipantGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // ฟังก์ชันแสดง Toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    dispatch({ type: 'SET_TOAST', payload: { show: true, message, type } });
    
    // ซ่อน Toast หลังจาก 3 วินาที
    setTimeout(() => {
      dispatch({ type: 'SET_TOAST', payload: { show: false, message: '', type: 'success' } });
    }, 3000);
  }, [dispatch]);

  // ฟังก์ชันสำหรับแคชข้อมูลบิล
  const cacheBills = useCallback(async (billsToCache: FirestoreBill[]) => {
    if (!user) return;
    try {
      // ตั้งเวลาหมดอายุแคช 15 นาที
      await localforage.setItem(`bills_${user.uid}`, {
        timestamp: Date.now(),
        data: billsToCache,
        expiry: Date.now() + 15 * 60 * 1000 // 15 นาทีในหน่วย ms
      });
    } catch (error) {
      console.error('Error caching bills:', error);
    }
  }, [user]);
  
  // ฟังก์ชันสำหรับดึงข้อมูลบิลจากแคช
  const getBillsFromCache = useCallback(async () => {
    if (!user) return null;
    
    try {
      const cached = await localforage.getItem(`bills_${user.uid}`);
      if (!cached) return null;
      
      const { data, expiry } = cached as any;
      
      // ตรวจสอบการหมดอายุของแคช
      if (Date.now() > expiry) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Cache expired, fetching new data');
        }
        return null;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Using cached bills data');
      }
      return data;
    } catch (error) {
      console.error('Error getting cached bills:', error);
      return null;
    }
  }, [user]);

  // โหลดข้อมูลกลุ่มผู้เข้าร่วม
  const loadParticipantGroups = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingGroups(true);
    try {
      const groups = await getParticipantGroups(user.uid);
      setSavedGroups(groups);
    } catch (error) {
      console.error('Error loading participant groups:', error);
      showToast('ไม่สามารถโหลดกลุ่มผู้เข้าร่วมได้', 'error');
    } finally {
      setIsLoadingGroups(false);
    }
  }, [user, showToast]);

  // บันทึกกลุ่มผู้เข้าร่วมใหม่
  const saveParticipantGroup = useCallback(async (name: string, description?: string) => {
    if (!user || state.participants.length === 0) {
      showToast('ไม่สามารถบันทึกกลุ่มได้ กรุณาเพิ่มผู้เข้าร่วมก่อน', 'error');
      return;
    }

    try {
      // ส่งค่าเป็น undefined แทน null เพื่อให้เข้ากับ type definition
      const sanitizedDescription = description && description.trim() !== '' ? description.trim() : undefined;
      await saveGroup(user.uid, name, state.participants, sanitizedDescription);
      showToast('บันทึกกลุ่มเรียบร้อยแล้ว', 'success');
      loadParticipantGroups(); // โหลดกลุ่มใหม่
    } catch (error) {
      console.error('Error saving group:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึกกลุ่ม', 'error');
    }
  }, [user, state.participants, showToast, loadParticipantGroups]);

  // โหลดกลุ่มผู้เข้าร่วมที่เลือก
  const loadParticipantGroup = useCallback((groupId: string) => {
    const group = savedGroups.find(g => g.id === groupId);
    if (!group) return;
    
    // ล้างรายชื่อเดิม
    dispatch({ type: 'SET_PARTICIPANTS', payload: [] });
    
    // เพิ่มสมาชิกจากกลุ่ม
    group.participants.forEach(participant => {
      // สร้าง ID ใหม่สำหรับการใช้งานครั้งนี้
      const newParticipant = {
        ...participant,
        id: uuidv4()
      };
      dispatch({ 
        type: 'UPDATE_PARTICIPANT', 
        payload: { ...newParticipant, isNew: true }
      });
    });
    
    showToast(`โหลดกลุ่ม ${group.name} เรียบร้อยแล้ว`, 'success');
  }, [savedGroups, dispatch, showToast]);

  // ฟังก์ชันสำหรับโหลดข้อมูลเริ่มต้น
  const loadInitialData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    setIsLoading(true);
    
    try {
      // ลองดึงข้อมูลจากแคชก่อน
      const cachedBills = await getBillsFromCache();
      
      if (cachedBills && cachedBills.length > 0) {
        dispatch({ type: 'SET_BILLS', payload: cachedBills });
        dispatch({ type: 'SET_LOADING', payload: false });
        setIsLoading(false);
      } else {
        // ถ้าไม่มีแคชหรือแคชหมดอายุ ให้ดึงข้อมูลใหม่
        fetchBills();
      }
      
      // โหลดข้อมูลกลุ่มผู้เข้าร่วม
      loadParticipantGroups();
    } catch (error) {
      console.error('Error loading initial data:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
      setIsLoading(false);
    }
  }, [dispatch, getBillsFromCache, loadParticipantGroups]);

  // ฟังก์ชันดึงข้อมูลบิลแบบมี pagination
  const fetchBills = useCallback(async () => {
    if (!user) return { bills: [], lastVisible: null, hasMore: false };
    setIsLoading(true);
    
    try {
      // กำหนดค่าคงที่สำหรับจำนวนบิลต่อหน้า
      const ITEMS_PER_PAGE = 10;
      
      // ลองดึงจากแคชก่อน
      const cachedBills = await getBillsFromCache();
      if (cachedBills) {
        setIsLoading(false);
        return { bills: cachedBills, lastVisible: null, hasMore: true };
      }
      
      // สร้าง query โดยใช้ lastVisible ถ้ามี
      let billsQuery;
      if (lastVisible) {
        billsQuery = query(
          collection(db, 'bills'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        billsQuery = query(
          collection(db, 'bills'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(ITEMS_PER_PAGE)
        );
      }
      
      const snapshot = await getDocs(billsQuery);
      const newLastVisible = snapshot.docs[snapshot.docs.length - 1];
      const fetchedBills = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          userId: data.userId,
          title: data.title,
          description: data.description || '',
          totalAmount: data.totalAmount || 0,
          participants: data.participants || [],
          items: data.items || [],
          category: data.category || '',
          status: data.status || 'pending',
          paymentMethod: data.paymentMethod || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || null,
        } as unknown as FirestoreBill;
      });
      
      // บันทึกลงแคช
      if (fetchedBills.length > 0) {
        await cacheBills(fetchedBills);
      }
      
      setIsLoading(false);
      
      // ตรวจสอบว่ามีข้อมูลเหลืออยู่หรือไม่
      const hasMoreData = snapshot.docs.length === ITEMS_PER_PAGE;
      
      return { 
        bills: fetchedBills, 
        lastVisible: newLastVisible, 
        hasMore: hasMoreData 
      };
    } catch (error) {
      console.error('Error fetching bills:', error);
      setError(error as Error);
      setIsLoading(false);
      return { bills: [], lastVisible: null, hasMore: false };
    }
  }, [user, lastVisible, getBillsFromCache, cacheBills]);

  // ฟังก์ชันสำหรับการตั้งค่า real-time listener
  const setupRealtimeListener = useCallback(() => {
    if (!isRealTimeEnabled || !user) return null;
    
    const billsRef = collection(db, 'bills');
    const q = query(
      billsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    // สร้าง real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        // จัดการกับข้อมูลที่เปลี่ยนแปลง
        const updatedBills = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as unknown as FirestoreBill[];
        
        // อัปเดตข้อมูลใน state
        dispatch({ type: 'SET_BILLS', payload: updatedBills });
        
        // บันทึกข้อมูลลงแคช
        cacheBills(updatedBills);
        
        // ถ้ามีการเปลี่ยนแปลง ให้ invalidate query cache
        queryClient.invalidateQueries({ queryKey: ['bills'] });
      } catch (err) {
        console.error("Error processing snapshot data:", err);
        dispatch({
          type: 'SET_TOAST',
          payload: {
            show: true,
            message: `เกิดข้อผิดพลาดในการอัปเดตข้อมูลแบบเรียลไทม์: ${err instanceof Error ? err.message : 'Unknown error'}`,
            type: 'error'
          }
        });
      }
    }, (error) => {
      console.error("Snapshot listener error:", error);
      dispatch({
        type: 'SET_TOAST',
        payload: {
          show: true,
          message: `เกิดข้อผิดพลาดในการเชื่อมต่อเรียลไทม์: ${error.message}`,
          type: 'error'
        }
      });
    });
    
    // คืนค่าฟังก์ชันสำหรับการยกเลิก listener
    return unsubscribe;
  }, [isRealTimeEnabled, user, queryClient, cacheBills, dispatch]);

  // เพิ่มฟังก์ชัน addParticipant
  const addParticipant = useCallback(() => {
    const newParticipant: Participant = {
      id: uuidv4(),
      name: '',
      status: 'pending'
    };
    
    // เพิ่มผู้เข้าร่วมใหม่
    dispatch({ type: 'ADD_PARTICIPANT', payload: newParticipant });
    
    // ถ้าเป็นโหมดหารเท่ากัน ให้เพิ่มผู้เข้าร่วมใหม่ในทุกรายการอาหาร
    if (state.splitMethod === 'equal' && state.foodItems.length > 0) {
      const updatedFoodItems = state.foodItems.map(item => ({
        ...item,
        participants: [...item.participants, newParticipant.id]
      }));
      dispatch({ type: 'SET_FOOD_ITEMS', payload: updatedFoodItems });
    }
  }, [state.splitMethod, state.foodItems, dispatch]);

  // เพิ่มฟังก์ชัน addFoodItem
  const addFoodItem = useCallback(() => {
    const newFoodItem: FoodItem = {
      id: uuidv4(),
      name: '',
      price: 0,
      participants: state.splitMethod === 'equal' 
        ? state.participants.map(p => p.id) 
        : []
    };
    dispatch({ type: 'ADD_FOOD_ITEM', payload: newFoodItem });
  }, [state.splitMethod, state.participants, dispatch]);

  // ฟังก์ชันลบผู้เข้าร่วม
  const handleRemoveParticipant = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PARTICIPANT', payload: id });
  }, [dispatch]);

  // ฟังก์ชันลบรายการอาหาร
  const handleRemoveFoodItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FOOD_ITEM', payload: id });
  }, [dispatch]);

  // ฟังก์ชันสำหรับการบันทึกบิล
  // คืน true เมื่อบันทึกสำเร็จ (หน้าเรียกใช้จะล้างบิลที่ค้างไว้)
  const handleSaveBill = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      // เปิด modal ล็อกอินแทนการนำทางไปหน้าล็อกอิน
      openLoginModal();
      return false;
    }

    if (!state.billName || state.participants.length === 0 || state.foodItems.length === 0) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return false;
    }
    
    dispatch({ type: 'SET_LOADING', payload: true });
    setIsLoading(true);
    
    try {
      // เตรียมข้อมูลที่จะบันทึก
      const billData = {
        name: state.billName,
        totalAmount: state.totalAmount,
        vat: state.vat,
        discount: state.discount,
        serviceCharge: state.serviceCharge,
        splitMethod: state.splitMethod,
        categoryId: state.categoryId,
        foodItems: state.foodItems,
        participants: state.participants,
        splitResults: state.splitResults,
        // เก็บเลขพร้อมเพย์ไว้ให้หน้ารายละเอียดบิลสร้าง QR ของแต่ละคนได้
        ...(promptPayId.replace(/[^0-9]/g, '') ? { promptPayId: promptPayId.replace(/[^0-9]/g, '') } : {}),
        userId: user?.uid || '',
        userEmail: user?.email || '',
        createdAt: Timestamp.fromDate(new Date()),
        status: 'pending'
      };
      
      // บันทึกลง Firestore
      const docRef = await addDoc(collection(db, 'bills'), billData);
      
      showToast('บันทึกบิลสำเร็จ', 'success');
      
      // รีเซ็ตฟอร์ม
      dispatch({ type: 'RESET_BILL' });
      
      // นำทางไปยังหน้ารายละเอียดบิล
      router.push(`/bill/${docRef.id}`);
      return true;
    } catch (error) {
      console.error('Error saving bill:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึกบิล', 'error');
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      setIsLoading(false);
    }
  }, [isAuthenticated, state, user, router, showToast, openLoginModal, dispatch, promptPayId]);

  // ฟังก์ชันโหลดบิลเพิ่มเติม
  const loadMoreBills = useCallback(async () => {
    if (!lastVisible || !hasMore || isLoading) return;
    
    const result = await fetchBills();
    
    if (result.bills.length > 0) {
      dispatch({ type: 'ADD_BILLS', payload: result.bills });
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
    } else {
      setHasMore(false);
    }
  }, [lastVisible, hasMore, isLoading, fetchBills, dispatch]);

  // ฟังก์ชันตรวจสอบว่าสามารถไปยัง step ต่อไปได้หรือไม่
  const canProceedToNextStep = useCallback(() => {
    switch (currentStep) {
      case 0: // ผู้ร่วมบิล
        return state.participants.length > 0 && state.participants.every(p => p.name.trim() !== '');
      case 1: // รายการอาหาร
        return state.foodItems.length > 0 && state.foodItems.every(item => item.name.trim() !== '' && item.price > 0);
      case 2: // วิธีหาร
        // เลือกวิธีการแบ่งแล้ว (มี default เป็น 'equal' อยู่แล้ว)
        return state.splitMethod === 'equal' || state.splitMethod === 'itemized';
      case 3: // จัดสรรรายการ (เฉพาะ itemized)
        if (state.splitMethod === 'itemized') {
          // ตรวจสอบว่าทุกรายการอาหารมีผู้กินอย่างน้อย 1 คน
          return state.foodItems.every(item => item.participants.length > 0);
        }
        // สำหรับ equal split จะข้าม step นี้ไป
        return true;
      case 4: // ข้อมูลบิล
        return state.billName.trim() !== '';
      case 5: // ผลลัพธ์
        return true;
      default:
        return true;
    }
  }, [currentStep, state.participants, state.foodItems, state.splitMethod, state.billName]);

  // ฟังก์ชันสำหรับการเปลี่ยน step
  const goToNextStep = useCallback(() => {
    if (currentStep < 6 - 1) {
      if (canProceedToNextStep()) {
        // ถ้าเป็น equal split และอยู่ที่ step 2 (วิธีหาร) ให้ข้าม step 3 (จัดสรรรายการ)
        if (state.splitMethod === 'equal' && currentStep === 2) {
          setCurrentStep(4); // ไปที่ step ข้อมูลบิลเลย
        } else {
          setCurrentStep(prevStep => prevStep + 1);
        }
        window.scrollTo(0, 0); // เลื่อนหน้าขึ้นบน
      } else {
        // แสดงข้อความข้อผิดพลาดตาม step ปัจจุบัน
        switch (currentStep) {
          case 0:
            showToast('กรุณากรอกชื่อผู้เข้าร่วมทุกคนให้ครบถ้วน', 'error');
            break;
          case 1:
            showToast('กรุณากรอกชื่อและราคาของรายการอาหารให้ครบถ้วน', 'error');
            break;
          case 2:
            showToast('กรุณาเลือกวิธีการหารบิล', 'error');
            break;
          case 3:
            showToast('กรุณาเลือกผู้ที่รับประทานอาหารในแต่ละรายการ', 'error');
            break;
          case 4:
            showToast('กรุณากรอกชื่อบิล', 'error');
            break;
        }
      }
    }
  }, [currentStep, canProceedToNextStep, showToast, state.splitMethod]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      // ถ้าเป็น equal split และอยู่ที่ step 4 (ข้อมูลบิล) ให้กลับไป step 2 (วิธีหาร)
      if (state.splitMethod === 'equal' && currentStep === 4) {
        setCurrentStep(2);
      } else {
        setCurrentStep(prevStep => prevStep - 1);
      }
      window.scrollTo(0, 0); // เลื่อนหน้าขึ้นบน
    }
  }, [currentStep, state.splitMethod]);
  
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < 6) {
      setCurrentStep(step);
      window.scrollTo(0, 0); // เลื่อนหน้าขึ้นบน
    }
  }, []);

  // คำนวณผลลัพธ์
  const calculatedResults = useMemo(() => {
    // ตรวจสอบว่าข้อมูลพร้อมสำหรับการคำนวณหรือไม่
    if (state.participants.length === 0) return [];

    const billData = {
      name: state.billName,
      totalAmount: 0,
      foodItems: state.foodItems,
      participants: state.participants,
      vat: state.vat,
      discount: state.discount,
      serviceCharge: state.serviceCharge,
      splitMethod: state.splitMethod,
      createdAt: new Date(),
      categoryId: state.categoryId,
      status: 'pending' as const,
    };

    return calculateSplit(billData as Bill);
  }, [state.foodItems, state.participants, state.vat, state.discount, state.serviceCharge, state.splitMethod, state.billName, state.categoryId]);

  // ยอดรวมของบิล = ผลรวมยอดของทุกคน (คิดเป็นสตางค์) จึงตรงกับที่แต่ละคนจ่ายพอดี
  // เดิมคิดค่าบริการจากค่าอาหารแทนยอดหลัง VAT ยอดรวมจึงไม่ตรงเมื่อมีทั้ง VAT และค่าบริการ
  const billTotal = useMemo(
    () => fromSatang(calculatedResults.reduce((sum, r) => sum + toSatang(r.amount), 0)),
    [calculatedResults],
  );
  useEffect(() => {
    if (state.totalAmount !== billTotal) {
      dispatch({ type: 'SET_TOTAL_AMOUNT', payload: billTotal });
    }
  }, [billTotal, state.totalAmount, dispatch]);

  return {
    promptPayId,
    setPromptPayId,
    qrPayload,
    setQrPayload,
    currentStep,
    setCurrentStep,
    isLoading,
    error,
    notes,
    setNotes,
    calculatedResults,
    addParticipant,
    addFoodItem,
    handleRemoveParticipant,
    handleRemoveFoodItem,
    handleSaveBill,
    loadMoreBills,
    loadInitialData,
    setupRealtimeListener,
    canProceedToNextStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    showToast,
    // กลุ่มผู้เข้าร่วม
    savedGroups,
    isLoadingGroups,
    loadParticipantGroups,
    saveParticipantGroup,
    loadParticipantGroup
  };
} 