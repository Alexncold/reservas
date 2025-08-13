import mongoose, { Document, Schema } from 'mongoose';

interface ICliente {
  nombre: string;
  telefono: string;
  email?: string | null;
}

interface IPago {
  estado: string;
  mercadopago_id?: string | null;
  fecha_actualizacion?: Date;
  monto?: number | null;
  detalle?: {
    status?: string;
    status_detail?: string;
    payment_method_id?: string;
    payment_type_id?: string;
    transaction_amount?: number;
    installments?: number;
    total_paid_amount?: number;
  };
}

interface IEstadoHistorico {
  estado: string;
  fecha: Date;
  motivo: string;
}

export interface IReserva extends Document {
  fecha: Date;
  turno: string;
  mesa: number;
  clientes: ICliente;
  personas: number;
  juego?: string | null;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'expirada';
  pago?: IPago;
  historial_estados?: IEstadoHistorico[];
  notas?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClienteSchema = new Schema<ICliente>({
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, default: null },
});

const PagoSchema = new Schema<IPago>({
  estado: { type: String, required: true },
  mercadopago_id: { type: String, default: null },
  fecha_actualizacion: { type: Date, default: Date.now },
  monto: { type: Number, default: null },
  detalle: {
    status: String,
    status_detail: String,
    payment_method_id: String,
    payment_type_id: String,
    transaction_amount: Number,
    installments: Number,
    total_paid_amount: Number,
  },
});

const EstadoHistoricoSchema = new Schema<IEstadoHistorico>({
  estado: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  motivo: { type: String, required: true },
});

const ReservaSchema = new Schema<IReserva>(
  {
    fecha: { type: Date, required: true },
    turno: { type: String, required: true },
    mesa: { type: Number, required: true },
    clientes: { type: ClienteSchema, required: true },
    personas: { type: Number, required: true, min: 1 },
    juego: { type: String, default: null },
    estado: {
      type: String,
      enum: ['pendiente', 'confirmada', 'cancelada', 'expirada'],
      default: 'pendiente',
    },
    pago: { type: PagoSchema },
    historial_estados: { type: [EstadoHistoricoSchema], default: [] },
    notas: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
ReservaSchema.index({ fecha: 1, turno: 1, mesa: 1 });
ReservaSchema.index({ estado: 1 });
ReservaSchema.index({ 'pago.mercadopago_id': 1 }, { sparse: true });

// Export the model
const Reserva = mongoose.models.Reserva || mongoose.model<IReserva>('Reserva', ReservaSchema);
export default Reserva;
