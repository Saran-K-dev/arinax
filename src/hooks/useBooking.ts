import { useState } from 'react';
import { Facility, SavedBooking, Slot, SlotStatus } from '@/types';
import { getSlots, setSlots } from '@/utils/storage';
import {
  calcBookingTotal,
  generateBookingId,
  generateTimeSlots,
  getBookedTimesForDate,
  getMaxBookableDuration,
  getOperatingHours,
  saveBooking,
} from '@/utils/helpers';

export const useBooking = () => {
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [date, setDate] = useState<string>(''); // YYYY-MM-DD
  const [duration, setDuration] = useState<number>(1);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState<SavedBooking | null>(null);

  // Generate slots for a facility on a given date, merging persisted data.
  const generateSlots = (facility: Facility, dateStr: string): Slot[] => {
    const defaultSlots = generateTimeSlots([], dateStr);
    const persisted = getSlots(facility.id, dateStr);
    const map = new Map<string, SlotStatus>(persisted.map((slot) => [slot.time, slot.status]));
    return defaultSlots.map((slot) => ({
      ...slot,
      status: map.get(slot.time) ?? slot.status,
    }));
  };

  // When a booking is confirmed we mark the selected slot as booked
  const confirmBooking = (customer: {
    name: string;
    phone: string;
    email: string;
  }) => {
    if (!selectedFacility || !date || !selectedSlot) return;
    const maxDuration = getMaxBookableDuration(
      selectedSlot.time,
      getBookedTimesForDate(selectedFacility.id, date),
      getOperatingHours(date).close,
    );
    if (duration > maxDuration) return;
    const pricing = calcBookingTotal(
      selectedFacility.pricePerHour,
      selectedFacility.peakPricePerHour,
      selectedSlot.time,
      duration,
      date,
      selectedFacility.id,
    );
    const totalPrice = pricing.total;
    const advance = pricing.advance;

    const newBooking = {
      id: generateBookingId(),
      facilityId: selectedFacility.id,
      facilityName: selectedFacility.name,
      date,
      startTime: selectedSlot.time,
      durationHours: duration,
      totalPrice,
      advance,
      balance: totalPrice - advance,
      isPeak: pricing.isPeak,
      hourlyRate: pricing.hourlyRate,
      hourlyRates: pricing.hourlyRates,
      customer,
      status: 'confirmed' as const,
      createdAt: new Date().toISOString(),
      paymentMode: 'advance' as const,
    };
    setBooking(newBooking);
    saveBooking(newBooking);

    const occupiedTimes = new Set(
      Array.from({ length: duration }, (_, hour) => {
        const slotHour = Number(selectedSlot.time.split(':')[0]) + hour;
        return `${String(slotHour).padStart(2, '0')}:00`;
      }),
    );
    const updated: Slot[] = generateSlots(selectedFacility, date).map((slot) =>
      occupiedTimes.has(slot.time) ? { ...slot, status: 'booked' } : slot,
    );
    setSlots(selectedFacility.id, date, updated);
  };

  return {
    selectedFacility,
    setSelectedFacility,
    date,
    setDate,
    duration,
    setDuration,
    selectedSlot,
    setSelectedSlot,
    generateSlots,
    confirmBooking,
    booking
  };
};

