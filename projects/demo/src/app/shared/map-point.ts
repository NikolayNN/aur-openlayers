import Point from 'ol/geom/Point';
import {fromLonLat, toLonLat} from 'ol/proj';

export class MapPoint {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly lat: number,
    public readonly lng: number,
    public readonly district = '',
    public readonly address = '',
    public readonly details = '',
    public readonly status = '',
    public readonly schedule = '',
  ) {}
}

const DEFAULT_POINTS: MapPoint[] = [
  new MapPoint(
    'minsk-center',
    'Площадь Победы',
    53.9097,
    27.5678,
    'Центральный район',
    'пр-т Независимости, 40',
    'Памятник и мемориальный комплекс в центре города.',
    'Статус: достопримечательность',
    'Работает круглосуточно',
  ),
  new MapPoint(
    'minsk-library',
    'Национальная библиотека',
    53.9314,
    27.6434,
    'Первомайский район',
    'пр-т Независимости, 116',
    'Главная библиотека страны с обзорной площадкой.',
    'Статус: культурный объект',
    'Открыта с 10:00 до 21:00',
  ),
  new MapPoint(
    'minsk-arena',
    'Минск-Арена',
    53.9362,
    27.4786,
    'Фрунзенский район',
    'пр-т Победителей, 111',
    'Крупный спортивно-развлекательный комплекс.',
    'Статус: спортивный объект',
    'Расписание зависит от мероприятий',
  ),
  new MapPoint(
    'minsk-tractors',
    'Тракторный завод',
    53.8759,
    27.6204,
    'Партизанский район',
    'ул. Долгобродская, 29',
    'Промышленный гигант и один из символов города.',
    'Статус: промышленный объект',
    'Экскурсии по записи',
  ),
  new MapPoint(
    'minsk-station',
    'ЖД вокзал',
    53.893,
    27.5514,
    'Октябрьский район',
    'ул. Кирова, 2',
    'Главный железнодорожный узел города.',
    'Статус: транспортный объект',
    'Работает круглосуточно',
  ),
  new MapPoint(
    'minsk-island',
    'Остров слёз',
    53.9099,
    27.5559,
    'Центральный район',
    'Троицкая набережная',
    'Мемориал в честь погибших воинов-интернационалистов.',
    'Статус: мемориал',
    'Открыт для посещения',
  ),
  new MapPoint(
    'minsk-park',
    'Парк Горького',
    53.9145,
    27.5789,
    'Ленинский район',
    'ул. Фрунзе, 2',
    'Городской парк с аттракционами и набережной.',
    'Статус: зона отдыха',
    'Открыт ежедневно',
  ),
  new MapPoint(
    'minsk-zoo',
    'Минский зоопарк',
    53.8582,
    27.6763,
    'Заводской район',
    'ул. Ташкентская, 40',
    'Крупный зоопарк с разнообразными экспозициями.',
    'Статус: семейный объект',
    'Открыт с 10:00 до 20:00',
  ),
  new MapPoint(
    'minsk-dynamo',
    'Стадион Динамо',
    53.8964,
    27.5612,
    'Ленинский район',
    'ул. Кирова, 8/7',
    'Спортивный комплекс в центре города.',
    'Статус: спортивный объект',
    'По расписанию мероприятий',
  ),
  new MapPoint(
    'minsk-lake',
    'Комсомольское озеро',
    53.9297,
    27.4991,
    'Фрунзенский район',
    'пр-т Победителей, 44',
    'Популярная зона отдыха у воды.',
    'Статус: зона отдыха',
    'Открыт ежедневно',
  ),
  new MapPoint('minsk-airport', 'Аэропорт Минск-1', 53.8722, 27.561),
  new MapPoint('minsk-botanical', 'Ботанический сад', 53.9244, 27.6172),
  new MapPoint('minsk-komarovka', 'Комаровский рынок', 53.9142, 27.5808),
  new MapPoint('minsk-svisloch', 'Набережная Свислочи', 53.9122, 27.5535),
  new MapPoint('minsk-chizhovka', 'Чижовка-Арена', 53.8434, 27.6789),
  new MapPoint('minsk-museum', 'Национальный художественный музей', 53.9021, 27.5615),
  new MapPoint('minsk-theatre', 'Большой театр', 53.9133, 27.5713),
  new MapPoint('minsk-kgb', 'Музей истории', 53.9044, 27.5501),
  new MapPoint('minsk-trinity', 'Троицкое предместье', 53.9112, 27.5568),
  new MapPoint('minsk-parkstone', 'Парк Челюскинцев', 53.9226, 27.6138),
];

export class MapPointGenerator {
  private readonly points: MapPoint[];

  constructor(points: MapPoint[] = DEFAULT_POINTS) {
    this.points = points;
  }

  getByCount(count: number): MapPoint[] {
    const safeCount = Math.max(0, Math.min(count, this.points.length));
    return this.points.slice(0, safeCount);
  }

  getByIds(ids: readonly string[]): MapPoint[] {
    const pointMap = new Map(this.points.map((point) => [point.id, point]));
    return ids
      .map((id) => pointMap.get(id))
      .filter((point): point is MapPoint => Boolean(point));
  }
}

export const mapPointToGeometry = (model: MapPoint): Point =>
  new Point(fromLonLat([model.lng, model.lat]));

export const applyGeometryToMapPoint = (prev: MapPoint, geom: unknown): MapPoint => {
  if (!(geom instanceof Point)) return prev;
  const [lng, lat] = toLonLat(geom.getCoordinates());
  return new MapPoint(
    prev.id,
    prev.name,
    lat,
    lng,
    prev.district,
    prev.address,
    prev.details,
    prev.status,
    prev.schedule,
  );
};
