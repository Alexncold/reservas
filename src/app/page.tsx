import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, Users, Clock } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-4xl mx-auto">
        {/* Hero Section */}
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Reserva tu Mesa en
          <span className="text-primary-600 block">GameHub</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          El lugar perfecto para disfrutar de los mejores juegos de mesa. 
          Reserva tu turno de 2 horas fácil y rápido.
        </p>

        {/* CTA Button */}
        <Link href="/reservar">
          <Button size="lg" className="text-lg px-8 py-4 mb-16">
            Reservar Ahora
          </Button>
        </Link>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Reserva Online</h3>
            <p className="text-gray-600">
              Sistema simple y rápido para reservar tu mesa favorita
            </p>
          </div>
          
          <div className="text-center">
            <Users className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Hasta 6 Personas</h3>
            <p className="text-gray-600">
              Cada mesa acomoda cómodamente hasta 6 jugadores
            </p>
          </div>
          
          <div className="text-center">
            <Clock className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Turnos de 2 Horas</h3>
            <p className="text-gray-600">
              Tiempo perfecto para disfrutar de tus juegos favoritos
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-16 p-8 bg-gray-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Información de Turnos
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="font-semibold text-lg mb-2">Horarios</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 17:00 - 19:00</li>
                <li>• 19:00 - 21:00</li>
                <li>• 21:00 - 23:00</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Días</h3>
              <p className="text-gray-600">
                Jueves a Domingo
              </p>
              <p className="text-lg font-bold text-primary-600 mt-2">
                $3.000 por persona
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
