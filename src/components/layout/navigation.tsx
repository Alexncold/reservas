import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Inicio', href: '/' },
  { name: 'Reservar', href: '/reservar' },
  { name: 'Admin', href: '/admin' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-6">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`${
              isActive
                ? 'text-primary-600 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            } transition-colors`}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
} 