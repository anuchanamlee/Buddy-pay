import { Bill, FoodItem, Participant } from './schema';
import { SplitResult } from './billCalculator';
import { ParticipantGroup } from './types/participantGroup';

// ขยาย Type Bill สำหรับข้อมูลที่มาจาก Firestore ซึ่งมี id เพิ่มเติม
export interface FirestoreBill extends Bill {
  id: string;
}

// สถานะแอป
export interface BillState {
  billName: string;
  totalAmount: number;
  vat: number;
  discount: number;
  serviceCharge: number;
  splitMethod: 'equal' | 'itemized';
  categoryId: string;
  foodItems: FoodItem[];
  participants: Participant[];
  splitResults: SplitResult[];
  bills: FirestoreBill[];
  toast: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  };
  isLoading: boolean;
  participantGroups?: ParticipantGroup[];
}

// ขยาย type Participant เพื่อรองรับการส่งผู้เข้าร่วมใหม่
export type ParticipantWithFlag = Participant & {
  isNew?: boolean;
}

// ขยาย type FoodItem เพื่อรองรับการส่งรายการอาหารใหม่
export type FoodItemWithFlag = FoodItem & {
  isNew?: boolean;
}

// กำหนด Action Types สำหรับ reducer
export type BillAction =
  | { type: 'SET_BILL_NAME'; payload: string }
  | { type: 'SET_TOTAL_AMOUNT'; payload: number }
  | { type: 'SET_VAT'; payload: number }
  | { type: 'SET_DISCOUNT'; payload: number }
  | { type: 'SET_SERVICE_CHARGE'; payload: number }
  | { type: 'SET_SPLIT_METHOD'; payload: 'equal' | 'itemized' }
  | { type: 'SET_CATEGORY_ID'; payload: string }
  | { type: 'SET_FOOD_ITEMS'; payload: FoodItem[] }
  | { type: 'ADD_FOOD_ITEM'; payload: FoodItem }
  | { type: 'UPDATE_FOOD_ITEM'; payload: FoodItemWithFlag }
  | { type: 'REMOVE_FOOD_ITEM'; payload: string }
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'UPDATE_PARTICIPANT'; payload: ParticipantWithFlag }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'SET_SPLIT_RESULTS'; payload: SplitResult[] }
  | { type: 'SET_BILLS'; payload: FirestoreBill[] }
  | { type: 'ADD_BILLS'; payload: FirestoreBill[] }
  | { type: 'SET_TOAST'; payload: { show: boolean; message: string; type: 'success' | 'error' | 'warning' } }
  | { type: 'RESET_BILL' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PARTICIPANT_GROUPS'; payload: ParticipantGroup[] }
  | { type: 'ADD_PARTICIPANT_GROUP'; payload: ParticipantGroup }
  | { type: 'REMOVE_PARTICIPANT_GROUP'; payload: string };

// สร้าง initial state
export const initialState: BillState = {
  billName: '',
  totalAmount: 0,
  vat: 0,
  discount: 0,
  serviceCharge: 0,
  splitMethod: 'equal',
  categoryId: 'food',
  foodItems: [],
  participants: [],
  splitResults: [],
  toast: { show: false, message: '', type: 'success' },
  bills: [],
  isLoading: false,
  participantGroups: []
};

// ค่าคงที่สำหรับการทำ pagination
export const BILLS_PER_PAGE = 10; 