import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="pt-24 min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="text-8xl font-black text-lime-500">404</div>
      <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
      <p className="text-gray-400 text-sm max-w-sm">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-6 py-2.5 rounded-md transition text-sm"
        >
          <Home size={16} /> Back Home
        </Link>
      </div>
    </div>
  )
}

