import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReservaForm } from '@/components/reserva/ReservaForm'

export const metadata = {
  title: 'Reservar Mesa | GameHub',
  description: 'Reserva tu mesa en GameHub y disfruta de una experiencia única de juegos de mesa',
}

export default function ReservarPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-2">
          Reserva tu mesa
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Selecciona la fecha, turno y mesa para vivir una experiencia única de juegos de mesa
        </p>
      </div>
      
      <ReservaForm />
    </div>
  )
}