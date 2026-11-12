// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Booking from './Booking'

vi.mock('../hooks/useFacilities', async () => {
  const { FACILITIES } = await import('../config/site')
  return { useFacilities: () => ({ facilities: FACILITIES, loading: false, error: '' }) }
})
vi.mock('../lib/database', () => ({ fetchUnavailableSlots: vi.fn().mockResolvedValue([]) }))

function CheckoutPreview() {
  const location = useLocation()
  const bookingData = (location.state as { bookingData: { durationHours: number; totalPrice: number } }).bookingData
  return <div>Checkout duration: {bookingData.durationHours} hours; total {bookingData.totalPrice}</div>
}

describe('multi-hour booking flow', () => {
  beforeEach(() => localStorage.clear())

  it('carries a two-hour selection through the summary into checkout', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/booking']}>
        <Routes>
          <Route path="/booking" element={<Booking />} />
          <Route path="/checkout" element={<CheckoutPreview />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /Royal Cricket Ground/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    fireEvent.change(screen.getByLabelText('Booking Date'), { target: { value: '2026-11-14' } })
    const startTime = await screen.findByRole('button', { name: '10 AM' })
    await user.click(startTime)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.click(screen.getByRole('button', { name: /^2\s+Hours/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('2 hours')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Proceed to Checkout' }))
    await waitFor(() => {
      expect(screen.getByText(/Checkout duration: 2 hours/)).toBeTruthy()
      expect(screen.getByText(/total 4800/)).toBeTruthy()
    })
  })
})
