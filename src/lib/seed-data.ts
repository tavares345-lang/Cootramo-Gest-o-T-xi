import { collection, getDocs, addDoc, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

let seedExecuted = false;

export async function ensureDefaultSeedData(currentUserId?: string, sectorId?: string) {
  if (seedExecuted) return;
  seedExecuted = true;

  try {
    // 1. Check if drivers exist, specifically if "Alexia" exists
    const driversSnap = await getDocs(collection(db, 'drivers'));
    let alexiaDoc = driversSnap.docs.find(d => 
      (d.data().name || '').toLowerCase().includes('alexia')
    );

    let alexiaId = alexiaDoc ? alexiaDoc.id : '';

    if (!alexiaDoc) {
      const alexiaRef = await addDoc(collection(db, 'drivers'), {
        name: 'Alexia Moreira',
        unitNumber: '042',
        licensePlate: 'HKZ-4E21',
        phone: '(31) 98877-6655',
        active: true,
      });
      alexiaId = alexiaRef.id;

      // Seed another driver for realistic tracking
      await addDoc(collection(db, 'drivers'), {
        name: 'Carlos Mendes',
        unitNumber: '015',
        licensePlate: 'PUX-9120',
        phone: '(31) 99123-4567',
        active: true,
      });
    }

    // 2. Check payment methods
    const methodsSnap = await getDocs(collection(db, 'paymentMethods'));
    let methodId = methodsSnap.docs[0]?.id;
    if (!methodId) {
      const methodRef = await addDoc(collection(db, 'paymentMethods'), {
        name: 'Cartão de Crédito',
        feePercentage: 5,
        fixedFee: 0,
        active: true
      });
      methodId = methodRef.id;

      await addDoc(collection(db, 'paymentMethods'), {
        name: 'Dinheiro',
        feePercentage: 0,
        fixedFee: 0,
        active: true
      });
    }

    // 3. Check sectors
    const sectorsSnap = await getDocs(collection(db, 'sectors'));
    let targetSectorId = sectorId || sectorsSnap.docs[0]?.id || 'admin-sector';

    // 4. Ensure Alexia has paid and pending payment records (rides & vouchers & settlements)
    const ridesSnap = await getDocs(collection(db, 'rides'));
    const alexiaRides = ridesSnap.docs.filter(d => d.data().driverId === alexiaId);

    const hasPaidAlexiaRide = alexiaRides.some(d => d.data().status === 'paid');

    if (!hasPaidAlexiaRide && alexiaId) {
      const seller = currentUserId || 'system-admin';

      // Create paid ride 1
      const ride1Ref = await addDoc(collection(db, 'rides'), {
        passengerName: 'Alexia Passageiro',
        origin: 'Aeroporto de Confins',
        destination: 'Belo Horizonte - Savassi',
        value: 160.00,
        feeAmount: 16.00,
        netValue: 144.00,
        paymentMethodId: methodId,
        sellerId: seller,
        sectorId: targetSectorId,
        driverId: alexiaId,
        status: 'paid',
        createdAt: Timestamp.now(),
      });

      const voucher1Ref = await addDoc(collection(db, 'vouchers'), {
        rideId: ride1Ref.id,
        voucherNumber: 'VOU-88910',
        status: 'redeemed',
        createdAt: Timestamp.now(),
      });

      // Create paid ride 2
      const ride2Ref = await addDoc(collection(db, 'rides'), {
        passengerName: 'Empresa Teste',
        origin: 'Aeroporto de Confins',
        destination: 'Contagem - Eldorado',
        value: 190.00,
        feeAmount: 19.00,
        netValue: 171.00,
        paymentMethodId: methodId,
        sellerId: seller,
        sectorId: targetSectorId,
        driverId: alexiaId,
        status: 'paid',
        createdAt: Timestamp.now(),
      });

      const voucher2Ref = await addDoc(collection(db, 'vouchers'), {
        rideId: ride2Ref.id,
        voucherNumber: 'VOU-88911',
        status: 'redeemed',
        createdAt: Timestamp.now(),
      });

      // Create a paid settlement launch for Alexia
      await addDoc(collection(db, 'settlements'), {
        settlementNumber: 'SET-99001',
        driverId: alexiaId,
        voucherIds: [voucher1Ref.id, voucher2Ref.id],
        totalAmount: 315.00,
        status: 'paid',
        paidAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });

      // Create pending ride for Alexia
      const pendingRideRef = await addDoc(collection(db, 'rides'), {
        passengerName: 'Passageiro em Trânsito',
        origin: 'Aeroporto de Confins',
        destination: 'Lagoa Santa - Centro',
        value: 80.00,
        feeAmount: 8.00,
        netValue: 72.00,
        paymentMethodId: methodId,
        sellerId: seller,
        sectorId: targetSectorId,
        driverId: alexiaId,
        status: 'pending',
        createdAt: Timestamp.now(),
      });

      await addDoc(collection(db, 'vouchers'), {
        rideId: pendingRideRef.id,
        voucherNumber: 'VOU-88912',
        status: 'active',
        createdAt: Timestamp.now(),
      });
    }
  } catch (err) {
    console.warn('Silent notice: seed data initialization:', err);
  }
}
