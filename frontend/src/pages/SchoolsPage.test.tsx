/// <reference types="vitest/globals" />
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SchoolsPage from '../pages/SchoolsPage'

const mockGetMe = vi.fn()
const mockGetSchools = vi.fn()
const mockGetPendingMembers = vi.fn()
const mockApprovePendingMember = vi.fn()
const mockRejectPendingMember = vi.fn()

vi.mock('../services/auth', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  getSchools: (...args: unknown[]) => mockGetSchools(...args),
  getPendingMembers: (...args: unknown[]) => mockGetPendingMembers(...args),
  approvePendingMember: (...args: unknown[]) => mockApprovePendingMember(...args),
  rejectPendingMember: (...args: unknown[]) => mockRejectPendingMember(...args),
}))

const mockUser: Parameters<typeof mockGetMe>[0] = {
  id: 1,
  email: 'admin@example.com',
  name: 'Admin',
  is_active: true,
  is_superuser: true,
  is_pending: false,
  school_id: 1,
  default_class_id: null,
  color_theme: 'teal',
  needs_koepel_selection: false,
  status_colors: null,
  membership_pending: false,
  pending_koepel: null,
  pending_school_id: null,
}

const mockSchools = [
  {
    id: 1,
    name: 'Demo School',
    slug: 'demo-school',
    is_active: true,
    created_at: null,
    address: null,
    postal_code: null,
    city: null,
    koepel: 'katholiek-onderwijs-vlaanderen',
    koepel_id: 3,
  },
]

const mockPendingMembers = [
  { id: 2, email: 'user1@example.com', name: 'User1', pending_koepel: 'katholiek-onderwijs-vlaanderen' },
  { id: 3, email: 'user2@example.com', name: 'User2', pending_koepel: 'katholiek-onderwijs-vlaanderen' },
  { id: 4, email: 'user3@example.com', name: 'User3', pending_koepel: 'katholiek-onderwijs-vlaanderen' },
]

beforeEach(() => {
  mockGetMe.mockClear()
  mockGetSchools.mockClear()
  mockGetPendingMembers.mockClear()
  mockApprovePendingMember.mockClear()
  mockRejectPendingMember.mockClear()

  mockGetMe.mockResolvedValue(mockUser)
  mockGetSchools.mockResolvedValue(mockSchools)
  mockGetPendingMembers.mockResolvedValue(mockPendingMembers)
  mockApprovePendingMember.mockResolvedValue({ id: 2, membership_pending: false, school_id: 1 })
  mockRejectPendingMember.mockResolvedValue({ id: 4, membership_pending: false, school_id: null })
})

describe('SchoolsPage pending members', () => {
  it('shows pending members section when a school is selected', async () => {
    render(<SchoolsPage />)

    await waitFor(() => expect(mockGetMe).toHaveBeenCalled())
    await waitFor(() => expect(mockGetSchools).toHaveBeenCalled())
    await waitFor(() => expect(mockGetPendingMembers).toHaveBeenCalledWith(1))

    expect(screen.getByText('Toegangsverzoeken')).toBeInTheDocument()
    expect(screen.getByText('3 verzoeken in behandeling')).toBeInTheDocument()
    expect(screen.getByText('User1')).toBeInTheDocument()
    expect(screen.getByText('user1@example.com')).toBeInTheDocument()
  })

  it('approves a pending member', async () => {
    const user = userEvent.setup()
    render(<SchoolsPage />)

    await waitFor(() => expect(mockGetPendingMembers).toHaveBeenCalledWith(1))

    const approveButtons = screen.getAllByRole('button', { name: 'Toelaten' })
    await act(async () => {
      await user.click(approveButtons[0])
    })

    expect(mockApprovePendingMember).toHaveBeenCalledWith(1, 2)
    await waitFor(() => expect(screen.queryByText('User1')).not.toBeInTheDocument())
    expect(screen.getByText('User2')).toBeInTheDocument()
    expect(screen.getByText('User3')).toBeInTheDocument()
  })

  it('rejects a pending member', async () => {
    const user = userEvent.setup()
    render(<SchoolsPage />)

    await waitFor(() => expect(mockGetPendingMembers).toHaveBeenCalledWith(1))

    const rejectButtons = screen.getAllByRole('button', { name: 'Afwijzen' })
    await act(async () => {
      await user.click(rejectButtons[2])
    })

    expect(mockRejectPendingMember).toHaveBeenCalledWith(1, 4)
    await waitFor(() => expect(screen.queryByText('User3')).not.toBeInTheDocument())
    expect(screen.getByText('User1')).toBeInTheDocument()
    expect(screen.getByText('User2')).toBeInTheDocument()
  })

  it('shows empty state when there are no pending members', async () => {
    mockGetPendingMembers.mockResolvedValue([])
    render(<SchoolsPage />)

    await waitFor(() => expect(mockGetPendingMembers).toHaveBeenCalledWith(1))
    expect(screen.getByText('Geen openstaande verzoeken')).toBeInTheDocument()
  })
})
