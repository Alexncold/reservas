import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReservarPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Reservar Mesa</CardTitle>
            <CardDescription>
              Selecciona tu fecha, turno y mesa para hacer tu reserva
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-8">
              🚧 Sistema de reservas en desarrollo 🚧
            </p>
            <p className="text-sm text-gray-500 text-center">
              Esta funcionalidad estará disponible en el próximo prompt
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 