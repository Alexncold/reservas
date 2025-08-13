import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, Mail, Phone, MapPin, Calendar, Users } from 'lucide-react'
import Link from 'next/link'

type Reserva = {
  id: string
  fecha: string
  turno: string
  mesa: number
  personas: number
  juego?: string
  cliente: {
    nombre: string
    email: string
    telefono: string
  }
  estado: 'pendiente_pago' | 'confirmada' | 'cancelada'
  pago?: {
    mercadopago_id: string
    monto: number
    estado: string
    fecha_pago: string
  }
  created_at: string
}

const TURNOS: Record<string, string> = {
  '17-19': '17:00 - 19:00',
  '19-21': '19:00 - 21:00',
  '21-23': '21:00 - 23:00',
}

export default async function ConfirmacionPage({
  params,
}: {
  params: { id: string }
}) {
  // En un entorno real, aquí harías una llamada a la API para obtener los detalles de la reserva
  // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservas/${params.id}`)
  // if (!response.ok) return notFound()
  // const reserva: Reserva = await response.json()

  // Datos de ejemplo para desarrollo
  const reserva: Reserva = {
    id: params.id,
    fecha: '2023-12-15',
    turno: '19-21',
    mesa: 3,
    personas: 4,
    juego: 'Catan',
    cliente: {
      nombre: 'Juan Pérez',
      email: 'juan@ejemplo.com',
      telefono: '91123456789',
    },
    estado: 'pendiente_pago',
    created_at: new Date().toISOString(),
  }

  const fechaFormateada = format(parseISO(reserva.fecha), "EEEE d 'de' MMMM", { locale: es })
  const turnoFormateado = TURNOS[reserva.turno] || reserva.turno

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-2">
          ¡Reserva realizada con éxito!
        </h1>
        <p className="text-lg text-muted-foreground">
          Hemos enviado los detalles a tu correo electrónico
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detalles de tu reserva</CardTitle>
            <CardDescription>Guarda esta información para presentarte en el local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Fecha y hora</h3>
                <p className="text-sm text-gray-500">
                  {fechaFormateada}, {turnoFormateado}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Mesa y personas</h3>
                <p className="text-sm text-gray-500">
                  Mesa {reserva.mesa} para {reserva.personas} {reserva.personas === 1 ? 'persona' : 'personas'}
                </p>
                {reserva.juego && (
                  <p className="text-sm text-gray-500 mt-1">
                    Juego solicitado: <span className="font-medium">{reserva.juego}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Ubicación</h3>
                <p className="text-sm text-gray-500">
                  Av. Corrientes 1234, CABA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Llegá 10 minutos antes de tu turno
                </p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <Clock className="h-4 w-4" />
                <span>Tu mesa estará reservada por 2 horas</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado de tu reserva</CardTitle>
              <CardDescription>
                {reserva.estado === 'pendiente_pago' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pendiente de pago
                  </span>
                )}
                {reserva.estado === 'confirmada' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Confirmada
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reserva.estado === 'pendiente_pago' && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Clock className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          Tu reserva está pendiente de pago. Tienes 15 minutos para completar el pago o la reserva se cancelará automáticamente.
                        </p>
                        <Link href={`/pagar/${reserva.id}`}>
                          <Button className="mt-2">
                            Completar pago
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">Número de reserva</h3>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded-md">
                    {reserva.id.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Muestra este número al llegar al local
                  </p>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">¿Necesitas ayuda?</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href="mailto:reservas@gamehub.com" className="text-sm text-blue-600 hover:underline">
                        reservas@gamehub.com
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href="tel:+541112345678" className="text-sm text-blue-600 hover:underline">
                        +54 11 1234-5678
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>¿Qué sigue?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">1</span>
                  <span>Recibirás un correo de confirmación con los detalles de tu reserva.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">2</span>
                  <span>Llega 10 minutos antes de tu turno para asegurar tu mesa.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">3</span>
                  <span>Muestra tu número de reserva al llegar.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link href="/">
          <Button variant="outline" className="mr-4">
            Volver al inicio
          </Button>
        </Link>
        <Link href="/reservar">
          <Button>
            Hacer otra reserva
          </Button>
        </Link>
      </div>
    </div>
  )
}
