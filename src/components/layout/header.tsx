import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">GH</span>
            </div>
            <span className="text-xl font-bold text-gray-900">GameHub</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Inicio
            </Link>
            <Link href="/reservar" className="text-gray-600 hover:text-gray-900">
              Reservar
            </Link>
          </nav>

          {/* CTA Button */}
          <Link href="/reservar">
            <Button>Reservar Mesa</Button>
          </Link>
        </div>
      </div>
    </header>
  )
} 