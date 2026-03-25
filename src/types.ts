export type UserRole = 'ADMINISTRADOR' | 'GERENTE' | 'VENDEDOR';

export interface UserProfile {
  uid: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  sectorId?: string;
}

export interface Employee {
  id: string;
  name: string;
  username?: string;
  email?: string;
  password?: string;
  role: UserRole;
  currentSectorId?: string;
  active: boolean;
}

export interface Driver {
  id: string;
  name: string;
  licensePlate: string;
  unitNumber: string;
  phone: string;
  active: boolean;
}

export interface Sector {
  id: string;
  name: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  feePercentage: number;
  fixedFee: number;
}

export interface Ride {
  id: string;
  passengerName?: string;
  origin: string;
  destination: string;
  value: number;
  paymentMethodId: string;
  feeAmount: number;
  netValue: number;
  sellerId: string;
  sectorId: string;
  driverId?: string;
  status: 'pending' | 'paid';
  createdAt: any; // Firestore Timestamp
}

export interface Voucher {
  id: string;
  rideId: string;
  voucherNumber: string;
  status: 'active' | 'cancelled' | 'redeemed';
  createdAt: any; // Firestore Timestamp
}

export interface Settlement {
  id: string;
  settlementNumber: string;
  driverId: string;
  voucherIds: string[];
  totalAmount: number;
  status: 'pending' | 'paid';
  createdAt: any; // Firestore Timestamp
  paidAt?: any; // Firestore Timestamp
}

export interface Payment {
  id: string;
  driverId: string;
  amount: number;
  status: 'pending' | 'paid';
  periodStart: any; // Firestore Timestamp
  periodEnd: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
}

export interface Destination {
  id: string;
  name: string;
  region: string;
  value: number;
}
