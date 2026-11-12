import { Facility, Sport } from '../types'

// ─────────────────────────────────────────────
// BRAND / BUSINESS CONFIGURATION
// Change these values to customise for any turf
// ─────────────────────────────────────────────
export const SITE = {
  name: 'ARENA X',
  tagline: 'Play · Book · Enjoy',
  logo: '/favicon.svg',
  primaryColor: '#a4ff00',
  bgColor: '#111111',

  contact: {
    phone: '+91 98765 43210',
    whatsapp: '+91 98765 43210',
    email: 'info@arenax.in',
    address: '123 Sports Avenue, Green Valley, Bengaluru, Karnataka – 560001',
    mapLink: 'https://maps.google.com/?q=Bengaluru,Karnataka',
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d497698.9974143279!2d77.35073153979202!3d12.954517007741834!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae1670c9b44e6d%3A0xf8dfc3e8517e4fe0!2sBengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1699999999999',
  },

  openingHours: {
    weekday: { open: '06:00', close: '23:00', label: 'Mon–Fri' },
    weekend: { open: '05:00', close: '23:00', label: 'Sat–Sun' },
  },

  pricing: {
    peakHoursStart: 18,  // 6 PM
    peakHoursEnd: 22,    // 10 PM
    advancePercent: 30,
    weekendMultiplier: 1.2,
  },

  social: {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    twitter: 'https://twitter.com',
    youtube: 'https://youtube.com',
  },

  stats: [
    { label: 'Happy Players', value: '12,000+' },
    { label: 'Bookings Monthly', value: '500+' },
    { label: 'Premium Courts', value: '8' },
    { label: 'Years of Excellence', value: '5+' },
  ],
}

// ─────────────────────────────────────────────
// SPORTS CATEGORIES
// ─────────────────────────────────────────────
export const SPORTS: Sport[] = [
  {
    id: 'cricket',
    name: 'Cricket Turf',
    icon: '🏏',
    description: 'Professional cricket pitches with floodlights and practice nets',
  },
  {
    id: 'box-cricket',
    name: 'Box Cricket',
    icon: '🏟️',
    description: 'Fast-paced box cricket arenas for quick matches',
  },
  {
    id: 'football',
    name: 'Football Turf',
    icon: '⚽',
    description: 'FIFA-standard artificial turf with LED lighting',
  },
  {
    id: 'badminton',
    name: 'Badminton Court',
    icon: '🏸',
    description: 'Indoor synthetic courts with professional nets',
  },
  {
    id: 'multi-sport',
    name: 'Multi-Sport',
    icon: '🏆',
    description: 'Versatile arenas for multiple sports activities',
  },
]

// ─────────────────────────────────────────────
// FACILITIES  (images use Unsplash CDN – no key needed)
// ─────────────────────────────────────────────
export const FACILITIES: Facility[] = [
  {
    id: '1',
    name: 'Royal Cricket Ground',
    category: 'cricket',
    description:
      'Our flagship cricket ground features a full-size pitch with professional-grade grass, floodlit for evening matches. Perfect for practice sessions, club matches, and corporate cricket events.',
    pricePerHour: 2000,
    peakPricePerHour: 3000,
    images: [
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
      'https://images.unsplash.com/photo-1593766788306-28561086694e?w=800&q=80',
    ],
    amenities: ['Floodlights', 'Practice Nets', 'Pavilion', 'Parking', 'Drinking Water', 'Changing Room'],
    rating: 4.8,
    reviewCount: 124,
    location: 'Block A, Green Valley Sports Complex',
    sports: ['Cricket'],
  },
  {
    id: '2',
    name: 'Urban Box Cricket Arena',
    category: 'box-cricket',
    description:
      'High-energy box cricket in an enclosed arena with artificial turf, side nets, and LED scoreboards. Ideal for quick tournaments and team outings.',
    pricePerHour: 1200,
    peakPricePerHour: 1800,
    images: [
      'https://images.unsplash.com/photo-1593766788306-28561086694e?w=800&q=80',
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
    ],
    amenities: ['LED Lighting', 'Side Nets', 'Scoreboard', 'Parking', 'Refreshments'],
    rating: 4.6,
    reviewCount: 89,
    location: 'Block B, Green Valley Sports Complex',
    sports: ['Box Cricket'],
  },
  {
    id: '3',
    name: 'Elite Football Turf',
    category: 'football',
    description:
      'Premium 5-a-side and 7-a-side football pitches with FIFA-approved synthetic grass, boundary walls, and high-intensity LED floodlights.',
    pricePerHour: 1800,
    peakPricePerHour: 2700,
    images: [
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
    ],
    amenities: ['FIFA Turf', 'Boundary Walls', 'Floodlights', 'Goalpost', 'Parking', 'Changing Room'],
    rating: 4.9,
    reviewCount: 203,
    location: 'Block C, Green Valley Sports Complex',
    sports: ['Football', 'Futsal'],
  },
  {
    id: '4',
    name: 'City Badminton Courts',
    category: 'badminton',
    description:
      'Air-conditioned indoor badminton courts with BWF-approved flooring, professional lighting, and equipment rental available on-site.',
    pricePerHour: 600,
    peakPricePerHour: 900,
    images: [
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
    ],
    amenities: ['Air Conditioned', 'BWF Flooring', 'Racket Rental', 'Shuttle', 'Locker Room'],
    rating: 4.7,
    reviewCount: 156,
    location: 'Block D, Green Valley Sports Complex',
    sports: ['Badminton'],
  },
  {
    id: '5',
    name: 'Flexi Multi-Sport Arena',
    category: 'multi-sport',
    description:
      'Our largest venue is a convertible multi-purpose arena that can host basketball, volleyball, futsal, throwball, and more. Perfect for school sports days and corporate events.',
    pricePerHour: 3000,
    peakPricePerHour: 4500,
    images: [
      'https://images.unsplash.com/photo-1546519638405-a9d1b5f2a5b6?w=800&q=80',
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
    ],
    amenities: ['Convertible Layout', 'Bleachers', 'Sound System', 'Projector', 'Parking', 'Cafeteria'],
    rating: 4.9,
    reviewCount: 78,
    location: 'Block E, Green Valley Sports Complex',
    sports: ['Basketball', 'Volleyball', 'Futsal', 'Throwball'],
  },
]

export const TESTIMONIALS = [
  {
    id: 1,
    name: 'Rahul Sharma',
    sport: 'Cricket',
    rating: 5,
    comment: 'Amazing facility! The pitch quality is excellent and the floodlights are top-notch. Booking was super easy online.',
    avatar: 'RS',
  },
  {
    id: 2,
    name: 'Priya Nair',
    sport: 'Badminton',
    rating: 5,
    comment: 'Best badminton courts in Bangalore. AC is perfect, floors are well-maintained. Will definitely book again!',
    avatar: 'PN',
  },
  {
    id: 3,
    name: 'Arjun Patel',
    sport: 'Football',
    rating: 4,
    comment: 'Great football turf with premium artificial grass. Night sessions under floodlights are absolutely amazing.',
    avatar: 'AP',
  },
  {
    id: 4,
    name: 'Anjali Verma',
    sport: 'Box Cricket',
    rating: 5,
    comment: 'Organised our entire office team outing here. The box cricket arena was fantastic, staff was very helpful.',
    avatar: 'AV',
  },
]

export const WHY_CHOOSE = [
  {
    icon: '🛡️',
    title: 'Safe & Secure',
    description: 'CCTV-monitored premises with 24/7 security personnel.',
  },
  {
    icon: '✨',
    title: 'Premium Surfaces',
    description: 'World-class turf maintained daily by certified groundskeepers.',
  },
  {
    icon: '📱',
    title: 'Instant Booking',
    description: 'Book your slot in under 2 minutes from your phone.',
  },
  {
    icon: '💳',
    title: 'Flexible Payment',
    description: 'Pay 30% advance online and the rest at the venue.',
  },
  {
    icon: '🕐',
    title: '17 Hours Open',
    description: 'Open from 6 AM to 11 PM every day, including holidays.',
  },
  {
    icon: '🎯',
    title: '24/7 Support',
    description: 'WhatsApp and phone support always available for queries.',
  },
]

