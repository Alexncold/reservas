# Estrategia de Pruebas GameHub

## Tipos de Pruebas

### 1. Pruebas Unitarias
- **Cobertura objetivo**: 80%+ (crítico: 90%+)
- **Ejemplos**: Funciones de utilidad, lógica de negocio, validadores
- **Herramientas**: Jest, ts-jest, @testing-library/react

### 2. Pruebas de Integración
- **Enfoque**: API endpoints, conexión a BD
- **Herramientas**: Supertest, mongo-memory-server

### 3. Pruebas E2E
- **Escenarios clave**: Flujo de reserva, pagos, notificaciones
- **Herramientas**: Playwright, Cypress

## Ejecución

```bash
# Instalar dependencias
yarn install

# Todas las pruebas
yarn test

# Con cobertura
yarn test:coverage

# Pruebas E2E
yarn test:e2e
```

## Ejemplo de Prueba

```typescript
// src/utils/dateUtils.test.ts
import { formatReservationDate } from './dateUtils';

describe('dateUtils', () => {
  test('formats date correctly', () => {
    const date = new Date('2025-08-15T14:00:00-03:00');
    expect(formatReservationDate(date)).toBe('15/08/2025 14:00');
  });
});
```

## Cobertura Mínima

| Tipo | Cobertura |
|------|-----------|
| Funciones | 80% |
| Líneas | 80% |
| Ramas | 75% |

## CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:6.0
        ports: ['27017:27017']
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18.x' }
      - run: yarn install --frozen-lockfile
      - run: yarn test:ci
```

## Mejores Prácticas

1. **Nombrado**: `describe('método', () => { test('debería hacer X cuando Y') })`
2. **Aislamiento**: Cada prueba debe ser independiente
3. **Fixtures**: Usar factories para datos de prueba
4. **Mocks**: Mockear servicios externos
5. **Limpieza**: Limpiar datos después de cada prueba
