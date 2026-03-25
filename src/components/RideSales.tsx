import React, { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, Timestamp, doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Driver, Sector, PaymentMethod, Ride, Voucher, Destination } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Car, 
  MapPin, 
  CreditCard, 
  User, 
  CheckCircle2, 
  Printer, 
  Plus, 
  ArrowRight,
  Search,
  AlertCircle,
  Ticket,
  ChevronDown,
  Clock,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

const rideSchema = z.object({
  passengerName: z.string().optional(),
  origin: z.string().min(3, 'Origem é obrigatória'),
  destination: z.string().min(3, 'Destino é obrigatório'),
  value: z.number().min(1, 'Valor deve ser maior que zero'),
  paymentMethodId: z.string().min(1, 'Forma de pagamento é obrigatória'),
  driverId: z.string().optional(),
  sectorId: z.string().min(1, 'Setor é obrigatório'),
});

type RideFormData = z.infer<typeof rideSchema>;

const FIXED_ORIGIN = "Aeroporto Internacional de Belo Horizonte";

export default function RideSales() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [successRide, setSuccessRide] = useState<{ ride: Ride; voucher: Voucher } | null>(null);
  const [showDestList, setShowDestList] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors }, setValue } = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      sectorId: profile?.sectorId || '',
      origin: FIXED_ORIGIN,
    }
  });

  const selectedPaymentMethodId = watch('paymentMethodId');
  const rideValue = watch('value') || 0;
  const destinationInput = watch('destination') || '';

  useEffect(() => {
    if (profile?.sectorId) {
      setValue('sectorId', profile.sectorId);
    }
  }, [profile, setValue]);

  useEffect(() => {
    if (!profile) return;

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)).filter(d => d.active));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });
    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sectors');
    });
    const unsubMethods = onSnapshot(collection(db, 'paymentMethods'), (snapshot) => {
      setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'paymentMethods');
    });
    const unsubDestinations = onSnapshot(collection(db, 'destinations'), (snapshot) => {
      setDestinations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Destination)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'destinations');
    });

    return () => {
      unsubDrivers();
      unsubSectors();
      unsubMethods();
      unsubDestinations();
    };
  }, []);

  const filteredDestinations = destinations.filter(d => 
    d.name.toLowerCase().includes(destinationInput.toLowerCase())
  );

  const selectDestination = (dest: Destination) => {
    setValue('destination', dest.name);
    setValue('value', dest.value);
    setShowDestList(false);
  };

  const calculateFees = () => {
    const method = paymentMethods.find(m => m.id === selectedPaymentMethodId);
    if (!method) return { feeAmount: 0, fixedFee: 0, netValue: rideValue };
    const feeAmount = (rideValue * method.feePercentage) / 100;
    const fixedFee = method.fixedFee || 0;
    const netValue = rideValue - feeAmount - fixedFee;
    return { feeAmount, fixedFee, netValue };
  };

  const onSubmit = async (data: RideFormData) => {
    setLoading(true);
    try {
      const { feeAmount, fixedFee, netValue } = calculateFees();
      const createdAt = Timestamp.now();
      
      const rideData = {
        ...data,
        feeAmount: feeAmount + fixedFee,
        netValue,
        sellerId: profile?.uid || '',
        status: 'pending',
        createdAt,
      };

      const rideRef = await addDoc(collection(db, 'rides'), rideData);
      
      // Generate Voucher
      const voucherNumber = `V-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      const voucherData = {
        rideId: rideRef.id,
        voucherNumber,
        status: 'active',
        createdAt,
      };
      
      const voucherRef = await addDoc(collection(db, 'vouchers'), voucherData);
      
      setSuccessRide({ 
        ride: { id: rideRef.id, ...rideData } as Ride, 
        voucher: { id: voucherRef.id, ...voucherData } as Voucher 
      });
      reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rides/vouchers');
    } finally {
      setLoading(false);
    }
  };

  const LOGO_URL = "https://storage.googleapis.com/static-content-dev-ais-studio/clzzlitvlpv7rxhba/258673167423/attachments/97960383-722d-427f-9477-80922437651a.png";

  const handlePrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Form Section */}
      <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <Plus size={24} />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Nova Venda de Corrida</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-50 text-neutral-500 rounded-lg border border-neutral-100">
            <Clock size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* Section: Passenger & Value */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informações da Corrida</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Passageiro (Opcional)</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      {...register('passengerName')}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Nome do passageiro"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Valor da Corrida (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      {...register('value', { valueAsNumber: true })}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-lg font-bold"
                      placeholder="0,00"
                    />
                  </div>
                  {errors.value && <p className="text-xs text-red-500 ml-1">{errors.value.message}</p>}
                </div>
              </div>
            </div>

            {/* Section: Route */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Trajeto</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Origem</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      {...register('origin')}
                      readOnly
                      className="w-full pl-12 pr-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed outline-none transition-all"
                      placeholder="Local de partida"
                    />
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Destino</label>
                  <div className="relative">
                    <ArrowRight className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      {...register('destination')}
                      onFocus={() => setShowDestList(true)}
                      autoComplete="off"
                      className="w-full pl-12 pr-10 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="Local de chegada"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowDestList(!showDestList)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  {errors.destination && <p className="text-xs text-red-500 ml-1">{errors.destination.message}</p>}
                  
                  <AnimatePresence>
                    {showDestList && filteredDestinations.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                      >
                        {filteredDestinations.map(dest => (
                          <button
                            key={dest.id}
                            type="button"
                            onClick={() => selectDestination(dest)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 text-left"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-neutral-900">{dest.name}</span>
                              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{dest.region}</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600">R$ {dest.value.toFixed(2)}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Section: Assignment & Payment */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Atribuição e Pagamento</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Motorista</label>
                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <select
                      {...register('driverId')}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">Selecione o motorista</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>U: {driver.unitNumber} - {driver.name}</option>
                      ))}
                    </select>
                  </div>
                  {errors.driverId && <p className="text-xs text-red-500 ml-1">{errors.driverId.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Forma de Pagamento</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <select
                      {...register('paymentMethodId')}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">Selecione o pagamento</option>
                      {paymentMethods.map(method => (
                        <option key={method.id} value={method.id}>{method.name}</option>
                      ))}
                    </select>
                  </div>
                  {errors.paymentMethodId && <p className="text-xs text-red-500 ml-1">{errors.paymentMethodId.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Setor de Venda</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <select
                      {...register('sectorId')}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">Selecione o setor</option>
                      {sectors.map(sector => (
                        <option key={sector.id} value={sector.id}>{sector.name}</option>
                      ))}
                    </select>
                  </div>
                  {errors.sectorId && <p className="text-xs text-red-500 ml-1">{errors.sectorId.message}</p>}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-8 bg-neutral-900 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex justify-between text-xs font-bold text-neutral-400 uppercase tracking-widest">
                <span>Detalhamento de Valores</span>
                <span className="text-emerald-500">Cálculo Automático</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-neutral-300">
                  <span>Valor Bruto</span>
                  <span>R$ {rideValue.toFixed(2)}</span>
                </div>
                {calculateFees().feeAmount > 0 && (
                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Taxa de Cartão ({paymentMethods.find(m => m.id === selectedPaymentMethodId)?.feePercentage}%)</span>
                    <span className="text-red-400">- R$ {calculateFees().feeAmount.toFixed(2)}</span>
                  </div>
                )}
                {calculateFees().fixedFee > 0 && (
                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Taxa Administrativa</span>
                    <span className="text-red-400">- R$ {calculateFees().fixedFee.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Líquido Motorista</span>
                  <span className="text-2xl font-black text-emerald-400">R$ {calculateFees().netValue.toFixed(2)}</span>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Ticket size={20} />
                  Gerar Voucher e Finalizar
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Sidebar Section */}
      <div className="lg:col-span-4 flex flex-col gap-8">
        <AnimatePresence mode="wait">
          {successRide ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">Venda Realizada!</h2>
              <p className="text-neutral-500 text-center mb-8">O voucher foi gerado com sucesso e está pronto para impressão.</p>

              {/* Voucher Preview & Print Sections */}
              <div id="voucher-print" className="w-full space-y-8">
                {/* VIA BALCÃO */}
                <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-3 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                  <div className="w-full mb-4 text-center">
                    <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                    <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                    <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                  </div>
                  <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Balcão</span>
                    <span className="text-xs font-bold text-neutral-900">#{successRide.voucher.voucherNumber}</span>
                  </div>
                  <div className="w-full text-left space-y-1">
                    <p className="text-[10px] text-neutral-400 uppercase font-bold">Destino</p>
                    <p className="text-sm font-bold text-neutral-900 truncate">{successRide.ride.destination}</p>
                  </div>
                  <div className="w-full pt-2 border-t border-neutral-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-neutral-400">VALOR</span>
                    <span className="text-lg font-black text-neutral-900">R$ {successRide.ride.value.toFixed(2)}</span>
                  </div>
                </div>

                {/* VIA COOPERADO */}
                <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-3 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                  <div className="w-full mb-4 text-center">
                    <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                    <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                    <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                  </div>
                  <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Cooperado</span>
                    <span className="text-xs font-bold text-neutral-900">#{successRide.voucher.voucherNumber}</span>
                  </div>
                  <div className="w-full space-y-2 text-left text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Motorista:</span>
                      <span className="font-bold">
                        {(() => {
                          if (!successRide.ride.driverId) return 'NÃO INFORMADO';
                          const d = drivers.find(d => d.id === successRide.ride.driverId);
                          return d ? `U: ${d.unitNumber} - ${d.name}` : 'N/A';
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Passageiro:</span>
                      <span className="font-bold">{successRide.ride.passengerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Destino:</span>
                      <span className="font-bold truncate max-w-[180px]">{successRide.ride.destination}</span>
                    </div>
                  </div>
                  <div className="w-full pt-3 border-t border-neutral-200 space-y-1 text-xs">
                    <div className="flex justify-between text-neutral-500">
                      <span>Valor Bruto:</span>
                      <span>R$ {successRide.ride.value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>Desconto/Taxas:</span>
                      <span>- R$ {successRide.ride.feeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-emerald-600 text-sm pt-1 border-t border-neutral-100">
                      <span>LÍQUIDO:</span>
                      <span>R$ {successRide.ride.netValue.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-neutral-400 italic pt-2">
                    {format(successRide.ride.createdAt.toDate(), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>

                {/* VIA CLIENTE */}
                <div className="w-full max-w-sm mx-auto bg-neutral-50 p-6 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center text-center space-y-4 print:shadow-none print:bg-white print:border-neutral-300 print:p-2">
                  <div className="w-full mb-4 text-center">
                    <h1 className="text-sm font-black text-neutral-900 leading-tight">COOTRAMO – MG</h1>
                    <p className="text-[10px] font-bold text-neutral-600">CNPJ: 04.994.250/0001-45</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Rua Silvia Maria Rocha Baggio, 500</p>
                    <p className="text-[9px] text-neutral-500 leading-tight">Dist. Ind. Genesco Aparecido de Oliveira</p>
                    <p className="text-[9px] text-neutral-500 leading-tight font-bold">Lagoa Santa – MG</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-1">Aeroporto de Confins</p>
                  </div>
                  <div className="w-full flex justify-between items-center border-b border-neutral-200 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Via Cliente</span>
                    <span className="text-xs font-bold text-neutral-900">#{successRide.voucher.voucherNumber}</span>
                  </div>
                  
                  <div className="w-full text-center py-2">
                    <p className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Destino</p>
                    <p className="text-lg font-black text-neutral-900 leading-tight">{successRide.ride.destination}</p>
                  </div>

                  <div className="py-2">
                    <QRCodeSVG value={successRide.voucher.voucherNumber} size={80} level="H" />
                  </div>

                  <div className="w-full pt-4 border-t border-neutral-200">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Valor da Corrida</p>
                    <p className="text-4xl font-black text-emerald-600">R$ {successRide.ride.value.toFixed(2)}</p>
                  </div>

                  <p className="text-[9px] text-neutral-500 font-bold">
                    Horário da Venda: {format(successRide.ride.createdAt.toDate(), "HH:mm:ss")} - {format(successRide.ride.createdAt.toDate(), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full mt-8">
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all"
                >
                  <Printer size={18} />
                  Imprimir
                </button>
                <button
                  onClick={() => setSuccessRide(null)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Nova Venda
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
              <AlertCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Dica de Balcão</h3>
                <p className="text-emerald-800 text-[10px] leading-relaxed font-medium">
                  Sempre verifique a unidade do motorista para garantir o repasse correto ao permissionário.
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Quick Search / Recent */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex-1">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Pesquisa Rápida</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text" 
                placeholder="Nº Voucher..." 
                className="pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-emerald-500 w-32"
              />
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] text-neutral-400 text-center py-8 italic">Use a pesquisa para reimprimir vouchers ou consultar status.</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
          }
          body * {
            visibility: hidden;
          }
          #voucher-print, #voucher-print * {
            visibility: visible;
          }
          #voucher-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            border: none;
            background: white;
            display: flex;
            flex-direction: column;
            gap: 10mm;
            padding: 5mm;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:border-neutral-300 {
            border-color: #d4d4d4 !important;
            border-style: solid !important;
            border-width: 1px !important;
          }
          .print\\:p-2 {
            padding: 2mm !important;
          }
        }
      `}</style>
    </div>
  );
}
