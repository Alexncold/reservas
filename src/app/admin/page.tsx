import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Panel de Administración</CardTitle>
            <CardDescription>
              Gestiona reservas, pagos y configuración del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center py-8">
              🚧 Panel de administración en desarrollo 🚧
            </p>
            <p className="text-sm text-gray-500 text-center">
              Esta funcionalidad estará disponible en prompts posteriores
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 