# Line Decorations: стрелки направления

## Что нового

В `FeatureDescriptor` добавлено опциональное поле `decorations` для декларативного описания визуальных декораций вдоль LineString-геометрий. Первый доступный тип декораций — **стрелки направления**.

Раньше для отображения стрелок вдоль маршрута нужно было вручную создавать отдельный слой, подписываться на события zoom/pan и пересчитывать стрелки при каждом изменении вида карты. Теперь это описывается декларативно прямо в дескрипторе слоя.

## API

### Новые типы

```typescript
type ArrowDecoration = {
  /** Расстояние между стрелками в метрах. Функция — для адаптации к масштабу. */
  interval: MaybeFn<number, [view: StyleView]>;

  /** Стиль стрелки. Получает rotation (радианы, по часовой от севера) и текущий вид карты. */
  style: (args: { rotation: number; view: StyleView }) => Style | Style[];

  /** Смещение первой стрелки от начала линии как доля интервала (0–1). По умолчанию: 0.5. */
  offsetRatio?: number;
};

type LineDecorations = {
  arrows?: ArrowDecoration;
};
```

### Использование

Добавьте `decorations` в `FeatureDescriptor` слоя с LineString-геометрией:

```typescript
{
  id: 'route-line',
  zIndex: 1,
  feature: {
    id: (m) => m.id,
    geometry: {
      fromModel: (m) => new LineString(m.coordinates),
      applyGeometryToModel: (prev) => prev,
    },
    style: {
      base: () => ({ color: '#2563eb', width: 4 }),
      render: (opts) => new Style({
        stroke: new Stroke({ color: opts.color, width: opts.width }),
      }),
    },
    decorations: {
      arrows: {
        // Адаптивный интервал: чем ближе зум, тем чаще стрелки
        interval: (view) => Math.max(100, view.resolution * 80),
        style: ({ rotation }) => new Style({
          image: new RegularShape({
            points: 3, radius: 6, rotation,
            fill: new Fill({ color: '#2563eb' }),
            stroke: new Stroke({ color: '#fff', width: 1 }),
          }),
        }),
      },
    },
  },
}
```

Никаких дополнительных слоёв, подписок на события или ручных обновлений. Библиотека автоматически:
- Создаёт внутренний слой для стрелок
- Пересчитывает стрелки при изменении масштаба, сдвиге карты и изменении моделей
- Синхронизирует видимость и прозрачность с родительским слоем
- Освобождает ресурсы при dispose

### Поддерживаемые геометрии

- `LineString` — стрелки размещаются вдоль линии
- `MultiLineString` — каждая суб-линия обрабатывается независимо
- Другие типы геометрий — поле `decorations` игнорируется

## Демо

Рабочий пример — демо **map-route-drag** (`projects/demo/src/app/map-route-drag/`) с маршрутизацией через OSRM и адаптивной плотностью стрелок в зависимости от масштаба.
