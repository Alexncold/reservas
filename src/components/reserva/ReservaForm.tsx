'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createReservaSchema } from '@/lib/schemas'
import { format, addDays, isWeekend, isBefore, isAfter } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'

type FormData = z.infer<typeof createReservaSchema>

const TURNOS = [
  { value: '17-19', label: '17:00 - 19:00' },
  { value: '19-21', label: '19:00 - 21:00' },
  { value: '21-23', label: '21:00 - 23:00' },
]

const MESAS = [1, 2, 3, 4, 5, 6, 7, 8]

const isDateDisabled = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = addDays(today, 30)
  return isBefore(date, today) || isAfter(date, maxDate) || isWeekend(date)
}

export function ReservaForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const today = new Date()
    if (isWeekend(today)) {
      const daysToAdd = today.getDay() === 0 ? 1 : 8 - today.getDay()
      return addDays(today, daysToAdd)
    }
    return today
  })
  const [availableTables, setAvailableTables] = useState<number[]>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(createReservaSchema),
    defaultValues: {
      fecha: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
      turno: '',
      mesa: undefined,
      personas: 2,
      juego: '',
      cliente: {
        nombre: '',
        email: '',
        telefono: '',
      },
    },
  })

  const selectedTurno = form.watch('turno')
  const selectedMesa = form.watch('mesa')

  useEffect(() => {
    const fecha = form.getValues('fecha')
    const turno = form.getValues('turno')

    if (fecha && turno) {
      checkAvailability(fecha, turno)
    } else {
      setAvailableTables([])
    }
  }, [form.watch('fecha'), form.watch('turno')])

  const checkAvailability = async (fecha: string, turno: string) => {
    setIsCheckingAvailability(true)
    try {
      const response = await fetch(`/api/reservas/availability?fecha=${fecha}&turno=${turno}`)
      if (!response.ok) throw new Error('Error al verificar disponibilidad')
      const data = await response.json()
      setAvailableTables(data.data.availability.availableTables)
    } catch (error) {
      console.error('Error checking availability:', error)
      toast({
        title: 'Error',
        description: 'No se pudo verificar la disponibilidad. Por favor, intente nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/reservas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al procesar la reserva')
      router.push(`/reserva/confirmacion/${result.data.reserva.id}`)
    } catch (error: any) {
      console.error('Error creating reservation:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al procesar tu reserva',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      form.setValue('fecha', format(date, 'yyyy-MM-dd'))
      form.setValue('turno', '')
      form.setValue('mesa', undefined)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Selecciona fecha y turno</CardTitle>
          <CardDescription>Elige cuándo quieres venir a jugar</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <FormLabel>Fecha</FormLabel>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={isDateDisabled}
                  locale={es}
                  className="rounded-md border p-3"
                  fromDate={new Date()}
                  toDate={addDays(new Date(), 30)}
                  initialFocus
                />
                <FormDescription className="text-xs">
                  * No atendemos los fines de semana
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="turno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turno</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        form.setValue('mesa', undefined)
                      }}
                      value={field.value}
                      disabled={!form.getValues('fecha')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un turno" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TURNOS.map((turno) => (
                          <SelectItem key={turno.value} value={turno.value}>
                            {turno.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mesa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mesa</FormLabel>
                    {isCheckingAvailability ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verificando disponibilidad...</span>
                      </div>
                    ) : availableTables.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {MESAS.map((mesa) => (
                          <Button
                            key={mesa}
                            type="button"
                            variant={field.value === mesa ? 'default' : 'outline'}
                            className={`h-12 w-full ${
                              !availableTables.includes(mesa) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            onClick={() => field.onChange(mesa)}
                            disabled={!availableTables.includes(mesa)}
                          >
                            {mesa}
                            {!availableTables.includes(mesa) && (
                              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
                            )}
                          </Button>
                        ))}
                      </div>
                    ) : selectedTurno ? (
                      <div className="text-sm text-yellow-600">
                        No hay mesas disponibles para este turno. Por favor, selecciona otro horario.
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Selecciona una fecha y turno para ver las mesas disponibles.
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de personas</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el número de personas" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'persona' : 'personas'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="juego"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Juego (opcional)</FormLabel>
                    <Input
                      placeholder="¿Tienes algún juego en mente?"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormDescription>
                      Si tienes algún juego en particular que te gustaría jugar, indícalo aquí.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Tus datos</h3>

                <FormField
                  control={form.control}
                  name="cliente.nombre"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Nombre completo</FormLabel>
                      <Input placeholder="Tu nombre" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cliente.email"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Email</FormLabel>
                      <Input type="email" placeholder="tu@email.com" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cliente.telefono"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Teléfono</FormLabel>
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm h-10">
                          +54
                        </span>
                        <Input
                          type="tel"
                          placeholder="91123456789"
                          className="rounded-l-none"
                          {...field}
                        />
                      </div>
                      <FormDescription className="text-xs">
                        Incluí el código de área sin el 0. Ej: 91123456789
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar reserva'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumen de tu reserva</CardTitle>
            <CardDescription>Revisá los detalles antes de confirmar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Fecha y hora</h4>
              <p className="text-sm text-muted-foreground">
                {selectedDate && selectedTurno ? (
                  <>
                    {format(selectedDate, 'EEEE d \'de\' MMMM', { locale: es })}, {
                      TURNOS.find((t) => t.value === selectedTurno)?.label
                    }
                  </>
                ) : (
                  'Selecciona una fecha y turno'
                )}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Mesa</h4>
              <p className="text-sm text-muted-foreground">
                {selectedMesa ? `Mesa ${selectedMesa}` : 'Selecciona una mesa'}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Personas</h4>
              <p className="text-sm text-muted-foreground">
                {form.watch('personas')} {form.watch('personas') === 1 ? 'persona' : 'personas'}
              </p>
            </div>

            {form.watch('juego') && (
              <div className="space-y-2">
                <h4 className="font-medium">Juego seleccionado</h4>
                <p className="text-sm text-muted-foreground">{form.watch('juego')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Políticas de reserva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-2">
              <li>La reserva se confirma con el pago del 50% del total.</li>
              <li>El resto se abona al momento de la reserva.</li>
              <li>Se puede cancelar hasta 24 horas antes sin cargo.</li>
              <li>En caso de no presentarse, se cobrará el 100% del total.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
