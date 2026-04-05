# Line Decorations: буферный полигон (коридор)

## Что нового

В `LineDecorations` добавлен новый тип декорации — **buffer**. Позволяет декларативно отображать буферную зону (коридор) заданной ширины вокруг LineString-геометрии.

Раньше для визуализации коридора вдоль маршрута нужно было вручную вычислять offset-кривые, создавать полигональный слой и синхронизировать его с исходной линией при drag/editing. Теперь это описывается одним полем в дескрипторе.

## API

### Новый тип

```typescript
type BufferDecoration = {
  /** Ширина буфера в метрах (в одну сторону — полная ширина = distance * 2). */
  distance: number;

  /** Стиль буферного полигона (OL Style). */
  style: Style | Style[];

  /** Форма торцов. По умолчанию: 'round'. */
  cap?: 'round' | 'flat';
};
```

### Расширенный `LineDecorations`

```typescript
type LineDecorations = {
  arrows?: ArrowDecoration;
  buffer?: BufferDecoration;
};
```

### Использование

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
      buffer: {
        distance: 500, // 500м в каждую сторону = коридор 1000м
        style: new Style({
          fill: new Fill({ color: 'rgba(37, 99, 235, 0.15)' }),
          stroke: new Stroke({ color: '#2563eb', width: 1 }),
        }),
        cap: 'round',
      },
      // Стрелки и буфер можно комбинировать
      arrows: {
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

Библиотека автоматически:
- Создаёт внутренний полигональный слой ниже родительской линии
- Строит буферный полигон с offset-кривыми и посегментной коррекцией по широте
- Обрабатывает углы (miter/bevel) и торцы (round/flat)
- Пересчитывает буфер при изменении геометрии (drag, editing)
- Синхронизирует видимость и прозрачность с родительским слоем
- Освобождает ресурсы при dispose

### Z-index стек (снизу вверх)

При использовании обоих типов декораций слои располагаются в порядке:

```
buffer  (zIndex: parentZIndex)      — буферный полигон
parent  (zIndex: parentZIndex + 1)  — линия
arrows  (zIndex: parentZIndex + 3)  — стрелки направления
```

### Поддерживаемые геометрии

- `LineString` — один буферный полигон
- `MultiLineString` — по одному полигону на каждую суб-линию
- Другие типы геометрий — поле `buffer` игнорируется

### Точность

Ширина буфера пересчитывается из метров в единицы проекции EPSG:3857 посегментно с учётом широты. Погрешность для маршрутов в пределах города < 0.5%, для региональных маршрутов ~1–2%.

## Демо

Рабочий пример — демо **map-line-buffer** (`projects/demo/src/app/map-line-buffer/`) с управлением шириной буфера, прозрачностью и формой торцов через слайдеры.
